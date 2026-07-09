---
name: parallel-test-fixing
description: Triage and fix a batch of failing tests efficiently — group by root cause, fix systematically, and re-run. Use when many unit/integration tests fail at once.
---

# Parallel test fixing

Fix large sets of failing tests without breaking others or gaming the suite.

## When to use

- `npm test` reports many failures across files.
- After a refactor that broke multiple suites.

## Instructions

1. Get the full failure list without stopping early:
   ```bash
   npm test 2>&1 | tee /tmp/test-run.log
   ```
   (For a fast core loop, use `npm run test:critical`.)
2. Group failures by **root cause**, not by file: shared mock/setup change, type/signature change, changed fixture, timing/async, or floating-point (common in FSRS).
3. Fix the highest-leverage root cause first (one shared fix often clears many tests). Prefer fixing source or the shared mock over editing many test files.
4. Re-run only affected files while iterating:
   ```bash
   npx vitest run path/to/file.test.ts
   ```
5. When the batch is green, run the full suite once more to catch regressions.

## Verification

- `npm test` passes (or only pre-existing/known-excluded failures remain — document those).
- No test was deleted, skipped, or weakened to pass. Assertions still test real behavior.
- `git diff --stat` matches the root causes you fixed.

## Failure recovery

- A "fix" breaks other tests → you changed shared behavior; reconsider the root cause.
- Flaky/timing tests → make them deterministic (fixed clocks/IDs), don't add retries to mask them.
- If a failure is pre-existing and unrelated to your change, leave it and report it explicitly.

## Never

- Never delete or `.skip` tests to make the build pass.
