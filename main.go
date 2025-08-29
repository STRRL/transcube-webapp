package main

import (
	"embed"
	"net/http"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// AssetHandler serves both embedded assets and media files
type AssetHandler struct {
	mediaServer http.Handler
}

func (h *AssetHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Route /media/* requests to the media server
	if strings.HasPrefix(r.URL.Path, "/media/") {
		h.mediaServer.ServeHTTP(w, r)
		return
	}
	
	// All other requests return 404 (will be handled by embedded assets)
	http.NotFound(w, r)
}

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create asset handler with media server
	assetHandler := &AssetHandler{
		mediaServer: app.mediaServer,
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "transcube-webapp",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: assetHandler,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
