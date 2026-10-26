import copy
import json
from types import SimpleNamespace

import pytest

from app import ai, db

DEFAULT = json.loads(db.DEFAULT_BOARD_JSON)


def ai_board(board):
    return {"columns": board["columns"], "cards": list(board["cards"].values())}


@pytest.fixture
def fake_ai(monkeypatch):
    """Replace the OpenRouter client; set `fake_ai.result` to the model's output."""
    fake = SimpleNamespace(calls=[], result=None)

    def parse(**kwargs):
        fake.calls.append(kwargs)
        parsed = ai.ChatResult.model_validate(fake.result)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=parsed))])

    completions = SimpleNamespace(parse=parse)
    monkeypatch.setattr(ai, "client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=completions)))
    return fake


def test_chat_requires_login(client):
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401


def test_reply_without_board_leaves_board_unchanged(signed_in, fake_ai):
    fake_ai.result = {"reply": "There are 2 cards in Done.", "board": None}
    response = signed_in.post("/api/chat", json={"message": "How many cards are in Done?"})
    assert response.status_code == 200
    assert response.json() == {"reply": "There are 2 cards in Done.", "board": None}
    assert signed_in.get("/api/board").json() == DEFAULT


def test_returned_board_is_saved(signed_in, fake_ai):
    updated = copy.deepcopy(DEFAULT)
    updated["cards"]["card-new"] = {"id": "card-new", "title": "Write docs", "details": ""}
    updated["columns"][0]["cardIds"].append("card-new")
    fake_ai.result = {"reply": "Added it.", "board": ai_board(updated)}
    response = signed_in.post("/api/chat", json={"message": "Add a card Write docs to Backlog"})
    assert response.status_code == 200
    assert response.json() == {"reply": "Added it.", "board": updated}
    assert signed_in.get("/api/board").json() == updated


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
    response = signed_in.post("/api/chat", json={"message": "Break the board"})
    assert response.status_code in (422, 502)
    assert signed_in.get("/api/board").json() == DEFAULT


def test_prompt_includes_board_history_and_message(signed_in, fake_ai):
    fake_ai.result = {"reply": "Sure.", "board": None}
    history = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi, how can I help?"},
    ]
    signed_in.post("/api/chat", json={"message": "What is in Review?", "history": history})
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
    response = client.post("/api/chat", json={"message": message})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.ai
def test_real_chat_adds_card(signed_in):
    result = chat(signed_in, 'Add a card titled "Write release notes" to Backlog.')
    board = signed_in.get("/api/board").json()
    assert result["board"] == board
    [card] = [c for c in board["cards"].values() if c["title"] == "Write release notes"]
    assert card["id"] in board["columns"][0]["cardIds"]


@pytest.mark.ai
def test_real_chat_question_returns_no_board(signed_in):
    result = chat(signed_in, "How many cards are in Done?")
    assert result["board"] is None
    assert "2" in result["reply"] or "two" in result["reply"].lower()
    assert signed_in.get("/api/board").json() == DEFAULT


@pytest.mark.ai
def test_real_chat_moves_card(signed_in):
    result = chat(signed_in, "Move card-1 to Done.")
    columns = {c["id"]: c["cardIds"] for c in signed_in.get("/api/board").json()["columns"]}
    assert result["board"] is not None
    assert "card-1" in columns["col-done"]
    assert "card-1" not in columns["col-backlog"]


@pytest.mark.ai
def test_real_chat_edits_card(signed_in):
    result = chat(signed_in, 'Change the title of card-2 to "Interview five customers".')
    cards = signed_in.get("/api/board").json()["cards"]
    assert result["board"] is not None
    assert cards["card-2"]["title"] == "Interview five customers"
    assert len(cards) == len(DEFAULT["cards"])


@pytest.mark.ai
def test_real_chat_does_not_repeat_earlier_requests(signed_in):
    first = 'Add a card titled "Write release notes" to Backlog.'
    reply = chat(signed_in, first)["reply"]
    count = len(signed_in.get("/api/board").json()["cards"])
    history = [{"role": "user", "content": first}, {"role": "assistant", "content": reply}]
    response = signed_in.post(
        "/api/chat",
        json={"message": 'Rename "Write release notes" to "Publish release notes".', "history": history},
    )
    assert response.status_code == 200, response.text
    titles = [c["title"] for c in signed_in.get("/api/board").json()["cards"].values()]
    assert len(titles) == count
    assert "Publish release notes" in titles
    assert "Write release notes" not in titles
