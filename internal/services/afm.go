package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// AFMClient wraps the `afm` command line tool provided by Apple Foundation Models.
type AFMClient struct {
	command string
	timeout time.Duration
}

// NewAFMClient constructs a client that invokes the `afm` CLI. Set AFM_CLI_PATH to override.
func NewAFMClient() *AFMClient {
	cmd := os.Getenv("AFM_CLI_PATH")
	if cmd == "" {
		cmd = "afm"
	}
	return &AFMClient{
		command: cmd,
		timeout: 120 * time.Second,
	}
}

// SummarizeStructured generates a structured summary JSON blob using the AFM CLI.
func (c *AFMClient) SummarizeStructured(ctx context.Context, transcript string, length string, language string) ([]byte, error) {
	if strings.TrimSpace(transcript) == "" {
		return nil, errors.New("transcript is empty")
	}

	if length == "" {
		length = "medium"
	}
	if language == "" {
		language = "en"
	}

	languageMap := map[string]string{
		"en": "English",
		"zh": "Chinese",
		"ja": "Japanese",
		"ko": "Korean",
		"es": "Spanish",
		"fr": "French",
		"de": "German",
		"ru": "Russian",
		"pt": "Portuguese",
		"it": "Italian",
	}

	langName := languageMap[language]
	if langName == "" {
		langName = "English"
	}

	prompt := buildAFMSummaryPrompt(transcript, length, langName)

	execCtx := ctx
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		execCtx, cancel = context.WithTimeout(ctx, c.timeout)
		defer cancel()
	}

	cmd := exec.CommandContext(execCtx, c.command)
	cmd.Stdin = bytes.NewBufferString(prompt)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if stderr.Len() > 0 {
			return nil, fmt.Errorf("afm execution failed: %v: %s", err, stderr.String())
		}
		return nil, fmt.Errorf("afm execution failed: %w", err)
	}

	cleaned := extractJSON(stdout.Bytes())
	if len(cleaned) == 0 {
		return nil, fmt.Errorf("afm returned empty response")
	}

	// Validate JSON structure roughly once before returning.
	var parsed map[string]interface{}
	if err := json.Unmarshal(cleaned, &parsed); err != nil {
		return nil, fmt.Errorf("invalid JSON from afm: %w", err)
	}

	return cleaned, nil
}

func buildAFMSummaryPrompt(transcript, length, language string) string {
	var b strings.Builder
	b.WriteString("You are a precise assistant that summarizes long transcripts.\\n")
	b.WriteString("Return ONLY a valid JSON object without markdown fences.\\n")
	b.WriteString("The JSON MUST match this structure exactly: ")
	b.WriteString("{\"type\":\"structured\",\"content\":{\"keyPoints\":[...],\"mainTopic\":\"\",\"conclusion\":\"\",\"tags\":[...]}}\\n")
	b.WriteString("Guidelines: keyPoints should contain 3-8 concise bullet sentences; tags 3-6 short keywords.\\n")
	b.WriteString(fmt.Sprintf("Write every value in %s. Aim for a %s length summary.\\n", language, length))
	b.WriteString("If information is missing, leave the field empty rather than hallucinating.\\n")
	b.WriteString("Transcript begins below:\\n")
	b.WriteString("---\\n")
	b.WriteString(transcript)
	b.WriteString("\\n---\\n")
	return b.String()
}

func extractJSON(out []byte) []byte {
	trimmed := bytes.TrimSpace(out)
	if len(trimmed) == 0 {
		return nil
	}

	first := bytes.IndexByte(trimmed, '{')
	last := bytes.LastIndexByte(trimmed, '}')
	if first == -1 || last == -1 || last < first {
		return nil
	}
	candidate := trimmed[first : last+1]
	return bytes.TrimSpace(candidate)
}
