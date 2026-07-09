# Rubric: Implementation Quality

Grades a code change (used by Reviewer + `pr-review`).

## Pass criteria (all required)
- Diff scope matches intent (`git diff --stat`; no unrelated churn).
- Correct: handles edge cases + error/empty/loading states; no obvious regressions.
- Follows architecture (Edge `context.env`/`safePrismaDisconnect`; no client Prisma; alias correct).
- No hallucinated imports/routes; all resolve (`typecheck`/`build`).
- Tests: new/changed behavior covered; none deleted/skipped/weakened.
- No new typecheck/lint errors introduced.

## Scoring (0–5)
- 5: clean, scoped, tested, verified. 3: works but thin tests/minor scope creep. 1: unverified or messy. 0: any automatic failure.

## Evidence required
- Verification-ladder output; `git diff --stat`; tests added.

## Automatic failure conditions
- Weakened auth/RLS/security; tests removed to pass; secrets in diff.
- Hallucinated file/import; new prod dependency without justification/approval.
- Production data touched; success claimed without commands.

## Examples of unacceptable claims
- "Refactored broadly and it builds" (scope creep, no tests).
- "Added `@ts-ignore` to fix the type error."

## Must be reported
- Files, commands+results, evidence, deviations, residual risks.
