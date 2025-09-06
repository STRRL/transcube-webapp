package utils

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type PathFinder struct {
	pathCache map[string]string
}

func NewPathFinder() *PathFinder {
	pf := &PathFinder{
		pathCache: make(map[string]string),
	}
	pf.initializePATH()
	return pf
}

func (pf *PathFinder) initializePATH() {
	currentPath := os.Getenv("PATH")
	slog.Info("Current PATH", "path", currentPath)
	
	additionalPaths := []string{
		"/opt/homebrew/bin",
		"/opt/homebrew/sbin",
		"/usr/local/bin",
		"/usr/local/sbin",
		"/usr/bin",
		"/bin",
		"/usr/sbin",
		"/sbin",
	}
	
	if runtime.GOOS == "darwin" {
		homeDir, _ := os.UserHomeDir()
		if homeDir != "" {
			additionalPaths = append([]string{
				filepath.Join(homeDir, ".local", "bin"),
				filepath.Join(homeDir, "bin"),
			}, additionalPaths...)
		}
	}
	
	pathSet := make(map[string]bool)
	paths := strings.Split(currentPath, string(os.PathListSeparator))
	for _, p := range paths {
		if p != "" {
			pathSet[p] = true
		}
	}
	
	for _, p := range additionalPaths {
		if _, exists := os.Stat(p); exists == nil && !pathSet[p] {
			paths = append(paths, p)
			pathSet[p] = true
		}
	}
	
	newPath := strings.Join(paths, string(os.PathListSeparator))
	os.Setenv("PATH", newPath)
	slog.Info("Updated PATH", "path", newPath)
}

func (pf *PathFinder) FindExecutable(name string) (string, error) {
	if cached, ok := pf.pathCache[name]; ok {
		if _, err := os.Stat(cached); err == nil {
			return cached, nil
		}
		delete(pf.pathCache, name)
	}
	
	if path, err := exec.LookPath(name); err == nil {
		absPath, _ := filepath.Abs(path)
		pf.pathCache[name] = absPath
		slog.Debug("Found executable", "name", name, "path", absPath)
		return absPath, nil
	}
	
	possiblePaths := []string{
		filepath.Join("/opt/homebrew/bin", name),
		filepath.Join("/usr/local/bin", name),
		filepath.Join("/usr/bin", name),
		filepath.Join("/bin", name),
	}
	
	if runtime.GOOS == "darwin" {
		homeDir, _ := os.UserHomeDir()
		if homeDir != "" {
			possiblePaths = append([]string{
				filepath.Join(homeDir, ".local", "bin", name),
				filepath.Join(homeDir, "bin", name),
			}, possiblePaths...)
		}
	}
	
	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			if err := pf.isExecutable(path); err == nil {
				pf.pathCache[name] = path
				slog.Debug("Found executable at fallback path", "name", name, "path", path)
				return path, nil
			}
		}
	}
	
	slog.Error("Executable not found", "name", name)
	return "", fmt.Errorf("executable '%s' not found in PATH or common locations", name)
}

func (pf *PathFinder) isExecutable(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	
	if runtime.GOOS != "windows" {
		if info.Mode()&0111 == 0 {
			return fmt.Errorf("file is not executable")
		}
	}
	
	return nil
}

func (pf *PathFinder) GetExecutableInfo(name string) string {
	path, err := pf.FindExecutable(name)
	if err != nil {
		return fmt.Sprintf("%s: not found", name)
	}
	
	cmd := exec.Command(path, "--version")
	output, _ := cmd.CombinedOutput()
	lines := strings.Split(string(output), "\n")
	if len(lines) > 0 && lines[0] != "" {
		return fmt.Sprintf("%s: %s (at %s)", name, strings.TrimSpace(lines[0]), path)
	}
	
	return fmt.Sprintf("%s: found at %s", name, path)
}

func (pf *PathFinder) DebugInfo() map[string]string {
	info := make(map[string]string)
	info["PATH"] = os.Getenv("PATH")
	info["OS"] = runtime.GOOS
	info["ARCH"] = runtime.GOARCH
	info["WorkingDir"], _ = os.Getwd()
	
	for _, tool := range []string{"ffmpeg", "yt-dlp", "yap"} {
		info[tool] = pf.GetExecutableInfo(tool)
	}
	
	return info
}