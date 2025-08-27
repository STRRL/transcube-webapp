# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Wails v2 desktop application that combines:
- **Backend**: Go 1.23 for application logic
- **Frontend**: React 18 + TypeScript + Vite for the user interface
- **Bridge**: Wails automatically generates JavaScript bindings for Go methods

## Essential Commands

### Development
```bash
# Start development mode with hot reload (runs both backend and frontend)
wails dev

# Frontend-only development (if needed)
cd frontend && npm run dev
```

### Building
```bash
# Build production application
wails build

# Build frontend only
cd frontend && npm run build
```

### Dependencies
```bash
# Install frontend dependencies
cd frontend && npm install

# Update Go dependencies
go mod tidy
```

## Architecture

### Go-Frontend Communication
- Go methods in `app.go` are automatically exposed to the frontend via Wails
- Frontend accesses these through generated bindings in `frontend/wailsjs/go/`
- Example: `Greet(name string)` in Go becomes `Greet(name)` in TypeScript

### Directory Structure
- `app.go` - Main application logic and exposed methods
- `main.go` - Application entry point and Wails setup
- `frontend/src/` - React components and application UI
- `frontend/wailsjs/` - Auto-generated bindings (DO NOT EDIT)
- `build/` - Build outputs and application resources

### Adding New Features

1. **Backend Methods**: Add methods to the `App` struct in `app.go`
2. **Frontend Access**: After running `wails dev`, bindings are auto-generated
3. **Use in React**: Import from `wailsjs/go/main/App` and call methods

Example:
```go
// In app.go
func (a *App) NewMethod(input string) string {
    return "Result: " + input
}
```

```typescript
// In React component
import { NewMethod } from '../wailsjs/go/main/App';
const result = await NewMethod("test");
```

### Important Notes

- The `frontend/wailsjs/` directory is auto-generated - never edit these files manually
- Frontend dev server runs on http://localhost:34115 during development
- Wails embeds the frontend dist into the Go binary for production builds
- Context is passed to backend methods for lifecycle management