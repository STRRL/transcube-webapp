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
	currentTaskID string
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

	a.logger.Info("Video metadata retrieved",
		"id", info.ID,
		"title", info.Title,
		"channel", info.Channel,
		"duration", info.Duration)

	return &types.VideoMetadata{
		ID:        info.ID,
		Title:     info.Title,
		Channel:   info.Channel,
		Duration:  int(info.Duration),
		Thumbnail: info.Thumbnail,
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
	a.currentTaskID = task.ID

	// Start processing in background
	go a.processTask(task)

	return task, nil
}

// GetCurrentTask returns the current running task
func (a *App) GetCurrentTask() *types.Task {
	return a.taskManager.GetCurrentTask()
}

// RetryTask retries a failed task
func (a *App) RetryTask(taskID string) (*types.Task, error) {
	task := a.taskManager.GetCurrentTask()
	if task == nil || task.ID != taskID {
		return nil, fmt.Errorf("task not found")
	}

	err := a.taskManager.RetryTask()
	if err != nil {
		return nil, err
	}

	// Start processing in background
	go a.processTask(task)

	return task, nil
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
func (a *App) processTask(task *types.Task) {
	a.logger.Info("Processing task started", "taskId", task.ID, "url", task.URL)

	// Update status to downloading
	a.taskManager.UpdateTaskStatus(types.TaskStatusDownloading, 10)
	a.logger.Debug("Task status updated", "taskId", task.ID, "status", "downloading")

	// Get video info
	a.logger.Debug("Fetching video info", "taskId", task.ID)
	info, err := a.downloader.GetVideoInfo(task.URL)
	if err != nil {
		a.logger.Error("Failed to get video info", "taskId", task.ID, "error", err)
		a.taskManager.SetTaskError(fmt.Sprintf("Failed to get video info: %v", err))
		return
	}
	a.logger.Info("Video info retrieved", "taskId", task.ID, "videoId", info.ID, "title", info.Title)

	// Update task metadata
	duration := time.Duration(info.Duration) * time.Second
	durationStr := fmt.Sprintf("%02d:%02d", int(duration.Minutes()), int(duration.Seconds())%60)

	err = a.taskManager.UpdateTaskMetadata(
		info.ID,
		info.Title,
		info.Channel,
		durationStr,
		info.Thumbnail,
	)
	if err != nil {
		a.taskManager.SetTaskError(fmt.Sprintf("Failed to update metadata: %v", err))
		return
	}

	// Create work directory
	workDir := a.storage.GetTaskDir(info.Title, info.ID)

	// Ensure work directory exists
	if err := os.MkdirAll(workDir, 0755); err != nil {
		a.logger.Error("Failed to create work directory", "taskId", task.ID, "path", workDir, "error", err)
		a.taskManager.SetTaskError(fmt.Sprintf("Failed to create work directory: %v", err))
		return
	}
	a.logger.Info("Work directory created", "taskId", task.ID, "path", workDir)

	// Update task with work directory
	task.WorkDir = workDir

	// Now save metadata after directory is created
	if err := a.storage.SaveMetadata(task); err != nil {
		a.logger.Error("Failed to save task metadata", "taskId", task.ID, "error", err)
	}

	// Download video
	a.taskManager.UpdateTaskStatus(types.TaskStatusDownloading, 30)
	a.logger.Info("Downloading video", "taskId", task.ID)
	err = a.downloader.DownloadVideo(task.URL, workDir)
	if err != nil {
		a.logger.Error("Failed to download video", "taskId", task.ID, "error", err)
		a.taskManager.SetTaskError(fmt.Sprintf("Failed to download video: %v", err))
		return
	}
	a.logger.Info("Video downloaded successfully", "taskId", task.ID)

	// Extract audio for transcription
	// Choose existing video file (prefer mp4, fallback to webm)
	videoPath := fmt.Sprintf("%s/video.mp4", workDir)
	if _, statErr := os.Stat(videoPath); os.IsNotExist(statErr) {
		alt := fmt.Sprintf("%s/video.webm", workDir)
		if _, statErr2 := os.Stat(alt); statErr2 == nil {
			videoPath = alt
		}
	}
	audioPath := fmt.Sprintf("%s/audio.aac", workDir)
	if _, statErr := os.Stat(videoPath); os.IsNotExist(statErr) {
		a.logger.Error("No downloaded video found for audio extraction", "taskId", task.ID)
		a.taskManager.SetTaskError("video file missing after download")
		return
	}
	a.logger.Info("Extracting audio from video", "taskId", task.ID)
	err = a.downloader.ExtractAudio(videoPath, audioPath)
	if err != nil {
		a.logger.Error("Failed to extract audio", "taskId", task.ID, "error", err)
		a.taskManager.SetTaskError(fmt.Sprintf("Failed to extract audio: %v", err))
		return
	}
	a.logger.Info("Audio extracted successfully", "taskId", task.ID)

	// Always use yap for transcription
	a.taskManager.UpdateTaskStatus(types.TaskStatusTranscribing, 60)
	a.logger.Info("Starting transcription with yap", "taskId", task.ID, "lang", task.SourceLang)
	err = a.yapRunner.Transcribe(audioPath, workDir, task.SourceLang)
	if err != nil {
		a.logger.Error("Failed to transcribe", "taskId", task.ID, "error", err)
		a.taskManager.SetTaskError(fmt.Sprintf("Failed to transcribe: %v", err))
		return
	}
	a.logger.Info("Transcription complete", "taskId", task.ID)

	// Summarizing stage via OpenRouter if configured
	a.taskManager.UpdateTaskStatus(types.TaskStatusSummarizing, 85)
	a.logger.Info("Starting summarization", "taskId", task.ID, "provider", a.settings.APIProvider)

	// Load transcript text (use the SRT file we generated)
	srtPath := fmt.Sprintf("%s/subs_%s.srt", workDir, task.SourceLang)
	srtBytes, err := os.ReadFile(srtPath)
	if err != nil {
		a.logger.Error("Failed to read transcript for summary", "taskId", task.ID, "error", err)
		a.taskManager.SetTaskError(fmt.Sprintf("Failed to read transcript for summary: %v", err))
		return
	}

	// Only implement OpenRouter path for now (requested)
	// For now, always try OpenRouter summarization as requested.
	sumBytes, err := a.summarizer.SummarizeStructured(a.ctx, a.settings.APIKey, string(srtBytes), a.settings.SummaryLength, a.settings.SummaryLanguage, a.settings.Temperature, a.settings.MaxTokens)
	summaryPath := fmt.Sprintf("%s/summary_structured.json", workDir)
	if err != nil {
		// Log but do not fail the entire task; save a minimal placeholder
		a.logger.Error("Summarization failed", "taskId", task.ID, "error", err)
		_ = a.storage.SaveLog(workDir, "summarize", fmt.Sprintf("Summary generation failed: %v", err))
		// Save placeholder to avoid 404s in UI
		placeholder := []byte(`{"type":"structured","content":{"keyPoints":[],"mainTopic":"","conclusion":"","tags":[]}}`)
		if werr := os.WriteFile(summaryPath, placeholder, 0644); werr != nil {
			a.logger.Error("Failed to write placeholder summary", "taskId", task.ID, "error", werr)
		}
	} else {
		if werr := os.WriteFile(summaryPath, sumBytes, 0644); werr != nil {
			a.logger.Error("Failed to write summary", "taskId", task.ID, "error", werr)
			_ = a.storage.SaveLog(workDir, "summarize", fmt.Sprintf("Failed to write summary: %v", werr))
		} else {
			_ = a.storage.SaveLog(workDir, "summarize", "Summary generated via OpenRouter")
			a.logger.Info("Summarization complete", "taskId", task.ID, "path", summaryPath)
		}
	}

	// Mark as done
	a.taskManager.UpdateTaskStatus(types.TaskStatusDone, 100)
	a.emitReloadEvent()
	a.logger.Info("Task completed successfully", "taskId", task.ID)

	// Clear current task ID
	if a.currentTaskID == task.ID {
		a.currentTaskID = ""
	}
}

// GetDebugInfo returns debug information about the environment and PATH
func (a *App) GetDebugInfo() map[string]string {
	pathFinder := utils.NewPathFinder()
	return pathFinder.DebugInfo()
}
