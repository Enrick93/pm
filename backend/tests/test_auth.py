def login(client, password="password"):
    return client.post("/api/login", json={"username": "user", "password": password})


def test_login_success(client):
    assert login(client).status_code == 200
    assert client.get("/api/me").json() == {"username": "user"}


def test_login_invalid(client):
    assert login(client, "wrong").status_code == 401
    assert client.get("/api/me").status_code == 401


def test_me_requires_session(client):
    assert client.get("/api/me").status_code == 401


def test_logout_clears_session(client):
    login(client)
    client.post("/api/logout")
    assert client.get("/api/me").status_code == 401
