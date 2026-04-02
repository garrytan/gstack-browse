VIZ_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: install dev build start stop clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	@cd $(VIZ_DIR) && npm install

dev: install ## Build & run in dev mode (http://localhost:3333)
	@echo "╔══════════════════════════════════════╗"
	@echo "║  bams-viz — Agent Execution Dashboard ║"
	@echo "║  http://localhost:3333                ║"
	@echo "║  Ctrl+C to stop                      ║"
	@echo "╚══════════════════════════════════════╝"
	@cd $(VIZ_DIR) && npx next dev --port 3333

build: install ## Production build
	@cd $(VIZ_DIR) && npx next build

start: build ## Production build & start (http://localhost:3333)
	@echo "╔══════════════════════════════════════╗"
	@echo "║  bams-viz — Production Mode           ║"
	@echo "║  http://localhost:3333                ║"
	@echo "║  Ctrl+C to stop                      ║"
	@echo "╚══════════════════════════════════════╝"
	@cd $(VIZ_DIR) && npx next start --port 3333

stop: ## Stop running bams-viz server
	@pkill -f "next.*3333" 2>/dev/null && echo "bams-viz stopped" || echo "bams-viz is not running"

clean: ## Remove build artifacts and node_modules
	@cd $(VIZ_DIR) && rm -rf .next node_modules
	@echo "Cleaned .next/ and node_modules/"
