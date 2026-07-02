//go:build !darwin

package services

import (
	"context"
	"fmt"
)

// SpeechAssets is a stub on non-darwin platforms. Speech model assets are
// managed by the macOS Speech framework, which does not exist elsewhere; this
// stub keeps the package compiling without the swiftc-built helper binary.
type SpeechAssets struct{}

func NewSpeechAssets() *SpeechAssets {
	return &SpeechAssets{}
}

func (s *SpeechAssets) EnsureInstalled(_ context.Context, locale string) error {
	return fmt.Errorf("speech model assets for %s can only be installed on macOS", locale)
}
