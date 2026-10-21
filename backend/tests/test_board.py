import copy
import json

import pytest

from app import db

DEFAULT = json.loads(db.DEFAULT_BOARD_JSON)


def board_with(change):
    board = copy.deepcopy(DEFAULT)
    change(board)
    return board


def test_board_routes_require_login(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json=DEFAULT).status_code == 401


def test_first_get_returns_default_board(signed_in):
    response = signed_in.get("/api/board")
    assert response.status_code == 200
    assert response.json() == DEFAULT


def test_put_then_get_returns_saved_board(signed_in):
    def change(board):
        board["columns"][0]["title"] = "Ideas"
        board["columns"][0]["cardIds"].remove("card-1")
        board["columns"][4]["cardIds"].insert(0, "card-1")
        board["cards"]["card-9"] = {"id": "card-9", "title": "New", "details": ""}
        board["columns"][1]["cardIds"].append("card-9")

    updated = board_with(change)
    response = signed_in.put("/api/board", json=updated)
    assert response.status_code == 200
    assert response.json() == updated
    assert signed_in.get("/api/board").json() == updated


def test_board_persists_across_app_restarts(db_path):
    from fastapi.testclient import TestClient

    from app.main import app

    updated = board_with(lambda b: b["columns"][0].update(title="Kept"))
    with TestClient(app) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        client.put("/api/board", json=updated)
    with TestClient(app) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        assert client.get("/api/board").json() == updated


def delete_card_everywhere(board, card_id):
    del board["cards"][card_id]
    for column in board["columns"]:
        if card_id in column["cardIds"]:
            column["cardIds"].remove(card_id)


def test_put_can_delete_cards(signed_in):
    updated = board_with(lambda b: delete_card_everywhere(b, "card-1"))
    assert signed_in.put("/api/board", json=updated).status_code == 200
    assert "card-1" not in signed_in.get("/api/board").json()["cards"]


@pytest.mark.parametrize(
    "change",
    [
        pytest.param(lambda b: b.pop("cards"), id="missing cards"),
        pytest.param(lambda b: b["columns"][0].pop("title"), id="missing column title"),
        pytest.param(lambda b: b["cards"]["card-1"].pop("details"), id="missing card details"),
        pytest.param(lambda b: b["columns"][0]["cardIds"].append("card-99"), id="unknown card id"),
        pytest.param(lambda b: b["columns"][1]["cardIds"].append("card-1"), id="duplicated card"),
        pytest.param(lambda b: b["columns"][0]["cardIds"].remove("card-1"), id="orphaned card"),
        pytest.param(lambda b: b["cards"]["card-1"].update(id="card-x"), id="card id mismatch"),
        pytest.param(lambda b: b["columns"][0].update(id="col-new"), id="changed column id"),
        pytest.param(lambda b: b["columns"].pop(), id="removed column"),
        pytest.param(lambda b: b["columns"].reverse(), id="reordered columns"),
        pytest.param(lambda b: b.update(extra=1), id="unexpected field"),
    ],
)
def test_put_rejects_invalid_board_and_saves_nothing(signed_in, change):
    signed_in.get("/api/board")
    response = signed_in.put("/api/board", json=board_with(change))
    assert response.status_code == 422
    assert signed_in.get("/api/board").json() == DEFAULT
