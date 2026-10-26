# Database

SQLite via Python's built-in `sqlite3`. Each board's content is one JSON document, so the frontend, the API and the AI all read and write the same shape (`docs/board-schema.json`).

## Tables (schema version 1)

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,          -- "scrypt$<salt hex>$<hash hex>"
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data TEXT NOT NULL,                   -- board JSON
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX boards_user_id ON boards (user_id);
```

- Usernames are unique ignoring case (`user` and `User` are the same account).
- `AUTOINCREMENT` means ids are never reused. Sessions store the user id, so a deleted user's session can't sign in as a newer user who would otherwise get the same id.
- Deleting a user deletes their boards (`ON DELETE CASCADE`; `connect()` turns on `PRAGMA foreign_keys`).
- Timestamps are UTC ISO 8601 strings (`2026-10-26T18:00:00Z`), so the browser parses them correctly.

## Lifecycle

- On startup, `init_db` creates the file and tables if missing and sets `PRAGMA user_version` to the schema version.
- The `user` / `password` demo account is created on startup if it doesn't exist, with the demo board (`backend/app/default_board.json`) as "My first board".
- Registering creates the user and gives them the demo board as "My first board". Boards created later get the five default columns and no cards.
- Every save of a board's data, and every AI change, replaces `data` and `updated_at`. Renaming also updates `updated_at`.

## Migration from the MVP

The MVP database (version 0) had `users (id, username, created_at)` and `boards (id, user_id UNIQUE, data, updated_at)`. `init_db` migrates it in one transaction: it renames the old tables, creates the new ones, copies the rows (each board becomes "My first board", timestamps become ISO 8601), and drops the old tables. Migrated users get an empty password hash; on startup the app sets the demo account's password, which was the only account the MVP allowed.

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
