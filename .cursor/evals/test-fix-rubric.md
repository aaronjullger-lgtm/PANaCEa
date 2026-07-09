# Rubric: Test Fix

Grades a test/failure fix (used by Test/Debug agent + `failure-triage`).

## Pass criteria (all required)
- Root cause identified (not symptom); fix targets source/shared cause.
- The exact failing command re-run and now passes (output shown).
- Broader ladder re-run to catch regressions.
- Regression test added/repaired where meaningful.
- Pre-existing/unrelated failures identified and left documented.
- ≤2 automatic repair attempts; escalated if unresolved.

## Scoring (0–5)
- 5: root-caused, verified, regression-covered. 3: fixed but thin coverage. 1: symptom patch. 0: any automatic failure.

## Evidence required
- Before/after command output; new/updated test; attempt log if looped.

## Automatic failure conditions
- Tests deleted/skipped/weakened; assertions loosened; `@ts-ignore`/lint-disable added to hide errors.
- Blind retries of installs/tests without diagnosis; >2 attempts.
- Success claimed without re-running the failing command.

## Examples of unacceptable claims
- "Skipped the flaky test so CI is green."
- "It passes now" (no re-run output).

## Must be reported
- Root cause, fix, before/after, regression test, remaining/pre-existing failures.
