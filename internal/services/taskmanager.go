package services

import (
	"fmt"
	"sync"
	"time"
	"github.com/google/uuid"
	"transcube-webapp/internal/types"
)

type TaskManager struct {
	mu          sync.Mutex
	currentTask *types.Task
	storage     *Storage
}

func NewTaskManager(storage *Storage) *TaskManager {
	return &TaskManager{
		storage: storage,
	}
}

// CreateTask creates a new task if no task is currently running
func (tm *TaskManager) CreateTask(url string, sourceLang string) (*types.Task, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	// Check if a task is already running
	if tm.currentTask != nil && tm.isTaskRunning(tm.currentTask.Status) {
		return nil, fmt.Errorf("a task is already running")
	}
	
	// Create new task
	task := &types.Task{
		ID:         uuid.New().String(),
		URL:        url,
		SourceLang: sourceLang,
		Status:     types.TaskStatusPending,
		Progress:   0,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	
	tm.currentTask = task
	return task, nil
}

// GetCurrentTask returns the current task
func (tm *TaskManager) GetCurrentTask() *types.Task {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	return tm.currentTask
}

// UpdateTaskStatus updates the status and progress of the current task
func (tm *TaskManager) UpdateTaskStatus(status types.TaskStatus, progress int) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tm.currentTask == nil {
		return fmt.Errorf("no current task")
	}
	
	tm.currentTask.Status = status
	tm.currentTask.Progress = progress
	tm.currentTask.UpdatedAt = time.Now()
	
	if status == types.TaskStatusDone || status == types.TaskStatusFailed {
		now := time.Now()
		tm.currentTask.CompletedAt = &now
	}
	
	// Save metadata
	if tm.currentTask.WorkDir != "" {
		return tm.storage.SaveMetadata(tm.currentTask)
	}
	
	return nil
}

// UpdateTaskMetadata updates task metadata
func (tm *TaskManager) UpdateTaskMetadata(videoID, title, channel, duration, thumbnail string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tm.currentTask == nil {
		return fmt.Errorf("no current task")
	}
	
	tm.currentTask.VideoID = videoID
	tm.currentTask.Title = title
	tm.currentTask.Channel = channel
	tm.currentTask.Duration = duration
	tm.currentTask.Thumbnail = thumbnail
	tm.currentTask.UpdatedAt = time.Now()
	
	// Set work directory path (but don't create it yet)
	workDir := tm.storage.GetTaskDir(title, videoID)
	tm.currentTask.WorkDir = workDir
	
	// Don't save metadata here - directory doesn't exist yet
	// Metadata will be saved after directory is created in processTask
	return nil
}

// SetTaskError sets an error message for the current task
func (tm *TaskManager) SetTaskError(err string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tm.currentTask == nil {
		return fmt.Errorf("no current task")
	}
	
	tm.currentTask.Status = types.TaskStatusFailed
	tm.currentTask.Error = err
	tm.currentTask.UpdatedAt = time.Now()
	now := time.Now()
	tm.currentTask.CompletedAt = &now
	
	// Save metadata
	if tm.currentTask.WorkDir != "" {
		return tm.storage.SaveMetadata(tm.currentTask)
	}
	
	return nil
}

// RetryTask retries the current task if it failed
func (tm *TaskManager) RetryTask() error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tm.currentTask == nil {
		return fmt.Errorf("no task to retry")
	}
	
	if tm.currentTask.Status != types.TaskStatusFailed {
		return fmt.Errorf("can only retry failed tasks")
	}
	
	// Reset task status
	tm.currentTask.Status = types.TaskStatusPending
	tm.currentTask.Progress = 0
	tm.currentTask.Error = ""
	tm.currentTask.CompletedAt = nil
	tm.currentTask.UpdatedAt = time.Now()
	
	return nil
}

// ClearTask clears the current task (for cleanup after completion)
func (tm *TaskManager) ClearTask() {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	tm.currentTask = nil
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