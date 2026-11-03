import os

import pytest

from app import ai, db

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="no API key"),
]


def test_connectivity():
    assert "4" in ai.ask("What is 2+2? Answer with just the number.")


def test_ai_creates_card(auth_client):
    response = auth_client.post(
        "/api/chat",
        json={"message": "Add a card titled 'Write release notes' to the Review column."},
    )
    assert response.status_code == 200
    board = db.get_board("user")
    review = next(c for c in board.columns if c.id == "col-review")
    assert any(board.cards[i].title == "Write release notes" for i in review.cardIds)


def test_ai_moves_card(auth_client):
    auth_client.get("/api/board")
    response = auth_client.post(
        "/api/chat",
        json={"message": "Move the card 'Align roadmap themes' to the Done column."},
    )
    assert response.status_code == 200
    board = db.get_board("user")
    done = next(c for c in board.columns if c.id == "col-done")
    assert "card-1" in done.cardIds
    assert len(board.cards) == 8
