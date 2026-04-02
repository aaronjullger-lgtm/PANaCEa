# PANaCEa — Claude Code Context

## What This Is
PANaCEa is a clinical education platform for PA students (PANCE/PANRE prep) built by a PA-S2 student. It combines evidence-based spaced repetition (FSRS v6), behavior-derived implicit ratings, multi-modal drill types, and AI-powered content generation into a single study platform.

**Live site:** studyPANaCEa.com
**Repo:** github.com/aaronjullger-lgtm/PANaCEa

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript + TailwindCSS + Framer Motion
- **Backend:** Cloudflare Pages Functions (Edge) — `functions/api/`
- **Database:** PostgreSQL + Prisma ORM (4131-line schema at `prisma/schema.prisma`)
- **Auth:** Clerk (`@clerk/clerk-react` + `@clerk/backend`)
- **AI:** Google Gemini API (question generation, Ghost Grader behavior analysis, OSCE patient sim)
- **Deployment:** Cloudflare Pages + Functions, CI via GitHub Actions

## Architecture Rules
- **Production API is Cloudflare Edge Functions** in `functions/api/`. The `routes/` directory is Express for local dev ONLY — never deployed.
- **Prisma Edge client** via `functions/api/_shared/prisma-edge.ts` (singleton). Always call `safePrismaDisconnect(prisma)` in `finally` blocks.
- **Auth:** `authenticatedEndpoint` middleware in `functions/api/_shared/auth.ts` verifies Clerk tokens and passes `auth.userId`.
- **No raw `process.env`** in Edge functions — use `context.env.*`.

## Critical Subsystems

### FSRS Pipeline (the heart of the app)
The spaced repetition system is the core differentiator. Key files:
- `lib/fsrs.ts` — FSRS v6 algorithm (21 params, binary rating: Again/Good)
- `lib/implicit-metrics.ts` — Derives FSRS rating from behavior (time-to-first-click, answer switches, dwell time, correctness, par time). NO self-rated buttons.
- `lib/services/drillReviewService.ts` (803 lines) — Main submission pipeline: correctness resolution → implicit rating → par time → circadian context → FSRS update → QuestionAttempt → UserProgress → confusion pairs → sibling propagation
- `lib/circadian.ts` — Circadian-aware scheduling adjustments
- `lib/srs/ghostGrader.ts` — Gemini-powered confidence/rating inference from behavior
- `lib/fsrs/eorScheduler.ts` — End-of-rotation scheduling clamp
- `functions/api/drills/submit-review.ts` — API endpoint that calls drillReviewService

### Implicit Rating Inputs
The `deriveContinuousRating` function in `lib/implicit-metrics.ts` uses: `timeToFirstClick`, `answerSwitches`, `totalDwellTime`, `isCorrect`, `parTimeMs`, `hintViewed`, `hintViewDurationMs`, and optionally CRPL micro-kinetics (`commitmentGapMs`, `cursorEntropy`, `hoverOscillationCount`). These are stored in `ReviewLog.telemetry` as: `par_time_ms`, `latency_ratio`, `implicit_confidence`, `answer_changes`, `circadian_phase`, `telemetry_quality`.

### Telemetry Rules (2026-04-02 Audit)
- **Hint-viewed penalty**: Viewing a hint before answering applies a 0.4 grade penalty + time-proportional penalty (capped at 0.3). This correctly models aided recall as weaker than free recall.
- **MVRT-aware rapid guess**: Server uses question-type-specific MVRT thresholds (VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms, DEFAULT=2000ms) with a server floor of 2000ms. Rapid guesses skip FSRS state updates.
- **Telemetry quality tags**: Each ReviewLog entry's `server_computed.telemetry_quality` is tagged as `'full'`, `'partial'`, or `'minimal'`. The optimizer can filter by quality.
- **assessTelemetryQuality()** in `lib/implicit-metrics.ts` classifies quality: full=first-click+switches+CRPL, partial=first-click or switches, minimal=only duration.

### Confidence Scoring Model (2026-04-02 Upgrade)
Research-backed multi-signal confidence model replacing the old additive-penalty approach. Key components:
- **Multi-signal weighted model** (SDT-inspired): `confidence = Σ(wi × si) × hintFactor`, where signals are RT (0.35), answer switches (0.25), trajectory/proxy (0.20), and hesitation composite (0.20). Bounded to [0.3, 0.95]. For incorrect answers, confidence is fixed at 0.9 (high confidence the student got it wrong → aggressive rescheduling).
- **Graduated stability multiplier** (sigmoid): `stabilityMult = 0.7 + 0.6 × σ((confidence - 0.6) × 5)`. Replaces old binary threshold (≤0.5 → 0.75×). Now both rewards high confidence (up to ~1.28×) and penalizes low (down to ~0.72×). Centered at 0.6 = neutral (1.0×).
- **Fluency illusion dampener** (Kornell & Bjork, 2008): `dampener = 0.7 + 0.3 × clamp(elapsedDays, 0, 1)`. Same-day reviews get 30% confidence reduction; ≥1 day → no adjustment. Prevents massed-repetition fluency from inflating stability.
- **Integration in drillReviewService.ts**: Full 4-step confidence pipeline: Bayesian accumulation → calibration dampener → fluency illusion dampener → graduated stability multiplier.
- **Exports**: `confidenceStabilityMultiplier()`, `fluencyIllusionDampener()`, `UserBaseline`, `QUESTION_TYPE_WEIGHTS`, `QuestionTypeKey` from `lib/implicit-metrics.ts`.
- **Test coverage**: 134+ tests across 6 test files, all passing.
- **Research plan**: `plans/confidence-scoring-upgrade-plan.md` and `plans/confidence-pipeline-v2-sprints.md`.

### Confidence Pipeline v2 (2026-04-02 Upgrade)
Six-sprint enhancement to the confidence scoring pipeline:
- **Sprint 1 — Per-student baseline normalization**: Z-scores RT, switch, and hesitation signals against each student's own behavioral history (rolling 200-attempt baseline from `userTimingProfileService.ts`). Falls back to absolute thresholds for new users (<25 attempts). Research: Ratcliff & McKoon (2008), Van der Linden (2006).
- **Sprint 2 — Metacognitive calibration**: `lib/services/calibrationService.ts` computes Brier score from ReviewLog pairs (confidence_i → wasCorrect_i+1). Derives a per-user `dampenerFactor` (0.7–1.3×): overconfident students get dampened, underconfident get boosted. Requires ≥30 review pairs. Research: Dunlosky & Nelson (1992), Koriat (1997).
- **Sprint 3 — Question-type signal weighting**: `QUESTION_TYPE_WEIGHTS` in `lib/implicit-metrics.ts` provides per-type weight profiles — vignettes weight RT (0.40), recall weights switches (0.40), image weights trajectory (0.35), rapid_recall weights RT (0.50). Research: Rayner (1998), Ericsson & Kintsch (1995).
- **Sprint 4 — Bayesian confidence accumulation**: `lib/confidence/bayesianAccumulator.ts` blends current-review confidence with exponentially-decayed history of past reviews for the same card. Prior weight capped at 0.4. Quality-aware and correctness-aligned. Research: Mozer et al. (2009), Benjamin et al. (1998).
- **Sprint 5 — Optimizer quality weighting**: `gcp-fsrs-optimizer/main.py` now probabilistically downsamples reviews by telemetry quality (full=100%, partial=60%, minimal=30%) and user calibration Brier score. Ensures high-fidelity behavioral data drives FSRS parameter fitting.
- **Sprint 6 — Calibration validation pipeline**: `scripts/validate-confidence-pipeline.ts` pulls ReviewLog pairs, computes Brier scores by quality tier and question type, measures stability multiplier correlation, and outputs JSON reports to `docs/validation/`.

### FSRS Pipeline Consumers
All drill and session types now submit to FSRS:
- `components/session/QuizView.tsx` (main session) → `syncManager.queueAnswer()` → `/api/questions/attempt`
- `components/modes/SmartReviewMode.tsx` → `/api/drills/submit-review`
- All 11 drill hooks (`hooks/game/use-*.ts`) → `useDrillFSRS` → `/api/drills/submit-review` with `sessionType: 'drill'`

### Main Session UI
- `components/session/QuizView.tsx` (2274 lines) — The main study session. Has: question rendering, answer selection, ExplanationPanel (structured rationale), NormalLabsPanel (slide-out lab reference), implicit metrics collection, FSRS submission.
- `components/drill/DrillShell.tsx` — Standard drill wrapper used by all 13 active drill components.

## Key Patterns

### Question Data Shape
Questions come from `PreGeneratedQuestion.questionData` (JSON). The `QuestionData` interface in drillReviewService.ts shows the shape: `stem`, `correctAnswer`, `options[]`, `rationale`. Multiple field names exist for the same concept (e.g., `correctAnswer` vs `answer` vs `correct_option`).

### Submission Flow
1. Client collects behavioral telemetry (timeToFirstClick, answerSwitches, totalDwellTime)
2. POST to `/api/drills/submit-review` with questionId, selectedAnswer, telemetry
3. Server: resolves correctness → derives implicit rating → calculates par time → builds circadian context → runs FSRS update → writes QuestionAttempt + ReviewLog + UserProgress
4. Returns: isCorrect, rating, stability, difficulty, nextReview, retrievability

### Content Sources
- Database: `MedicalContent`, `Condition`, `Drug`, `AnatomyStructure` tables
- AI Generation: Gemini generates questions on-demand
- Seeded data: Various `scripts/migrate*.ts` and `scripts/seed/` for initial content

## Build & Test Commands
```bash
npm run dev              # Vite dev server (frontend only)
npm run dev:server       # Express dev server (backend, local only)
npm run dev:all          # Both concurrently
npm run dev:wrangler     # Cloudflare Pages dev (production-like)
npm run typecheck        # tsc --noEmit
npm run build            # Vite production build
npm test                 # Vitest unit tests
npm run test:e2e         # Playwright E2E
npm run db:studio        # Prisma Studio (DB browser)
```

## File Organization
```
functions/api/       → Cloudflare Edge API handlers (PRODUCTION)
routes/              → Express routes (LOCAL DEV ONLY)
lib/                 → Core logic (FSRS, implicit metrics, services, utils)
lib/services/        → Business logic services
components/          → React components (drill/, session/, dashboard/, quiz/, etc.)
hooks/               → React hooks (70+ hooks)
services/            → Client-side service layer
pages/               → Page-level components
prisma/              → Schema + migrations
scripts/             → Data migration, content processing
docs/                → 241 documentation files (audits, plans, architecture)
plans/               → Implementation plans
```

## Important Constraints
- Binary FSRS rating only (Again=1, Good=3). Hard/Easy are deprecated and normalized.
- Only `review_type: 'real'` MAIN and DRILL sessions count for FSRS. Cram and rapid_recall are excluded.
- Rapid-guess filtering: responses below MVRT (minimum valid response time) are flagged.
- The optimizer sidecar (`gcp-fsrs-optimizer/`) uses review_time, review_rating, review_state, review_duration from ReviewLog to fit personalized FSRS weights.

## Current Priority: Content Generation & Integration Wiring
Sprints 1-7 completed (2026-04-02). All drill types feed into FSRS. Remaining priorities: (1) generate more questions with new `questionOrder`/`taskCategory` taxonomy for under-represented PANCE blueprint areas (CV, PULM), (2) run Prisma migration for new schema fields (`questionOrder`, `taskCategory`, `accountStatus`, `deletionScheduledAt`), (3) wire `RotationFocusCard` to real user profile data (currentRotation, eorDate), (4) wire `useStudyWellness` to real session history, (5) fix Knowledge Base content loading.

### New Subsystems (Sprints 1-7, 2026-04-02)

#### Question Order Taxonomy
- `questionOrder`: 'first' | 'second' | 'third' (Bloom's taxonomy mapped)
- `taskCategory`: 8 PANCE task categories per NCCPA blueprint
- `ORDER_DISTRIBUTION_BY_PHASE` in `lib/nccpa-question-weighting.ts`: didactic/clinical/pance_prep phase distributions
- `learnerPhase` on `SessionQuestionRequest` for progression-aware selection
- Question schema, validator, and Gemini prompt all updated

#### PA Curriculum Knowledge Base
- `lib/constants/pa-curriculum.ts`: 12 didactic courses, 10 clinical rotations, 5 milestone exams, licensure pathway, common struggles
- Helper functions: `findRotation()`, `getRotationSystems()`, `getRotationHighYield()`, `inferPhase()`

#### Dashboard Enhancements
- `StudyActionCard.tsx`: Priority action cards (overdue, due today, streak, drills)
- `BlueprintProgressBar.tsx`: NCCPA system coverage visualization
- `RotationFocusCard.tsx`: Rotation-specific study guidance with EOR countdown
- `WellnessWidget.tsx`: Study wellness status (thriving/steady/tired/burnout_risk)
- `useStudyNudges.ts`: Context-aware toast notifications with cooldowns
- `useStudyWellness.ts`: Burnout detection from session patterns

#### OSCE Enhancements
- `services/domain/adaptivePersonalitySelector.ts`: Student-weakness-aware personality selection with progressive difficulty tiers and rotation-personality weights
- `lib/osce/clinicalReasoningScaffold.ts`: 5-step Clinical Reasoning Ladder (H&P → PE → Dx → DDx → Tx) with per-step scoring and Gemini grading prompts
- `ROTATION_CASE_MAP`: 10+ rotation-to-condition mappings for focused OSCE practice

#### Clinical Data Reference
- `lib/constants/clinical-data.ts`: 11 imaging patterns, 12 auscultation sounds, 5 vital ranges, SIRS criteria, shock classification
- Helper functions: `getImagingBySystem()`, `getImagingByModality()`, `getAuscultationByType()`

#### Account Lifecycle
- `functions/api/user/delete.ts`: DELETE (30-day soft delete) + PUT (cancel deletion)
- `accountStatus` and `deletionScheduledAt` on User model

## Verified Issues (2026-03-31 Audit)

### FSRS Pipeline: FIXED ✅
- **syncManager auth bug (FIXED):** `syncManager.queueAnswer()` triggered immediate syncs without a Clerk JWT → every POST to `/api/questions/attempt` got 401'd silently. Fix: token provider pattern in `syncManager.ts` + `useSyncManager(getToken)` in `OfflineSyncIndicator.tsx`.
- **drillReviewService FSRS gating (FIXED):** `sessionType='drill'` was excluded from FSRS updates (treated like cram). Fix: `isMainSession` now includes `'drill'`.
- **ReviewLog session type mapping (FIXED):** Drills were incorrectly mapped to `CRAM` in ReviewLog. Now correctly mapped to `DRILL` enum value.
- All 11 drill hooks use `useDrillFSRS` which correctly gets Clerk tokens and submits to `/api/drills/submit-review` with `sessionType: 'drill'`.
- `useImplicitMetrics` (300-line hook) exists but is superseded by `useDrillFSRS` for drills — only used by `QuizView.tsx`.

### sessionType enum: Present ✅
- `SessionType` enum has `{MAIN, DRILL, CRAM, RAPID_RECALL}` — migration already applied.

### DrillShell: 13 of 13 active drill components now use it ✅
- All active drill sessions use DrillShell: Contrastive, Pharm, DDx, Condition, Anatomy, ECG, FirstLine, Imaging, Physiology, MiniLab, Guideline, Ventilator, Derm
- DrillShell wraps landing, menu, and completion views; MiniDrillLayout stays for active quiz (immersive full-screen)
- 3 delegation wrappers (SubcategoryDrill, SystemDrill, PharmacologyDrill) inherit DrillShell from their target components

### Build environment notes
- `tsc --noEmit` requires `NODE_OPTIONS="--max-old-space-size=4096"` (6189 TS files)
- Tests use Vitest with Rollup (may need platform-specific native module)

## Implementation Plans
- `plans/IMPROVEMENT_PLAN.md` — 5-phase roadmap with implementation details
- `plans/TIMELINE.md` — Realistic 10-day timeline with specific files and dependencies
- `plans/IMPROVEMENT_LOG.md` — Daily automated task logs (created by scheduled task)
