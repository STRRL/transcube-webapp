package services

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

type Downloader struct {
	storage *Storage
}

func NewDownloader(storage *Storage) *Downloader {
	return &Downloader{storage: storage}
}

// VideoInfo represents the metadata returned by yt-dlp
type VideoInfo struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Channel     string  `json:"channel,omitempty"`
	Uploader    string  `json:"uploader,omitempty"`
	Duration    float64 `json:"duration"`
	Thumbnail   string  `json:"thumbnail"`
	Description string  `json:"description"`
	UploadDate  string  `json:"upload_date"`
}

// GetVideoInfo fetches video metadata using yt-dlp
func (d *Downloader) GetVideoInfo(url string) (*VideoInfo, error) {
	slog.Debug("Fetching video info with yt-dlp", "url", url)
	cmd := exec.Command("yt-dlp", "--dump-json", "--no-playlist", url)
	output, err := cmd.Output()
	if err != nil {
		slog.Error("yt-dlp failed to get video info", "url", url, "error", err)
		return nil, d.parseError(err)
	}
	
	var info VideoInfo
	if err := json.Unmarshal(output, &info); err != nil {
		slog.Error("Failed to parse video JSON", "error", err)
		return nil, fmt.Errorf("failed to parse video info: %v", err)
	}
	
	slog.Info("Video info retrieved", "id", info.ID, "title", info.Title, "duration", info.Duration)
	
	// Use uploader if channel is empty
	if info.Channel == "" {
		info.Channel = info.Uploader
	}
	
	return &info, nil
}

// DownloadVideo downloads the video file (with audio)
func (d *Downloader) DownloadVideo(url string, outputDir string) error {
	slog.Info("Starting video download", "url", url, "outputDir", outputDir)
	
	// Ensure output directory exists
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		slog.Error("Failed to create output directory", "dir", outputDir, "error", err)
		return err
	}
	
	outputPath := filepath.Join(outputDir, "video.mp4")
	
	// Build yt-dlp command - prefer H.264 but don't force re-encoding
	// Format selection priority:
	// 1. H.264 video + AAC audio (best compatibility)
	// 2. H.264 video + any audio
	// 3. Any format up to 1080p (will be AV1/VP9 on newer videos)
	cmd := exec.Command("yt-dlp",
		"-f", "bestvideo[height<=1080][vcodec^=avc1]+bestaudio/bestvideo[height<=1080][vcodec^=h264]+bestaudio/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
		"--merge-output-format", "mp4",
		"--continue",
		"--no-playlist",
		"-o", outputPath,
		url,
	)
	
	// Execute command
	slog.Debug("Running yt-dlp video download command")
	output, err := cmd.CombinedOutput()
	if err != nil {
		slog.Error("Video download failed", "error", err, "output", string(output))
		// Log the error
		d.storage.SaveLog(outputDir, "download", string(output))
		return d.parseError(err)
	}
	
	slog.Info("Video downloaded successfully", "outputDir", outputDir)
	// Log success
	d.storage.SaveLog(outputDir, "download", "Video downloaded successfully")
	
	return nil
}


// parseError parses yt-dlp errors to provide user-friendly messages
func (d *Downloader) parseError(err error) error {
	if exitErr, ok := err.(*exec.ExitError); ok {
		stderr := string(exitErr.Stderr)
		
		// Check for common error patterns
		if strings.Contains(stderr, "ERROR: Private video") {
			return fmt.Errorf("video is private")
		}
		if strings.Contains(stderr, "ERROR: Video unavailable") {
			return fmt.Errorf("video is unavailable")
		}
		if strings.Contains(stderr, "ERROR: This video is not available") {
			return fmt.Errorf("video is not available in your region")
		}
		if strings.Contains(stderr, "ERROR: Unable to extract video data") {
			return fmt.Errorf("unable to extract video data")
		}
		if strings.Contains(stderr, "ERROR: Forbidden") || strings.Contains(stderr, "HTTP Error 403") {
			return fmt.Errorf("access forbidden (403)")
		}
		if strings.Contains(stderr, "HTTP Error 410") {
			return fmt.Errorf("video no longer exists (410)")
		}
		
		// Extract video ID if present for better error context
		if match := regexp.MustCompile(`\[youtube\] ([a-zA-Z0-9_-]+):`).FindStringSubmatch(stderr); len(match) > 1 {
			return fmt.Errorf("failed to process video %s: %v", match[1], err)
		}
	}
	
	return fmt.Errorf("download failed: %v", err)
}

// ExtractVideoID extracts the video ID from a YouTube URL
func (d *Downloader) ExtractVideoID(url string) string {
	patterns := []string{
		`(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)`,
		`^([^&\n?#]+)$`,
	}
	
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(url); len(match) > 1 {
			return match[1]
		}
	}
	
	return ""
}

// ExtractAudio extracts audio from video file for transcription
func (d *Downloader) ExtractAudio(videoPath string, audioPath string) error {
	slog.Info("Extracting audio from video", "videoPath", videoPath, "audioPath", audioPath)
	
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-vn", // no video
		"-acodec", "aac",
		"-ar", "16000", // 16kHz for transcription
		"-ac", "1", // mono
		"-y", // overwrite output
		audioPath,
	)
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		slog.Error("Audio extraction failed", "error", err, "output", string(output))
		return fmt.Errorf("failed to extract audio: %v", err)
	}
	
	slog.Info("Audio extracted successfully", "audioPath", audioPath)
	return nil
}