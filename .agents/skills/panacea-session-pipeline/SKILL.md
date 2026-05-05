---
name: "panacea-session-pipeline"
description: "Use this skill when working on PANaCEa study sessions, QuizView, drill modes, answer submission, syncManager queueing, telemetry collection, session recovery, review queues, daily triads, custom sessions, session scoring, and the path from a student answer to persisted analytics and FSRS updates."
---

# PANaCEa Session Pipeline

Use for user-facing study flow bugs and features that start with a student seeing or answering a question.

## First Files

- `components/session/QuizView.tsx`
- `components/session/SessionScopeSelector.tsx`
- `components/drill/DrillShell.tsx`
- `hooks/useDrillFSRS.ts`
- `hooks/useTelemetryCollector.ts`
- `hooks/useImplicitMetrics.ts` or `lib/implicit-metrics.ts`
- `lib/services/drillReviewService.ts`
- `lib/services/sync/syncManager.ts` and `lib/services/sync/offlineSync.ts` when offline queueing is involved
- `functions/api/questions/attempt.ts` and `functions/api/drills/submit-review.ts` for persistence

Also load `panacea-fsrs-guardrails` when the task can change scheduling, rating, retrievability, stability, par time, or review eligibility.

## Mental Model

Question rendered -> telemetry starts -> answer selected -> submit guard/idempotency -> score locally -> queue or POST answer -> server validates correctness -> review attempt persisted -> analytics/FSRS/readiness updated -> UI advances or recovers.

## Implementation Rules

- Preserve double-submit guards and keyboard/mouse submit behavior.
- Do not let UI score diverge from server-authoritative correctness when the endpoint can provide it.
- Preserve crash/tab-close recovery for active sessions.
- Keep `sessionId`, `questionId`, `conditionId`, `system`, timing, and telemetry payloads intact across client/server boundaries.
- Cram, rapid recall, practice previews, and fake/demo flows must not silently write real FSRS updates.
- Accessibility announcements and focus management matter in `QuizView` changes.

## Drill Mode Rules

- Reuse `DrillShell` and `useDrillFSRS` instead of adding per-drill persistence paths.
- Binary student-facing outcomes remain Again/Good through the existing implicit pipeline.
- Drill-specific UI can collect richer telemetry, but persistence should still route through the canonical review service.

## Tests To Look For

- `tests/fsrs*.test.ts`
- `tests/store/useStudyStore.test.ts`
- `lib/services/drillReviewService*`
- `functions/api/_shared/__tests__/submission-idempotency.test.ts`
- Component tests near `components/drill` or `components/session`
- Playwright specs under `e2e/all-modes` for real flow regressions

## Common Traps

- Advancing the question before durable submit/queue state is recorded
- Losing telemetry when a question changes or a session restores
- Updating only main sessions and breaking drill submission, or the reverse
- Adding a new session mode without mapping its review eligibility
- Fixing the Express route and missing the production Edge endpoint
