package services

import (
	"os/exec"
	"transcube-webapp/internal/types"
)

type DependencyChecker struct{}

func NewDependencyChecker() *DependencyChecker {
	return &DependencyChecker{}
}

// Check verifies all required dependencies are installed
func (d *DependencyChecker) Check() types.DependencyStatus {
	return types.DependencyStatus{
		YtDlp:  d.isInstalled("yt-dlp"),
		FFmpeg: d.isInstalled("ffmpeg"),
		Yap:    d.isInstalled("yap"),
	}
}

// isInstalled checks if a command exists in PATH
func (d *DependencyChecker) isInstalled(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

// GetInstallCommand returns the installation command for missing dependencies
func (d *DependencyChecker) GetInstallCommand(dep string) string {
	switch dep {
	case "yt-dlp":
		return "brew install yt-dlp"
	case "ffmpeg":
		return "brew install ffmpeg"
	case "yap":
		return "brew install yap"
	default:
		return ""
	}
}