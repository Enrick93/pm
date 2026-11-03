from app import ai, db
from app.ai import AIColumn, AIResponse, Message


def fake_chat(response, calls=None):
    def chat(board, history, message):
        if calls is not None:
            calls.append((board, history, message))
        return response

    return chat


def board_columns():
    board = db.get_board("user")
    return [
        AIColumn(
            id=c.id, title=c.title, cards=[board.cards[card_id] for card_id in c.cardIds]
        )
        for c in board.columns
    ]


def test_reply_without_board_change(auth_client, monkeypatch):
    before = auth_client.get("/api/board").json()
    calls = []
    monkeypatch.setattr(ai, "chat", fake_chat(AIResponse(reply="Hi", columns=None), calls))
    response = auth_client.post(
        "/api/chat",
        json={"message": "Hello", "history": [{"role": "user", "content": "Earlier"}]},
    )
    assert response.json() == {"reply": "Hi", "board": None}
    assert auth_client.get("/api/board").json() == before
    board, history, message = calls[0]
    assert len(board.cards) == 8
    assert history == [Message(role="user", content="Earlier")]
    assert message == "Hello"


def test_reply_with_board_update_is_saved(auth_client, monkeypatch):
    auth_client.get("/api/board")
    columns = board_columns()
    moved = columns[0].cards.pop(0)
    columns[4].cards.append(moved)
    columns[1].cards.append(ai.Card(id="card-new", title="New", details="From AI"))
    monkeypatch.setattr(ai, "chat", fake_chat(AIResponse(reply="Done", columns=columns)))

    response = auth_client.post("/api/chat", json={"message": "Do it"}).json()
    saved = auth_client.get("/api/board").json()
    assert response["reply"] == "Done"
    assert response["board"] == saved
    assert saved["columns"][4]["cardIds"][-1] == moved.id
    assert saved["cards"]["card-new"]["title"] == "New"


def test_invalid_board_from_ai_is_rejected(auth_client, monkeypatch):
    before = auth_client.get("/api/board").json()
    columns = board_columns()
    columns[1].cards.append(columns[0].cards[0])  # duplicate card
    monkeypatch.setattr(ai, "chat", fake_chat(AIResponse(reply="Oops", columns=columns)))
    assert auth_client.post("/api/chat", json={"message": "x"}).status_code == 502
    assert auth_client.get("/api/board").json() == before


def test_column_changes_from_ai_are_rejected(auth_client, monkeypatch):
    before = auth_client.get("/api/board").json()
    columns = board_columns()[:4]
    monkeypatch.setattr(ai, "chat", fake_chat(AIResponse(reply="Oops", columns=columns)))
    assert auth_client.post("/api/chat", json={"message": "x"}).status_code == 502
    assert auth_client.get("/api/board").json() == before


def test_chat_requires_session(client):
    assert client.post("/api/chat", json={"message": "x"}).status_code == 401


def test_build_messages_includes_board_history_and_message(client):
    board = db.get_board("user")
    messages = ai.build_messages(
        board, [Message(role="assistant", content="Earlier reply")], "Question"
    )
    assert messages[0]["role"] == "system"
    assert "Align roadmap themes" in messages[0]["content"]
    assert messages[1] == {"role": "assistant", "content": "Earlier reply"}
    assert messages[2] == {"role": "user", "content": "Question"}
