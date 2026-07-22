# AI Learning Engine Final Report

Date: 2026-05-02

## Current Result

The audit found a mature but fragmented intelligence layer. FSRS core scheduling is now stronger after this pass, the highest-severity provider credential issue was fixed, and the active study-session dynamic generation P0 was blocked. The app is still not launch-safe until AI output contracts are centralized and all learner-facing question selectors share the same production eligibility filter.

## Changes Completed

| Area | Files | Result |
|---|---|---|
| OSCE Live credential safety | `functions/api/osce/live-engine.ts` | Server Gemini key fallback removed; route fails closed with `503` if token minting fails |
| Study-session dynamic generation safety | `functions/api/study/session/generate.ts`, `functions/api/study/session-generate.test.ts` | Thin pools no longer trigger learner-facing AI generation or approved generated inserts |
| FSRS interval recalculation | `lib/fsrs.ts`, `drillReviewService.ts`, `fsrsScheduleService.ts` | Final modified stability now drives Review-state scheduled days and due dates |
| FSRS tests | `tests/fsrs.test.ts`, `tests/fsrsScheduleService.test.ts` | Added direct coverage for interval helper and recomputation path |
| Audit artifacts | Required audit/report files | Created required readiness tables, blockers, plan, and log |

## Remaining P1 List

| Severity | Finding | Evidence | Next Action |
|---|---|---|---|
| P1 | Direct AI calls bypass gateway policy | `questions/explain-rag.ts`, `clinical-eye/analyze.ts`, `conditions/[identifier]/structured.ts` | Migrate to gateway structured/text calls |
| P1 | Prompt/schema fragmentation | Multiple generation services | Canonical prompt and schema registry |
| P1 | Production question filters inconsistent | Multiple learner-facing review/session routes | Shared eligibility predicate |
| P1 | Attempt/progress writes not fully transactional | attempt/review/progress services | Canonical submit transaction |
| P1 | Recommendations not fully traceable | recommendation services | Single ranker with reason trace |

## Verification

- `npx vitest run tests/fsrs.test.ts tests/fsrsScheduleService.test.ts`: passed, 53 tests.
- `npx vitest run tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`: passed, 45 tests.
- `npx vitest run functions/api/study/session-generate.test.ts tests/questionServingSafety.test.ts`: passed, 11 tests.
- Combined targeted suite across the 7 files above: passed, 109 tests.

## Next Implementation Slice

Create a shared production question eligibility predicate and apply it to the remaining learner-facing review/session routes so all selectors enforce the same approved-content rules.
