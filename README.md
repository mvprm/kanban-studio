# Project Management MVP

Kanban board with AI chat. Runs locally in Docker.

## Run

Requires Docker and an `.env` file in the project root with `OPENROUTER_API_KEY`.

- Mac/Linux: `./scripts/start.sh`, stop with `./scripts/stop.sh`
- Windows: `scripts\start.bat`, stop with `scripts\stop.bat`

Open http://localhost:8000 and sign in with `user` / `password`.

## Tests

```bash
cd backend && uv run pytest
cd frontend && npm run test:unit
cd frontend && npm run test:e2e   # needs the container running
```
