# FSRS and Review Scheduling Audit

Date: 2026-05-02

Readiness after this pass: **82/100 (B)**. The core FSRS implementation is strong and well tested. The major scheduling defect found in the audit was fixed in this pass: post-FSRS stability modifiers now recompute review intervals before due dates are generated.

## FSRS and Review Scheduling Table

| FSRS Stage | Current Logic | Expected Logic | Files | Status | Blockers | Required Tests |
|---|---|---|---|---|---|---|
| Card initialization | New card with zero stability/difficulty | New state then learning after rating | `lib/fsrs.ts` | Good | None | Existing unit tests |
| Binary rating mapping | Again/Good from correctness in canonical path | Preserve binary implicit UI | `drillReviewService.ts` | Good | Do not add Hard/Easy UI without approval | Submit-review tests |
| FSRS.next | Core FSRS computes state/stability/interval | Official interval from stability | `lib/fsrs.ts` | Good | None | Existing FSRS tests |
| Confidence modifiers | Stability/difficulty adjusted after FSRS.next | Interval must reflect final stability | `drillReviewService.ts`, `fsrsScheduleService.ts` | Fixed | More modifier edge cases | Added interval recompute tests |
| Due date | Due date from scheduled days | Use final scheduled days and EOR clamp | same | Fixed | EOR urgency coverage limited | EOR and urgency tests |
| Review log | Persists review state and telemetry | Durable audit trail | `drillReviewService.ts` | Functional | Transaction coupling | Transaction tests |
| UserProgress card | Stores FSRS card JSON | Match ReviewLog state | `userProgressService.ts` | Partial | Failure can be swallowed | Persistence consistency tests |
| Due queue | Selects due `UserProgress` | Due sorted and production-safe | `conceptQuestionSelector.ts` | Functional | Route filter inconsistency | Selector route tests |
| Missed days | Overdue inferred from nextReviewAt | Recovery scheduling | allocator/planner services | Partial | No full simulation | Missed-day simulation |

## Implemented FSRS Fix

Files changed:

- `lib/fsrs.ts`: exposed `calculateIntervalFromStability(stability)` so service-level confidence modifiers can recalculate intervals from final stability.
- `lib/services/drillReviewService.ts`: recomputes `updatedCard.scheduled_days` for Review-state cards after confidence, circadian, fatigue, trend, urgency, and calibration modifiers.
- `lib/services/fsrsScheduleService.ts`: applies the same recomputation in the shared computation helper.
- `tests/fsrs.test.ts`: covers public interval calculation formula.
- `tests/fsrsScheduleService.test.ts`: proves the shared scheduler calls the interval helper with final modified stability.

## Remaining Risks

- `functions/api/drills/submit-review.ts` does not consistently pass exam urgency context.
- `lib/services/fsrsScheduleService.ts` still queries `userId_conditionId`, while production progress uses a `progressContext` unique key in other paths.
- Review queue selection needs shared production question eligibility across all learner-facing routes.

## Verification Run

- `npx vitest run tests/fsrs.test.ts tests/fsrsScheduleService.test.ts`: 2 files, 53 tests passed.
- `npx vitest run tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`: 3 files, 45 tests passed.
- `npx vitest run functions/api/study/session-generate.test.ts tests/questionServingSafety.test.ts tests/fsrs.test.ts tests/fsrsScheduleService.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`: 7 files, 109 tests passed.
