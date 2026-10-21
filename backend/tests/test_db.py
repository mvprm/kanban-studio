import json
import sqlite3

from app import db
from app.models import Board


def test_init_creates_file_and_tables(db_path):
    assert not db_path.exists()
    db.init_db()
    assert db_path.exists()
    conn = sqlite3.connect(db_path)
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert {"users", "boards"} <= tables


def test_init_is_idempotent_and_keeps_data(db_path):
    db.init_db()
    user_id = db.get_or_create_user("user")
    db.init_db()
    assert db.get_or_create_user("user") == user_id


def test_get_or_create_user_returns_same_id(db_path):
    db.init_db()
    assert db.get_or_create_user("user") == db.get_or_create_user("user")
    assert db.get_or_create_user("user") != db.get_or_create_user("other")


def test_first_get_board_seeds_and_stores_default(db_path):
    db.init_db()
    user_id = db.get_or_create_user("user")
    board = db.get_board(user_id)
    assert board == json.loads(db.DEFAULT_BOARD_JSON)
    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM boards WHERE user_id = ?", (user_id,)).fetchone()[0]
    conn.close()
    assert count == 1


def test_default_board_is_valid():
    Board.model_validate_json(db.DEFAULT_BOARD_JSON)


def test_returned_default_board_is_a_copy(db_path):
    db.init_db()
    user_id = db.get_or_create_user("user")
    db.get_board(user_id)["columns"].clear()
    assert len(db.get_board(user_id)["columns"]) == 5


def test_save_and_load_board(db_path):
    db.init_db()
    user_id = db.get_or_create_user("user")
    board = db.get_board(user_id)
    board["columns"][0]["title"] = "Ideas"
    db.save_board(user_id, board)
    assert db.get_board(user_id)["columns"][0]["title"] == "Ideas"


def test_users_have_separate_boards(db_path):
    db.init_db()
    alice = db.get_or_create_user("alice")
    bob = db.get_or_create_user("bob")
    board = db.get_board(alice)
    board["columns"][0]["title"] = "Alice backlog"
    db.save_board(alice, board)
    assert db.get_board(bob)["columns"][0]["title"] == "Backlog"
    assert db.get_board(alice)["columns"][0]["title"] == "Alice backlog"
