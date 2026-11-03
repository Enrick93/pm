import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

static_dir = Path(tempfile.mkdtemp())
(static_dir / "index.html").write_text("<html>test</html>")
os.environ["STATIC_DIR"] = str(static_dir)

from app import db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "data" / "pm.db")
    with TestClient(app) as client:
        yield client


@pytest.fixture
def auth_client(client):
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client
