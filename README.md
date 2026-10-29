# Kanban Studio

Project management with Kanban boards and an AI assistant. Each user has their own boards; the assistant reads a board and can create, edit and move cards on request. Runs as a single Docker container with a SQLite database.

## Features

- **Accounts**: register, sign in, change password, delete account (with all boards). Sessions last 14 days. A demo account, `user` / `password`, is always available.
- **Boards**: several private boards per user. Create, rename, open and delete them from the board list. A new account starts with a sample board.
- **Kanban**: five columns per board (Backlog, Discovery, In Progress, Review, Done) that can be renamed. Add, edit and delete cards (title and details), and drag them within or between columns. Every change is saved at once.
- **AI assistant**: a chat panel on each board, powered by `openai/gpt-oss-120b` through OpenRouter. Ask questions about the board, or have it add, edit and move one or more cards. Its changes appear on the board straight away.
- **Links**: the open board is in the URL (`#board=<id>`), so reloads, bookmarks and the back button work.

## Quick start

Requires [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on Mac and Windows) and an [OpenRouter API key](https://openrouter.ai/keys).

1. Create `.env` in the project root from the template, and set your key:

   ```bash
   cp .env.example .env
   ```

2. Start the app. The first build takes a few minutes.

   - Mac/Linux: `./scripts/start.sh`
   - Windows: `scripts\start.bat`

3. Open http://localhost:8000. Create an account, or sign in as `user` / `password`.

4. Stop the app with `./scripts/stop.sh` (Mac/Linux) or `scripts\stop.bat` (Windows).

Data is stored in `data/app.db` and survives restarts and rebuilds.

## Documentation

- [Deployment and operations](docs/DEPLOYMENT.md): configuration, running in production, HTTPS, backups, upgrades, monitoring, security checklist
- [Development](docs/DEVELOPMENT.md): local setup without Docker, tests, project layout
- [Database](docs/DATABASE.md): schema, migrations, validation
- API reference: interactive at http://localhost:8000/docs while the app runs; route summary in [backend/AGENTS.md](backend/AGENTS.md)
- [Plan](docs/PLAN.md): build history and roadmap

## Tests

```bash
cd backend && uv run pytest           # API and database, coverage must stay at 95% or more
cd frontend && npm run test:coverage  # components, coverage must stay at 90% or more
cd frontend && npm run test:e2e       # browser tests against the running container
```

See [Development](docs/DEVELOPMENT.md#tests) for details.
