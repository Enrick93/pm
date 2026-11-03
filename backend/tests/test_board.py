from app import db


def test_db_created_on_startup(client):
    assert db.DB_PATH.exists()


def test_returns_seed_board(auth_client):
    board = auth_client.get("/api/board").json()
    assert [c["id"] for c in board["columns"]] == [
        "col-backlog",
        "col-discovery",
        "col-progress",
        "col-review",
        "col-done",
    ]
    assert len(board["cards"]) == 8


def test_put_then_get_round_trips(auth_client):
    board = auth_client.get("/api/board").json()
    board["columns"][0]["title"] = "Ideas"
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][4]["cardIds"].append("card-1")
    board["cards"]["card-1"]["title"] = "Edited"
    assert auth_client.put("/api/board", json=board).status_code == 200
    assert auth_client.get("/api/board").json() == board


def test_rejects_card_missing_from_columns(auth_client):
    board = auth_client.get("/api/board").json()
    board["columns"][0]["cardIds"].remove("card-1")
    assert auth_client.put("/api/board", json=board).status_code == 422


def test_rejects_unknown_card_id(auth_client):
    board = auth_client.get("/api/board").json()
    board["columns"][0]["cardIds"].append("card-missing")
    assert auth_client.put("/api/board", json=board).status_code == 422


def test_rejects_column_changes(auth_client):
    board = auth_client.get("/api/board").json()
    board["columns"][0]["id"] = "col-new"
    assert auth_client.put("/api/board", json=board).status_code == 422


def test_board_requires_session(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json={}).status_code == 401
