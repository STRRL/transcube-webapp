package services

import (
	"bufio"
	"fmt"
	"io"
	"regexp"
	"strings"
)

// ConvertSRTToVTT converts SRT subtitle format to WebVTT format
func ConvertSRTToVTT(reader io.Reader, writer io.Writer) error {
	scanner := bufio.NewScanner(reader)
	
	// Write WebVTT header
	fmt.Fprintln(writer, "WEBVTT")
	fmt.Fprintln(writer)
	
	// SRT timestamp regex: 00:00:00,000 --> 00:00:00,000
	timestampRegex := regexp.MustCompile(`(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})`)
	
	for scanner.Scan() {
		line := scanner.Text()
		
		// Skip subtitle numbers (they're not needed in VTT)
		if isSubtitleNumber(line) {
			continue
		}
		
		// Convert SRT timestamp format to VTT format
		// SRT uses comma for milliseconds, VTT uses period
		if timestampRegex.MatchString(line) {
			line = timestampRegex.ReplaceAllString(line, "$1.$2 --> $3.$4")
		}
		
		fmt.Fprintln(writer, line)
	}
	
	return scanner.Err()
}

// isSubtitleNumber checks if a line is just a subtitle number
func isSubtitleNumber(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return false
	}
	
	// Check if the line contains only digits
	for _, r := range trimmed {
		if r < '0' || r > '9' {
			return false
		}
	}
	
	return true
}