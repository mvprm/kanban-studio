# Backend

Python FastAPI app managed with uv (Python 3.14).

## Structure

- `app/main.py` - FastAPI app; creates the database on startup (lifespan); API routes live under `/api`; the static frontend is mounted at `/` last so API routes take precedence
- `app/db.py` - SQLite via `sqlite3`: `init_db`, `get_or_create_user`, `get_board` (seeds the default board), `save_board`. See `docs/DATABASE.md`
- `app/models.py` - Pydantic `Board`/`Column`/`Card` matching `docs/board-schema.json`; validates card ids, orphans and duplicates
- `app/default_board.json` - board given to a user on first access
- `app/static/` - the Next.js static export, copied in by the Docker build (gitignored; `STATIC_DIR` env var overrides the path)
- `tests/` - pytest tests using FastAPI's `TestClient`; `conftest.py` points `STATIC_DIR` at a stub `index.html` and provides `db_path` (temp database), `client` (runs startup) and `signed_in` fixtures

## Auth

Starlette `SessionMiddleware` stores the username in a signed, httponly cookie (`SESSION_SECRET` env var, dev default). The MVP account is hardcoded (`user` / `password`). Use the `current_user` dependency to require a signed-in user (401 otherwise), or `current_user_id` to also get their database id.

## Database

`DB_PATH` env var, default `data/app.db` (`/app/data/app.db` in the container, mounted from the project's `data/`).

## Routes

- `GET /api/health` - `{"status": "ok"}`
- `POST /api/login` - body `{username, password}`; sets the session; 401 on wrong credentials
- `POST /api/logout` - clears the session
- `GET /api/me` - `{username}`, or 401 if not signed in
- `GET /api/board` - the signed-in user's board
- `PUT /api/board` - replace the whole board; 422 if invalid or the column ids change, and nothing is saved

## Commands

```bash
uv sync
uv run pytest
```

## Docker

The root `Dockerfile` builds the frontend in a Node stage, then installs backend dependencies with `uv sync --locked --no-dev`, copies `app/` and the export into `app/static`, and runs uvicorn on port 8000.
