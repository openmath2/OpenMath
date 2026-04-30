def test_solve_quadratic_two_roots(client):
    response = client.post(
        "/solve",
        json={"equation": "x**2 - 5*x + 6 = 0", "variable": "x"},
    )
    assert response.status_code == 200
    solutions = response.json()["solutions"]
    assert sorted(solutions, key=lambda s: int(s)) == ["2", "3"]


def test_solve_quadratic_double_root(client):
    response = client.post(
        "/solve",
        json={"equation": "x**2 + 4*x + 4 = 0", "variable": "x"},
    )
    assert response.status_code == 200
    assert response.json()["solutions"] == ["-2"]


def test_solve_linear(client):
    response = client.post(
        "/solve",
        json={"equation": "2*x + 4 = 0", "variable": "x"},
    )
    assert response.status_code == 200
    assert response.json()["solutions"] == ["-2"]


def test_solve_implicit_zero(client):
    response = client.post(
        "/solve",
        json={"equation": "x**2 - 4", "variable": "x"},
    )
    assert response.status_code == 200
    solutions = response.json()["solutions"]
    assert sorted(solutions, key=lambda s: int(s)) == ["-2", "2"]


def test_solve_rational_solution(client):
    response = client.post(
        "/solve",
        json={"equation": "2*x + 1 = 0", "variable": "x"},
    )
    assert response.status_code == 200
    assert response.json()["solutions"] == ["-1/2"]


def test_solve_invalid_equation(client):
    response = client.post(
        "/solve",
        json={"equation": "this is not math", "variable": "x"},
    )
    assert response.status_code == 400
