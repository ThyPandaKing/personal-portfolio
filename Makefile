# One-command runner for the whole stack (frontend, backend, agent, chroma).
# Usage:  make up   (build + start everything)   ·   make down   ·   make logs

COMPOSE := docker compose

.PHONY: up down build logs ps restart clean check env

## Start the entire system (builds images on first run)
up: check
	$(COMPOSE) up --build

## Start in the background
upd: check
	$(COMPOSE) up --build -d

## Stop and remove containers
down:
	$(COMPOSE) down

## Follow logs from all services
logs:
	$(COMPOSE) logs -f

## Show running services
ps:
	$(COMPOSE) ps

## Rebuild images without starting
build: check
	$(COMPOSE) build

## Stop and also remove volumes (wipes Chroma data)
clean:
	$(COMPOSE) down -v

## Create missing .env files from the examples
env:
	@test -f backend/.env       || cp backend/.env.example backend/.env       && echo "created backend/.env"
	@test -f agent-service/.env || cp agent-service/.env.example agent-service/.env && echo "created agent-service/.env"
	@test -f frontend/.env      || cp frontend/.env.example frontend/.env      && echo "created frontend/.env"
	@echo "env files ready — fill in secrets (MONGO_URI, Google OAuth, GOOGLE_API_KEY)."

## Preflight: verify Docker is installed, running, and env files exist
check:
	@command -v docker >/dev/null 2>&1 || { echo "❌ Docker is not installed. See the install steps in README / chat."; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "❌ Docker is installed but not running. Start Docker Desktop (or run 'colima start')."; exit 1; }
	@test -f backend/.env || { echo "❌ Missing backend/.env. Run: make env"; exit 1; }
	@test -f agent-service/.env || { echo "❌ Missing agent-service/.env. Run: make env"; exit 1; }
	@echo "✅ Preflight OK — Docker is running and env files exist."
