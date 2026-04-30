def test_differentiate_polynomial(client):
    response = client.post(
        "/differentiate",
        json={"expr": "x**2 + 3*x", "variable": "x"},
    )
    assert response.status_code == 200
    assert response.json()["derivative"] == "2*x + 3"


def test_differentiate_constant(client):
    response = client.post(
        "/differentiate",
        json={"expr": "5", "variable": "x"},
    )
    assert response.status_code == 200
    assert response.json()["derivative"] == "0"


def test_differentiate_trig(client):
    response = client.post(
        "/differentiate",
        json={"expr": "sin(x)", "variable": "x"},
    )
    assert response.status_code == 200
    assert response.json()["derivative"] == "cos(x)"
