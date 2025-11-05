package platform

type Platform interface {
	Name() string
	DetectURL(url string) bool
	ExtractVideoID(url string) string
}

type PlatformName string

const (
	YouTube  PlatformName = "youtube"
	Bilibili PlatformName = "bilibili"
	Unknown  PlatformName = "unknown"
)
