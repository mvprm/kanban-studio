# Backend

Python FastAPI app managed with uv (Python 3.14).

## Structure

- `app/main.py` - FastAPI app; API routes live under `/api`; the static frontend is mounted at `/` last so API routes take precedence
- `app/static/` - the Next.js static export, copied in by the Docker build (gitignored; `STATIC_DIR` env var overrides the path)
- `tests/` - pytest tests using FastAPI's `TestClient`; `conftest.py` points `STATIC_DIR` at a temp dir with a stub `index.html`

## Auth

Starlette `SessionMiddleware` stores the username in a signed, httponly cookie (`SESSION_SECRET` env var, dev default). The MVP account is hardcoded (`user` / `password`). Use the `current_user` dependency to require a signed-in user (401 otherwise).

## Routes

- `GET /api/health` - `{"status": "ok"}`
- `POST /api/login` - body `{username, password}`; sets the session; 401 on wrong credentials
- `POST /api/logout` - clears the session
- `GET /api/me` - `{username}`, or 401 if not signed in

## Commands

```bash
uv sync
uv run pytest
```

## Docker

The root `Dockerfile` builds the frontend in a Node stage, then installs backend dependencies with `uv sync --locked --no-dev`, copies `app/` and the export into `app/static`, and runs uvicorn on port 8000.
