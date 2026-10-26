import json
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

static_dir = Path(tempfile.mkdtemp())
(static_dir / "index.html").write_text("<h1>Kanban Studio</h1>")
os.environ["STATIC_DIR"] = str(static_dir)
os.environ["DB_PATH"] = str(static_dir / "unused.db")

from app import db  # noqa: E402
from app.main import app  # noqa: E402

DEFAULT = json.loads(db.DEFAULT_BOARD_JSON)


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "data" / "app.db"
    monkeypatch.setattr(db, "DB_PATH", path)
    return path


@pytest.fixture
def client(db_path):
    """App client with startup run against a fresh temporary database."""
    with TestClient(app) as client:
        yield client


@pytest.fixture
def signed_in(client):
    """The client, signed in as the seeded demo user."""
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client


@pytest.fixture
def new_client(client):
    """Makes more clients (each with its own cookies) for the same app and database."""

    def make(username=None, password="secret-pass"):
        other = TestClient(app)
        if username:
            response = other.post("/api/register", json={"username": username, "password": password})
            assert response.status_code == 201, response.text
        return other

    return make


def first_board_id(client) -> int:
    return client.get("/api/boards").json()[0]["id"]
