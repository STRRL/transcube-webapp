package services

import (
	"transcube-webapp/internal/types"
	"transcube-webapp/internal/utils"
)

type DependencyChecker struct {
	pathFinder *utils.PathFinder
}

func NewDependencyChecker() *DependencyChecker {
	return &DependencyChecker{
		pathFinder: utils.NewPathFinder(),
	}
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
	_, err := d.pathFinder.FindExecutable(cmd)
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
