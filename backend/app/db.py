import json
import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).parent.parent / "data" / "app.db"))
DEFAULT_BOARD_JSON = (Path(__file__).parent / "default_board.json").read_text()

SCHEMA_VERSION = 1
NOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"

# AUTOINCREMENT so ids are never reused: sessions hold a user id, and a deleted user's
# session must not sign in as a newer user who got the same id
SCHEMA = f"""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ({NOW})
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ({NOW}),
    updated_at TEXT NOT NULL DEFAULT ({NOW})
);

CREATE INDEX IF NOT EXISTS boards_user_id ON boards (user_id);
"""

# The MVP schema had no passwords and one board per user (boards.user_id UNIQUE).
# Passwords are left empty here; the app sets the demo account's password on startup.
MIGRATE_FROM_MVP = f"""
BEGIN;
ALTER TABLE users RENAME TO users_mvp;
ALTER TABLE boards RENAME TO boards_mvp;
{SCHEMA}
INSERT INTO users (id, username, password_hash, created_at)
    SELECT id, username, '', replace(created_at, ' ', 'T') || 'Z' FROM users_mvp;
INSERT INTO boards (id, user_id, name, data, created_at, updated_at)
    SELECT id, user_id, 'My first board', data,
        replace(updated_at, ' ', 'T') || 'Z', replace(updated_at, ' ', 'T') || 'Z'
    FROM boards_mvp;
DROP TABLE boards_mvp;
DROP TABLE users_mvp;
COMMIT;
"""

BOARD_SUMMARY = "id, name, created_at AS createdAt, updated_at AS updatedAt"


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Open a connection, commit on success, and always close it."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        with conn:
            yield conn
    finally:
        conn.close()


def init_db():
    """Create the database, or migrate an MVP database, to the current schema."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        has_tables = conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'boards'").fetchone()
        if version == 0 and has_tables:
            conn.executescript(MIGRATE_FROM_MVP)
        conn.executescript(SCHEMA)
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


def default_board() -> dict:
    return json.loads(DEFAULT_BOARD_JSON)


def empty_board() -> dict:
    """The default columns with no cards, for boards created after the first."""
    return {
        "columns": [{**column, "cardIds": []} for column in default_board()["columns"]],
        "cards": {},
    }


# Users


def create_user(username: str, password_hash: str) -> int:
    """Insert a user; raises sqlite3.IntegrityError if the username is taken."""
    with connect() as conn:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash)
        )
        return cursor.lastrowid


def get_user(user_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, created_at AS createdAt FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None


def get_user_by_username(username: str) -> dict | None:
    """The user including their password hash, for signing in."""
    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()
        return dict(row) if row else None


def get_password_hash(user_id: int) -> str:
    with connect() as conn:
        return conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()[0]


def set_password_hash(user_id: int, password_hash: str):
    with connect() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))


def delete_user(user_id: int):
    """Delete the user; their boards go with them (ON DELETE CASCADE)."""
    with connect() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


# Boards


def list_boards(user_id: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            f"SELECT {BOARD_SUMMARY} FROM boards WHERE user_id = ? ORDER BY id", (user_id,)
        ).fetchall()
        return [dict(row) for row in rows]


def create_board(user_id: int, name: str, data: dict) -> int:
    with connect() as conn:
        cursor = conn.execute(
            "INSERT INTO boards (user_id, name, data) VALUES (?, ?, ?)",
            (user_id, name, json.dumps(data)),
        )
        return cursor.lastrowid


def get_board(user_id: int, board_id: int) -> dict | None:
    """The board's summary and `data`, or None if the user does not own it."""
    with connect() as conn:
        row = conn.execute(
            f"SELECT {BOARD_SUMMARY}, data FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        return {**dict(row), "data": json.loads(row["data"])} if row else None


def rename_board(board_id: int, name: str):
    with connect() as conn:
        conn.execute(
            f"UPDATE boards SET name = ?, updated_at = {NOW} WHERE id = ?", (name, board_id)
        )


def save_board_data(board_id: int, data: dict):
    with connect() as conn:
        conn.execute(
            f"UPDATE boards SET data = ?, updated_at = {NOW} WHERE id = ?",
            (json.dumps(data), board_id),
        )


def delete_board(board_id: int):
    with connect() as conn:
        conn.execute("DELETE FROM boards WHERE id = ?", (board_id,))
