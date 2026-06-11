# pyright: reportAny=false
# pyright: reportMissingParameterType=false
# pyright: reportMissingTypeStubs=false
# pyright: reportUnknownArgumentType=false
# pyright: reportUnknownMemberType=false
# pyright: reportUnknownParameterType=false
# pyright: reportUnknownVariableType=false
from sympy import simplify, symbols

from src.routers import math as math_router


def test_parse_math_accepts_latex_fraction():
    x = symbols("x")
    parsed = math_router.parse_math(r"\frac{1}{2}+x^2")
    assert simplify(parsed - (x**2 + 1 / 2)) == 0


def test_verify_uses_sampling_when_equals_is_undecidable(client):
    response = client.post(
        "/verify",
        json={"expr1": "Abs(x)**2", "expr2": "x**2"},
    )

    assert response.status_code == 200
    assert response.json()["equivalent"] is True


def test_verify_answer_number_fraction_decimal(client):
    response = client.post(
        "/verify-answer",
        json={"expected": "1/2", "actual": "0.5", "answer_type": "number"},
    )

    assert response.status_code == 200
    assert response.json()["equivalent"] is True


def test_verify_answer_expression_latex(client):
    response = client.post(
        "/verify-answer",
        json={
            "expected": r"(x+1)^2",
            "actual": "x**2 + 2*x + 1",
            "answer_type": "expression",
        },
    )

    assert response.status_code == 200
    assert response.json()["equivalent"] is True


def test_verify_answer_equation_normalizes_solution_form(client):
    response = client.post(
        "/verify-answer",
        json={"expected": "x=2", "actual": "x-2=0", "answer_type": "equation"},
    )

    assert response.status_code == 200
    assert response.json()["equivalent"] is True


def test_verify_answer_solution_set_accepts_comma_order(client):
    response = client.post(
        "/verify-answer",
        json={
            "expected": "{-2, 2}",
            "actual": "2, -2",
            "answer_type": "solution_set",
        },
    )

    assert response.status_code == 200
    assert response.json()["equivalent"] is True


def test_verify_answer_solution_set_accepts_plus_minus(client):
    response = client.post(
        "/verify-answer",
        json={
            "expected": "±2",
            "actual": "2, -2",
            "answer_type": "solution_set",
        },
    )

    assert response.status_code == 200
    assert response.json()["equivalent"] is True


def test_verify_answer_inequality_canonicalizes_direction(client):
    response = client.post(
        "/verify-answer",
        json={"expected": "x > 2", "actual": "2 < x", "answer_type": "inequality"},
    )

    assert response.status_code == 200
    assert response.json()["equivalent"] is True


def test_endpoint_timeout_returns_504(client, monkeypatch):
    monkeypatch.setattr(math_router, "COMPUTE_TIMEOUT_SECONDS", 0.001)

    response = client.post("/simplify", json={"expr": "x + 1"})

    assert response.status_code == 504
    assert "timed out" in response.json()["detail"]
