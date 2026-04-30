def test_verify_equivalent(client):
    response = client.post(
        "/verify",
        json={"expr1": "(x+1)**2", "expr2": "x**2 + 2*x + 1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["equivalent"] is True


def test_verify_not_equivalent(client):
    response = client.post(
        "/verify",
        json={"expr1": "x**2", "expr2": "x**3"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["equivalent"] is False
    assert body["diff"] != "0"


def test_verify_rational_equivalence(client):
    response = client.post(
        "/verify",
        json={"expr1": "1/2 + 1/3", "expr2": "5/6"},
    )
    assert response.status_code == 200
    assert response.json()["equivalent"] is True
