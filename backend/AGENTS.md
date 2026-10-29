# Backend

Python FastAPI app managed with uv (Python 3.14).

## Structure

- `app/main.py` - FastAPI app; creates or migrates the database and seeds the demo account on startup (lifespan); API routes live under `/api`; the static frontend is mounted at `/` last so API routes take precedence
- `app/db.py` - SQLite via `sqlite3`: `init_db` (creates or migrates; see `docs/DATABASE.md`), user functions (`create_user`, `get_user`, `get_user_by_username`, `get_password_hash`, `set_password_hash`, `delete_user`) and board functions (`list_boards`, `create_board`, `get_board`, `rename_board`, `save_board_data`, `delete_board`); `default_board()` and `empty_board()` templates
- `app/auth.py` - `hash_password` / `verify_password` (salted `hashlib.scrypt`, constant-time compare)
- `app/ai.py` - OpenRouter client and `chat(board, history, message)` with structured output
- `app/models.py` - Pydantic `Board`/`Column`/`Card` matching `docs/board-schema.json`; validates card ids, orphans and duplicates
- `app/default_board.json` - the demo board every new user gets as "My first board"
- `app/static/` - the Next.js static export, copied in by the Docker build (gitignored; `STATIC_DIR` env var overrides the path)
- `tests/` - pytest tests using FastAPI's `TestClient`; `conftest.py` points `STATIC_DIR` at a stub `index.html` and provides `db_path` (temp database), `client` (runs startup), `signed_in` (the demo user) and `new_client` (more clients, optionally registered as another user) fixtures, plus `DEFAULT` and `first_board_id`. Coverage is measured on every run (`pytest-cov`) and must stay at 95% or more

## Auth

Accounts are stored in the database with scrypt password hashes. Anyone can register; the `user` / `password` demo account is created on startup. Starlette `SessionMiddleware` stores the user id in a signed, httponly cookie (`SESSION_SECRET` env var, dev default). The `current_user` dependency loads the user (401 if not signed in or the account was deleted); `owned_board` loads a board the user owns (404 otherwise, including other users' boards).

## Database

`DB_PATH` env var, default `data/app.db` (`/app/data/app.db` in the container, mounted from the project's `data/`).

## Routes

- `GET /api/health` - `{"status": "ok"}`
Users are `{id, username, createdAt}`; board summaries are `{id, name, createdAt, updatedAt}`; a full board adds `data` (the board JSON).

- `POST /api/register` - body `{username, password}` (username 3-32 of letters, digits, `._-`; password 8+ characters, else 422); 409 if the username is taken (ignoring case); creates the user with the demo board, signs in, returns the user (201)
- `POST /api/login` - body `{username, password}`; sets the session and returns the user; 401 on wrong credentials
- `POST /api/logout` - clears the session
- `GET /api/me` - the user, or 401 if not signed in
- `PUT /api/me/password` - body `{currentPassword, newPassword}`; 403 if the current password is wrong
- `DELETE /api/me` - body `{password}`; deletes the user and their boards and signs out (204); 403 on a wrong password
- `GET /api/boards` - the user's board summaries, oldest first
- `POST /api/boards` - body `{name}` (1-80 characters after trimming); creates a board with the default columns and no cards; returns the full board (201)
- `GET /api/boards/{id}` - the full board
- `PATCH /api/boards/{id}` - body `{name}`; returns the summary
- `DELETE /api/boards/{id}` - 204
- `PUT /api/boards/{id}/data` - replace the board's data; 422 if invalid or the column ids change, and nothing is saved
- `POST /api/boards/{id}/chat` - body `{message, history: [{role, content}]}`; returns `{reply, board}`, where `board` is the saved updated data or `null` if the AI made no change; 502 (or 422 for changed column ids) if the AI returns an invalid board, 409 if the board was saved while the AI was working; nothing is saved in those cases

Every `/api/boards/{id}` route returns 404 for a board the user does not own.

## AI

`app/ai.py` calls OpenRouter through the `openai` SDK (`base_url` set to OpenRouter, `OPENROUTER_API_KEY` from the environment), model `openai/gpt-oss-120b`. `chat` sends a system prompt with the rules, then the history, then the current board followed by the message, and parses the reply with `chat.completions.parse(response_format=ChatResult)`. Structured output uses `AIBoard`, which lists `cards` instead of keying them by id (strict JSON schemas can't describe a dict); the route converts it back to a `Board`, validates it and saves it. `PROVIDER` restricts OpenRouter routing to providers that honour `response_format` and skips CoreWeave, which returned malformed JSON in testing. Tests that call the real API are marked `ai` and excluded by default; run them with `uv run --env-file ../.env pytest -m ai`.

## Commands

```bash
uv sync
uv run pytest
```

## Docker

The root `Dockerfile` builds the frontend in a Node stage, then installs backend dependencies with `uv sync --locked --no-dev`, copies `app/` and the export into `app/static`, and runs uvicorn on port 8000.
