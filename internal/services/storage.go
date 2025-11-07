package services

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"transcube-webapp/internal/types"
)

type Storage struct {
	workspace string
}

func NewStorage(workspace string) *Storage {
	if workspace == "" {
		workspace = filepath.Join(os.Getenv("HOME"), "Downloads", "TransCube")
	}
	return &Storage{workspace: workspace}
}

// EnsureWorkspace creates the workspace directory if it doesn't exist
func (s *Storage) EnsureWorkspace() error {
	return os.MkdirAll(s.workspace, 0755)
}

// GetTaskDir returns the directory path for a specific task. The taskID ensures
// concurrent tasks processing the same video do not collide on the filesystem.
// taskID is required to prevent directory collisions between concurrent tasks.
func (s *Storage) GetTaskDir(title string, videoID string, taskID string) (string, error) {
	if taskID == "" {
		return "", fmt.Errorf("taskID is required to prevent directory collisions")
	}

	sanitized := s.sanitizeTitle(title)
	suffix := taskID
	if len(taskID) > 8 {
		suffix = taskID[:8]
	}

	if videoID == "" {
		dirname := fmt.Sprintf("%s__%s", sanitized, suffix)
		return filepath.Join(s.workspace, dirname), nil
	}

	dirname := fmt.Sprintf("%s__%s__%s", sanitized, videoID, suffix)
	return filepath.Join(s.workspace, dirname), nil
}

// sanitizeTitle cleans the title for use as a directory name
func (s *Storage) sanitizeTitle(title string) string {
	// Only remove characters that are forbidden in macOS file system
	// Keep Chinese characters and other Unicode characters
	// Forbidden characters in macOS: / : \ * ? " < > |
	forbiddenChars := []string{"/", ":", "\\", "*", "?", "\"", "<", ">", "|"}
	sanitized := title
	for _, char := range forbiddenChars {
		sanitized = strings.ReplaceAll(sanitized, char, "_")
	}

	// Replace spaces with underscores for better compatibility
	sanitized = strings.ReplaceAll(sanitized, " ", "_")

	// Remove consecutive underscores
	reg := regexp.MustCompile(`_+`)
	sanitized = reg.ReplaceAllString(sanitized, "_")

	// Trim underscores and limit to 80 characters (considering multi-byte characters)
	sanitized = strings.Trim(sanitized, "_")
	if len([]rune(sanitized)) > 80 {
		runes := []rune(sanitized)
		sanitized = string(runes[:80])
	}

	// Ensure we have a valid directory name
	if sanitized == "" {
		sanitized = "untitled"
	}

	return sanitized
}

// SaveMetadata saves task metadata to meta.json
func (s *Storage) SaveMetadata(task *types.Task) error {
	metaPath := filepath.Join(task.WorkDir, "meta.json")
	data, err := json.MarshalIndent(task, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(metaPath, data, 0644)
}

// LoadMetadata loads task metadata from meta.json
func (s *Storage) LoadMetadata(taskDir string) (*types.Task, error) {
	metaPath := filepath.Join(taskDir, "meta.json")
	data, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, err
	}

	var task types.Task
	err = json.Unmarshal(data, &task)
	return &task, err
}

// GetAllTasks returns all tasks from the workspace
func (s *Storage) GetAllTasks() ([]*types.Task, error) {
	entries, err := os.ReadDir(s.workspace)
	if err != nil {
		if os.IsNotExist(err) {
			return []*types.Task{}, nil
		}
		return nil, err
	}

	var tasks []*types.Task
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		taskDir := filepath.Join(s.workspace, entry.Name())
		task, err := s.LoadMetadata(taskDir)
		if err != nil {
			continue // Skip invalid directories
		}
		tasks = append(tasks, task)
	}

	return tasks, nil
}

// SaveLog saves log content to a specific log file
func (s *Storage) SaveLog(taskDir string, logType string, content string) error {
	logDir := filepath.Join(taskDir, "logs")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	logPath := filepath.Join(logDir, fmt.Sprintf("%s.log", logType))
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logEntry := fmt.Sprintf("[%s] %s\n", timestamp, content)

	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer func() {
		if err := f.Close(); err != nil {
			slog.Error("close log file", "error", err)
		}
	}()

	_, err = f.WriteString(logEntry)
	return err
}

// GetWorkspace returns the current workspace path
func (s *Storage) GetWorkspace() string {
	return s.workspace
}

// SetWorkspace updates the workspace path
func (s *Storage) SetWorkspace(path string) {
	s.workspace = path
}

// DeleteTask deletes a task and its associated files
func (s *Storage) DeleteTask(taskID string) error {
	// Find the task directory by checking all directories
	entries, err := os.ReadDir(s.workspace)
	if err != nil {
		return fmt.Errorf("failed to read workspace: %v", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		taskDir := filepath.Join(s.workspace, entry.Name())
		task, err := s.LoadMetadata(taskDir)
		if err != nil {
			continue // Skip invalid directories
		}

		if task.ID == taskID {
			// Remove the entire task directory
			if err := os.RemoveAll(taskDir); err != nil {
				return fmt.Errorf("failed to delete task directory: %v", err)
			}
			return nil
		}
	}

	return fmt.Errorf("task not found: %s", taskID)
}
