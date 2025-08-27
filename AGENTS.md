# Repository Guidelines

## Project Structure & Modules
- Root Go app (Wails): `main.go`, `app.go`, config in `wails.json`.
- Frontend (React + TS): `frontend/` with sources in `frontend/src` and assets in `frontend/src/assets`.
- Build artifacts: `frontend/dist` (frontend), `build/` (packaging, platform files).

## Build, Test, and Development
- Local dev (full app): `wails dev` — runs Vite with hot reload and Wails bridge.
- Frontend only: `cd frontend && npm run dev` — Vite dev server.
- Build app: `wails build` — produces production bundle and desktop binaries.
- Frontend build: `cd frontend && npm run build` — TS compile + Vite build.
- Go tests (if added): `go test ./...` — runs unit tests across modules.

Prereqs: Go 1.23+, Node 16+, Wails CLI installed (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`).

## Coding Style & Naming
- Go: format with `go fmt ./...`; keep packages lowercase, exported symbols in PascalCase, errors with `%w` when wrapping.
- TypeScript/React: 2‑space indent, `PascalCase` for components (`App.tsx`), `camelCase` for variables, keep JSX files as `.tsx`.
- Imports: group stdlib/external/local (Go) and keep relative paths stable (TS).

## Testing Guidelines
- Go tests: place next to sources as `*_test.go`; table‑driven tests encouraged; aim for core logic coverage.
- Frontend tests: none configured; if adding, prefer Vitest + React Testing Library; colocate as `Component.test.tsx`.
- Run with `go test ./...` and (if configured) `npm test` in `frontend/`.

## Commit & PR Guidelines
- Commits: use concise, imperative messages. Conventional Commits style is preferred: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- PRs: include purpose, scope, screenshots (UI changes), and linked issues. Keep diffs focused; update docs when behavior changes.
- CI/build checks should pass (`wails build`, frontend build) before requesting review.

## Notes & Tips
- Wails bridges Go methods via bindings in `frontend/wailsjs/`; re‑build after changing Go APIs.
- Do not commit built artifacts under `frontend/dist` or platform binaries under `build/bin/`.
