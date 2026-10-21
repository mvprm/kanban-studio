# Database

SQLite via Python's built-in `sqlite3`. Each user's board is one JSON document, so the frontend, the API and the AI all read and write the same shape (`docs/board-schema.json`).

## Tables

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data TEXT NOT NULL,  -- board JSON
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- `boards.user_id` is `UNIQUE`: one board per user for the MVP. Dropping the constraint later allows several boards per user without changing anything else.
- No password column: the MVP account is hardcoded in the backend. A `password_hash` column can be added when real accounts are needed.

## Lifecycle

- The database file and tables are created on app startup if they don't exist (`CREATE TABLE IF NOT EXISTS`).
- A `users` row is created the first time a signed-in user calls a board route (`current_user_id` dependency).
- On a user's first board access, a `boards` row is created holding the default board (`backend/app/default_board.json`: 5 columns, 8 cards).
- Every `PUT /api/board`, and every AI update, replaces `data` and `updated_at` for that user's row.

## Validation

Before saving, the backend parses the board with Pydantic models matching the schema, then checks:

- every id in a column's `cardIds` is a key in `cards`, and each card's `id` matches its key
- every card appears in exactly one column (no orphans, no duplicates)
- the column ids are the same, in the same order, as the stored board's (columns are fixed; only titles change)

An invalid board is rejected with 422 and nothing is saved. This matters most for AI responses, which return the whole board.

## Location

- `DB_PATH` env var, defaulting to `data/app.db` next to `app/` (`/app/data/app.db` in the container)
- `docker-compose.yml` mounts `./data` at `/app/data`, so the database lives in the project's `data/` folder and survives container rebuilds
- Tests set `DB_PATH` to a temporary file
