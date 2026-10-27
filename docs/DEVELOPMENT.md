# Development

How to work on Kanban Studio: setup, running without Docker, tests and project layout. Each part of the code also has an `AGENTS.md` with its structure and conventions: [backend](../backend/AGENTS.md), [frontend](../frontend/AGENTS.md), [scripts](../scripts/AGENTS.md). Coding standards are in the root [AGENTS.md](../AGENTS.md).

## Prerequisites

- Python 3.14 and [uv](https://docs.astral.sh/uv/) 0.12 or newer
- Node.js 24 and npm
- Docker, for the container and the end-to-end tests
- `.env` in the project root with `OPENROUTER_API_KEY` (copy `.env.example`)

## Setup

```bash
cd backend && uv sync
cd ../frontend && npm ci
npx playwright install chromium     # browser for the end-to-end tests
```

## Running

### In Docker (as in production)

`./scripts/start.sh` (or `scripts\start.bat`) builds and starts the container at http://localhost:8000; `./scripts/stop.sh` stops it. Rebuild with the start script after any change.

### Without Docker

The frontend is a static export that the backend serves, so build it, then point the backend at it:

```bash
cd frontend && npm run build        # writes frontend/out
cd ../backend
STATIC_DIR=../frontend/out uv run --env-file ../.env uvicorn app.main:app --reload
```

On Windows PowerShell, set the variable first: `$env:STATIC_DIR = "../frontend/out"`, then run the `uv run` command.

The app is at http://localhost:8000 and uses `backend/data/app.db` (set `DB_PATH` to use another file). `--reload` restarts the backend on Python changes; after frontend changes, run `npm run build` again and reload the page.

The interactive API reference is at http://localhost:8000/docs.

## Tests

| Suite | Command | What it covers |
|---|---|---|
| Backend | `cd backend && uv run pytest` | API routes, auth, database, migrations, AI chat with the model mocked. Prints coverage and fails below 95%. |
| Backend, real AI | `cd backend && uv run --env-file ../.env pytest -m ai` | The chat against the real model on OpenRouter. Excluded from the default run; costs API credit and takes about a minute. |
| Frontend unit | `cd frontend && npm run test:unit` | Components and page flows in jsdom, with an in-memory fake of the API (`src/test/api.ts`). |
| Frontend coverage | `cd frontend && npm run test:coverage` | The unit tests, failing below 90% statements, branches, functions or lines. HTML report in `frontend/coverage/`. |
| End-to-end | `cd frontend && npm run test:e2e` | Chromium against the running container at http://localhost:8000: accounts, boards, cards, drag and drop, chat (with the AI response mocked). Start the container first. |

Notes:

- End-to-end tests register a fresh `e2e-...` user per test, so they don't depend on each other. Those accounts stay in `data/app.db`; don't run the end-to-end tests against a database with real users.
- Backend tests use a temporary database per test, and never touch `data/`.
- Also run `npm run lint` and `npx tsc --noEmit` in `frontend/` before committing.

## Project layout

```
backend/
  app/
    main.py            FastAPI app: routes, sessions, startup (database, demo account)
    db.py              SQLite schema, migration and queries
    auth.py            Password hashing
    ai.py              OpenRouter chat with structured output
    models.py          Board validation (Pydantic)
    default_board.json Sample board for new accounts
  tests/               pytest
frontend/
  src/app/page.tsx     Sign in, board list or board (from the URL hash)
  src/components/      AuthForm, AppHeader, AccountDialog, BoardList, KanbanBoard,
                       KanbanColumn, KanbanCard, NewCardForm, ChatSidebar
  src/lib/api.ts       API client
  src/lib/kanban.ts    Board types and card move logic
  tests/               Playwright end-to-end tests
docs/                  Plan, database, deployment, development
scripts/               Start and stop scripts
Dockerfile             Node build stage, then the Python runtime
docker-compose.yml     Port 8000, .env, data/ volume
```

## Changing the database schema

Bump `SCHEMA_VERSION` in `backend/app/db.py` and add a migration step in `init_db` for databases at the previous version, as `MIGRATE_FROM_MVP` does for version 0. Add a test that builds a database at the old version and checks the migrated data (see `tests/test_db.py`). Update [DATABASE.md](DATABASE.md).
