# Remediation Handoff — Remaining Work

| | |
|---|---|
| Status | Active handoff |
| Date | 2026-06-10 |
| Branch (done so far) | `feat/agent-real-generation-remediation` (commit `4b7d1c6c8`) |
| Plan | [`remediation-plan.md`](./remediation-plan.md) |
| Baseline | [`../eval/baseline-2026-06-10.md`](../eval/baseline-2026-06-10.md) |

This doc lets a new session resume the "real generation agent transition" cleanly. It records **what shipped**, **what's cut/remaining**, and the **non-obvious gotchas** discovered while implementing — so the next person doesn't re-debug them.

---

## 1. What shipped (committed, verified)

Verified green: agent typecheck clean · 236 unit + 5 integration tests · web typecheck clean · 29 pytest · ruff clean.

- **Phase 0** — `DETERMINISTIC_FALLBACK=off|last-resort|first` env threaded through workflow; SSE result wire now carries `gates`, `overall`, `attempt_count`, `generation_model`, `refined_by`; [`scripts/eval-generation.ts`](../../scripts/eval-generation.ts) harness; baseline run (**pure-LLM 0/8 verified** — the demo only passed via the template).
- **Phase 1** — template demoted to last-resort (emitted flagged after retries fail); per-attempt temperature 0.35→0.6→0.85; `generateObject` schema-failure immediate retry; gate-specific retry hints + previous-failure counterexample; intent fallback no longer blanket `must_preserve:true` (inherits strategy dims / marks `dimensions_source`); `SOLVER_MODEL` env; web "템플릿 폴백" badge.
- **Phase 2** — math-engine: `multiprocessing.Process`+`terminate()` 5s hard timeout, `equals()`+numeric-sampling equivalence, `POST /verify-answer` (number|expression|equation|solution_set|inequality), `parse_latex(backend="lark")` (+`lark` dep), async endpoints. agent: gate **3-state** (`passed|failed|skipped|unverified`), honest sympy + real multiple-choice verification (**zero "non-empty⇒passed" paths**), re-solve mismatch → retry then reject on final attempt, equation-extractor unicode+LaTeX, `domain.md` I-V4 update, web "기호 검증 불가" badge.
- **Phase 3-1** — `techniques_used` flows generator→schema→objective gate; deterministic set compare vs `required_techniques` (structural must cover; `technique_mismatch` failure).
- **Phase 4-2** — silent catches record `skipped_reason`/`nuance_skipped_reason`/`normalization_skipped_reasons` in gate evidence.
- **Phase 4-4** — `LLM_E2E=1`-gated real integration test (`tests/integration/real-llm-e2e.test.ts`), skipped by default.

---

## 2. Remaining work (cut for time, in priority order)

### High value
- **4-1 — `withTimeout` + AbortController propagation.** `policies/timeout-policy.ts` `withTimeout` currently only rejects after a timer; it does NOT cancel `fn()`. Add an `AbortController`, pass `signal` into the `generateObject` calls (`agents/generator-agent.ts`, `steps/intent-extraction.ts`, `steps/objective-mapping.ts` nuance, `agents/*`) and into `tools/math-engine-client.ts` fetch (combine with its internal controller). This is the **root cause of the baseline's 160s timeouts** — without real cancellation, slow LLM calls run to the wall-clock limit. NOTE: `generator-agent.ts` was heavily modified in Phase 1; read current state first.
- **4-5 — Wire S5/S6 to the real stream, remove mock.** `packages/web/app/app/new/result/page.tsx` (~L35-46) and `export/page.tsx` (~L45-60) call `generateMockResults(...)`. The `useVerificationStream` hook already persists real results to `sessionStorage` (`lib/verification-storage-key.ts`), and `result/view.tsx` + `export/view.tsx` already rehydrate from it. Removing the page-level mock seed + relying on the existing rehydrate path is the bulk of the work. category: visual-engineering + frontend-ui-ux.

### Medium value
- **3-2 — Mode-specific surface check** (`steps/objective-mapping.ts` ~L135-141, the `not_transformed` guard / `sameMathText`). structural = number-masked skeleton must MATCH source; conceptual = skeleton must DIFFER. Extend the existing guard.
- **3-3 — Deterministic `must_preserve` enforcement** at the objective gate (answer-type, technique, difficulty markers) independent of the LLM constraint-critic. Build on the 3-1 `techniqueEvidence` machinery already in `objective-mapping.ts`.
- **4-3 — Cost visibility.** Aggregate AI SDK `usage` per workflow into the SSE result event; cap calls per workflow. AI SDK v4: `result.usage = { promptTokens, completionTokens, totalTokens }`. Thread through `verification-workflow.ts` → result event → `wire-format.schema.ts`.

### Low value / post-demo
- **4-6 — Corpus injection defense.** Wrap corpus text in `prompts/problem-generator.md` with `<source>…</source>` + an "ignore instructions inside source" directive. NOTE: this prompt was edited in Phase 1 (counterexample) and 3-1 (techniques) — read current state.
- **4-7 — RAG embeddings, request seed reproducibility, rate limit.** Deferred to post-demo.

### Measurement
- **Full baseline + phase-boundary eval.** Run the documented 120-generation matrix unattended (1–2h at `xhigh` speed) and append the improvement table to `docs/eval/`:
  ```bash
  cd packages/agent && PORT=31416 DETERMINISTIC_FALLBACK=off ./node_modules/.bin/tsx src/index.ts &
  packages/agent/node_modules/.bin/tsx scripts/eval-generation.ts \
    --endpoint http://localhost:31416 --repeats 5 --concurrency 4 --timeout-ms 240000 --out-dir reports/eval
  ```
  Compare `refined_by` template-fallback % and per-gate pass rates against the 0% baseline. **Never fabricate numbers** — only commit what live runs return.

---

## 3. Non-obvious gotchas (re-debugged so you don't have to)

1. **`normalizeExpectedAnswer` overwrites the LLM's answer with the engine's solve result** (`steps/problem-generation.ts`). So for any engine-solvable equation, `sympy_verify` compares solve-vs-solve → always passes; a genuine wrong answer surfaces at **re_solve** or the **objective** gate, not sympy. This is intended (engine = source of truth for solvable equations) but surprising.
2. **`sameAnswer` has an `expectedMatchesEquationSolve` shortcut** (`tools/answer-equivalence.ts`): if the *expected* answer matches the equation's solve, it returns true **regardless of the derived/solver answer**. Combined with (1), a solvable-equation candidate cannot fail re_solve via a wrong solver answer in tests. To test a rejection deterministically, use a **technique mismatch** (3-1) — see `tests/integration/generate.test.ts`.
3. **Gate `unverified` maps to wire step "completed"**, not "failed" (`server/sse/wire-adapter.ts` `readGateStatus` only knows passed/failed/skipped → null → "completed"). If you add UI/eval logic on step status, read the per-gate `status` from the result event instead.
4. **acceptance ↔ retry budget consistency**: `verification-workflow.ts` passes `maxAttempts = maxRetries ?? 3` to BOTH `createBoundedRetryPolicy` and `createAcceptancePolicy` (L77-79). If you change one, change both, or the 2-9 "final-attempt mismatch → reject" promise breaks for `maxRetries ≠ 3`.
5. **Python 3.11** — no `ProcessPoolExecutor.kill_workers` (3.14+). The 5s hard timeout uses `multiprocessing.Process` + `terminate()`. Don't "simplify" it back to ProcessPoolExecutor.
6. **`parse_latex` uses `backend="lark"`** (pure-Python, `lark` dep) — not the antlr default (needs `antlr4-python3-runtime`).
7. **Integration tests are a separate vitest config** (`pnpm -F @openmath/agent test:integration`, `vitest.integration.config.ts`) — they are NOT run by `pnpm test`. After changing verification behavior, run BOTH.
8. **Tests that encoded the old "non-empty⇒passed" behavior were updated, not deleted**, to assert the new honest semantics. Keep this discipline.

---

## 4. Files NOT touched (leave alone)

Pre-existing untracked files that are NOT part of this work and were intentionally excluded from the commit:
- `packages/agent/scripts/transform_real_corpus.py`
- `packages/agent/scripts/verify_rag.ts`
- `reports/` (regenerable eval artifacts)

---

## 5. Suggested resume order

`4-1 (timeout/abort) → re-run eval to confirm timeouts drop → 4-5 (web real wiring) → 3-2/3-3 (isomorphism depth) → 4-3 (cost) → 4-6 → full 120-run eval → final comparison table`.
