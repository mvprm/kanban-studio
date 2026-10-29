import copy

import pytest
from conftest import DEFAULT, first_board_id
from fastapi.testclient import TestClient

from app import db
from app.main import app


def board_with(change, board=DEFAULT):
    board = copy.deepcopy(board)
    change(board)
    return board


def data_url(board_id):
    return f"/api/boards/{board_id}/data"


@pytest.mark.parametrize(
    "method, url",
    [
        ("GET", "/api/boards"),
        ("POST", "/api/boards"),
        ("GET", "/api/boards/1"),
        ("PATCH", "/api/boards/1"),
        ("DELETE", "/api/boards/1"),
        ("PUT", "/api/boards/1/data"),
        ("POST", "/api/boards/1/chat"),
    ],
)
def test_board_routes_require_login(client, method, url):
    assert client.request(method, url, json={}).status_code == 401


def test_old_single_board_route_is_gone(signed_in):
    assert signed_in.get("/api/board").status_code == 404


# Listing, creating, reading


def test_demo_user_starts_with_the_demo_board(signed_in):
    [summary] = signed_in.get("/api/boards").json()
    assert summary["name"] == "My first board"
    assert set(summary) == {"id", "name", "createdAt", "updatedAt"}
    board = signed_in.get(f"/api/boards/{summary['id']}").json()
    assert board == {**summary, "data": DEFAULT}


def test_create_board_starts_with_default_columns_and_no_cards(signed_in):
    response = signed_in.post("/api/boards", json={"name": "  Launch plan  "})
    assert response.status_code == 201
    board = response.json()
    assert board["name"] == "Launch plan"
    assert board["data"]["cards"] == {}
    assert [c["id"] for c in board["data"]["columns"]] == [c["id"] for c in DEFAULT["columns"]]
    assert all(c["cardIds"] == [] for c in board["data"]["columns"])
    assert signed_in.get(f"/api/boards/{board['id']}").json() == board


def test_boards_are_listed_in_creation_order(signed_in):
    signed_in.post("/api/boards", json={"name": "Second"})
    signed_in.post("/api/boards", json={"name": "Third"})
    names = [b["name"] for b in signed_in.get("/api/boards").json()]
    assert names == ["My first board", "Second", "Third"]


@pytest.mark.parametrize("name", ["", "   ", "x" * 81])
def test_create_board_validates_name(signed_in, name):
    assert signed_in.post("/api/boards", json={"name": name}).status_code == 422
    assert len(signed_in.get("/api/boards").json()) == 1


def test_unknown_board_is_404(signed_in):
    assert signed_in.get("/api/boards/999").status_code == 404


# Renaming and deleting


def test_rename_board(signed_in):
    board_id = first_board_id(signed_in)
    response = signed_in.patch(f"/api/boards/{board_id}", json={"name": "Roadmap"})
    assert response.status_code == 200
    assert response.json()["name"] == "Roadmap"
    assert "data" not in response.json()
    assert signed_in.get("/api/boards").json()[0]["name"] == "Roadmap"
    assert signed_in.get(f"/api/boards/{board_id}").json()["data"] == DEFAULT


def test_rename_board_validates_name(signed_in):
    board_id = first_board_id(signed_in)
    assert signed_in.patch(f"/api/boards/{board_id}", json={"name": ""}).status_code == 422


def test_delete_board(signed_in):
    keep = signed_in.post("/api/boards", json={"name": "Keep"}).json()["id"]
    board_id = first_board_id(signed_in)
    assert signed_in.delete(f"/api/boards/{board_id}").status_code == 204
    assert signed_in.get(f"/api/boards/{board_id}").status_code == 404
    assert [b["id"] for b in signed_in.get("/api/boards").json()] == [keep]


def test_user_can_delete_every_board(signed_in):
    signed_in.delete(f"/api/boards/{first_board_id(signed_in)}")
    assert signed_in.get("/api/boards").json() == []


# Ownership


def test_other_users_boards_are_hidden(signed_in, new_client):
    board_id = first_board_id(signed_in)
    alice = new_client("alice")
    alice_board = first_board_id(alice)
    assert alice_board != board_id
    assert [b["id"] for b in alice.get("/api/boards").json()] == [alice_board]
    for method, url, body in [
        ("GET", f"/api/boards/{board_id}", None),
        ("PATCH", f"/api/boards/{board_id}", {"name": "Hijacked"}),
        ("PUT", data_url(board_id), DEFAULT),
        ("DELETE", f"/api/boards/{board_id}", None),
        ("POST", f"/api/boards/{board_id}/chat", {"message": "hi"}),
    ]:
        assert alice.request(method, url, json=body).status_code == 404, (method, url)
    assert signed_in.get(f"/api/boards/{board_id}").json()["name"] == "My first board"


def test_users_edits_stay_on_their_own_boards(signed_in, new_client):
    alice = new_client("alice")
    renamed = board_with(lambda b: b["columns"][0].update(title="Alice backlog"))
    alice.put(data_url(first_board_id(alice)), json=renamed)
    assert signed_in.get(f"/api/boards/{first_board_id(signed_in)}").json()["data"] == DEFAULT


# Saving data


def test_put_then_get_returns_saved_board(signed_in):
    board_id = first_board_id(signed_in)

    def change(board):
        board["columns"][0]["title"] = "Ideas"
        board["columns"][0]["cardIds"].remove("card-1")
        board["columns"][4]["cardIds"].insert(0, "card-1")
        board["cards"]["card-9"] = {"id": "card-9", "title": "New", "details": ""}
        board["columns"][1]["cardIds"].append("card-9")

    updated = board_with(change)
    response = signed_in.put(data_url(board_id), json=updated)
    assert response.status_code == 200
    assert response.json() == updated
    assert signed_in.get(f"/api/boards/{board_id}").json()["data"] == updated


@pytest.mark.parametrize(
    "change",
    [
        lambda client, board_id: client.put(data_url(board_id), json=DEFAULT),
        lambda client, board_id: client.patch(f"/api/boards/{board_id}", json={"name": "Renamed"}),
    ],
    ids=["save", "rename"],
)
def test_changes_update_the_timestamp(signed_in, change):
    board_id = first_board_id(signed_in)
    with db.connect() as conn:
        conn.execute("UPDATE boards SET updated_at = '2000-01-01T00:00:00Z'")
    change(signed_in, board_id)
    assert signed_in.get(f"/api/boards/{board_id}").json()["updatedAt"] > "2000-01-01T00:00:00Z"


def test_board_persists_across_app_restarts(db_path):
    updated = board_with(lambda b: b["columns"][0].update(title="Kept"))
    with TestClient(app) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        client.put(data_url(first_board_id(client)), json=updated)
    with TestClient(app) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        assert client.get(f"/api/boards/{first_board_id(client)}").json()["data"] == updated


def delete_card_everywhere(board, card_id):
    del board["cards"][card_id]
    for column in board["columns"]:
        if card_id in column["cardIds"]:
            column["cardIds"].remove(card_id)


def test_put_can_delete_cards(signed_in):
    board_id = first_board_id(signed_in)
    updated = board_with(lambda b: delete_card_everywhere(b, "card-1"))
    assert signed_in.put(data_url(board_id), json=updated).status_code == 200
    assert "card-1" not in signed_in.get(f"/api/boards/{board_id}").json()["data"]["cards"]


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
    board_id = first_board_id(signed_in)
    response = signed_in.put(data_url(board_id), json=board_with(change))
    assert response.status_code == 422
    assert signed_in.get(f"/api/boards/{board_id}").json()["data"] == DEFAULT
