def test_evaluate_factorial_product(client):
    response = client.post(
        "/evaluate", json={"expr": "factorial(3)*factorial(3)*1*factorial(4)"}
    )
    assert response.status_code == 200
    assert response.json()["value"] == "864"


def test_evaluate_binomial(client):
    response = client.post("/evaluate", json={"expr": "binomial(10, 3)"})
    assert response.status_code == 200
    assert response.json()["value"] == "120"


def test_evaluate_permutation_as_factorial_ratio(client):
    response = client.post(
        "/evaluate", json={"expr": "factorial(5)/factorial(5-2)"}
    )
    assert response.status_code == 200
    assert response.json()["value"] == "20"


def test_evaluate_keeps_exact_fraction(client):
    response = client.post("/evaluate", json={"expr": "3/8"})
    assert response.status_code == 200
    body = response.json()
    assert body["value"] == "3/8"
    assert body["numeric"].startswith("0.375")


def test_evaluate_keeps_exact_sqrt(client):
    response = client.post("/evaluate", json={"expr": "sqrt(8)"})
    assert response.status_code == 200
    assert response.json()["value"] == "2*sqrt(2)"


def test_evaluate_rejects_symbolic_expression(client):
    response = client.post("/evaluate", json={"expr": "x + 1"})
    assert response.status_code == 422


def test_evaluate_rejects_unparseable_expression(client):
    # TokenError 류는 500, SyntaxError 류는 400.
    # 클라이언트 계약은 "비정상 응답 → unverified".
    response = client.post("/evaluate", json={"expr": "factorial("})
    assert response.status_code >= 400
