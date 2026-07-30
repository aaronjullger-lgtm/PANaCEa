---
description: Run PANaCEa verification pipeline — typecheck + tests. Shows first error only on failure.
agent: verify
---

Run the full PANaCEa verification pipeline: typecheck + unit tests.

1. Run `npm run typecheck:ci 2>&1 | tail -10` and report pass/fail
2. Run `npx vitest run --reporter=dot 2>&1 | tail -10` and report test count + pass/fail
3. If either fails, show only the first error — don't dump the full log
4. Report results concisely: "typecheck: pass | tests: 254/254 pass"

$ARGUMENTS
