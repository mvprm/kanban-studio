# Kanban Studio

Project management with Kanban boards and an AI assistant. Each user has their own boards. Runs locally in Docker.

## Run

Requires Docker and an `.env` file in the project root with `OPENROUTER_API_KEY`.

- Mac/Linux: `./scripts/start.sh`, stop with `./scripts/stop.sh`
- Windows: `scripts\start.bat`, stop with `scripts\stop.bat`

Open http://localhost:8000 and create an account, or sign in with the demo account `user` / `password`.

## Tests

```bash
cd backend && uv run pytest          # with coverage (95% minimum)
cd frontend && npm run test:coverage  # unit tests with coverage (90% minimum)
cd frontend && npm run test:e2e       # needs the container running
```
