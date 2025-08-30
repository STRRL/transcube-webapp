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
	
    // First attempt: MP4 (best compatibility)
    mp4Path := filepath.Join(outputDir, "video.mp4")
    cmdMp4 := exec.Command("yt-dlp",
        "-f", "bestvideo[height<=1080][vcodec^=avc1]+bestaudio/bestvideo[height<=1080][vcodec^=h264]+bestaudio/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "--merge-output-format", "mp4",
        "--continue",
        "--no-playlist",
        "-o", mp4Path,
        url,
    )

    slog.Debug("Running yt-dlp (mp4) download command")
    output, err := cmdMp4.CombinedOutput()
    if err == nil {
        slog.Info("Video downloaded successfully (mp4)", "outputDir", outputDir)
        d.storage.SaveLog(outputDir, "download", "Video downloaded successfully (mp4)")
        return nil
    }

    // Fallback: WebM (more permissive for VP9/Opus)
    slog.Warn("MP4 download failed; attempting WebM fallback", "error", err)
    d.storage.SaveLog(outputDir, "download", "MP4 failed; attempting WebM fallback\n"+string(output))

    webmPath := filepath.Join(outputDir, "video.webm")
    cmdWebm := exec.Command("yt-dlp",
        "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "--merge-output-format", "webm",
        "--continue",
        "--no-playlist",
        "-o", webmPath,
        url,
    )
    slog.Debug("Running yt-dlp (webm) download command")
    output2, err2 := cmdWebm.CombinedOutput()
    if err2 != nil {
        slog.Error("Video download failed (webm fallback)", "error", err2, "output", string(output2))
        d.storage.SaveLog(outputDir, "download", "WebM fallback failed\n"+string(output2))
        return d.parseError(err2)
    }

    slog.Info("Video downloaded successfully (webm)", "outputDir", outputDir)
    d.storage.SaveLog(outputDir, "download", "Video downloaded successfully (webm)")
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
