---
name: panacea-dev
description: "PANaCEa project-specific development patterns, architecture constraints, and codebase conventions. Use this skill whenever working on the PANaCEa codebase — writing new features, fixing bugs, modifying components, creating API endpoints, or doing any development work in the StudyPANaCEa repository. This should be the first skill consulted for any PANaCEa task, as it provides the foundational context that other skills (react-refactor, fsrs-pipeline, cf-edge-api, clinical-content-gen) build upon. Trigger on any mention of PANaCEa, StudyPANaCEa, OSCE, drill types, study sessions, question generation, or clinical education platform work."
---

# PANaCEa Development Patterns

PANaCEa is a clinical education platform for PA students (PANCE/PANRE prep). This skill captures the project-specific patterns, conventions, and constraints that prevent common mistakes. Read this before writing any code in the PANaCEa repo.

## Architecture Overview

```
Frontend:  React 19 + Vite + TypeScript + TailwindCSS + Framer Motion
Backend:   Cloudflare Pages Functions (Edge) — functions/api/
Database:  PostgreSQL + Prisma ORM (4131-line schema)
Auth:      Clerk (@clerk/clerk-react + @clerk/backend)
AI:        Google Gemini API
Deploy:    Cloudflare Pages + Functions, CI via GitHub Actions
```

## Critical Constraint: Two Backend Systems

The repo contains two backend systems. Getting them confused is the #1 source of bugs:

- **`functions/api/`** — Cloudflare Edge Functions. This is PRODUCTION. All deployed API endpoints live here.
- **`routes/`** — Express routes. LOCAL DEV ONLY. Never deployed, never imported by production code.

When writing a new API endpoint, it goes in `functions/api/`. When modifying an existing endpoint, check which directory it's in first.

## File Organization

```
functions/api/       → Production Edge API handlers
functions/api/_shared/ → Shared middleware, auth, prisma client, utils
routes/              → Local dev Express routes (NOT production)
lib/                 → Core logic (FSRS, metrics, services, utils, constants)
lib/services/        → Business logic services (drillReviewService, calibration, etc.)
components/          → React components organized by domain
  components/modes/  → Full-page mode components (PatientEncounterMode, SmartReviewMode)
  components/drill/  → Drill shell and drill-specific components
  components/session/ → QuizView and session components
  components/dashboard/ → Dashboard widgets
hooks/               → 88+ React hooks
services/            → Client-side service layer
pages/               → Page-level route components
prisma/              → Schema + migrations
scripts/             → Data migration, seeding, content processing
plans/               → Implementation plans and improvement logs
docs/                → Architecture docs, audits, validation reports
```

## Middleware Stack

Every Edge Function endpoint uses this pattern:

```typescript
import { authenticatedEndpoint } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { withCors } from '../_shared/cors';
import { createEndpointLogger } from '../_shared/logging';

export const onRequestPost: PagesFunction<Env> = withCors(
  authenticatedEndpoint(async (context, auth) => {
    const prisma = createEdgePrismaClient(context.env);
    try {
      // ... endpoint logic
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  })
);
```

Key rules:
- **No `process.env`** in Edge functions — use `context.env.*`
- **Always** `safePrismaDisconnect(prisma)` in `finally` blocks
- **Auth**: `authenticatedEndpoint` middleware verifies Clerk tokens and passes `auth.userId`
- **Validation**: Use Zod schemas for request body validation

## State Management Patterns

### Component State
- Large components (>10 useState) should use `useReducer` via a custom hook (see `hooks/useEncounterReducer.ts` for the canonical pattern)
- The `set()` factory pattern produces stable setter references compatible with both direct values and functional updaters

### FSRS State Flow
The submission pipeline is the heart of the app:
1. Client collects behavioral telemetry (timeToFirstClick, answerSwitches, totalDwellTime)
2. POST to `/api/drills/submit-review` with questionId, selectedAnswer, telemetry
3. Server: correctness → implicit rating → par time → circadian context → FSRS update → QuestionAttempt + ReviewLog + UserProgress
4. Returns: isCorrect, rating, stability, difficulty, nextReview, retrievability

### Session Types
- `MAIN` — Standard study session via QuizView.tsx
- `DRILL` — Drill modes (all 13 types) via DrillShell.tsx
- `CRAM` — Review without FSRS updates
- `RAPID_RECALL` — Speed drills without FSRS updates

Only `MAIN` and `DRILL` with `review_type: 'real'` count for FSRS.

## Naming Conventions

### Question Data Shape
Questions come from `PreGeneratedQuestion.questionData` (JSON). Multiple field names exist for the same concept — always check for aliases:
- Correct answer: `correctAnswer` OR `answer` OR `correct_option`
- Question text: `stem` OR `questionText` OR `question`
- Options: `options[]` with items that may have `text` or be plain strings

### Hook Naming
- `use[Domain][Concern]` — e.g., `useDrillFSRS`, `useEncounterReducer`, `useStudyWellness`
- Telemetry hooks: `useImplicitMetrics`, `useMicroKinetics`, `useTelemetryCollector`
- Data hooks: `useUserStats`, `useLearningCurveData`

### Component Naming
- Mode components: `[Mode]Mode.tsx` — e.g., `PatientEncounterMode.tsx`, `SmartReviewMode.tsx`
- Drill components: `[Type]Drill.tsx` — wrapped in `DrillShell`
- Dashboard widgets: `[Feature]Widget.tsx` or `[Feature]Card.tsx`

## Build & Test

```bash
npm run dev              # Vite dev server (frontend only)
npm run dev:server       # Express dev server (local backend)
npm run dev:all          # Both concurrently
npm run dev:wrangler     # Cloudflare Pages dev (production-like)
npm run typecheck        # tsc --noEmit (needs NODE_OPTIONS="--max-old-space-size=4096")
npm run build            # Vite production build
npm test                 # Vitest unit tests
npm run test:e2e         # Playwright E2E
```

TypeScript checking requires `NODE_OPTIONS="--max-old-space-size=4096"` due to 6189 TS files.

## Common Gotchas

1. **Prisma Edge client is a singleton** via `functions/api/_shared/prisma-edge.ts`. Don't create new PrismaClient instances in endpoints.
2. **Binary FSRS rating only**: Again=1, Good=3. Hard/Easy are deprecated and normalized to these two. Don't introduce Hard/Easy ratings.
3. **Rapid-guess filtering**: Responses below MVRT (minimum valid response time) skip FSRS updates. MVRT thresholds are question-type-specific (VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms).
4. **Shared utility duplication**: Server code (`functions/api/`) can't import from `lib/`, and client code can't import from `functions/api/`. If both need the same utility, create mirror files (e.g., `functions/api/_shared/inferSystem.ts` + `lib/utils/inferSystem.ts`).
5. **Large components**: `PatientEncounterMode.tsx` (~3500 lines) and `QuizView.tsx` (~2274 lines) are the two largest. Changes here need extra care — always verify with `tsc --noEmit` after edits.
6. **DrillShell**: All 13 active drill components must use DrillShell. Don't create drill components without it.

## Verification Protocol

After any code change:
1. `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep "error TS"` — filter for actual errors
2. For targeted checks: `npx tsc --noEmit 2>&1 | grep -E "ModifiedFile1|ModifiedFile2"`
3. `npm test` for unit tests when modifying `lib/` files
4. Visual inspection of the specific component if UI changes were made

## Related Skills

This skill provides foundational context. For domain-specific work, also consult:
- **react-refactor** — When decomposing large components or consolidating state
- **fsrs-pipeline** — When modifying spaced repetition logic, telemetry, or confidence scoring
- **cf-edge-api** — When writing or modifying Cloudflare Edge Function endpoints
- **clinical-content-gen** — When generating PANCE questions or working with curriculum taxonomy
