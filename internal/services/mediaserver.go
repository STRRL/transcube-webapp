package services

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// MediaServer handles serving video and subtitle files with proper streaming support
type MediaServer struct {
	storage *Storage
}

func NewMediaServer(storage *Storage) *MediaServer {
	return &MediaServer{storage: storage}
}

// ServeHTTP implements http.Handler interface for serving media files
func (m *MediaServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Only handle specific media paths
	if !strings.HasPrefix(r.URL.Path, "/media/") {
		http.NotFound(w, r)
		return
	}

	// Parse the request path: /media/{taskID}/{filename}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/media/"), "/")
	if len(parts) < 2 {
		http.NotFound(w, r)
		return
	}

	taskID := parts[0]
	filename := strings.Join(parts[1:], "/")

	// Get task to find work directory
	tasks, err := m.storage.GetAllTasks()
	if err != nil {
		http.Error(w, "Failed to load tasks", http.StatusInternalServerError)
		return
	}

	var workDir string
	for _, task := range tasks {
		if task.ID == taskID {
			workDir = task.WorkDir
			break
		}
	}

	if workDir == "" {
		http.NotFound(w, r)
		return
	}

	// Construct full file path
	filePath := filepath.Join(workDir, filename)

	// Security check: ensure the path is within workDir
	if !strings.HasPrefix(filePath, workDir) {
		http.Error(w, "Invalid file path", http.StatusForbidden)
		return
	}

	// Open the file
	file, err := os.Open(filePath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()

	// Get file info
	stat, err := file.Stat()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Set appropriate content type based on file extension
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".mp4":
		w.Header().Set("Content-Type", "video/mp4")
	case ".webm":
		w.Header().Set("Content-Type", "video/webm")
	case ".vtt":
		w.Header().Set("Content-Type", "text/vtt")
	case ".srt":
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	case ".aac", ".m4a":
		w.Header().Set("Content-Type", "audio/aac")
	}

	// Use http.ServeContent for proper range request support
	// This automatically handles:
	// - Range requests for video seeking
	// - If-Modified-Since headers
	// - Content-Length
	// - Proper status codes (206 Partial Content for ranges)
	http.ServeContent(w, r, filename, stat.ModTime(), file)
}