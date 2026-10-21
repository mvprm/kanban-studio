import json
import os
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

from app.models import Card, Column

MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = """You are the assistant for a Kanban board app. You answer questions about the board and change it when asked.

The board is JSON: {"columns": [{"id", "title", "cardIds"}], "cards": [{"id", "title", "details"}]}.
"cardIds" lists a column's cards from top to bottom.

Rules:
- Keep every column id and the column order. You may rename column titles.
- Every card must be in exactly one column's "cardIds", and every id in "cardIds" must be a card.
- New cards need a unique id such as "card-<random letters>". Use "" for details if there are none.
- When you change the board, set "board" to the whole updated board. Otherwise set "board" to null.
- Put a short reply to the user in "reply".

The current board:
"""


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AIBoard(BaseModel):
    """The board with cards as a list, because strict JSON schemas can't describe a dict keyed by id."""

    columns: list[Column]
    cards: list[Card]


class ChatResult(BaseModel):
    reply: str
    board: AIBoard | None


def client() -> OpenAI:
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
    )


def complete(prompt: str) -> str:
    response = client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


def chat(board: dict, history: list[Message], message: str) -> ChatResult:
    ai_board = {"columns": board["columns"], "cards": list(board["cards"].values())}
    response = client().chat.completions.parse(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT + json.dumps(ai_board)},
            *(m.model_dump() for m in history),
            {"role": "user", "content": message},
        ],
        response_format=ChatResult,
    )
    return response.choices[0].message.parsed
