from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sympy import Eq, diff, limit, oo, simplify, solve, symbols
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

router = APIRouter(tags=["math"])

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)


def safe_parse(expr_str: str):
    try:
        return parse_expr(expr_str, transformations=TRANSFORMATIONS)
    except (SyntaxError, TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {e}") from e


class SolveRequest(BaseModel):
    equation: str
    variable: str = "x"


class SolveResponse(BaseModel):
    solutions: list[str]


@router.post("/solve", response_model=SolveResponse)
def solve_equation(req: SolveRequest):
    var = symbols(req.variable)

    if "=" in req.equation:
        left, right = req.equation.split("=", 1)
        expr = Eq(safe_parse(left.strip()), safe_parse(right.strip()))
    else:
        expr = safe_parse(req.equation)

    solutions = solve(expr, var)
    return SolveResponse(solutions=[str(s) for s in solutions])


class VerifyRequest(BaseModel):
    expr1: str
    expr2: str


class VerifyResponse(BaseModel):
    equivalent: bool
    diff: str


@router.post("/verify", response_model=VerifyResponse)
def verify_equivalence(req: VerifyRequest):
    e1 = safe_parse(req.expr1)
    e2 = safe_parse(req.expr2)

    difference = simplify(e1 - e2)
    is_equivalent = difference == 0

    return VerifyResponse(equivalent=is_equivalent, diff=str(difference))


class SimplifyRequest(BaseModel):
    expr: str


class SimplifyResponse(BaseModel):
    simplified: str


@router.post("/simplify", response_model=SimplifyResponse)
def simplify_expression(req: SimplifyRequest):
    expr = safe_parse(req.expr)
    result = simplify(expr)
    return SimplifyResponse(simplified=str(result))


class DifferentiateRequest(BaseModel):
    expr: str
    variable: str = "x"


class DifferentiateResponse(BaseModel):
    derivative: str


@router.post("/differentiate", response_model=DifferentiateResponse)
def differentiate_expression(req: DifferentiateRequest):
    var = symbols(req.variable)
    expr = safe_parse(req.expr)
    result = diff(expr, var)
    return DifferentiateResponse(derivative=str(result))


class LimitRequest(BaseModel):
    expr: str
    variable: str = "x"
    point: str


class LimitResponse(BaseModel):
    limit: str


@router.post("/limit", response_model=LimitResponse)
def compute_limit(req: LimitRequest):
    var = symbols(req.variable)
    expr = safe_parse(req.expr)

    if req.point == "oo":
        pt = oo
    elif req.point == "-oo":
        pt = -oo
    else:
        pt = safe_parse(req.point)

    result = limit(expr, var, pt)
    return LimitResponse(limit=str(result))
