---
name: failure-triage
description: Triage a failing check (build, typecheck, lint, runtime, or CI) to root cause before fixing. Use when something fails and the cause isn't obvious.
---

# Failure triage

Find the real root cause before changing code. For many failing unit tests specifically, use `parallel-test-fixing`.

## When to use

- A build/typecheck/lint/runtime/CI failure needs diagnosis.

## Instructions

1. Reproduce with the exact command and capture full output:
   - Build: `npm run build` · Types: `npm run typecheck` · Lint: `npm run lint` · Tests: `npm test` (or `npx vitest run <file>`).
2. Establish whether it's **pre-existing** (fails on a clean `main`/before your change) or **introduced**. Known pre-existing on `main`: 3 `no-empty` lint errors; 2 typecheck errors in `lib/study/renderStructuredRationale.ts`. Don't attribute those to your change.
3. Read the FIRST error, not the last — later errors are often cascades.
4. Form one hypothesis, make the smallest fix, re-run the same command. For non-trivial runtime bugs you can reproduce, use the debug workflow (instrument → reproduce → analyze).
5. Fix the source/shared cause, not the symptom; don't silence errors.

## Stop conditions

- Stop when the target command passes, or when the failure is confirmed pre-existing/unrelated (then document it).

## Verification

- The failing command now passes; re-run the broader ladder to catch regressions.

## Do not claim success unless

- You re-ran the exact failing command and it passed (paste output).

## Recovery

- Fix breaks other areas → wrong root cause; revert and re-diagnose.
- Never delete/skip tests, weaken assertions, `@ts-ignore`, or bypass lint to force green.
- Flaky/timing failure → make it deterministic, don't add blind retries.
