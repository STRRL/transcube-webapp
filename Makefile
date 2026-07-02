.DEFAULT_GOAL := help

SPEECH_ASSETS_BIN := internal/services/bin/speech-assets

.PHONY: help dev check speech-assets

help: ## Show available commands
	@printf "Available commands:\n\n"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

speech-assets: ## Build the Swift speech model assets helper (embedded into the Go binary)
	mkdir -p $(dir $(SPEECH_ASSETS_BIN))
	swiftc -O -target arm64-apple-macos14.0 internal/services/speechassets_helper.swift -o $(SPEECH_ASSETS_BIN)-arm64
	swiftc -O -target x86_64-apple-macos14.0 internal/services/speechassets_helper.swift -o $(SPEECH_ASSETS_BIN)-x86_64
	lipo -create -output $(SPEECH_ASSETS_BIN) $(SPEECH_ASSETS_BIN)-arm64 $(SPEECH_ASSETS_BIN)-x86_64
	rm $(SPEECH_ASSETS_BIN)-arm64 $(SPEECH_ASSETS_BIN)-x86_64

dev: speech-assets ## Run Wails dev environment
	wails dev

check: speech-assets ## Run Go fmt/vet/lint and frontend CI/lint/format
	go fmt ./...
	go vet ./...
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run ./...; \
	else \
		printf "golangci-lint not found, skipping Go lint.\n"; \
	fi
	npm --prefix frontend run ci --if-present
	npm --prefix frontend run lint --if-present
	npm --prefix frontend run format --if-present
	npm --prefix frontend run format:check --if-present
