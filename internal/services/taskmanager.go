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
	}

	if task.WorkDir != "" {
		return tm.storage.SaveMetadata(task)
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

	task.WorkDir = tm.storage.GetTaskDir(title, videoID)

	return nil
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

func cloneTask(task *types.Task) *types.Task {
	if task == nil {
		return nil
	}
	copy := *task
	return &copy
}
