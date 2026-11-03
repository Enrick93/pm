import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path

from app.models import Board

DB_PATH = Path(os.environ.get("DB_PATH", "data/pm.db"))
SEED_BOARD = (Path(__file__).parent / "seed_board.json").read_text()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    with closing(sqlite3.connect(DB_PATH)) as conn, conn:
        yield conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        conn.execute("INSERT OR IGNORE INTO users (username) VALUES ('user')")


def get_board(username: str) -> Board:
    with connect() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO boards (user_id, data)
               SELECT id, ? FROM users WHERE username = ?""",
            (SEED_BOARD, username),
        )
        (data,) = conn.execute(
            """SELECT b.data FROM boards b JOIN users u ON u.id = b.user_id
               WHERE u.username = ?""",
            (username,),
        ).fetchone()
    return Board.model_validate_json(data)


def save_board(username: str, board: Board) -> None:
    with connect() as conn:
        conn.execute(
            """UPDATE boards SET data = ?, updated_at = CURRENT_TIMESTAMP
               WHERE user_id = (SELECT id FROM users WHERE username = ?)""",
            (board.model_dump_json(), username),
        )
