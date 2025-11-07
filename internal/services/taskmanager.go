package services

import (
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"

	"transcube-webapp/internal/types"
)

type TaskManager struct {
	mu        sync.RWMutex
	tasks     map[string]*types.Task
	taskLocks map[string]*sync.Mutex
	storage   *Storage
}

func NewTaskManager(storage *Storage) *TaskManager {
	return &TaskManager{
		tasks:     make(map[string]*types.Task),
		taskLocks: make(map[string]*sync.Mutex),
		storage:   storage,
	}
}

// CreateTask creates a new task with pre-fetched metadata and tracks it in memory
func (tm *TaskManager) CreateTask(url, sourceLang, platform, videoID, title, channel, duration, thumbnail string) (*types.Task, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if videoID == "" {
		return nil, fmt.Errorf("video ID is required when creating a task")
	}

	for _, existing := range tm.tasks {
		if existing.URL == url && tm.isTaskRunning(existing.Status) {
			return nil, fmt.Errorf("a task is already running for this url: %s", url)
		}
		if existing.Platform == platform && existing.VideoID == videoID {
			return nil, fmt.Errorf("a task is already processing video %s on %s", videoID, platform)
		}
	}

	if all, err := tm.storage.GetAllTasks(); err == nil {
		for _, existing := range all {
			if existing.Platform == platform && existing.VideoID == videoID {
				return nil, fmt.Errorf("video %s on %s has already been processed by task %s", videoID, platform, existing.ID)
			}
		}
	} else {
		return nil, fmt.Errorf("failed to validate existing tasks: %w", err)
	}

	task := &types.Task{
		ID:         uuid.New().String(),
		URL:        url,
		Platform:   platform,
		SourceLang: sourceLang,
		Status:     types.TaskStatusPending,
		Progress:   0,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		VideoID:    videoID,
		Title:      title,
		Channel:    channel,
		Duration:   duration,
		Thumbnail:  thumbnail,
	}

	workDir, err := tm.storage.GetTaskDir(title, videoID, task.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate work directory: %w", err)
	}
	task.WorkDir = workDir

	if err := os.MkdirAll(task.WorkDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create task workspace: %w", err)
	}

	if err := tm.storage.SaveMetadata(task); err != nil {
		return nil, fmt.Errorf("failed to persist task metadata: %w", err)
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

	if videoID != "" && task.VideoID != videoID {
		for id, existing := range tm.tasks {
			if id == taskID {
				continue
			}
			if existing.VideoID == videoID {
				return fmt.Errorf("video %s is already being processed by task %s", videoID, existing.ID)
			}
		}

		if all, err := tm.storage.GetAllTasks(); err == nil {
			for _, existing := range all {
				if existing.ID == taskID {
					continue
				}
				if existing.VideoID == videoID {
					return fmt.Errorf("video %s has already been processed by task %s", videoID, existing.ID)
				}
			}
		} else {
			return fmt.Errorf("failed to validate existing tasks: %w", err)
		}

		task.VideoID = videoID
	}

	if title != "" {
		task.Title = title
	}
	if channel != "" {
		task.Channel = channel
	}
	if duration != "" {
		task.Duration = duration
	}
	if thumbnail != "" {
		task.Thumbnail = thumbnail
	}
	task.UpdatedAt = time.Now()

	if task.WorkDir == "" {
		targetDir, err := tm.storage.GetTaskDir(task.Title, task.VideoID, task.ID)
		if err != nil {
			return fmt.Errorf("failed to generate work directory: %w", err)
		}
		if err := os.MkdirAll(targetDir, 0755); err != nil {
			return fmt.Errorf("failed to create work directory: %w", err)
		}
		task.WorkDir = targetDir
	}

	if err := tm.storage.SaveMetadata(task); err != nil {
		return fmt.Errorf("failed to persist task metadata: %w", err)
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
	delete(tm.taskLocks, taskID)
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
			delete(tm.taskLocks, taskID)
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

// getTaskLock returns the mutex for a specific task, creating it if necessary
func (tm *TaskManager) getTaskLock(taskID string) *sync.Mutex {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if _, exists := tm.taskLocks[taskID]; !exists {
		tm.taskLocks[taskID] = &sync.Mutex{}
	}
	return tm.taskLocks[taskID]
}

// LockTask acquires the operation lock for a task, preventing concurrent operations.
// Returns an error if the task is already locked.
func (tm *TaskManager) LockTask(taskID string) error {
	lock := tm.getTaskLock(taskID)

	// Try to acquire the lock without blocking
	if !lock.TryLock() {
		return fmt.Errorf("task %s is already being processed", taskID)
	}

	return nil
}

// UnlockTask releases the operation lock for a task
func (tm *TaskManager) UnlockTask(taskID string) {
	lock := tm.getTaskLock(taskID)
	lock.Unlock()
}
