def test_simplify_polynomial(client):
    response = client.post("/simplify", json={"expr": "(x+1)**2 - x**2"})
    assert response.status_code == 200
    assert response.json()["simplified"] == "2*x + 1"


def test_simplify_keeps_rational(client):
    response = client.post("/simplify", json={"expr": "1/3 + 1/6"})
    assert response.status_code == 200
    assert response.json()["simplified"] == "1/2"


def test_simplify_keeps_sqrt(client):
    response = client.post("/simplify", json={"expr": "sqrt(8)"})
    assert response.status_code == 200
    assert response.json()["simplified"] == "2*sqrt(2)"
