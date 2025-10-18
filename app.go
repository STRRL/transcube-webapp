package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
	"transcube-webapp/internal/services"
	"transcube-webapp/internal/types"
	"transcube-webapp/internal/utils"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx           context.Context
	depChecker    *services.DependencyChecker
	storage       *services.Storage
	taskManager   *services.TaskManager
	downloader    *services.Downloader
	yapRunner     *services.YapRunner
	mediaServer   *services.MediaServer
	logger        *slog.Logger
	summarizer    *services.OpenRouterClient
	settings      types.Settings
	settingsStore *services.SettingsStore
}

// NewApp creates a new App application struct
func NewApp() *App {
	// Setup JSON logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	storage := services.NewStorage("")
	ss, _ := services.NewSettingsStore()
	return &App{
		depChecker:  services.NewDependencyChecker(),
		storage:     storage,
		taskManager: services.NewTaskManager(storage),
		downloader:  services.NewDownloader(storage),
		yapRunner:   services.NewYapRunner(storage),
		mediaServer: services.NewMediaServer(storage),
		logger:      logger,
		summarizer:  services.NewOpenRouterClient(),
		settings: types.Settings{
			Workspace:       storage.GetWorkspace(),
			SourceLang:      "en",
			APIProvider:     "openrouter",
			APIKey:          "",
			SummaryLength:   "medium",
			SummaryLanguage: "en",
			Temperature:     0.3,
			MaxTokens:       4096,
		},
		settingsStore: ss,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.logger.Info("TransCube starting up")

	// Log environment info for debugging
	pathFinder := utils.NewPathFinder()
	debugInfo := pathFinder.DebugInfo()
	a.logger.Info("Environment Debug Info",
		"PATH", debugInfo["PATH"],
		"WorkingDir", debugInfo["WorkingDir"],
		"ffmpeg", debugInfo["ffmpeg"],
		"yt-dlp", debugInfo["yt-dlp"])

	// Ensure workspace exists
	if err := a.storage.EnsureWorkspace(); err != nil {
		a.logger.Error("Failed to ensure workspace", "error", err)
	} else {
		a.logger.Info("Workspace ready", "path", a.storage.GetWorkspace())
	}

	// Load persisted settings (if present)
	if a.settingsStore != nil {
		if loaded, err := a.settingsStore.Load(); err != nil {
			a.logger.Warn("Failed to load settings", "error", err)
		} else if loaded != nil {
			a.settings = *loaded
			// keep storage workspace in sync
			if a.settings.Workspace != "" {
				a.storage.SetWorkspace(a.settings.Workspace)
				if err := a.storage.EnsureWorkspace(); err != nil {
					a.logger.Warn("Failed to ensure workspace from settings", "error", err)
				}
			}
		}
	}

	// Log dependency status
	deps := a.depChecker.Check()
	a.logger.Info("Dependency check",
		"yt-dlp", deps.YtDlp,
		"ffmpeg", deps.FFmpeg,
		"yap", deps.Yap)
}

// CheckDependencies checks if required tools are installed
func (a *App) CheckDependencies() types.DependencyStatus {
	return a.depChecker.Check()
}

// GetSettings returns current application settings
func (a *App) GetSettings() types.Settings {
	// keep workspace in sync
	a.settings.Workspace = a.storage.GetWorkspace()
	return a.settings
}

// UpdateSettings updates application settings
func (a *App) UpdateSettings(settings types.Settings) types.Settings {
	if settings.Workspace != "" {
		a.storage.SetWorkspace(settings.Workspace)
		a.storage.EnsureWorkspace()
	}
	// store in memory (could be persisted later)
	a.settings = settings
	// ensure workspace reflects current storage
	a.settings.Workspace = a.storage.GetWorkspace()
	// persist to disk
	if a.settingsStore != nil {
		if err := a.settingsStore.Save(a.settings); err != nil {
			a.logger.Warn("Failed to persist settings", "error", err)
		}
	}
	return a.settings
}

// ParseVideoUrl parses a YouTube URL and returns video metadata
func (a *App) ParseVideoUrl(url string) (*types.VideoMetadata, error) {
	a.logger.Debug("Parsing video URL", "url", url)

	info, err := a.downloader.GetVideoInfo(url)
	if err != nil {
		a.logger.Error("Failed to get video info", "url", url, "error", err)
		return nil, err
	}

	publishedAt := ""
	if info.UploadDate != "" {
		if parsed, err := time.Parse("20060102", info.UploadDate); err == nil {
			publishedAt = parsed.UTC().Format(time.RFC3339)
		} else {
			a.logger.Warn("Failed to parse upload date", "uploadDate", info.UploadDate, "error", err)
		}
	}
	if publishedAt == "" && info.Timestamp > 0 {
		publishedAt = time.Unix(info.Timestamp, 0).UTC().Format(time.RFC3339)
	}
	if publishedAt == "" && info.ReleaseTS > 0 {
		publishedAt = time.Unix(info.ReleaseTS, 0).UTC().Format(time.RFC3339)
	}

	a.logger.Info("Video metadata retrieved",
		"id", info.ID,
		"title", info.Title,
		"channel", info.Channel,
		"duration", info.Duration,
		"views", info.ViewCount,
		"likes", info.LikeCount,
		"publishedAt", publishedAt)

	return &types.VideoMetadata{
		ID:          info.ID,
		Title:       info.Title,
		Channel:     info.Channel,
		ChannelID:   info.ChannelID,
		Duration:    int(info.Duration),
		PublishedAt: publishedAt,
		Thumbnail:   info.Thumbnail,
		ViewCount:   info.ViewCount,
		LikeCount:   info.LikeCount,
		Description: info.Description,
	}, nil
}

// StartTranscription starts a new transcription task
func (a *App) StartTranscription(url string, sourceLang string) (*types.Task, error) {
	a.logger.Info("Starting new transcription task", "url", url, "sourceLang", sourceLang)

	// Create new task
	task, err := a.taskManager.CreateTask(url, sourceLang)
	if err != nil {
		a.logger.Error("Failed to create task", "error", err)
		return nil, err
	}

	a.logger.Info("Task created", "taskId", task.ID)

	// Start processing in background
	go a.processTask(task.ID)

	return task, nil
}

// GetTask returns the task by ID, falling back to persisted metadata if needed
func (a *App) GetTask(taskID string) (*types.Task, error) {
	if taskID == "" {
		return nil, fmt.Errorf("taskID is required")
	}

	if task, err := a.taskManager.GetTask(taskID); err == nil {
		return task, nil
	}

	tasks, err := a.storage.GetAllTasks()
	if err != nil {
		return nil, err
	}

	for _, task := range tasks {
		if task.ID == taskID {
			return task, nil
		}
	}

	return nil, fmt.Errorf("task %s not found", taskID)
}

// ListActiveTasks returns all tasks currently managed in memory
func (a *App) ListActiveTasks() []*types.Task {
	return a.taskManager.ListTasks()
}

// ensureTaskLoaded guarantees the task is present in the in-memory manager,
// reloading it from disk metadata if necessary.
func (a *App) ensureTaskLoaded(taskID string) (*types.Task, error) {
	if taskID == "" {
		return nil, fmt.Errorf("taskID is required")
	}

	if task, err := a.taskManager.GetTask(taskID); err == nil {
		return task, nil
	}

	tasks, err := a.storage.GetAllTasks()
	if err != nil {
		return nil, err
	}

	for _, t := range tasks {
		if t.ID == taskID {
			if _, err := a.taskManager.UpsertTask(t); err != nil {
				return nil, err
			}
			return a.taskManager.GetTask(taskID)
		}
	}

	return nil, fmt.Errorf("task %s not found", taskID)
}

// RetryTask retries a failed task
func (a *App) RetryTask(taskID string) (*types.Task, error) {
	task, err := a.taskManager.RetryTask(taskID)
	if err != nil {
		return nil, err
	}

	a.logger.Info("Retrying task", "taskId", taskID)

	go a.processTask(taskID)

	return task, nil
}

// UpdateTaskSourceLanguage updates the source language for a task
func (a *App) UpdateTaskSourceLanguage(taskID string, sourceLang string) (*types.Task, error) {
	if taskID == "" {
		return nil, fmt.Errorf("taskID is required")
	}
	if sourceLang == "" {
		return nil, fmt.Errorf("source language is required")
	}

	if _, err := a.ensureTaskLoaded(taskID); err != nil {
		return nil, err
	}

	updated, err := a.taskManager.UpdateTaskSourceLang(taskID, sourceLang)
	if err != nil {
		return nil, err
	}

	a.logger.Info("Task source language updated", "taskId", taskID, "sourceLang", sourceLang)
	return updated, nil
}

// DownloadTask executes metadata fetching, workspace preparation, and media download
func (a *App) DownloadTask(taskID string) (*types.Task, error) {
	task, err := a.ensureTaskLoaded(taskID)
	if err != nil {
		return nil, err
	}

	a.logger.Info("Download stage started", "taskId", taskID, "url", task.URL)

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDownloading, 10); err != nil {
		return nil, err
	}

	info, err := a.downloader.GetVideoInfo(task.URL)
	if err != nil {
		a.logger.Error("Failed to get video info", "taskId", taskID, "error", err)
		if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("Failed to get video info: %v", err)); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	duration := time.Duration(info.Duration) * time.Second
	durationStr := fmt.Sprintf("%02d:%02d", int(duration.Minutes()), int(duration.Seconds())%60)

	if err := a.taskManager.UpdateTaskMetadata(taskID, info.ID, info.Title, info.Channel, durationStr, info.Thumbnail); err != nil {
		a.logger.Error("Failed to update metadata", "taskId", taskID, "error", err)
		if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("Failed to update metadata: %v", err)); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	updatedTask, err := a.taskManager.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	workDir := updatedTask.WorkDir
	if workDir == "" {
		err := fmt.Errorf("work directory not set for task %s", taskID)
		a.logger.Error("Work directory missing", "taskId", taskID)
		if setErr := a.taskManager.SetTaskError(taskID, err.Error()); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	if err := os.MkdirAll(workDir, 0755); err != nil {
		a.logger.Error("Failed to create work directory", "taskId", taskID, "path", workDir, "error", err)
		if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("Failed to create work directory: %v", err)); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDownloading, 30); err != nil {
		return nil, err
	}

	if err := a.downloader.DownloadVideo(task.URL, workDir); err != nil {
		a.logger.Error("Failed to download video", "taskId", taskID, "error", err)
		if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("Failed to download video: %v", err)); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDownloading, 45); err != nil {
		return nil, err
	}

	videoPath := fmt.Sprintf("%s/video.mp4", workDir)
	if _, statErr := os.Stat(videoPath); os.IsNotExist(statErr) {
		alt := fmt.Sprintf("%s/video.webm", workDir)
		if _, altErr := os.Stat(alt); altErr == nil {
			videoPath = alt
		} else {
			a.logger.Error("No downloaded video found for audio extraction", "taskId", taskID)
			err := fmt.Errorf("video file missing after download")
			if setErr := a.taskManager.SetTaskError(taskID, err.Error()); setErr != nil {
				a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
			}
			return nil, err
		}
	}

	audioPath := fmt.Sprintf("%s/audio.aac", workDir)
	if err := a.downloader.ExtractAudio(videoPath, audioPath); err != nil {
		a.logger.Error("Failed to extract audio", "taskId", taskID, "error", err)
		if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("Failed to extract audio: %v", err)); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDownloading, 60); err != nil {
		return nil, err
	}

	a.logger.Info("Download stage completed", "taskId", taskID, "workDir", workDir)
	return a.taskManager.GetTask(taskID)
}

// TranscribeTask triggers Yap transcription using the prepared audio file
func (a *App) TranscribeTask(taskID string) (*types.Task, error) {
	task, err := a.ensureTaskLoaded(taskID)
	if err != nil {
		return nil, err
	}

	if task.WorkDir == "" {
		return nil, fmt.Errorf("task %s has no working directory", taskID)
	}

	audioPath := fmt.Sprintf("%s/audio.aac", task.WorkDir)
	if _, err := os.Stat(audioPath); err != nil {
		a.logger.Error("Audio file missing for transcription", "taskId", taskID, "error", err)
		if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("Audio file missing for transcription: %v", err)); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	a.logger.Info("Transcription stage started", "taskId", taskID, "lang", task.SourceLang)

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusTranscribing, 60); err != nil {
		return nil, err
	}

	if err := a.yapRunner.Transcribe(audioPath, task.WorkDir, task.SourceLang); err != nil {
		a.logger.Error("Failed to transcribe", "taskId", taskID, "error", err)
		if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("Failed to transcribe: %v", err)); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusTranscribing, 80); err != nil {
		return nil, err
	}

	a.logger.Info("Transcription stage completed", "taskId", taskID)
	return a.taskManager.GetTask(taskID)
}

// SummarizeTask generates video summaries via the configured LLM client
func (a *App) SummarizeTask(taskID string) (*types.Task, error) {
	task, err := a.ensureTaskLoaded(taskID)
	if err != nil {
		return nil, err
	}

	if task.WorkDir == "" {
		return nil, fmt.Errorf("task %s has no working directory", taskID)
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusSummarizing, 85); err != nil {
		return nil, err
	}

	a.logger.Info("Summarization stage started", "taskId", taskID, "provider", a.settings.APIProvider)

	srtPath := fmt.Sprintf("%s/subs_%s.srt", task.WorkDir, task.SourceLang)
	srtBytes, err := os.ReadFile(srtPath)
	if err != nil {
		a.logger.Error("Failed to read transcript for summary", "taskId", taskID, "error", err)
		if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("Failed to read transcript for summary: %v", err)); setErr != nil {
			a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
		}
		return nil, err
	}

	sumBytes, summarizeErr := a.summarizer.SummarizeStructured(
		a.ctx,
		a.settings.APIKey,
		string(srtBytes),
		a.settings.SummaryLength,
		a.settings.SummaryLanguage,
		a.settings.Temperature,
		a.settings.MaxTokens,
	)

	summaryPath := fmt.Sprintf("%s/summary_structured.json", task.WorkDir)
	if summarizeErr != nil {
		a.logger.Error("Summarization failed", "taskId", taskID, "error", summarizeErr)
		_ = a.storage.SaveLog(task.WorkDir, "summarize", fmt.Sprintf("Summary generation failed: %v", summarizeErr))
		placeholder := []byte(`{"type":"structured","content":{"keyPoints":[],"mainTopic":"","conclusion":"","tags":[]}}`)
		if writeErr := os.WriteFile(summaryPath, placeholder, 0644); writeErr != nil {
			a.logger.Error("Failed to write placeholder summary", "taskId", taskID, "error", writeErr)
		}
	} else {
		if writeErr := os.WriteFile(summaryPath, sumBytes, 0644); writeErr != nil {
			a.logger.Error("Failed to write summary", "taskId", taskID, "error", writeErr)
			_ = a.storage.SaveLog(task.WorkDir, "summarize", fmt.Sprintf("Failed to write summary: %v", writeErr))
		} else {
			_ = a.storage.SaveLog(task.WorkDir, "summarize", "Summary generated via OpenRouter")
			a.logger.Info("Summarization complete", "taskId", taskID, "path", summaryPath)
		}
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusSummarizing, 95); err != nil {
		return nil, err
	}

	if summarizeErr == nil {
		if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDone, 100); err != nil {
			return nil, err
		}
	}

	updatedTask, getErr := a.taskManager.GetTask(taskID)
	if getErr != nil {
		return nil, getErr
	}

	return updatedTask, summarizeErr
}

// GetAllTasks returns all processed tasks
func (a *App) GetAllTasks() ([]*types.Task, error) {
	return a.storage.GetAllTasks()
}

// SubtitleEntry represents a single subtitle entry
type SubtitleEntry struct {
	Index     int    `json:"index"`
	Timestamp string `json:"timestamp"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	English   string `json:"english"`
	Chinese   string `json:"chinese,omitempty"`
}

// GetTaskSubtitles returns parsed subtitles for a task
func (a *App) GetTaskSubtitles(taskID string) ([]SubtitleEntry, error) {
	a.logger.Info("Getting subtitles for task", "taskId", taskID)

	// Get task to find work directory
	tasks, err := a.storage.GetAllTasks()
	if err != nil {
		return nil, err
	}

	var task *types.Task
	for _, t := range tasks {
		if t.ID == taskID {
			task = t
			break
		}
	}

	if task == nil {
		return nil, fmt.Errorf("task not found")
	}

	// Read subtitle file (gracefully handle missing/empty files)
	subtitlePath := fmt.Sprintf("%s/subs_%s.srt", task.WorkDir, task.SourceLang)
	content, err := os.ReadFile(subtitlePath)
	if err != nil {
		a.logger.Warn("Subtitle file not available; returning empty transcript", "path", subtitlePath, "error", err)
		return []SubtitleEntry{}, nil
	}

	// Empty file: no speech detected or no transcript
	if len(strings.TrimSpace(string(content))) == 0 {
		a.logger.Info("Subtitle file is empty; likely no speech", "taskId", taskID)
		return []SubtitleEntry{}, nil
	}

	// Parse SRT format
	entries := parseSRT(string(content))
	a.logger.Info("Parsed subtitles", "taskId", taskID, "entries", len(entries))
	return entries, nil
}

// GetTaskSubtitlesForLang returns parsed subtitles for a task for the specified language code
// GetTaskSubtitlesForLang and RegenerateTranscript were removed to keep a single-language flow.

// parseSRT parses SRT subtitle format
func parseSRT(content string) []SubtitleEntry {
	var entries []SubtitleEntry
	lines := strings.Split(content, "\n")

	i := 0
	for i < len(lines) {
		// Skip empty lines
		if strings.TrimSpace(lines[i]) == "" {
			i++
			continue
		}

		// Parse index
		index := 0
		fmt.Sscanf(lines[i], "%d", &index)
		i++

		if i >= len(lines) {
			break
		}

		// Parse timestamp
		timestampLine := strings.TrimSpace(lines[i])
		if !strings.Contains(timestampLine, "-->") {
			i++
			continue
		}

		parts := strings.Split(timestampLine, "-->")
		if len(parts) != 2 {
			i++
			continue
		}

		startTime := strings.TrimSpace(parts[0])
		endTime := strings.TrimSpace(parts[1])

		// Create display timestamp (just the start time in a shorter format)
		timestamp := startTime
		if len(timestamp) > 8 {
			timestamp = timestamp[:8] // Remove milliseconds for display
		}

		i++

		// Parse subtitle text (can be multiple lines)
		var textLines []string
		for i < len(lines) && strings.TrimSpace(lines[i]) != "" {
			textLines = append(textLines, lines[i])
			i++
		}

		if len(textLines) > 0 {
			entries = append(entries, SubtitleEntry{
				Index:     index,
				Timestamp: timestamp,
				StartTime: startTime,
				EndTime:   endTime,
				English:   strings.Join(textLines, " "),
			})
		}
	}

	return entries
}

// DeleteTask deletes a task and its associated files
func (a *App) DeleteTask(taskID string) error {
	a.logger.Info("Deleting task", "taskId", taskID)
	err := a.storage.DeleteTask(taskID)
	if err != nil {
		a.logger.Error("Failed to delete task", "taskId", taskID, "error", err)
		return fmt.Errorf("failed to delete task: %v", err)
	}
	a.logger.Info("Task deleted successfully", "taskId", taskID)

	// Emit event to frontend to reload videos
	a.emitReloadEvent()

	return nil
}

func (a *App) emitReloadEvent() {
	if a.ctx == nil {
		a.logger.Warn("Cannot emit reload event before startup context is set")
		return
	}
	runtime.EventsEmit(a.ctx, "reload-videos")
}

// processTask handles the actual task processing
func (a *App) processTask(taskID string) {
	a.logger.Info("Processing task started", "taskId", taskID)

	if _, err := a.DownloadTask(taskID); err != nil {
		a.logger.Error("Download stage failed", "taskId", taskID, "error", err)
		return
	}

	if _, err := a.TranscribeTask(taskID); err != nil {
		a.logger.Error("Transcription stage failed", "taskId", taskID, "error", err)
		return
	}

	if _, err := a.SummarizeTask(taskID); err != nil {
		a.logger.Warn("Summarization stage completed with warnings", "taskId", taskID, "error", err)
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDone, 100); err != nil {
		a.logger.Error("Failed to finalize task", "taskId", taskID, "error", err)
		return
	}

	a.taskManager.ClearTask(taskID)

	a.emitReloadEvent()
	a.logger.Info("Task completed successfully", "taskId", taskID)
}

// GetDebugInfo returns debug information about the environment and PATH
func (a *App) GetDebugInfo() map[string]string {
	pathFinder := utils.NewPathFinder()
	return pathFinder.DebugInfo()
}
