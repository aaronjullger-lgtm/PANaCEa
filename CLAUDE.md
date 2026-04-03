# PANaCEa — Claude Code Context

**Site:** studyPANaCEa.com | **Repo:** github.com/aaronjullger-lgtm/PANaCEa

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript + TailwindCSS + Framer Motion
- **Backend:** Cloudflare Pages Functions (Edge) — `functions/api/`
- **Database:** PostgreSQL + Prisma ORM (`prisma/schema.prisma`)
- **Auth:** Clerk (`@clerk/clerk-react` + `@clerk/backend`)
- **AI:** Google Gemini (question gen, Ghost Grader, OSCE sim)
- **Deployment:** Cloudflare Pages + Functions; CI via GitHub Actions

## Architecture Rules
- **Production API:** Cloudflare Edge Functions in `functions/api/`. `routes/` is Express for local dev ONLY — never deployed.
- **Prisma Edge client:** `functions/api/_shared/prisma-edge.ts` (singleton). Always call `safePrismaDisconnect(prisma)` in `finally` blocks.
- **Auth:** `authenticatedEndpoint` middleware in `functions/api/_shared/auth.ts`. No raw `process.env` in Edge — use `context.env.*`.

## FSRS Pipeline (core differentiator)
- `lib/fsrs.ts` — FSRS v6, 21 params, binary rating: Again/Good only (Hard/Easy deprecated).
- `lib/implicit-metrics.ts` — Derives rating from behavior: `timeToFirstClick`, `answerSwitches`, `totalDwellTime`, `isCorrect`, `parTimeMs`, `hintViewed`. No self-rated buttons.
- `lib/services/drillReviewService.ts` — Main submission pipeline: correctness → implicit rating → par time → circadian → FSRS update → QuestionAttempt → UserProgress → confusion pairs.
- `functions/api/drills/submit-review.ts` — API endpoint. Only `review_type: 'real'` MAIN and DRILL sessions update FSRS; Cram/rapid_recall excluded.
- **Rapid-guess filter:** MVRT thresholds by type (VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms). Below threshold skips FSRS update.
- **Confidence pipeline (8-step):** Bayesian accumulation → calibration dampener → fatigue → interference → fluency illusion dampener → graduated stability multiplier → desirable difficulty bonus → cross-session trend. Key files: `lib/confidence/bayesianAccumulator.ts`, `lib/services/calibrationService.ts`, `lib/confidence/desirableDifficultyBonus.ts`, `lib/confidence/interferenceDetector.ts`, `lib/confidence/trendDetector.ts`.
- **254 tests passing** across confidence pipeline + FSRS subsystems.

## Session & Drill Submission Flow
1. Client collects telemetry → POST `/api/drills/submit-review` (questionId, selectedAnswer, telemetry)
2. Server: correctness → implicit rating → par time → circadian → FSRS → writes QuestionAttempt + ReviewLog + UserProgress
3. Returns: isCorrect, rating, stability, difficulty, nextReview, retrievability
- All 11 drill hooks use `useDrillFSRS` → `/api/drills/submit-review` with `sessionType: 'drill'`
- `QuizView.tsx` (main session) uses `syncManager.queueAnswer()` → `/api/questions/attempt`

## Proactive Question Reservoir
Background queue (per-student) ensuring no wait during sessions. States: queued → reserved → consumed → expired → failed.
- Policy: LOW_WATER=15, HIGH_WATER=40, BATCH=25, TTL=48h. Priority: OVERDUE_REVIEW(100) > DUE_REVIEW(80) > NEW_BLUEPRINT_GAP(60) > NEW_STANDARD(40) > BACKFILL(20).
- `reserveFromReservoir()` uses `FOR UPDATE SKIP LOCKED`. Cron maintenance every 2h via `functions/api/cron/reservoir-maintenance.ts`.

## Key Files
- `lib/fsrs.ts` — FSRS v6; `lib/implicit-metrics.ts` — behavioral confidence; `lib/services/drillReviewService.ts` — submission pipeline (803 lines)
- `components/session/QuizView.tsx` — main session UI (2274 lines); `components/drill/DrillShell.tsx` — drill wrapper (13 active drills)
- `lib/nccpa-question-weighting.ts` — question order/taskCategory; `lib/constants/pa-curriculum.ts` — 12 courses, 10 rotations

## Build Commands
```bash
npm run dev          # Vite frontend; npm run dev:all → + Express backend
npm run dev:wrangler # Cloudflare Pages (production-like)
npm run typecheck    # tsc --noEmit (NODE_OPTIONS="--max-old-space-size=4096")
npm test / npm run test:e2e / npm run db:studio
```

## Current Priorities (2026-04-02)
1. Generate questions for under-represented PANCE blueprint areas (CV, PULM)
2. Run Prisma migration for `questionOrder`, `taskCategory`, `accountStatus`, `deletionScheduledAt`
3. Wire `RotationFocusCard` to real user profile (currentRotation, eorDate)
4. Wire `useStudyWellness` to real session history
5. Fix Knowledge Base content loading

## Verified Fixes (2026-03-31)
- **syncManager auth bug (FIXED):** Token provider pattern added; `useSyncManager(getToken)` in `OfflineSyncIndicator.tsx`.
- **drillReviewService FSRS gating (FIXED):** `sessionType='drill'` now included in FSRS updates.
- **ReviewLog session type (FIXED):** Drills now correctly map to `DRILL` enum (not `CRAM`).
