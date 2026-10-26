import copy
import json
from types import SimpleNamespace

import pytest
from conftest import DEFAULT, first_board_id

from app import ai, db


def ai_board(board):
    return {"columns": board["columns"], "cards": list(board["cards"].values())}


@pytest.fixture
def fake_ai(monkeypatch):
    """Replace the OpenRouter client; set `fake_ai.result` to the model's output.

    `fake_ai.during`, if set, runs while the model is "thinking".
    """
    fake = SimpleNamespace(calls=[], result=None, during=None)

    def parse(**kwargs):
        fake.calls.append(kwargs)
        if fake.during:
            fake.during()
        parsed = ai.ChatResult.model_validate(fake.result)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=parsed))])

    completions = SimpleNamespace(parse=parse)
    monkeypatch.setattr(ai, "client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=completions)))
    return fake


def post_chat(client, message, history=None):
    body = {"message": message} if history is None else {"message": message, "history": history}
    return client.post(f"/api/boards/{first_board_id(client)}/chat", json=body)


def stored(client):
    return client.get(f"/api/boards/{first_board_id(client)}").json()["data"]


def test_chat_requires_login(client):
    assert client.post("/api/boards/1/chat", json={"message": "hi"}).status_code == 401


def test_chat_on_unknown_board_is_404(signed_in, fake_ai):
    assert signed_in.post("/api/boards/999/chat", json={"message": "hi"}).status_code == 404
    assert fake_ai.calls == []


def test_chat_works_on_the_given_board(signed_in, fake_ai):
    second = signed_in.post("/api/boards", json={"name": "Second"}).json()
    updated = copy.deepcopy(second["data"])
    updated["cards"]["card-new"] = {"id": "card-new", "title": "Only here", "details": ""}
    updated["columns"][0]["cardIds"].append("card-new")
    fake_ai.result = {"reply": "Added.", "board": ai_board(updated)}
    response = signed_in.post(f"/api/boards/{second['id']}/chat", json={"message": "Add a card"})
    assert response.status_code == 200
    assert json.dumps(ai_board(second["data"])) in fake_ai.calls[0]["messages"][-1]["content"]
    assert signed_in.get(f"/api/boards/{second['id']}").json()["data"] == updated
    assert stored(signed_in) == DEFAULT


def test_reply_without_board_leaves_board_unchanged(signed_in, fake_ai):
    fake_ai.result = {"reply": "There are 2 cards in Done.", "board": None}
    response = post_chat(signed_in, "How many cards are in Done?")
    assert response.status_code == 200
    assert response.json() == {"reply": "There are 2 cards in Done.", "board": None}
    assert stored(signed_in) == DEFAULT


def test_returned_board_is_saved(signed_in, fake_ai):
    updated = copy.deepcopy(DEFAULT)
    updated["cards"]["card-new"] = {"id": "card-new", "title": "Write docs", "details": ""}
    updated["columns"][0]["cardIds"].append("card-new")
    fake_ai.result = {"reply": "Added it.", "board": ai_board(updated)}
    response = post_chat(signed_in, "Add a card Write docs to Backlog")
    assert response.status_code == 200
    assert response.json() == {"reply": "Added it.", "board": updated}
    assert stored(signed_in) == updated


@pytest.mark.parametrize(
    "change",
    [
        pytest.param(lambda b: b["columns"][0]["cardIds"].append("card-99"), id="unknown card id"),
        pytest.param(lambda b: b["columns"][0]["cardIds"].remove("card-1"), id="orphaned card"),
        pytest.param(lambda b: b["columns"][0].update(id="col-new"), id="changed column id"),
    ],
)
def test_invalid_board_is_rejected_and_not_saved(signed_in, fake_ai, change):
    board = copy.deepcopy(DEFAULT)
    change(board)
    fake_ai.result = {"reply": "Done.", "board": ai_board(board)}
    response = post_chat(signed_in, "Break the board")
    assert response.status_code in (422, 502)
    assert stored(signed_in) == DEFAULT


def test_board_edited_during_ai_call_is_not_overwritten(signed_in, fake_ai):
    edited = copy.deepcopy(DEFAULT)
    edited["columns"][0]["title"] = "Edited meanwhile"
    from_ai = copy.deepcopy(DEFAULT)
    from_ai["columns"][1]["title"] = "Renamed by AI"
    fake_ai.result = {"reply": "Renamed it.", "board": ai_board(from_ai)}
    fake_ai.during = lambda: db.save_board_data(first_board_id(signed_in), edited)
    response = post_chat(signed_in, "Rename Discovery")
    assert response.status_code == 409
    assert stored(signed_in) == edited


def test_prompt_includes_board_history_and_message(signed_in, fake_ai):
    fake_ai.result = {"reply": "Sure.", "board": None}
    history = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi, how can I help?"},
    ]
    post_chat(signed_in, "What is in Review?", history)
    [call] = fake_ai.calls
    assert call["model"] == ai.MODEL
    assert call["response_format"] is ai.ChatResult
    assert call["extra_body"] == {"provider": ai.PROVIDER}
    system, *past, latest = call["messages"]
    assert system == {"role": "system", "content": ai.SYSTEM_PROMPT}
    assert past == history
    assert latest["role"] == "user"
    assert json.dumps(ai_board(DEFAULT)) in latest["content"]
    assert latest["content"].endswith("What is in Review?")


def chat(client, message):
    response = post_chat(client, message)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.ai
def test_real_chat_adds_card(signed_in):
    result = chat(signed_in, 'Add a card titled "Write release notes" to Backlog.')
    board = stored(signed_in)
    assert result["board"] == board
    [card] = [c for c in board["cards"].values() if c["title"] == "Write release notes"]
    assert card["id"] in board["columns"][0]["cardIds"]


@pytest.mark.ai
def test_real_chat_question_returns_no_board(signed_in):
    result = chat(signed_in, "How many cards are in Done?")
    assert result["board"] is None
    assert "2" in result["reply"] or "two" in result["reply"].lower()
    assert stored(signed_in) == DEFAULT


@pytest.mark.ai
def test_real_chat_moves_card(signed_in):
    result = chat(signed_in, "Move card-1 to Done.")
    columns = {c["id"]: c["cardIds"] for c in stored(signed_in)["columns"]}
    assert result["board"] is not None
    assert "card-1" in columns["col-done"]
    assert "card-1" not in columns["col-backlog"]


@pytest.mark.ai
def test_real_chat_edits_card(signed_in):
    result = chat(signed_in, 'Change the title of card-2 to "Interview five customers".')
    cards = stored(signed_in)["cards"]
    assert result["board"] is not None
    assert cards["card-2"]["title"] == "Interview five customers"
    assert len(cards) == len(DEFAULT["cards"])


@pytest.mark.ai
def test_real_chat_does_not_repeat_earlier_requests(signed_in):
    first = 'Add a card titled "Write release notes" to Backlog.'
    reply = chat(signed_in, first)["reply"]
    count = len(stored(signed_in)["cards"])
    history = [{"role": "user", "content": first}, {"role": "assistant", "content": reply}]
    response = post_chat(signed_in, 'Rename "Write release notes" to "Publish release notes".', history)
    assert response.status_code == 200, response.text
    titles = [c["title"] for c in stored(signed_in)["cards"].values()]
    assert len(titles) == count
    assert "Publish release notes" in titles
    assert "Write release notes" not in titles
