import json
import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).parent.parent / "data" / "app.db"))
DEFAULT_BOARD_JSON = (Path(__file__).parent / "default_board.json").read_text()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Open a connection, commit on success, and always close it."""
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        with conn:
            yield conn
    finally:
        conn.close()


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)


def get_or_create_user(username: str) -> int:
    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))
        return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()[0]


def get_board(user_id: int) -> dict:
    """Return the user's board, creating the default board on first access."""
    with connect() as conn:
        row = conn.execute("SELECT data FROM boards WHERE user_id = ?", (user_id,)).fetchone()
        if row:
            return json.loads(row[0])
        conn.execute(
            "INSERT INTO boards (user_id, data) VALUES (?, ?)", (user_id, DEFAULT_BOARD_JSON)
        )
        return json.loads(DEFAULT_BOARD_JSON)


def save_board(user_id: int, board: dict):
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO boards (user_id, data) VALUES (?, ?)
            ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, json.dumps(board)),
        )
