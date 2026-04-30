def test_limit_finite_point(client):
    response = client.post(
        "/limit",
        json={"expr": "sin(x)/x", "variable": "x", "point": "0"},
    )
    assert response.status_code == 200
    assert response.json()["limit"] == "1"


def test_limit_to_infinity(client):
    response = client.post(
        "/limit",
        json={"expr": "1/x", "variable": "x", "point": "oo"},
    )
    assert response.status_code == 200
    assert response.json()["limit"] == "0"


def test_limit_polynomial(client):
    response = client.post(
        "/limit",
        json={"expr": "x**2 + 1", "variable": "x", "point": "2"},
    )
    assert response.status_code == 200
    assert response.json()["limit"] == "5"
