//go:build darwin

package services

import (
	"context"
	"strings"
	"testing"
)

// TestEnsureInstalledUnsupportedLocale exercises the embedded helper end to
// end: extraction, execution, and error propagation. An unsupported locale is
// used because it fails deterministically without touching system state.
func TestEnsureInstalledUnsupportedLocale(t *testing.T) {
	s := NewSpeechAssets()
	err := s.EnsureInstalled(context.Background(), "xx-XX")
	if err == nil {
		t.Fatal("expected error for unsupported locale, got nil")
	}
	if !strings.Contains(err.Error(), "ensure speech assets for xx-XX") {
		t.Fatalf("unexpected error: %v", err)
	}
}
