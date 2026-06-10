# Remediation Plan — Real Generation Agent Transition

| | |
|---|---|
| Status | Active (implementation) |
| Last updated | 2026-06-10 |
| Branch | `feat/agent-real-generation-remediation` |
| Goal | 12 demo units where the LLM actually generates problems, gates pass *honestly*, and quality is provable in numbers. |
| Principle | Each phase builds on the previous phase's **measurement**. Measure first, then fix ("재고 나서 고친다"). |

> This doc tracks the engineering execution of the transition from a template-first
> demo to a real LLM-generation product. File/line anchors below were captured from a
> full codebase survey (2026-06-10) and may drift — re-grep before editing.

## Environment status (verified 2026-06-10)

- `packages/agent/.env` exists: `LLM_PROVIDER=cliproxy`, `CLIPROXY_BASE_URL=http://localhost:8317/v1`, `LLM_MODEL=gpt-5.5(xhigh)`.
- CLIProxyAPI router reachable on `:8317` (401 on unauthenticated `/v1/models`; agent holds a key).
- math-engine healthy on `:16180`; agent up on `:31415`.
- Python **3.11.14** → `ProcessPoolExecutor.kill_workers()` (3.14+) unavailable. Hard SymPy timeout must use `multiprocessing.Process` + `terminate()`.
- AI SDK pinned `ai@^4.3.0` → v4 usage naming `{promptTokens, completionTokens, totalTokens}`; `NoObjectGeneratedError`, `experimental_repairText`, `abortSignal`, `temperature` all available on `generateObject`.

## 12 demo units (eval target)

`9수01-01`, `9수01-05`, `9수02-01`, `9수02-03`, `9수02-06`, `9수02-07`, `9수02-08`, `9수02-09`, `9수02-10`, `9수03-02`, `9수03-04`, `9수04-05`.

## Invariant impact (domain.md must be updated where flagged)

- Adding gate status `unverified` extends `GateStatusSchema` (`passed|failed|skipped` → `+unverified`). Touches **I-V1** model and **I-V4** semantics → update `domain.md` §2.4.
- 2-9 changes re-solve mismatch from `warning`-pass to retry-then-reject → revises **I-V4** intent → update `domain.md`.
- 1-4 intent fallback must still satisfy **I-I2** (≥1 `must_preserve:true`).
- 3-1/3-2/3-3 enforce **I-G2/I-G3** deterministically at the gate.

---

## Phase 0 — Baseline measurement (prerequisite for all decisions)

| # | Task | Target |
|---|---|---|
| 0-1 | `DETERMINISTIC_FALLBACK=off\|last-resort\|first` (default `first`) env, threaded to workflow. | `config/env.ts` L8-32, `index.ts` L39-103, `steps/problem-generation.ts` L58-63 |
| 0-1b | **Observability prereq**: expose verification `gates` + `generation_metadata.{model,refined_by}` + usage in the SSE result wire (needed by eval AND Phase 1-1 badge; no behavior change). | `wire-adapter.ts` L96-115, `wire-format.schema.ts` L45-72, `progress-event.schema.ts` |
| 0-2 | `scripts/eval-generation.ts`: 12 units × {structural,conceptual} × 5 → per-gate pass rate, failure reason, duration, `refined_by`, model → JSONL + summary MD. Template on `scripts/sweep-generate.mjs`. | `scripts/eval-generation.ts` (new) |
| 0-3 | Run once with `DETERMINISTIC_FALLBACK=off` → `docs/eval/baseline-<date>.md`. **Requires live LLM; numbers never fabricated.** | — |

**Done when**: a per-unit LLM-generation success table exists as the comparison baseline.

> **Baseline result (2026-06-10, see `docs/eval/baseline-2026-06-10.md`)**: pure-LLM (`off`) verified = **0/8 (0%)**. Failure modes: `no-result` pipeline exception (silently swallowed; from `generateProblem` re-throwing a `generateObject` schema failure) and 160s timeouts (slow `xhigh` model). Confirms the demo passes only via the template short-circuit. This is the number Phase 1+ must move.

## Phase 1 — Generation path recovery

| # | Task | Target |
|---|---|---|
| 1-1 | Demote template to last-resort; surface `generation_metadata.model="deterministic-topic-generator"` in SSE result; web "템플릿 폴백" badge. | `problem-generation.ts` L58-63,140-153, `deterministic.ts`, wire-adapter, web `result/view.tsx` L38-74 |
| 1-2 | Per-attempt temperature schedule (0.35→0.6→0.85); gate-specific retry hints; previous failed candidate as counterexample in prompt. | `retry-policy.ts` L19-45, `generator-agent.ts` L66-72, `prompts/problem-generator.md` |
| 1-3 | `generateObject` schema-failure immediate single retry (error as hint) before bubbling to workflow failure. | `generator-agent.ts` L66-72 |
| 1-4 | Intent fallback: stop guessing `must_preserve:true` for all dims → inherit strategy default dims; if guessed, set `fallback:true` evidence → warning. Keep I-I2. | `intent-extraction.ts` L69-110 |
| 1-5 | `SOLVER_MODEL` env (defaults to `LLM_MODEL`) so re-solve uses a different model. | `config/env.ts`, `index.ts` L42-80, `config/models.ts` |

**Done when**: re-run eval shows `deterministic-topic-generator` in `refined_by` < 10%, LLM success measurably improved vs baseline.

## Phase 2 — Verification becomes real verification

### math-engine (Python) — parallelizable with TS
| # | Task | Target |
|---|---|---|
| 2-1 | Per-request hard timeout via `multiprocessing.Process` + `terminate()` (5s) — Python 3.11, no `kill_workers`. | `routers/math.py`, `main.py` |
| 2-2 | Equivalence `simplify(a-b)==0` → `expr.equals(0)` + numeric-sampling fallback (lambdify mpmath, N trials). | `math.py` L78-86 |
| 2-3 | New `/verify-answer` with `answer_type: number\|expression\|equation\|solution_set\|inequality` (x=2 vs x-2=0; {-2,2} vs ±2; 1/2 vs 0.5). | `math.py`, models |
| 2-4 | LaTeX parse layer: `parse_latex(..., backend="lark")` + add `lark` dep; `\frac` etc → SymPy. Removes agent regex workarounds. | `math.py` L19-23, `pyproject.toml` |
| 2-5 | `async def` endpoints delegating to executor; uvicorn workers. | `main.py`, `run.py` |

### agent (TypeScript)
| # | Task | Target |
|---|---|---|
| 2-6 | 3-state gates: add `unverified` to `GateStatusSchema`. SymPy-blind types (Korean answer, geometry, stats) → `unverified` (not non-empty⇒passed). acceptance: `unverified`→`warning`. web badge "기호 검증 불가". **update domain.md.** | `verification.schema.ts` L24, `sympy-verification.ts` L70-90, `acceptance-policy.ts`, web |
| 2-7 | Multiple-choice verification: extract correct option value → compare to SymPy solution; 5 distractors mutually non-equivalent (block duplicate answers). | `sympy-verification.ts` L71-76, `answer-equivalence.ts` |
| 2-8 | `equation-extractor` unicode ops (≤ ≥ ÷) + LaTeX inline; extraction failure → `unverified` (not throw→failed). | `equation-extractor.ts` |
| 2-9 | Re-solve mismatch → retry trigger; final-attempt mismatch → `reject` (was warning-pass). | `acceptance-policy.ts` L21, `retry-policy.ts` |

**Done when**: zero "non-empty⇒passed" paths; every candidate is honestly `passed|unverified|failed`; deliberately-wrong-answer test cases all reject.

## Phase 3 — Isomorphism from prompt to gate

| # | Task | Target |
|---|---|---|
| 3-1 | `techniques_used: string[]` (enum from strategy vocab) in generator output → deterministic set compare with `required_techniques`. | `generated-problem.schema.ts`, `problem-generator.md`, `objective-mapping.ts` |
| 3-2 | Mode surface check: structural=number-masked skeleton must match source; conceptual=skeleton must differ. | `objective-mapping.ts` L135-141 |
| 3-3 | Enforce `must_preserve` dims deterministically (answer type, technique, difficulty markers) at the gate, independent of LLM critic. | `objective-mapping.ts` |

**Done when**: injecting a different-technique problem (e.g. quadratic-formula item into a factoring unit) is rejected at the objective gate.

## Phase 4 — Trust & operational infra

| # | Task | Target |
|---|---|---|
| 4-1 | `withTimeout` + `AbortController` → propagate `abortSignal` to AI SDK + math-engine fetch; real cancel on timeout. | `timeout-policy.ts`, agents/clients |
| 4-2 | Remove 5 silent catches → record `skipped_reason` in gate evidence. | `objective-mapping.ts` L206, `problem-generation.ts` L190-193, `answer-equivalence.ts` L79-84 |
| 4-3 | Aggregate AI SDK `usage` per workflow into result event; cap calls per workflow. | wire/SSE schema, workflow |
| 4-4 | `LLM_E2E=1`-gated real integration test: 1 unit end-to-end → verified. | `tests/integration/` |
| 4-5 | Wire S5/S6 to real `useVerificationStream` results; remove mock. | `result/page.tsx` L35-46, `export/page.tsx` L45-60 |
| 4-6 | Corpus text injection defense: `<source>…</source>` wrap + "ignore instructions" directive. | `problem-generator.md`, prompt-loader |
| 4-7 | (Deferred) RAG embeddings, request seed reproducibility, rate limit. | post-demo |

## Dependency order

```
Phase 0 (measure) ──→ Phase 1 (generation) ──→ Phase 3 (isomorphism)
                  └→ Phase 2 (verification) ──┘
Phase 4: 4-1/4-2 alongside Phase 1; rest at the end.
```

- Phase 0+1 = the first bundle; alone yields an "AI generates problems" product.
- Phase 2 splits into Python (2-1..2-5) and agent (2-6..2-9), parallelizable.
- If schedule is tight, cut 3-2/3-3 and 4-6/4-7 first — **never cut 2-6 (3-state)**; honesty of the "verified" claim is this project's reason to exist.
- Re-run `scripts/eval-generation.ts` at each phase boundary; keep the comparison table for the final presentation (improvement story, not a template demo).
