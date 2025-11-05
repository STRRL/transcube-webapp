package platform

import (
	"net/url"
	"regexp"
	"strings"
)

type YouTubePlatform struct{}

func (y *YouTubePlatform) Name() string {
	return string(YouTube)
}

func (y *YouTubePlatform) DetectURL(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err == nil && u.Host != "" {
		host := strings.ToLower(u.Host)
		if strings.Contains(host, "youtube.com") || strings.Contains(host, "youtu.be") {
			return true
		}
	}

	if strings.Contains(rawURL, "youtube.com") || strings.Contains(rawURL, "youtu.be") {
		return true
	}

	return false
}

func (y *YouTubePlatform) ExtractVideoID(rawURL string) string {
	patterns := []string{
		`(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)`,
		`^([^&\n?#]+)$`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(rawURL); len(match) > 1 {
			return match[1]
		}
	}

	return ""
}
