.DEFAULT_GOAL := help

.PHONY: help dev check

help: ## Show available commands
	@printf "Available commands:\n\n"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Run Wails dev environment
	wails dev

check: ## Run Go fmt/vet/lint and frontend CI/lint/format
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
