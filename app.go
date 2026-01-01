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

// Progress value constants for task stages
const (
	ProgressDownloadStart      = 10
	ProgressMetadataFetched    = 30
	ProgressVideoDownloaded    = 45
	ProgressAudioExtracted     = 60
	ProgressTranscribeStart    = 60
	ProgressTranscribeComplete = 80
	ProgressSummarizeStart     = 85
	ProgressSummarizeComplete  = 95
	ProgressTaskComplete       = 100
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
		if err := a.storage.EnsureWorkspace(); err != nil {
			slog.Error("ensure workspace", "error", err)
		}
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

// DetectPlatform detects which video platform the URL belongs to
func (a *App) DetectPlatform(url string) string {
	return a.downloader.DetectPlatform(url)
}

// ParseVideoUrl parses a video URL and returns video metadata
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

	platform := a.downloader.DetectPlatform(url)

	return &types.VideoMetadata{
		ID:          info.ID,
		Platform:    platform,
		Title:       info.Title,
		Channel:     info.Channel,
		ChannelID:   info.ChannelID,
		Duration:    int(info.Duration),
		PublishedAt: publishedAt,
		Thumbnail:   utils.EnsureHTTPS(info.Thumbnail),
		ViewCount:   info.ViewCount,
		LikeCount:   info.LikeCount,
		Description: info.Description,
	}, nil
}

// StartTranscription starts a new transcription task
func (a *App) StartTranscription(url string, sourceLang string) (*types.Task, error) {
	a.logger.Info("Starting new transcription task", "url", url, "sourceLang", sourceLang)

	info, err := a.downloader.GetVideoInfo(url)
	if err != nil {
		a.logger.Error("Failed to fetch metadata before creating task", "url", url, "error", err)
		return nil, err
	}
	if info.ID == "" {
		return nil, fmt.Errorf("video ID is missing from metadata")
	}

	duration := time.Duration(info.Duration) * time.Second
	durationStr := fmt.Sprintf("%02d:%02d", int(duration.Minutes()), int(duration.Seconds())%60)

	platform := a.downloader.DetectPlatform(url)

	task, err := a.taskManager.CreateTask(
		url,
		sourceLang,
		platform,
		info.ID,
		info.Title,
		info.Channel,
		durationStr,
		utils.EnsureHTTPS(info.Thumbnail),
	)
	if err != nil {
		a.logger.Error("Failed to create task", "error", err)
		return nil, err
	}

	a.logger.Info("Task created", "taskId", task.ID)

	// Start processing in background
	go a.processTask(task.ID)

	return task, nil
}

func (a *App) loadTaskFromDisk(taskID string) (*types.Task, error) {
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

// GetTask returns the task by ID, loading it from persisted metadata
func (a *App) GetTask(taskID string) (*types.Task, error) {
	if taskID == "" {
		return nil, fmt.Errorf("taskID is required")
	}

	return a.loadTaskFromDisk(taskID)
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

	task, err := a.loadTaskFromDisk(taskID)
	if err != nil {
		return nil, err
	}

	if _, err := a.taskManager.UpsertTask(task); err != nil {
		return nil, err
	}

	return a.taskManager.GetTask(taskID)
}

// RetryTask retries a failed task
func (a *App) RetryTask(taskID string) (*types.Task, error) {
	if taskID == "" {
		return nil, fmt.Errorf("taskID is required")
	}

	if _, err := a.ensureTaskLoaded(taskID); err != nil {
		return nil, err
	}

	task, err := a.taskManager.RetryTask(taskID)
	if err != nil {
		return nil, err
	}

	a.logger.Info("Retrying task", "taskId", taskID)

	go a.processTask(taskID)
	a.emitReloadEvent()

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

// downloadTaskInternal is the internal implementation without lock acquisition
func (a *App) downloadTaskInternal(taskID string) (*types.Task, error) {
	task, err := a.ensureTaskLoaded(taskID)
	if err != nil {
		return nil, err
	}

	if err := a.taskManager.BeginStage(
		taskID,
		types.TaskStatusDownloading,
		ProgressDownloadStart,
		types.TaskStatusPending,
		types.TaskStatusFailed,
		types.TaskStatusDone,
	); err != nil {
		a.logger.Warn("Download stage rejected", "taskId", taskID, "error", err)
		return nil, err
	}

	a.logger.Info("Download stage started", "taskId", taskID, "url", task.URL)

	info, err := a.downloader.GetVideoInfo(task.URL)
	if err != nil {
		a.recordTaskError(taskID, err, "Failed to get video info", "url", task.URL)
		return nil, err
	}

	duration := time.Duration(info.Duration) * time.Second
	durationStr := fmt.Sprintf("%02d:%02d", int(duration.Minutes()), int(duration.Seconds())%60)

	if err := a.taskManager.UpdateTaskMetadata(taskID, info.ID, info.Title, info.Channel, durationStr, utils.EnsureHTTPS(info.Thumbnail)); err != nil {
		a.recordTaskError(taskID, err, "Failed to update metadata")
		return nil, err
	}

	updatedTask, err := a.taskManager.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	workDir := updatedTask.WorkDir
	if workDir == "" {
		err := fmt.Errorf("work directory not set for task %s", taskID)
		a.recordTaskError(taskID, err, "Work directory missing after metadata update")
		return nil, err
	}

	if err := os.MkdirAll(workDir, 0755); err != nil {
		a.recordTaskError(taskID, err, "Failed to create work directory", "path", workDir)
		return nil, err
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDownloading, ProgressMetadataFetched); err != nil {
		return nil, err
	}

	if err := a.downloader.DownloadVideo(task.URL, workDir); err != nil {
		a.recordTaskError(taskID, err, "Failed to download video", "url", task.URL)
		return nil, err
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDownloading, ProgressVideoDownloaded); err != nil {
		return nil, err
	}

	videoPath := fmt.Sprintf("%s/video.mp4", workDir)
	if _, statErr := os.Stat(videoPath); os.IsNotExist(statErr) {
		alt := fmt.Sprintf("%s/video.webm", workDir)
		if _, altErr := os.Stat(alt); altErr == nil {
			videoPath = alt
		} else {
			err := fmt.Errorf("video file missing after download")
			a.recordTaskError(taskID, err, "No downloaded video found for audio extraction")
			return nil, err
		}
	}

	audioPath := fmt.Sprintf("%s/audio.aac", workDir)
	if err := a.downloader.ExtractAudio(videoPath, audioPath); err != nil {
		a.recordTaskError(taskID, err, "Failed to extract audio")
		return nil, err
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDownloading, ProgressAudioExtracted); err != nil {
		return nil, err
	}

	a.logger.Info("Download stage completed", "taskId", taskID, "workDir", workDir)
	return a.taskManager.GetTask(taskID)
}

// DownloadTask executes metadata fetching, workspace preparation, and media download
func (a *App) DownloadTask(taskID string) (*types.Task, error) {
	// Acquire task lock to prevent concurrent operations
	if err := a.taskManager.LockTask(taskID); err != nil {
		a.logger.Warn("Task is already being processed", "taskId", taskID, "error", err)
		return nil, err
	}
	defer a.taskManager.UnlockTask(taskID)

	return a.downloadTaskInternal(taskID)
}

// transcribeTaskInternal is the internal implementation without lock acquisition
func (a *App) transcribeTaskInternal(taskID string) (*types.Task, error) {
	task, err := a.ensureTaskLoaded(taskID)
	if err != nil {
		return nil, err
	}

	if task.WorkDir == "" {
		return nil, fmt.Errorf("task %s has no working directory", taskID)
	}

	switch task.Status {
	case types.TaskStatusTranscribing:
		return nil, fmt.Errorf("transcription already in progress")
	case types.TaskStatusPending:
		return nil, fmt.Errorf("download stage must complete before transcription")
	case types.TaskStatusSummarizing:
		return nil, fmt.Errorf("cannot transcribe while summarization is running")
	}

	if task.Progress < 60 {
		return nil, fmt.Errorf("download stage must complete before transcription")
	}

	audioPath := fmt.Sprintf("%s/audio.aac", task.WorkDir)
	if _, err := os.Stat(audioPath); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("download stage must complete before transcription")
		}
		a.recordTaskError(taskID, err, "Failed to access audio file for transcription")
		return nil, err
	}

	if err := a.taskManager.BeginStage(
		taskID,
		types.TaskStatusTranscribing,
		ProgressTranscribeStart,
		types.TaskStatusDownloading,
		types.TaskStatusFailed,
		types.TaskStatusDone,
	); err != nil {
		a.logger.Warn("Transcription stage rejected", "taskId", taskID, "error", err)
		return nil, err
	}

	a.logger.Info("Transcription stage started", "taskId", taskID, "lang", task.SourceLang)

	if err := a.yapRunner.Transcribe(audioPath, task.WorkDir, task.SourceLang); err != nil {
		a.recordTaskError(taskID, err, "Failed to transcribe", "lang", task.SourceLang)
		return nil, err
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusTranscribing, ProgressTranscribeComplete); err != nil {
		return nil, err
	}

	a.logger.Info("Transcription stage completed", "taskId", taskID)
	return a.taskManager.GetTask(taskID)
}

// TranscribeTask triggers Yap transcription using the prepared audio file
func (a *App) TranscribeTask(taskID string) (*types.Task, error) {
	// Acquire task lock to prevent concurrent operations
	if err := a.taskManager.LockTask(taskID); err != nil {
		a.logger.Warn("Task is already being processed", "taskId", taskID, "error", err)
		return nil, err
	}
	defer a.taskManager.UnlockTask(taskID)

	return a.transcribeTaskInternal(taskID)
}

// summarizeTaskInternal is the internal implementation without lock acquisition
func (a *App) summarizeTaskInternal(taskID string) (*types.Task, error) {
	task, err := a.ensureTaskLoaded(taskID)
	if err != nil {
		return nil, err
	}

	if task.WorkDir == "" {
		return nil, fmt.Errorf("task %s has no working directory", taskID)
	}

	switch task.Status {
	case types.TaskStatusSummarizing:
		return nil, fmt.Errorf("summarization already in progress")
	case types.TaskStatusPending, types.TaskStatusDownloading:
		return nil, fmt.Errorf("run download and transcription stages before summarizing")
	case types.TaskStatusTranscribing:
		if task.Progress < 80 {
			return nil, fmt.Errorf("transcription stage must complete before summarization")
		}
	}

	srtPath := fmt.Sprintf("%s/subs_%s.srt", task.WorkDir, task.SourceLang)
	srtBytes, err := os.ReadFile(srtPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("transcription stage must complete before summarization")
		}
		a.recordTaskError(taskID, err, "Failed to read transcript for summary")
		return nil, err
	}

	if err := a.taskManager.BeginStage(
		taskID,
		types.TaskStatusSummarizing,
		ProgressSummarizeStart,
		types.TaskStatusTranscribing,
		types.TaskStatusFailed,
		types.TaskStatusDone,
	); err != nil {
		a.logger.Warn("Summarization stage rejected", "taskId", taskID, "error", err)
		return nil, err
	}

	a.logger.Info("Summarization stage started", "taskId", taskID, "provider", a.settings.APIProvider)

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

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusSummarizing, ProgressSummarizeComplete); err != nil {
		return nil, err
	}

	if summarizeErr == nil {
		if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDone, ProgressTaskComplete); err != nil {
			return nil, err
		}
	}

	updatedTask, getErr := a.taskManager.GetTask(taskID)
	if getErr != nil {
		return nil, getErr
	}

	return updatedTask, summarizeErr
}

// SummarizeTask generates video summaries via the configured LLM client
func (a *App) SummarizeTask(taskID string) (*types.Task, error) {
	// Acquire task lock to prevent concurrent operations
	if err := a.taskManager.LockTask(taskID); err != nil {
		a.logger.Warn("Task is already being processed", "taskId", taskID, "error", err)
		return nil, err
	}
	defer a.taskManager.UnlockTask(taskID)

	return a.summarizeTaskInternal(taskID)
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
		if _, err := fmt.Sscanf(lines[i], "%d", &index); err != nil {
			slog.Error("parse subtitle index", "error", err)
		}
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

func (a *App) recordTaskError(taskID string, err error, message string, attrs ...any) {
	if err == nil {
		return
	}

	fields := append([]any{"taskId", taskID, "error", err}, attrs...)
	a.logger.Error(message, fields...)

	if setErr := a.taskManager.SetTaskError(taskID, fmt.Sprintf("%s: %v", message, err)); setErr != nil {
		a.logger.Error("Failed to record task error", "taskId", taskID, "error", setErr)
	}
}

// processTask handles the actual task processing
func (a *App) processTask(taskID string) {
	// Acquire task lock to prevent concurrent operations
	if err := a.taskManager.LockTask(taskID); err != nil {
		a.logger.Warn("Task is already being processed", "taskId", taskID, "error", err)
		return
	}

	locked := true
	defer func() {
		if locked {
			a.taskManager.UnlockTask(taskID)
		}
	}()

	a.logger.Info("Processing task started", "taskId", taskID)

	if _, err := a.downloadTaskInternal(taskID); err != nil {
		a.logger.Error("Download stage failed", "taskId", taskID, "error", err)
		return
	}

	if _, err := a.transcribeTaskInternal(taskID); err != nil {
		a.logger.Error("Transcription stage failed", "taskId", taskID, "error", err)
		return
	}

	if _, err := a.summarizeTaskInternal(taskID); err != nil {
		a.logger.Warn("Summarization stage completed with warnings", "taskId", taskID, "error", err)
	}

	if err := a.taskManager.UpdateTaskStatus(taskID, types.TaskStatusDone, ProgressTaskComplete); err != nil {
		a.logger.Error("Failed to finalize task", "taskId", taskID, "error", err)
		return
	}

	// Unlock before clearing task to avoid double-unlock
	a.taskManager.UnlockTask(taskID)
	locked = false
	a.taskManager.ClearTask(taskID)

	a.emitReloadEvent()
	a.logger.Info("Task completed successfully", "taskId", taskID)
}

// GetDebugInfo returns debug information about the environment and PATH
func (a *App) GetDebugInfo() map[string]string {
	pathFinder := utils.NewPathFinder()
	return pathFinder.DebugInfo()
}
