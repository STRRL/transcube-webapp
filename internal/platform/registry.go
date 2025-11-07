package platform

var registry = []Platform{
	&YouTubePlatform{},
	&BilibiliPlatform{},
}

type Registry struct {
	platforms []Platform
}

func NewRegistry() *Registry {
	return &Registry{
		platforms: registry,
	}
}

func (r *Registry) Detect(url string) Platform {
	for _, p := range r.platforms {
		if p.DetectURL(url) {
			return p
		}
	}
	return nil
}

func (r *Registry) DetectPlatformName(url string) string {
	p := r.Detect(url)
	if p == nil {
		return string(Unknown)
	}
	return p.Name()
}

func (r *Registry) ExtractVideoID(url string) string {
	p := r.Detect(url)
	if p == nil {
		return ""
	}
	return p.ExtractVideoID(url)
}

func (r *Registry) GetPlatform(name string) Platform {
	for _, p := range r.platforms {
		if p.Name() == name {
			return p
		}
	}
	return nil
}
