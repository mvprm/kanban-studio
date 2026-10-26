import json
import sqlite3

import pytest
from conftest import DEFAULT
from fastapi.testclient import TestClient

from app import db
from app.main import app
from app.models import Board

MVP_SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE boards (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def tables(path):
    conn = sqlite3.connect(path)
    names = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    return names


@pytest.fixture
def ready(db_path):
    db.init_db()
    return db_path


def test_init_creates_file_and_tables(db_path):
    assert not db_path.exists()
    db.init_db()
    assert db_path.exists()
    assert {"users", "boards"} <= tables(db_path)
    with db.connect() as conn:
        assert conn.execute("PRAGMA user_version").fetchone()[0] == db.SCHEMA_VERSION


def test_init_is_idempotent_and_keeps_data(ready):
    user_id = db.create_user("alice", "hash")
    db.init_db()
    assert db.get_user(user_id)["username"] == "alice"


def test_default_board_is_valid():
    Board.model_validate_json(db.DEFAULT_BOARD_JSON)


def test_empty_board_is_valid_and_has_default_columns():
    board = Board.model_validate(db.empty_board())
    assert board.cards == {}
    assert [c.title for c in board.columns] == [c["title"] for c in DEFAULT["columns"]]


def test_default_board_returns_a_copy():
    db.default_board()["columns"].clear()
    assert len(db.default_board()["columns"]) == 5


# Users


def test_create_and_get_user(ready):
    user_id = db.create_user("alice", "hash")
    user = db.get_user(user_id)
    assert user["username"] == "alice"
    assert "password_hash" not in user
    assert db.get_user_by_username("ALICE")["password_hash"] == "hash"
    assert db.get_password_hash(user_id) == "hash"


def test_usernames_are_unique_ignoring_case(ready):
    db.create_user("alice", "hash")
    with pytest.raises(sqlite3.IntegrityError):
        db.create_user("Alice", "hash")


def test_missing_user_is_none(ready):
    assert db.get_user(42) is None
    assert db.get_user_by_username("nobody") is None


def test_set_password_hash(ready):
    user_id = db.create_user("alice", "old")
    db.set_password_hash(user_id, "new")
    assert db.get_password_hash(user_id) == "new"


def test_delete_user_deletes_their_boards_only(ready):
    alice = db.create_user("alice", "hash")
    bob = db.create_user("bob", "hash")
    alice_board = db.create_board(alice, "A", DEFAULT)
    bob_board = db.create_board(bob, "B", DEFAULT)
    db.delete_user(alice)
    assert db.get_user(alice) is None
    with db.connect() as conn:
        ids = [row[0] for row in conn.execute("SELECT id FROM boards")]
    assert ids == [bob_board]
    assert alice_board not in ids


# Boards


def test_create_list_and_get_boards(ready):
    user_id = db.create_user("alice", "hash")
    first = db.create_board(user_id, "First", DEFAULT)
    second = db.create_board(user_id, "Second", db.empty_board())
    assert [(b["id"], b["name"]) for b in db.list_boards(user_id)] == [(first, "First"), (second, "Second")]
    board = db.get_board(user_id, first)
    assert board["data"] == DEFAULT
    assert board["createdAt"].endswith("Z")


def test_get_board_checks_owner(ready):
    alice = db.create_user("alice", "hash")
    bob = db.create_user("bob", "hash")
    board_id = db.create_board(alice, "A", DEFAULT)
    assert db.get_board(bob, board_id) is None
    assert db.list_boards(bob) == []


def test_rename_save_and_delete_board(ready):
    user_id = db.create_user("alice", "hash")
    board_id = db.create_board(user_id, "Old", DEFAULT)
    db.rename_board(board_id, "New")
    data = db.empty_board()
    db.save_board_data(board_id, data)
    board = db.get_board(user_id, board_id)
    assert (board["name"], board["data"]) == ("New", data)
    db.delete_board(board_id)
    assert db.get_board(user_id, board_id) is None


# Migration from the MVP schema


@pytest.fixture
def mvp_db(db_path):
    """A database as the MVP left it: the demo user with an edited board."""
    db_path.parent.mkdir(parents=True)
    board = {**DEFAULT, "columns": [{**DEFAULT["columns"][0], "title": "MVP backlog"}, *DEFAULT["columns"][1:]]}
    conn = sqlite3.connect(db_path)
    conn.executescript(MVP_SCHEMA)
    conn.execute("INSERT INTO users (username, created_at) VALUES ('user', '2026-10-01 09:00:00')")
    conn.execute(
        "INSERT INTO boards (user_id, data, updated_at) VALUES (1, ?, '2026-10-02 10:00:00')",
        (json.dumps(board),),
    )
    conn.commit()
    conn.close()
    return board


def test_init_migrates_mvp_database_and_keeps_the_board(db_path, mvp_db):
    db.init_db()
    assert tables(db_path) == {"users", "boards", "sqlite_sequence"}
    user = db.get_user(1)
    assert user == {"id": 1, "username": "user", "createdAt": "2026-10-01T09:00:00Z"}
    [summary] = db.list_boards(1)
    assert summary["name"] == "My first board"
    assert summary["updatedAt"] == "2026-10-02T10:00:00Z"
    assert db.get_board(1, summary["id"])["data"] == mvp_db
    # A second board is now allowed
    db.create_board(1, "Second", db.empty_board())
    assert len(db.list_boards(1)) == 2


def test_migrated_demo_user_can_sign_in_and_see_their_board(db_path, mvp_db):
    with TestClient(app) as client:
        response = client.post("/api/login", json={"username": "user", "password": "password"})
        assert response.status_code == 200
        [summary] = client.get("/api/boards").json()
        assert client.get(f"/api/boards/{summary['id']}").json()["data"] == mvp_db
