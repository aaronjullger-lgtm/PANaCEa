---
name: panacea-fsrs-wiring
description: "Ensure PANaCEa session and drill components submit through the canonical implicit FSRS pipeline. Use when wiring answer submission, fixing drills that do not update review state, debugging duplicate/missing ReviewLog/UserProgress writes, or adding a new study/drill mode."
---

# PANaCEa FSRS Wiring

The canonical review writer is `lib/services/drillReviewService.ts`. UI components should not invent their own FSRS persistence.

## Current Paths

- Main session UI: `components/session/QuizView.tsx`
- Extracted submit hook: `components/session/hooks/useQuizSubmit.ts`
- Drill hook: `hooks/useDrillFSRS.ts`
- Drill endpoint: `functions/api/drills/submit-review.ts`
- Legacy SRS adapter: `functions/api/srs/submit.ts`
- Attempt-only endpoint: `functions/api/questions/attempt.ts`
- Shared drill schema: `lib/api/schemas/drills.ts`
- FSRS math: `lib/fsrs.ts`
- Telemetry/MVRT: `types/telemetry.ts`, `lib/implicit-metrics.ts`

## Writer Rules

- `/api/drills/submit-review` and `/api/srs/submit` delegate to `submitDrillReview()`.
- `/api/questions/attempt` records attempt/seen/stat data only and must not become an FSRS writer.
- `main`, `drill`, `targeted`, and omitted `sessionType` are FSRS-eligible.
- `cram` and `rapid_recall` are not FSRS-eligible.
- Rapid guesses are recorded/audited but skip schedule mutation.
- Preserve idempotency keys and stable submission identity across retries.

## Component Checklist

When adding or fixing a mode:

1. Confirm where answer selection, submit guard, and question advancement live.
2. Collect timing and behavioral telemetry before advancing to the next question.
3. Submit through `useDrillFSRS`, `syncManager`, or the existing session submit hook; do not call FSRS directly from UI.
4. Pass correct `sessionType`.
5. Preserve `questionId`, `session_id`, selected answer, timing, and telemetry payloads.
6. Handle API failure by queueing/retry where the existing flow supports it.

## Verification

- `tests/fsrsSingleWriter.test.ts`
- `tests/drillReviewService.test.ts`
- `functions/api/drills/submit-review.test.ts`
- `functions/api/questions/attempt.test.ts`
- `tests/syncManager.test.ts`
- `npm run test:critical` for broader learning-pipeline changes
