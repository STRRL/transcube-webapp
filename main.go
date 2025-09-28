package main

import (
	"embed"
	"net/http"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	macopts "github.com/wailsapp/wails/v2/pkg/options/mac"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
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

	// Create application menu
	appMenu := menu.NewMenu()

	// Add App menu on macOS (required for macOS apps)
	if runtime.GOOS == "darwin" {
		appMenu.Append(menu.AppMenu())
	}

	// Create File menu with Close window option
	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("Close Window", keys.CmdOrCtrl("w"), func(cd *menu.CallbackData) {
		if app.ctx != nil {
			wailsruntime.Quit(app.ctx)
		}
	})

	// Add Edit menu with standard copy/paste/cut operations on macOS
	if runtime.GOOS == "darwin" {
		appMenu.Append(menu.EditMenu())
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
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		OnStartup:        app.startup,
		Menu:             appMenu,
		Mac: &macopts.Options{
			TitleBar: &macopts.TitleBar{
				TitlebarAppearsTransparent: false,
				FullSizeContent:            false,
				UseToolbar:                 false,
				HideTitle:                  false,
			},
			Appearance:           macopts.NSAppearanceNameAqua,
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			Preferences: &macopts.Preferences{
				// Enable DOM Element Fullscreen API in WKWebView (macOS 12.3+)
				FullscreenEnabled: macopts.Enabled,
			},
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
