def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_serves_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "<html" in response.text
