# Testing Primer

How to prove a change works here. Authoritative: `.cursor/rules/testing-and-verification.mdc`; skills: `failure-triage`, `parallel-test-fixing`.

## The verification ladder (run what applies)
1. `npm run typecheck` (or `npm run typecheck:ci`)
2. `npm run lint` (repo gate `--max-warnings 2000`; don't add new errors)
3. `npm test` (full, ~140s) or `npm run test:critical` (fast FSRS/core, 143 tests) while iterating
4. `npm run build`
5. UI/flows: `npm run dev` + browser screenshots; `npm run test:e2e` (needs `npx playwright install`); a11y: `npm run test:e2e:a11y`

## Writing tests
- Vitest (`jsdom`), tests in `tests/` + colocated `*.test.ts(x)`. Deterministic fixtures (fixed IDs, no insertion-order assumptions, float-tolerant FSRS math).

## Baseline (pre-existing failures — don't blame yourself)
- `npm run typecheck`: 2 errors in `lib/study/renderStructuredRationale.ts`. `npm run lint`: 3 `no-empty` errors. A change is clean if it doesn't increase these. See `.cursor/memory/validation-history.md`.

## Never
- Delete/skip tests, weaken assertions, `@ts-ignore`, or blind-retry to reach green. Paste real command output — don't summarize a run you didn't do.
