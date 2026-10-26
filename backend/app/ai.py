import json
import os
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

from app.models import Card, Column

MODEL = "openai/gpt-oss-120b"

# OpenRouter routing: only providers that honour response_format, and not CoreWeave,
# whose gpt-oss-120b returned malformed JSON on every structured request we tested
PROVIDER = {"require_parameters": True, "ignore": ["coreweave"]}

SYSTEM_PROMPT = """You are the assistant for a Kanban board app. You answer questions about the board and change it when asked.

The board is JSON: {"columns": [{"id", "title", "cardIds"}], "cards": [{"id", "title", "details"}]}.
"cardIds" lists a column's cards from top to bottom.

Rules:
- Keep every column id and the column order. You may rename column titles.
- Every card must be in exactly one column's "cardIds", and every id in "cardIds" must be a card.
- New cards need a unique id such as "card-<random letters>". Use "" for details if there are none.
- The latest user message starts with the current board, which already includes every change from earlier messages. Act only on the latest request and never repeat earlier changes.
- When you change the board, set "board" to the whole updated board: every column and every card, copied exactly apart from your changes. Never shorten text or leave cards out. Otherwise set "board" to null.
- Put a short reply to the user in "reply".
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
            {"role": "system", "content": SYSTEM_PROMPT},
            *(m.model_dump() for m in history),
            {"role": "user", "content": f"Current board:\n{json.dumps(ai_board)}\n\nRequest: {message}"},
        ],
        response_format=ChatResult,
        extra_body={"provider": PROVIDER},
    )
    return response.choices[0].message.parsed
