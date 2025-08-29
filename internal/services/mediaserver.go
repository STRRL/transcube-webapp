package services

import (
	"bytes"
	"io"
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
	// Set CORS headers for subtitle and video files
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Range, Content-Type")
	
	// Handle preflight requests
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
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

	// Check if client is requesting a VTT file that doesn't exist but SRT does
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == ".vtt" {
		// Try to find corresponding SRT file
		srtFilename := strings.TrimSuffix(filename, ".vtt") + ".srt"
		srtPath := filepath.Join(workDir, srtFilename)
		
		if _, err := os.Stat(srtPath); err == nil {
			// SRT file exists, convert it to VTT on the fly
			srtFile, err := os.Open(srtPath)
			if err != nil {
				http.Error(w, "Failed to open subtitle file", http.StatusInternalServerError)
				return
			}
			defer srtFile.Close()
			
			// Convert SRT to VTT
			var vttBuffer bytes.Buffer
			if err := ConvertSRTToVTT(srtFile, &vttBuffer); err != nil {
				http.Error(w, "Failed to convert subtitle", http.StatusInternalServerError)
				return
			}
			
			// Serve the converted VTT
			w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
			w.Header().Set("Access-Control-Allow-Origin", "*")
			io.Copy(w, &vttBuffer)
			return
		}
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
	switch ext {
	case ".mp4":
		w.Header().Set("Content-Type", "video/mp4")
	case ".webm":
		w.Header().Set("Content-Type", "video/webm")
	case ".vtt":
		w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
	case ".srt":
		// Convert SRT to VTT for browser compatibility
		var vttBuffer bytes.Buffer
		if err := ConvertSRTToVTT(file, &vttBuffer); err != nil {
			// If conversion fails, serve as plain text
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			file.Seek(0, 0)
			io.Copy(w, file)
			return
		}
		w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
		io.Copy(w, &vttBuffer)
		return
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