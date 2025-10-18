package services

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"transcube-webapp/internal/types"
)

type TaskManager struct {
	mu      sync.RWMutex
	tasks   map[string]*types.Task
	storage *Storage
}

func NewTaskManager(storage *Storage) *TaskManager {
	return &TaskManager{
		tasks:   make(map[string]*types.Task),
		storage: storage,
	}
}

// CreateTask creates a new task and tracks it in memory
func (tm *TaskManager) CreateTask(url string, sourceLang string) (*types.Task, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	for _, existing := range tm.tasks {
		if existing.URL == url && tm.isTaskRunning(existing.Status) {
			return nil, fmt.Errorf("a task is already running for this url: %s", url)
		}
	}

	task := &types.Task{
		ID:         uuid.New().String(),
		URL:        url,
		SourceLang: sourceLang,
		Status:     types.TaskStatusPending,
		Progress:   0,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	tm.tasks[task.ID] = task
	return cloneTask(task), nil
}

// UpsertTask loads an existing task into memory or replaces the existing copy
func (tm *TaskManager) UpsertTask(task *types.Task) (*types.Task, error) {
	if task == nil {
		return nil, fmt.Errorf("task is nil")
	}
	if task.ID == "" {
		return nil, fmt.Errorf("task ID is required")
	}

	tm.mu.Lock()
	defer tm.mu.Unlock()

	copy := cloneTask(task)
	tm.tasks[copy.ID] = copy
	return cloneTask(copy), nil
}

// GetTask returns a copy of the task with the given ID
func (tm *TaskManager) GetTask(taskID string) (*types.Task, error) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	task, ok := tm.tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("task %s not found", taskID)
	}

	return cloneTask(task), nil
}

// ListTasks returns copies of all tracked tasks
func (tm *TaskManager) ListTasks() []*types.Task {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	result := make([]*types.Task, 0, len(tm.tasks))
	for _, task := range tm.tasks {
		result = append(result, cloneTask(task))
	}
	return result
}

// UpdateTaskStatus updates the status and progress for the given task
func (tm *TaskManager) UpdateTaskStatus(taskID string, status types.TaskStatus, progress int) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, ok := tm.tasks[taskID]
	if !ok {
		return fmt.Errorf("task %s not found", taskID)
	}

	task.Status = status
	task.Progress = progress
	task.UpdatedAt = time.Now()

	if status == types.TaskStatusDone || status == types.TaskStatusFailed {
		now := time.Now()
		task.CompletedAt = &now
		go tm.scheduleCleanup(taskID)
	}

	if task.WorkDir != "" {
		return tm.storage.SaveMetadata(task)
	}

	return nil
}

// BeginStage transitions the task into a new processing stage if the current
// status is one of the allowed states. It is used to guard manual operations
// from running concurrently or out of order.
func (tm *TaskManager) BeginStage(taskID string, stage types.TaskStatus, progress int, allowedStatuses ...types.TaskStatus) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, ok := tm.tasks[taskID]
	if !ok {
		return fmt.Errorf("task %s not found", taskID)
	}

	isAllowed := false
	for _, allowed := range allowedStatuses {
		if task.Status == allowed {
			isAllowed = true
			break
		}
	}

	if !isAllowed {
		return fmt.Errorf("cannot start %s stage while task is %s", stage, task.Status)
	}

	task.Status = stage
	task.Progress = progress
	task.Error = ""
	task.CompletedAt = nil
	task.UpdatedAt = time.Now()

	if task.WorkDir != "" {
		if err := tm.storage.SaveMetadata(task); err != nil {
			return fmt.Errorf("failed to persist task metadata: %w", err)
		}
	}

	return nil
}

// UpdateTaskMetadata updates the metadata for the given task
func (tm *TaskManager) UpdateTaskMetadata(taskID, videoID, title, channel, duration, thumbnail string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, ok := tm.tasks[taskID]
	if !ok {
		return fmt.Errorf("task %s not found", taskID)
	}

	task.VideoID = videoID
	task.Title = title
	task.Channel = channel
	task.Duration = duration
	task.Thumbnail = thumbnail
	task.UpdatedAt = time.Now()

	if task.WorkDir == "" {
		task.WorkDir = tm.storage.GetTaskDir(title, videoID, task.ID)
	}

	return nil
}

// UpdateTaskSourceLang updates the source language for a task
func (tm *TaskManager) UpdateTaskSourceLang(taskID string, sourceLang string) (*types.Task, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, ok := tm.tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("task %s not found", taskID)
	}

	task.SourceLang = sourceLang
	task.UpdatedAt = time.Now()

	if task.WorkDir != "" {
		if err := tm.storage.SaveMetadata(task); err != nil {
			return nil, fmt.Errorf("failed to persist task metadata: %w", err)
		}
	}

	return cloneTask(task), nil
}

// SetTaskError marks the task as failed with the provided error message
func (tm *TaskManager) SetTaskError(taskID string, err string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, ok := tm.tasks[taskID]
	if !ok {
		return fmt.Errorf("task %s not found", taskID)
	}

	task.Status = types.TaskStatusFailed
	task.Error = err
	task.UpdatedAt = time.Now()
	now := time.Now()
	task.CompletedAt = &now
	go tm.scheduleCleanup(taskID)

	if task.WorkDir != "" {
		return tm.storage.SaveMetadata(task)
	}

	return nil
}

// RetryTask resets task state if it previously failed
func (tm *TaskManager) RetryTask(taskID string) (*types.Task, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	task, ok := tm.tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("task %s not found", taskID)
	}

	if task.Status != types.TaskStatusFailed {
		return nil, fmt.Errorf("can only retry failed tasks")
	}

	task.Status = types.TaskStatusPending
	task.Progress = 0
	task.Error = ""
	task.CompletedAt = nil
	task.UpdatedAt = time.Now()

	return cloneTask(task), nil
}

// ClearTask removes the task from the in-memory map
func (tm *TaskManager) ClearTask(taskID string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	delete(tm.tasks, taskID)
}

// isTaskRunning checks if a task status indicates it's still running
func (tm *TaskManager) isTaskRunning(status types.TaskStatus) bool {
	switch status {
	case types.TaskStatusPending, types.TaskStatusDownloading,
		types.TaskStatusTranscribing, types.TaskStatusTranslating,
		types.TaskStatusSummarizing:
		return true
	default:
		return false
	}
}

func (tm *TaskManager) scheduleCleanup(taskID string) {
	time.AfterFunc(2*time.Minute, func() {
		tm.mu.Lock()
		defer tm.mu.Unlock()

		task, ok := tm.tasks[taskID]
		if !ok {
			return
		}

		if task.Status == types.TaskStatusDone || task.Status == types.TaskStatusFailed {
			delete(tm.tasks, taskID)
		}
	})
}

func cloneTask(task *types.Task) *types.Task {
	if task == nil {
		return nil
	}
	copy := *task
	return &copy
}
