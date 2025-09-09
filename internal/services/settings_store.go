package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"transcube-webapp/internal/types"
)

// SettingsStore persists app settings to the user's config directory
type SettingsStore struct {
	filePath string
}

func NewSettingsStore() (*SettingsStore, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to resolve config dir: %w", err)
	}
	appDir := filepath.Join(configDir, "TransCube")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		return nil, fmt.Errorf("failed to create app config dir: %w", err)
	}
	return &SettingsStore{filePath: filepath.Join(appDir, "settings.json")}, nil
}

func (s *SettingsStore) Load() (*types.Settings, error) {
	f, err := os.Open(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("open settings: %w", err)
	}
	defer f.Close()
	var st types.Settings
	if err := json.NewDecoder(f).Decode(&st); err != nil {
		return nil, fmt.Errorf("decode settings: %w", err)
	}
	return &st, nil
}

func (s *SettingsStore) Save(st types.Settings) error {
	tmp := s.filePath + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("open temp settings: %w", err)
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(st); err != nil {
		f.Close()
		return fmt.Errorf("encode settings: %w", err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("close temp settings: %w", err)
	}
	return os.Rename(tmp, s.filePath)
}
