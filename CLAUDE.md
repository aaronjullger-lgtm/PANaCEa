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

### Implicit Rating Inputs (from PDFs)
The `deriveImplicitRating` function uses: `timeToFirstClick`, `answerSwitches`, `totalDwellTime`, `isCorrect`, `parTimeMs`, and optionally `trajectory` (micro-kinetics). These are stored in `ReviewLog.telemetry` as: `par_time_ms`, `latency_ratio`, `implicit_confidence`, `answer_changes`, `circadian_phase`.

### FSRS Pipeline Consumers (CRITICAL GAP)
Currently only these components submit to the FSRS pipeline:
- `components/session/QuizView.tsx` (main session) → `/api/drills/submit-review`
- `components/modes/SmartReviewMode.tsx` → `/api/drills/submit-review`
- `hooks/game/use-condition-drill.ts` → `/api/drills/submit-review`

**30+ other drill types do NOT feed into FSRS.** This is the #1 consistency problem. Drill types like PharmDrill, DDxDrill, AnatomyDrill, ECGDrill, ImagingDrill, etc. are standalone and don't update spaced repetition scheduling.

### Main Session UI
- `components/session/QuizView.tsx` (2274 lines) — The main study session. Has: question rendering, answer selection, ExplanationPanel (structured rationale), NormalLabsPanel (slide-out lab reference), implicit metrics collection, FSRS submission.
- `components/drill/DrillShell.tsx` — Reusable drill wrapper, but only used by ContrastiveDrillSession. Should be the standard wrapper for all drills.

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
- Only `review_type: 'real'` MAIN sessions count for FSRS. Cram and rapid_recall are excluded.
- Rapid-guess filtering: responses below MVRT (minimum valid response time) are flagged.
- The optimizer sidecar (`gcp-fsrs-optimizer/`) uses review_time, review_rating, review_state, review_duration from ReviewLog to fit personalized FSRS weights.

## Current Priority: Consistency
The #1 goal is making all drill types feed into the FSRS pipeline consistently. Every answered question should: (1) collect implicit behavioral metrics, (2) submit to `/api/drills/submit-review`, (3) update the learner's spaced repetition schedule. The `DrillShell` component should be the standard wrapper providing this behavior.

## Verified Issues (2026-03-30 Audit)

### FSRS Pipeline: 1 of 14 drill hooks submits (and it's broken)
- `use-condition-drill.ts` submits to `/api/drills/submit-review` but WITHOUT `sessionType` → defaults to 'main' → contaminates FSRS data
- 13 other drill hooks (pharm, ddx, anatomy, first-line, photo, mini-lab, physiology, guideline, ventilator, polypharmacy, contrastive, ecg, derm) do NOT submit
- `useImplicitMetrics` (300-line hook) exists and works but is ONLY used by `QuizView.tsx` — no drill uses it

### sessionType enum missing 'drill'
- Current: `['main', 'cram', 'rapid_recall']` — no way to distinguish drill submissions from main session
- Fix: add `'drill'` to the enum, make drills pass it, update FSRS gating logic

### DrillShell: 6 of 16 drill components now use it
- `ContrastiveDrillSession`, `PharmDrillSession`, `DDxDrillSession`, `ConditionDrillSession`, `AnatomyDrillSession`, `ECGDrillSession` use DrillShell
- DrillShell wraps landing, menu, and completion views; MiniDrillLayout stays for active quiz (immersive full-screen)
- Remaining 10 drill sessions still need migration

### Build environment notes
- `tsc --noEmit` requires `NODE_OPTIONS="--max-old-space-size=4096"` (6189 TS files)
- Tests use Vitest with Rollup (may need platform-specific native module)

## Implementation Plans
- `plans/IMPROVEMENT_PLAN.md` — 5-phase roadmap with implementation details
- `plans/TIMELINE.md` — Realistic 10-day timeline with specific files and dependencies
- `plans/IMPROVEMENT_LOG.md` — Daily automated task logs (created by scheduled task)
