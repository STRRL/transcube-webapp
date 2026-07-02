//go:build darwin

package services

import (
	"context"
	_ "embed"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
	"time"
)

// The helper binary is compiled from speechassets_helper.swift by
// `make speech-assets` (also wired as a Wails pre-build hook).
//
//go:embed bin/speech-assets
var speechAssetsHelperBinary []byte

// speechAssetsTimeout bounds a model download; models are a few hundred MB.
const speechAssetsTimeout = 10 * time.Minute

// SpeechAssets pre-installs on-device speech recognition model assets.
// yap's built-in asset download reliably fails with CancellationError when a
// locale's model is missing, so we install assets ourselves via the Speech
// framework before invoking yap.
type SpeechAssets struct{}

func NewSpeechAssets() *SpeechAssets {
	return &SpeechAssets{}
}

// EnsureInstalled downloads and installs the speech model assets for the given
// BCP47 locale if they are not already present. It is a no-op when the assets
// are installed. The embedded helper binary carries no runtime dependencies
// beyond the OS-provided Swift runtime.
func (s *SpeechAssets) EnsureInstalled(ctx context.Context, locale string) error {
	helperPath, err := s.extractHelper()
	if err != nil {
		return err
	}
	defer func() {
		if removeErr := os.Remove(helperPath); removeErr != nil {
			slog.Warn("remove speech assets helper", "error", removeErr)
		}
	}()

	ctx, cancel := context.WithTimeout(ctx, speechAssetsTimeout)
	defer cancel()

	slog.Info("Ensuring speech model assets are installed", "locale", locale)
	cmd := exec.CommandContext(ctx, helperPath, locale)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ensure speech assets for %s: %w: %s", locale, err, strings.TrimSpace(string(output)))
	}

	slog.Info("Speech model assets ready", "locale", locale, "output", strings.TrimSpace(string(output)))
	return nil
}

// extractHelper writes the embedded helper binary to a temporary file and
// makes it executable. Files created by the app carry no quarantine
// attribute, so Gatekeeper does not block them.
func (s *SpeechAssets) extractHelper() (string, error) {
	helperFile, err := os.CreateTemp("", "transcube-speech-assets-*")
	if err != nil {
		return "", fmt.Errorf("create helper binary: %w", err)
	}
	if _, err := helperFile.Write(speechAssetsHelperBinary); err != nil {
		if closeErr := helperFile.Close(); closeErr != nil {
			slog.Warn("close speech assets helper", "error", closeErr)
		}
		return "", fmt.Errorf("write helper binary: %w", err)
	}
	if err := helperFile.Close(); err != nil {
		return "", fmt.Errorf("close helper binary: %w", err)
	}
	if err := os.Chmod(helperFile.Name(), 0o755); err != nil {
		return "", fmt.Errorf("chmod helper binary: %w", err)
	}
	return helperFile.Name(), nil
}
