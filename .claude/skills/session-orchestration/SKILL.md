---
name: session-orchestration
description: Debug, extend, or review the study session and drill orchestration layer in PANaCEa — including QuizView, DrillShell, reservoir queue, sync manager, session state machines, and the submit-review pipeline. Use this skill whenever working on how sessions start/end, how questions flow from reservoir to screen, how answers get submitted, how drills wire into FSRS, or any session-level bug like 'questions aren't loading', 'answers aren't saving', 'the session freezes', or 'drills aren't updating review schedule'.
---

## Purpose
The session layer is where students spend 90% of their time. It orchestrates the seamless flow of questions from the proactive reservoir, through presentation and answer collection, to FSRS updates and next-question scheduling. Any degradation in this pipeline directly impacts student experience and confidence calibration.

## Core Architecture: Reservoir → Reserve → Present → Telemetry → Submit → FSRS → Next

```
1. RESERVOIR: Proactive buffering of questions per student
   ↓
2. RESERVE: Lock-free reservation (FOR UPDATE SKIP LOCKED) → activeReservation
   ↓
3. PRESENT: QuizView/DrillShell displays question + UI affordances
   ↓
4. TELEMETRY: Client collects timeToFirstClick, answerSwitches, dwellTime, hints
   ↓
5. SUBMIT: POST /api/drills/submit-review or /api/questions/attempt
   ↓
6. FSRS: Implicit rating → par time → circadian → FSRS v6 update
   ↓
7. NEXT: Fetch next question → loop or complete session
```

## Key Files & Paths

| Purpose | Path | Lines | Role |
|---------|------|-------|------|
| **Main session UI** | `components/session/QuizView.tsx` | 2274 | Session state, question fetch loop, answer collection |
| **Drill wrapper** | `components/drill/DrillShell.tsx` | — | Renders 13 drill types; integrates useDrillFSRS |
| **Question reservoir** | `lib/services/reservoir/` | 5 files | Low-water refill, concurrent reservation, expiry |
| **Submission pipeline** | `lib/services/drillReviewService.ts` | 803 | Correctness → implicit rating → par time → FSRS |
| **API endpoint** | `functions/api/drills/submit-review.ts` | — | Edge function; session-type gating for FSRS |
| **Sync manager** | `lib/services/sync/syncManager.ts` | — | Offline queue + token auth + retry logic |
| **Drill hooks** | `hooks/useDrillFSRS.ts` + 90 others | — | Per-drill submission wiring; telemetry collection |
| **Constants** | `lib/constants/pa-curriculum.ts` | — | 12 courses, 10 rotations, session metadata |

## Session Lifecycle State Machine

```
INIT → LOADING → ACTIVE → SUBMITTING → TRANSITIONING → COMPLETE/ERROR

INIT        Question reservoir empty or session config missing
LOADING     Fetching first question from reservoir or API
ACTIVE      Question displayed; student answering; telemetry collected
SUBMITTING  Answer posted; awaiting server response (correctness, next Q, FSRS)
TRANSITING  Loading next question; can appear as brief shimmer
COMPLETE    Session ended (time limit, student exit, no more questions)
ERROR       Sync failure, auth token expired, network timeout
```

## Drill Wiring Checklist

To add a new drill type to DrillShell:

1. **Create hook** (e.g., `hooks/useMyDrill.ts`):
   - Call `useDrillFSRS({ drillType: 'MY_DRILL', onSubmit: handleSubmit })`
   - Collect telemetry: `timeToFirstClick`, `answerSwitches`, `totalDwellTime`, `isCorrect`
   - POST to `/api/drills/submit-review` with `sessionType: 'drill'`

2. **Register in DrillShell** (`components/drill/DrillShell.tsx`):
   - Import hook and drill component
   - Add case to `renderDrill()` switch
   - Pass `onComplete`, `onSkip`, telemetry callbacks

3. **Verify in useDrillFSRS** (`hooks/useDrillFSRS.ts`):
   - Confirm `reviewPayload.sessionType === 'drill'` (not 'cram' or 'rapid_recall')
   - Check rapid-guess filter applies (e.g., VIGNETTE threshold = 3000ms)
   - Ensure QuestionAttempt + ReviewLog write succeeds

4. **Test**: Run `npm test` + spot-check FSRS updates in dashboard

## Reservoir Integration

**Purpose:** Proactive buffering ensures no wait when student clicks "next".

| Config | Value | Role |
|--------|-------|------|
| `LOW_WATER` | 15 | Trigger refill when < 15 active |
| `HIGH_WATER` | 40 | Stop refill at 40 active |
| `BATCH_SIZE` | 25 | Queue 25 at a time |
| `TTL` | 48h | Expire unreserved after 48h |

**Priority order:**
1. OVERDUE_REVIEW (100) — stale SRS items
2. DUE_REVIEW (80) — on-schedule SRS items
3. NEW_BLUEPRINT_GAP (60) — weak blueprint areas
4. NEW_STANDARD (40) — standard curriculum progression
5. BACKFILL (20) — fill remaining reservoir

**Concurrent safety:** Use `FOR UPDATE SKIP LOCKED` in `reserveFromReservoir()`. Cron maintenance every 2h via `functions/api/cron/reservoir-maintenance.ts`.

## Sync Manager Patterns

**Offline queue:** `lib/services/sync/syncManager.ts` queues answers when offline; retries on reconnect.

**Token auth:** Always pass `getToken()` callback:
```typescript
const { getToken } = useAuth();
useSyncManager(getToken);  // Not useSyncManager() alone
```

**Retry logic:** Exponential backoff; max 3 attempts before user notification.

## Common Failure Modes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| "Questions aren't loading" | Reservoir exhausted or low-water refill stuck | Check `reservoir-maintenance` cron; verify `reserveFromReservoir()` permissions |
| "Answers aren't saving" | Sync token stale; offline queue not flushing | Call `useSyncManager(getToken)` in parent; check `/api/drills/submit-review` auth |
| "Session freezes on submit" | `SUBMITTING` state timeout; no error boundary | Add 10s timeout → ERROR state transition |
| "Drills don't update FSRS" | `sessionType: 'cram'` or `'rapid_recall'` instead of `'drill'` | Verify `useDrillFSRS` passes `sessionType: 'drill'` |
| "Rapid-guess false positives" | MVRT threshold too low (e.g., VIGNETTE < 3000ms) | Check `lib/implicit-metrics.ts` threshold vs question type |
| "Stale reservoir questions" | Reservation timeout not enforced; expired items not cleaned | Run manual `reservoir-maintenance` cron; review TTL logic |

## Composes With

- **fsrs-pipeline** — FSRS v6 update, 21 params, binary rating logic
- **panacea-fsrs-wiring** — Implicit rating derivation, par time, circadian dampening
- **cf-edge-api** — Cloudflare Pages Functions auth, Prisma edge client, env vars
