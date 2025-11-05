package platform

import (
	"net/url"
	"regexp"
	"strings"
)

type BilibiliPlatform struct{}

func (b *BilibiliPlatform) Name() string {
	return string(Bilibili)
}

func (b *BilibiliPlatform) DetectURL(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err == nil && u.Host != "" {
		host := strings.ToLower(u.Host)
		if strings.Contains(host, "bilibili.com") {
			return true
		}
	}

	if strings.Contains(rawURL, "bilibili.com") {
		return true
	}

	return false
}

func (b *BilibiliPlatform) ExtractVideoID(rawURL string) string {
	re := regexp.MustCompile(`(BV[a-zA-Z0-9]{10})`)
	if match := re.FindStringSubmatch(rawURL); len(match) > 1 {
		return match[1]
	}

	return ""
}
