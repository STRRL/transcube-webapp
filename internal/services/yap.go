package services

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type YapRunner struct {
	storage *Storage
}

func NewYapRunner(storage *Storage) *YapRunner {
	return &YapRunner{storage: storage}
}

// Transcribe uses yap to transcribe audio to SRT
func (y *YapRunner) Transcribe(audioPath string, outputDir string, language string) error {
	// Map language codes to yap locale format
	locale := y.mapLanguageToLocale(language)
	slog.Info("Starting transcription with yap",
		"audioPath", audioPath,
		"language", language,
		"locale", locale)

	// Output file name based on language
	outputFile := filepath.Join(outputDir, fmt.Sprintf("subs_%s.srt", language))

	// Build yap command
	cmd := exec.Command("yap", "transcribe",
		audioPath,
		"--srt",
		"--locale", locale,
		"--output-file", outputFile,
	)

	// Execute command
	slog.Debug("Running yap transcribe command", "cmd", cmd.String())
	output, err := cmd.CombinedOutput()
	if err != nil {
		slog.Error("Yap transcription failed",
			"error", err,
			"output", string(output),
			"audioPath", audioPath)
		// Log the error
		if logErr := y.storage.SaveLog(outputDir, "asr", fmt.Sprintf("Transcription failed: %s", string(output))); logErr != nil {
			slog.Warn("save transcription log", "error", logErr)
		}
		return fmt.Errorf("transcription failed: %v", err)
	}

	// Check if output file was created
	if _, err := os.Stat(outputFile); os.IsNotExist(err) {
		slog.Error("Transcription output file not created", "outputFile", outputFile)
		return fmt.Errorf("transcription completed but no output file created")
	}

	slog.Info("Transcription completed successfully",
		"outputFile", outputFile,
		"language", language)

	// Log success
	if logErr := y.storage.SaveLog(outputDir, "asr", fmt.Sprintf("Transcription completed for language: %s", language)); logErr != nil {
		slog.Warn("save transcription log", "error", logErr)
	}

	return nil
}

// mapLanguageToLocale maps language codes to yap locale format
func (y *YapRunner) mapLanguageToLocale(lang string) string {
	// Map common language codes to yap locale format
	localeMap := map[string]string{
		"en": "en-US",
		"zh": "zh-CN",
		"es": "es-ES",
		"fr": "fr-FR",
		"de": "de-DE",
		"ja": "ja-JP",
		"ko": "ko-KR",
		"ru": "ru-RU",
		"pt": "pt-BR",
		"it": "it-IT",
	}

	if locale, ok := localeMap[lang]; ok {
		return locale
	}

	// Default to the language code with region suffix
	if len(lang) == 2 {
		return strings.ToLower(lang) + "-" + strings.ToUpper(lang)
	}

	return lang
}

// IsInstalled checks if yap is available
func (y *YapRunner) IsInstalled() bool {
	_, err := exec.LookPath("yap")
	return err == nil
}
