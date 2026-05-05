---
name: session-orchestration
description: "Debug, extend, or review PANaCEa study sessions, drill flows, reservoir/question delivery, answer submission, telemetry, offline queueing, session recovery, and progress persistence."
---

# Session Orchestration

Use for bugs like questions not loading, answers not saving, sessions freezing, drill review state not updating, queue/reservoir issues, or new study mode flow.

## Flow

Question source -> UI presentation -> telemetry starts -> answer selected -> submit guard/idempotency -> local score/feedback -> queue or POST -> server validates -> attempt/review/progress writes -> next question or summary.

## First Files

- `components/session/QuizView.tsx`
- `components/session/hooks/useQuizSubmit.ts`
- `components/session/SessionScopeSelector.tsx`
- `components/drill/DrillShell.tsx`
- `hooks/useDrillFSRS.ts`
- `hooks/useTelemetryCollector.ts`
- `lib/services/sync/syncManager.ts`
- `lib/services/sync/offlineSync.ts`
- `functions/api/drills/submit-review.ts`
- `functions/api/questions/attempt.ts`
- `lib/services/drillReviewService.ts`
- `lib/services/reservoir/*`

## Rules

- Preserve double-submit guards and keyboard/mouse submit behavior.
- Do not advance critical state before durable queue/server acceptance.
- Preserve crash/reload recovery for active sessions.
- Keep `session_id`, `questionId`, `conditionId`, system, selected answer, timing, and telemetry intact.
- Do not let cram or rapid recall silently update FSRS.
- Use canonical review/attempt endpoints; do not add a third writer.

## Common Failures

- Duplicate attempt/review rows from unstable idempotency keys.
- UI score diverges from server correctness.
- Telemetry resets before submit.
- Offline queue records local stats twice.
- Reservoir reservations are not consumed or expire incorrectly.
- Fix applied to Express `routes/` but production `functions/api/` still fails.

## Verification

- Targeted unit/endpoint tests for the changed flow.
- `tests/syncManager.test.ts` and idempotency tests for retry paths.
- `npm run test:critical` for FSRS/session changes.
- Playwright for real session navigation, reload recovery, auth, or offline/PWA behavior.
