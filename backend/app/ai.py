import os
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

from app.models import Board, Card, Column

MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = """You are a project management assistant for a Kanban board.
You can answer questions about the board and create, edit, move or delete cards.

Current board (JSON):
{board}

Rules:
- Always write a short, helpful `reply` to the user.
- If the board does not need to change, set `columns` to null.
- If it does, return the complete updated board in `columns`: every column in the same order with the same ids, each with all of its cards in order. Cards you do not change must be returned unchanged.
- Column titles may be renamed only if the user asks. Columns cannot be added or removed.
- New cards need a unique id such as "card-<short-random-string>".
"""


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AIColumn(BaseModel):
    id: str
    title: str
    cards: list[Card]


class AIResponse(BaseModel):
    reply: str
    columns: list[AIColumn] | None


def client() -> OpenAI:
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ.get("OPENROUTER_API_KEY"),
    )


def ask(question: str) -> str:
    completion = client().chat.completions.create(
        model=MODEL, messages=[{"role": "user", "content": question}]
    )
    return completion.choices[0].message.content


def build_messages(board: Board, history: list[Message], message: str) -> list[dict]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT.format(board=board.model_dump_json())},
        *[m.model_dump() for m in history],
        {"role": "user", "content": message},
    ]


def chat(board: Board, history: list[Message], message: str) -> AIResponse | None:
    completion = client().chat.completions.parse(
        model=MODEL,
        messages=build_messages(board, history, message),
        response_format=AIResponse,
        extra_body={"provider": {"require_parameters": True}},
    )
    return completion.choices[0].message.parsed


def to_board(columns: list[AIColumn]) -> Board:
    return Board(
        columns=[
            Column(id=c.id, title=c.title, cardIds=[card.id for card in c.cards])
            for c in columns
        ],
        cards={card.id: card for c in columns for card in c.cards},
    )
