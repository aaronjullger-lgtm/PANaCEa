---
description: Pre-PR quality gate — typecheck, lint, test, build. Run before merging or creating a PR.
agent: verify
---

Run the full pre-merge quality gate for the current branch. Report PASS/FAIL for each check.

## Checks (run in order, stop on first failure)

### 1. Git Status
- Show `git diff --stat` against the base branch
- List all changed files
- Flag any files that shouldn't be committed (.env, secrets, lock files from other tools)

### 2. Lint
- Run `npm run lint`
- Must be 0 errors (warnings are acceptable)
- If errors: fix them, re-run, then proceed

### 3. Typecheck (CI-scoped)
- Run `npm run typecheck:ci`
- Must pass with 0 errors
- If OOM: run with `NODE_OPTIONS="--max-old-space-size=4096"`
- If errors: fix them before proceeding

### 4. Critical Tests
- Run `npm run test:critical` (FSRS + learning-stack gate)
- Must be 100% pass

### 5. Focused Tests
- For each changed file, find and run its corresponding test file
- Example: changed `lib/services/drillReviewService.ts` → run `tests/drillReviewService.test.ts`
- All must pass

### 6. Build
- Run `npm run build`
- Must succeed
- Check `npm run build:check-size` for bundle regressions

## Report Format
```
PREFLIGHT RESULTS
=================
Lint:        PASS/FAIL
Typecheck:   PASS/FAIL
Critical:    PASS/FAIL (N/N)
Focused:     PASS/FAIL (N/N)
Build:       PASS/FAIL
Bundle Size: OK/WARNING (X KB)

VERDICT: READY TO MERGE / FIX REQUIRED
```

If any check fails, show the specific error and suggested fix. Do NOT proceed to PR creation until all pass or Aaron explicitly approves.
