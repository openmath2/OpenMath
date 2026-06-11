# pyright: reportAny=false
# pyright: reportArgumentType=false
# pyright: reportAttributeAccessIssue=false
# pyright: reportCallIssue=false
# pyright: reportExplicitAny=false
# pyright: reportMissingTypeArgument=false
# pyright: reportMissingTypeStubs=false
# pyright: reportOperatorIssue=false
# pyright: reportOptionalMemberAccess=false
# pyright: reportOptionalOperand=false
# pyright: reportUnknownArgumentType=false
# pyright: reportUnknownLambdaType=false
# pyright: reportUnknownMemberType=false
# pyright: reportUnknownParameterType=false
# pyright: reportUnknownVariableType=false
import asyncio
import multiprocessing
import queue
import random
from collections.abc import Callable
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sympy import Eq, diff, lambdify, limit, oo, simplify, solve, symbols
from sympy.core.relational import Equality, Relational
from sympy.parsing.latex import parse_latex
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)
from sympy.solvers.inequalities import solve_univariate_inequality

router = APIRouter(tags=["math"])

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)

COMPUTE_TIMEOUT_SECONDS = 5.0
NUMERIC_SAMPLE_COUNT = 8
NUMERIC_SAMPLE_TOLERANCE = 1e-9
SPAWN_CONTEXT = multiprocessing.get_context("spawn")


class ComputationTimeoutError(TimeoutError):
    pass


def _process_worker(
    result_queue: multiprocessing.Queue,
    fn: Callable[..., Any],
    args: tuple[Any, ...],
) -> None:
    try:
        result = fn(*args)
    except HTTPException as e:
        result_queue.put(
            {
                "kind": "http_error",
                "status_code": e.status_code,
                "detail": e.detail,
            }
        )
    except Exception as e:
        result_queue.put(
            {
                "kind": "error",
                "error_type": type(e).__name__,
                "detail": str(e),
            }
        )
    else:
        result_queue.put({"kind": "ok", "result": result})


def run_with_timeout(
    fn: Callable[..., Any],
    args: tuple[Any, ...] = (),
    timeout: float = COMPUTE_TIMEOUT_SECONDS,
) -> Any:
    result_queue = SPAWN_CONTEXT.Queue()
    proc = SPAWN_CONTEXT.Process(target=_process_worker, args=(result_queue, fn, args))

    try:
        proc.start()
        proc.join(timeout)

        if proc.is_alive():
            proc.terminate()
            proc.join(1)
            if proc.is_alive():
                proc.kill()
                proc.join()
            raise ComputationTimeoutError(
                f"SymPy computation timed out after {timeout}s"
            )

        try:
            payload = result_queue.get(timeout=1)
        except queue.Empty as e:
            raise HTTPException(
                status_code=500,
                detail=(
                    "SymPy worker exited without a result "
                    f"(exitcode={proc.exitcode})"
                ),
            ) from e
    finally:
        result_queue.close()
        result_queue.join_thread()

    if payload["kind"] == "ok":
        return payload["result"]

    if payload["kind"] == "http_error":
        raise HTTPException(
            status_code=payload["status_code"],
            detail=payload["detail"],
        )

    raise HTTPException(
        status_code=500,
        detail=f"{payload['error_type']}: {payload['detail']}",
    )


async def _run_compute(fn: Callable[..., Any], *args: Any) -> Any:
    try:
        return await asyncio.to_thread(
            run_with_timeout,
            fn,
            args,
            COMPUTE_TIMEOUT_SECONDS,
        )
    except ComputationTimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e)) from e


def safe_parse(expr_str: str):
    try:
        return parse_expr(expr_str, transformations=TRANSFORMATIONS)
    except (SyntaxError, TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {e}") from e


def _looks_like_latex(expr_str: str) -> bool:
    return any(token in expr_str for token in ("\\", "^", "_", "{"))


def parse_math(expr_str: str):
    normalized = expr_str.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Parse error: empty expression")

    if not _looks_like_latex(normalized):
        return safe_parse(normalized)

    try:
        return parse_latex(normalized, backend="lark")
    except Exception as latex_error:
        try:
            return safe_parse(normalized)
        except HTTPException as parse_error:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Parse error: {parse_error.detail}; "
                    f"LaTeX parse error: {latex_error}"
                ),
            ) from parse_error


def parse_equation(equation: str):
    if "=" in equation:
        left, right = equation.split("=", 1)
        return Eq(parse_math(left.strip()), parse_math(right.strip()))
    return parse_math(equation)


def _equation_normal_form(equation: str):
    if "=" in equation:
        left, right = equation.split("=", 1)
        return parse_math(left.strip()) - parse_math(right.strip())

    parsed = parse_math(equation)
    if isinstance(parsed, Equality):
        return parsed.lhs - parsed.rhs
    return parsed


def _near_zero(value: Any, tolerance: float = NUMERIC_SAMPLE_TOLERANCE) -> bool:
    try:
        return abs(complex(value)) <= tolerance
    except (TypeError, ValueError, OverflowError):
        return abs(float(value)) <= tolerance


def _numeric_samples_equal_zero(
    difference: Any,
    samples: int = NUMERIC_SAMPLE_COUNT,
    tolerance: float = NUMERIC_SAMPLE_TOLERANCE,
) -> bool:
    free_symbols = sorted(difference.free_symbols, key=lambda symbol: symbol.name)
    if not free_symbols:
        try:
            return _near_zero(difference.evalf(), tolerance)
        except (TypeError, ValueError, OverflowError):
            return False

    rng = random.Random(1729)
    numeric_fn = lambdify(free_symbols, difference, "mpmath")
    successful_samples = 0

    for _ in range(samples * 4):
        sample_point = [rng.uniform(-10, 10) for _ in free_symbols]
        try:
            value = numeric_fn(*sample_point)
            is_zero = _near_zero(value, tolerance)
        except Exception:
            continue

        if not is_zero:
            return False

        successful_samples += 1
        if successful_samples == samples:
            return True

    return False


def _expressions_equivalent(expr1: Any, expr2: Any) -> tuple[bool, str]:
    difference = expr1 - expr2
    symbolic_result = difference.equals(0)

    if symbolic_result is None:
        is_equivalent = _numeric_samples_equal_zero(difference)
    else:
        is_equivalent = bool(symbolic_result)

    try:
        diff_string = str(simplify(difference))
    except Exception:
        diff_string = str(difference)

    return is_equivalent, diff_string


def _parse_solution_token(token: str) -> list[Any]:
    normalized = token.strip()
    if "=" in normalized:
        normalized = normalized.split("=", 1)[1].strip()

    plus_minus_markers = ("±", "\\pm", "+/-")
    for marker in plus_minus_markers:
        if marker in normalized:
            value = parse_math(normalized.split(marker, 1)[1].strip())
            return [simplify(value), simplify(-value)]

    return [simplify(parse_math(normalized))]


def _parse_solution_set(solution_set: str) -> list[Any]:
    normalized = solution_set.strip()
    normalized = normalized.replace("$", "")
    normalized = normalized.replace("\\left", "").replace("\\right", "")
    normalized = normalized.replace("\\{", "{").replace("\\}", "}")

    if normalized.startswith("{") and normalized.endswith("}"):
        normalized = normalized[1:-1]

    if not normalized.strip():
        return []

    values: list[Any] = []
    for token in normalized.replace(";", ",").split(","):
        stripped = token.strip()
        if stripped:
            values.extend(_parse_solution_token(stripped))

    return _dedupe_equivalent(values)


def _dedupe_equivalent(values: list[Any]) -> list[Any]:
    deduped: list[Any] = []
    for value in values:
        if not any(_expressions_equivalent(value, existing)[0] for existing in deduped):
            deduped.append(value)
    return deduped


def _sets_equivalent(expected: list[Any], actual: list[Any]) -> bool:
    if len(expected) != len(actual):
        return False

    unmatched_actual = list(actual)
    for expected_value in expected:
        match_index = next(
            (
                index
                for index, actual_value in enumerate(unmatched_actual)
                if _expressions_equivalent(expected_value, actual_value)[0]
            ),
            None,
        )
        if match_index is None:
            return False
        unmatched_actual.pop(match_index)

    return True


def _parse_inequality(inequality: str) -> Relational:
    parsed = parse_math(inequality)
    if not isinstance(parsed, Relational) or isinstance(parsed, Equality):
        raise HTTPException(status_code=400, detail="Expected an inequality")
    return parsed


def _inequalities_equivalent(expected: Relational, actual: Relational) -> bool:
    direct_result = expected.equals(actual)
    if direct_result is True:
        return True

    if expected.canonical == actual.canonical:
        return True


    free_symbols = sorted(
        expected.free_symbols.union(actual.free_symbols),
        key=lambda symbol: symbol.name,
    )
    if len(free_symbols) != 1:
        return False

    variable = free_symbols[0]
    try:
        expected_set = solve_univariate_inequality(
            expected,
            variable,
            relational=False,
        )
        actual_set = solve_univariate_inequality(actual, variable, relational=False)
    except (AttributeError, NotImplementedError, TypeError, ValueError):
        return False

    return expected_set == actual_set


def _equations_equivalent(expected: str, actual: str) -> bool:
    expected_normal = _equation_normal_form(expected)
    actual_normal = _equation_normal_form(actual)

    if _expressions_equivalent(expected_normal, actual_normal)[0]:
        return True

    if _expressions_equivalent(expected_normal, -actual_normal)[0]:
        return True

    free_symbols = sorted(
        expected_normal.free_symbols.union(actual_normal.free_symbols),
        key=lambda symbol: symbol.name,
    )
    if len(free_symbols) != 1:
        return False

    variable = free_symbols[0]
    try:
        expected_solutions = _dedupe_equivalent(solve(Eq(expected_normal, 0), variable))
        actual_solutions = _dedupe_equivalent(solve(Eq(actual_normal, 0), variable))
    except (NotImplementedError, TypeError, ValueError):
        return False

    return _sets_equivalent(expected_solutions, actual_solutions)


class SolveRequest(BaseModel):
    equation: str | list[str]
    variable: str | list[str] = "x"


class SolveResponse(BaseModel):
    solutions: list[str]


def _compute_solve(
    equation: str | list[str],
    variable: str | list[str],
) -> dict[str, Any]:
    if isinstance(variable, list):
        variables = symbols(" ".join(variable))
        if not isinstance(variables, tuple):
            variables = (variables,)
    else:
        variables = (symbols(variable),)

    if isinstance(equation, list):
        equations = [parse_equation(item) for item in equation]
        solutions = solve(equations, variables, dict=True)
        return {
            "solutions": [
                ", ".join(f"{str(var)}={str(solution[var])}" for var in variables)
                for solution in solutions
            ]
        }

    expr = parse_equation(equation)
    var = variables[0]
    solutions = solve(expr, var)
    return {"solutions": [str(solution) for solution in solutions]}


@router.post("/solve", response_model=SolveResponse)
async def solve_equation(req: SolveRequest):
    return await _run_compute(_compute_solve, req.equation, req.variable)


class VerifyRequest(BaseModel):
    expr1: str
    expr2: str


class VerifyResponse(BaseModel):
    equivalent: bool
    diff: str


def _compute_verify(expr1: str, expr2: str) -> dict[str, Any]:
    e1 = parse_math(expr1)
    e2 = parse_math(expr2)
    is_equivalent, difference = _expressions_equivalent(e1, e2)
    return {"equivalent": is_equivalent, "diff": difference}


@router.post("/verify", response_model=VerifyResponse)
async def verify_equivalence(req: VerifyRequest):
    return await _run_compute(_compute_verify, req.expr1, req.expr2)


class VerifyAnswerRequest(BaseModel):
    expected: str
    actual: str
    answer_type: Literal[
        "number",
        "expression",
        "equation",
        "solution_set",
        "inequality",
    ]


class VerifyAnswerResponse(BaseModel):
    equivalent: bool
    detail: str


def _compute_verify_answer(
    expected: str,
    actual: str,
    answer_type: str,
) -> dict[str, Any]:
    if answer_type in {"number", "expression"}:
        is_equivalent, difference = _expressions_equivalent(
            parse_math(expected),
            parse_math(actual),
        )
        return {
            "equivalent": is_equivalent,
            "detail": "answers are equivalent"
            if is_equivalent
            else f"diff={difference}",
        }

    if answer_type == "equation":
        is_equivalent = _equations_equivalent(expected, actual)
        return {
            "equivalent": is_equivalent,
            "detail": "equations are equivalent"
            if is_equivalent
            else "equations have different solution sets",
        }

    if answer_type == "solution_set":
        expected_set = _parse_solution_set(expected)
        actual_set = _parse_solution_set(actual)
        is_equivalent = _sets_equivalent(expected_set, actual_set)
        return {
            "equivalent": is_equivalent,
            "detail": "solution sets are equivalent"
            if is_equivalent
            else f"expected={expected_set}, actual={actual_set}",
        }

    if answer_type == "inequality":
        is_equivalent = _inequalities_equivalent(
            _parse_inequality(expected),
            _parse_inequality(actual),
        )
        return {
            "equivalent": is_equivalent,
            "detail": "inequalities are equivalent"
            if is_equivalent
            else "inequalities describe different regions",
        }

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported answer_type: {answer_type}",
    )


@router.post("/verify-answer", response_model=VerifyAnswerResponse)
async def verify_answer(req: VerifyAnswerRequest):
    return await _run_compute(
        _compute_verify_answer,
        req.expected,
        req.actual,
        req.answer_type,
    )


class SimplifyRequest(BaseModel):
    expr: str


class SimplifyResponse(BaseModel):
    simplified: str


def _compute_simplify(expr: str) -> dict[str, Any]:
    parsed = parse_math(expr)
    result = simplify(parsed)
    return {"simplified": str(result)}


@router.post("/simplify", response_model=SimplifyResponse)
async def simplify_expression(req: SimplifyRequest):
    return await _run_compute(_compute_simplify, req.expr)


class EvaluateRequest(BaseModel):
    expr: str


class EvaluateResponse(BaseModel):
    value: str
    numeric: str


def _compute_evaluate(expr: str) -> dict[str, Any]:
    parsed = parse_math(expr)
    evaluated = simplify(parsed.doit() if hasattr(parsed, "doit") else parsed)
    if not evaluated.is_number:
        raise HTTPException(
            status_code=422,
            detail=f"Expression did not evaluate to a number: {evaluated}",
        )
    return {"value": str(evaluated), "numeric": str(evaluated.evalf())}


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_expression(req: EvaluateRequest):
    return await _run_compute(_compute_evaluate, req.expr)


class DifferentiateRequest(BaseModel):
    expr: str
    variable: str = "x"


class DifferentiateResponse(BaseModel):
    derivative: str


def _compute_differentiate(expr: str, variable: str) -> dict[str, Any]:
    var = symbols(variable)
    parsed = parse_math(expr)
    result = diff(parsed, var)
    return {"derivative": str(result)}


@router.post("/differentiate", response_model=DifferentiateResponse)
async def differentiate_expression(req: DifferentiateRequest):
    return await _run_compute(_compute_differentiate, req.expr, req.variable)


class LimitRequest(BaseModel):
    expr: str
    variable: str = "x"
    point: str


class LimitResponse(BaseModel):
    limit: str


def _compute_limit(expr: str, variable: str, point: str) -> dict[str, Any]:
    var = symbols(variable)
    parsed = parse_math(expr)

    if point == "oo":
        pt = oo
    elif point == "-oo":
        pt = -oo
    else:
        pt = parse_math(point)

    result = limit(parsed, var, pt)
    return {"limit": str(result)}


@router.post("/limit", response_model=LimitResponse)
async def compute_limit(req: LimitRequest):
    return await _run_compute(_compute_limit, req.expr, req.variable, req.point)
