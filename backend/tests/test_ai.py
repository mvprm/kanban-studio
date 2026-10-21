import pytest

from app import ai


def test_ai_test_requires_login(client):
    assert client.post("/api/ai/test").status_code == 401


def test_ai_test_returns_reply(signed_in, monkeypatch):
    prompts = []
    monkeypatch.setattr(ai, "complete", lambda prompt: prompts.append(prompt) or "4")
    response = signed_in.post("/api/ai/test")
    assert response.status_code == 200
    assert response.json() == {"reply": "4"}
    assert prompts == ["What is 2+2?"]


@pytest.mark.ai
def test_real_completion():
    assert "4" in ai.complete("What is 2+2? Answer with just the number.")


@pytest.mark.ai
def test_real_ai_test_route(signed_in):
    response = signed_in.post("/api/ai/test")
    assert response.status_code == 200
    assert "4" in response.json()["reply"]
