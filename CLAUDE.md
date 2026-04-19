# PANaCEa — Claude Code Context

**Site:** [studyPANaCEa.com](https://studypanacea.com) | **Repo:** [github.com/aaronjullger-lgtm/PANaCEa](https://github.com/aaronjullger-lgtm/PANaCEa)

> Adaptive clinical education platform for PA students. Combines FSRS v6 spaced repetition, implicit behavioral metrics, NCCPA blueprint-aligned question generation, and AI-powered clinical simulations to maximize PANCE/PANRE readiness.

---

## Developer Context

**Aaron** — PA-S2 (second-year Physician Assistant student) balancing clinical rotations, PANCE preparation, and solo full-stack development of PANaCEa. Time is extremely limited; favor high-ROI changes, avoid scope creep, and keep responses concise. Aaron has deep domain knowledge in both the clinical content and the codebase architecture.

---

## Working with Aaron

These rules apply to **every session**, regardless of which skill is loaded.

- **"Do it for me"** = fully execute. Don't ask clarifying questions. Don't explain what you're about to do. Just build it.
- **Audit first**: Before writing code, read every file you'll modify. Understand imports, types, and existing patterns. This prevents the #1 source of wasted time.
- **Concise reporting**: "37/37 tests pass" — not a paragraph. Aaron can read diffs.
- **Phased sprints**: Break large features into numbered sprints (Sprint 1, 2, etc.). Each sprint touches 1–4 files and produces something testable.
- **Always verify**: Every sprint ends with tests passing. Don't skip this. Don't declare done without running tests.
- **Commit granularity**: One commit per logical group is fine. Don't micro-commit.
- **Session continuation**: "Continue" means pick up the NEXT undone thing. Don't recap what was already done — Aaron has already read the summary.

---

## Decision Authority

### Just Do It (no approval needed)
- Read/edit/create source files, components, services, hooks, tests
- Run tests, typecheck, lint, build
- Safe git operations: add, commit, status, diff, log, branch, pull (ff-only)
- Install dev dependencies (`npm install --save-dev`)
- Fix lint/type errors that are clearly bugs
- Create new files following existing patterns

### Ask First (get Aaron's approval)
- Schema migrations (Prisma migrate) — these touch production data
- Adding new production dependencies (`npm install`)
- Force push, hard reset, or any destructive git operation
- Deleting files (especially services, endpoints, or components in active use)
- Architecture changes (new state management pattern, new routing approach)
- Changes to FSRS algorithm parameters or rating logic
- Deploying to production (`npm run deploy:local`, `npx wrangler`)
- Any change to auth middleware or RLS policies
- Modifying `.env` files or environment variable configuration

### Never Do (even if asked — push back)
- Introduce self-rated difficulty buttons (PANaCEa is implicit-only)
- Add Hard/Easy rating values (binary Again/Good only)
- Use `process.env` in Edge functions (use `context.env.*`)
- Import Prisma client in frontend components
- Skip `safePrismaDisconnect` in Edge function finally blocks
- Commit `.env` files, API keys, or secrets

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 19.2 + TypeScript (strict) + Vite 6.2 | JSX auto-runtime, path alias `@/*` → repo root |
| **Styling** | TailwindCSS 3.4 + Framer Motion | Custom semantic color tokens (deep-plum, steel-blue, sage, etc.) |
| **State** | Zustand 5.0 + TanStack Query 5.90 | Zustand for client state, RQ for server state |
| **Backend** | Cloudflare Pages Functions (Edge) | `functions/api/` — 81+ endpoint directories |
| **Database** | PostgreSQL (Supabase) + Prisma 7.6 | pgbouncer pooling, direct URL for migrations |
| **Auth** | Clerk (`@clerk/clerk-react` + `@clerk/backend`) | Token provider pattern, RBAC via UserRole enum |
| **AI** | Google Gemini | Question gen, Ghost Grader, OSCE sim, content enrichment |
| **Monitoring** | Sentry | Source maps, performance tracing, error tracking |
| **PWA** | vite-plugin-pwa | Offline-first, StaleWhileRevalidate + CacheFirst strategies, cache ID `panacea-v12-offline-first` |
| **Testing** | Vitest 4.1 + Playwright | jsdom env, 3200+ tests passing (205/213 test files), coverage thresholds enforced |
| **CI/CD** | GitHub Actions → Cloudflare Pages | Auto-deploy on push to main |
| **Node** | v22 (.node-version) | Required for Edge runtime compatibility |

---

## Architecture Rules

### Production API (Cloudflare Edge)
- **All production endpoints** live in `functions/api/`. The `routes/` directory is Express for **local dev ONLY** — never deployed.
- **Prisma Edge client:** Singleton at `functions/api/_shared/prisma-edge.ts`. Always call `safePrismaDisconnect(prisma)` in `finally` blocks.
- **Auth middleware:** `authenticatedEndpoint` from `functions/api/_shared/auth.ts`. Never use raw `process.env` in Edge — use `context.env.*`.
- **Rate limiting:** Distributed via `RATE_LIMIT_KV` namespace. Content caching via `CACHE` KV namespace.
- **Error pattern:** Every endpoint wraps logic in try/catch, returns structured JSON `{ error: string }` on failure.

### Frontend Architecture
- **Code splitting:** Manual vendor chunks (react, charting, ui, state, router, auth, validation) + component-level splits for heavy components (CommandCenterHub, QuizView, GrandRoundsMode).
- **Prisma exclusion:** Custom Vite plugin stubs `@prisma/client` in browser builds — Prisma is server-only.
- **Import alias:** `@/` maps to repo root. Use `@/lib/`, `@/components/`, `@/hooks/`, etc.

### TypeScript
- **Strict mode** fully enabled: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitReturns`.
- **Target:** ES2022, module ESNext, bundler resolution.
- **Typecheck command:** `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` (OOM without the flag).

---

## FSRS Pipeline (Core Differentiator)

PANaCEa uses a **fully implicit** spaced repetition system — no self-rated buttons. Rating is derived from behavioral telemetry.

### Rating Flow
1. **Telemetry collected:** `timeToFirstClick`, `answerSwitches`, `totalDwellTime`, `isCorrect`, `parTimeMs`, `hintViewed`
2. **Implicit rating derived:** `lib/implicit-metrics.ts` → binary Again/Good (Hard/Easy deprecated)
3. **Rapid-guess filter:** MVRT thresholds — VIGNETTE=3000ms, RECALL=1500ms, IMAGE=2000ms. Below threshold → skip FSRS update entirely
4. **FSRS v6 update:** `lib/fsrs.ts` — 21 parameters, `schedulingStates()` → new stability, difficulty, interval
5. **Persistence:** QuestionAttempt + ReviewLog + UserProgress written atomically

### Confidence Pipeline (8 Steps)
Bayesian accumulation → calibration dampener → fatigue → interference → fluency illusion dampener → graduated stability multiplier → desirable difficulty bonus → cross-session trend.

**Key files:**
- `lib/confidence/bayesianAccumulator.ts`
- `lib/services/calibrationService.ts`
- `lib/confidence/desirableDifficultyBonus.ts`
- `lib/confidence/interferenceDetector.ts`
- `lib/confidence/trendDetector.ts`

### Critical Constraints
- **Binary rating ONLY:** Again (0) / Good (1). Never introduce Hard/Easy.
- **Only real sessions update FSRS:** `review_type: 'real'` with `MAIN` or `DRILL` session types. Cram and rapid_recall are excluded.
- **Par time is per-question-type**, not global. Calculated from historical data.
- **3200+ tests passing** (205/213 test files) across confidence pipeline, FSRS, and all service subsystems — do not break these.

---

## Session & Drill Submission Flow

### Main Study Session (QuizView)
```
Client (QuizView.tsx) → syncManager.queueAnswer() → POST /api/questions/attempt
```

### Drill Sessions (13 active drill types)
```
Client (DrillShell.tsx + drill component) → useDrillFSRS hook → POST /api/drills/submit-review
```

### Server Pipeline (drillReviewService.ts — 803 lines)
```
Request → correctness check → implicit rating → par time lookup → circadian adjustment
→ FSRS update → write QuestionAttempt + ReviewLog + UserProgress + confusion pairs
→ Response: { isCorrect, rating, stability, difficulty, nextReview, retrievability }
```

### Active Drill Types
AnatomyDrill, ConditionDrill, ContrastiveDrill, DDxDrill, DermDrill, ECGDrill, ElaborationDrill, FirstLineDrill, GuidelineDrill, ICDCodingDrill, ImagingDrill, MiniLabDrill, PharmDrill

---

## Proactive Question Reservoir

Background queue ensuring zero-wait question delivery during sessions.

**States:** queued → reserved → consumed → expired → failed
**Policy:** LOW_WATER=15, HIGH_WATER=40, BATCH=25, TTL=48h
**Priority:** OVERDUE_REVIEW(100) > DUE_REVIEW(80) > NEW_BLUEPRINT_GAP(60) > NEW_STANDARD(40) > BACKFILL(20)
**Locking:** `reserveFromReservoir()` uses `FOR UPDATE SKIP LOCKED`
**Maintenance:** Cron every 2h via `functions/api/cron/reservoir-maintenance.ts`

---

## Directory Structure

```
StudyPANaCEa/
├── components/          # 55 subdirs, 580+ React components
│   ├── admin/           # Admin panels (29+ subdirs)
│   ├── dashboard/       # Main dashboard layouts + widgets
│   ├── drill/           # 42 drill-related files (13 active drill types)
│   ├── session/         # QuizView.tsx (2274 lines), session management
│   ├── osce/            # OSCE clinical simulation UI
│   ├── library/         # Clinical reference library browser
│   ├── charts/          # Data viz (recharts, d3, victory wrappers)
│   └── ...              # analytics, auth, gamification, knowledge, etc.
├── hooks/               # 77 custom React hooks
│   ├── useDrillFSRS.ts  # FSRS integration for all drills
│   ├── useImplicitMetrics.ts
│   ├── useEnhancedAuth.ts
│   └── ...
├── lib/                 # Core business logic
│   ├── fsrs.ts          # FSRS v6 algorithm
│   ├── implicit-metrics.ts
│   ├── confidence/      # 8-step confidence pipeline
│   ├── services/        # 112 service files
│   │   ├── drillReviewService.ts  # Main submission pipeline (803 lines)
│   │   ├── calibrationEngine.ts
│   │   ├── adaptiveLearning.ts
│   │   ├── autoAuthor/  # AI content generation
│   │   └── cognitiveScience/
│   ├── constants/       # 11 constant files
│   │   ├── pa-curriculum.ts       # 12 courses, 10 rotations
│   │   ├── blueprint.ts           # NCCPA blueprint
│   │   └── spacing.ts             # SRS interval constants
│   ├── srs/             # Spacing retrieval system
│   └── nccpa-question-weighting.ts  # Question order + taskCategory
├── functions/api/       # 81+ endpoint directories (Cloudflare Edge)
│   ├── _shared/         # prisma-edge.ts, auth.ts, middleware
│   ├── drills/          # submit-review.ts + drill endpoints
│   ├── questions/       # Question CRUD, attempt, search
│   ├── conditions/      # Medical condition data
│   ├── analytics/       # Analytics aggregation
│   ├── admin/           # Admin operations
│   ├── cron/            # Scheduled jobs (reservoir maintenance)
│   └── ...              # 70+ more endpoint groups
├── types/               # 25+ TypeScript type definition files
├── contexts/            # React context providers
├── store/               # Zustand stores
├── prisma/              # Schema + migrations
│   └── schema.prisma    # 60+ models, 20+ enums
├── scripts/             # 211 automation scripts
├── tests/               # Unit + integration tests
├── e2e/                 # Playwright E2E tests
├── vitest-mocks/        # Test stubs (Sentry, etc.)
├── config/              # App configuration
├── public/              # Static assets + PWA manifest
└── .claude/             # Claude Code config
    ├── skills/          # 27 custom PANaCEa skills
    ├── commands/        # Custom slash commands
    └── settings.local.json
```

---

## Database Schema (Prisma)

### Core Models (60+)

**User Domain (14 models):**
User, UserPreferences, UserProgress, UserStatistics, UserLearningProfile, UserCircadianProfile, UserGoal, UserQuestionHistory, UserStudyPhenotype, UserConditionAccuracy, UserRolling360Stats, DailyUserAnalytics, UserWordleState, UserDiagnosticPuzzleState

**Content Domain (30+ models):**
Question, Condition, Drug, Guideline, ClinicalPearl, FirstLineTreatment, ImagingStudy, LabCase, ECGPattern, VitalSignRange, HistoryComponent, DifferentialDiagnosis, Buzzword, ConfusionPair, ACLSAlgorithm, AnatomyStructure, MedicalContent, ContentStatistics

**Study/Progress Domain (15+ models):**
Card, DrillSessionRecord, EncounterResult, GrandRoundsAttempt, GrandRoundsChallenge, FluidCase, DiagnosticPuzzle, DailyDiagnosticPuzzle, BaselineAssessment, ExamOutcome, DailyStudyPlan, ReviewLog, QuestionAttempt

**Relationship Models:**
ConditionRelation, DrugConditionLink, ImagingConditionLink, AnatomyConditionLink, WeaknessPattern, ConceptGap

**Knowledge Graph:**
GraphNode, GraphEdge, SystemMapping

### Key Enums
`QuestionFormat` (MCQ, short answer, case, etc.), `CognitiveLevel` (Bloom's: Recall→Create), `SessionType` (MAIN, DRILL, CRAM, etc.), `UserRole` (Student, Faculty, Admin), `QuestionLifecycleStatus`, `CircadianPhase`, `ProgressContext`, `TrainingPhase`

---

## Key Files Quick Reference

| File | Lines | Purpose |
|------|-------|---------|
| `components/session/QuizView.tsx` | 2045 | Main study session UI |
| `lib/services/drillReviewService.ts` | 1620 | Core submission pipeline |
| `lib/fsrs.ts` | — | FSRS v6 algorithm (21 params) |
| `lib/implicit-metrics.ts` | — | Behavioral → rating derivation |
| `components/drill/DrillShell.tsx` | — | Drill wrapper (13 drill types) |
| `hooks/useDrillFSRS.ts` | — | FSRS hook for all drills |
| `lib/nccpa-question-weighting.ts` | — | Question order + taskCategory |
| `lib/constants/pa-curriculum.ts` | — | 12 courses, 10 rotations |
| `functions/api/_shared/prisma-edge.ts` | — | Prisma singleton (Edge) |
| `functions/api/_shared/auth.ts` | — | Auth middleware |
| `vite.config.ts` | 557 | Build config + code splitting |
| `vitest.config.ts` | 80 | Test config + coverage thresholds |

---

## Build & Dev Commands

```bash
# Development
npm run dev              # Vite frontend (HMR)
npm run dev:all          # Frontend + Express backend
npm run dev:wrangler     # Cloudflare Pages (production-like)

# Type checking (MUST use memory flag)
npm run typecheck        # tsc --noEmit (NODE_OPTIONS="--max-old-space-size=4096")

# Testing
npm test                 # Vitest unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E

# Database
npm run db:push          # Push schema (dev)
npm run db:migrate:dev   # Create migration
npm run db:migrate:deploy # Apply migrations
npm run db:studio        # Prisma Studio GUI
npm run db:validate      # Schema integrity check

# Build & Deploy
npm run build            # Production build
npm run deploy:local     # Build + deploy to Cloudflare Pages
npm run preview          # Preview production build

# Content & Scripts
npm run generate:clinical    # Generate clinical content
npm run health-check         # Content health check
npm run system-health        # System health check
npm run orchestrate:full     # Full automation pipeline
```

---

## Environment Variables

### Required Secrets (never commit)
- `CLERK_SECRET_KEY` — Backend auth verification
- `DATABASE_URL` — PostgreSQL connection (pgbouncer)
- `DIRECT_DATABASE_URL` — Direct connection (migrations only)
- `GEMINI_API_KEY` — Server-side AI
- `SUPABASE_SERVICE_ROLE_KEY` — Admin DB access
- `SENTRY_AUTH_TOKEN` — Source map upload

### Client-Side (VITE_ prefix)
- `VITE_CLERK_PUBLISHABLE_KEY` — Frontend auth
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Client DB access
- `VITE_SENTRY_DSN` — Error tracking
- `VITE_API_URL` — API base URL (https://studypanacea.com in prod)

### Cloudflare KV Namespaces
- `RATE_LIMIT_KV` (id: `7df124d8b81f400eafe6ba55477bf11d`) — Distributed rate limiting
- `CACHE` (id: `b576c43270a3407a8e5ae65afad0fe7e`) — Content caching

---

## Testing Strategy

### Coverage Thresholds
- **Global floor:** 40% statements, 35% branches/functions/lines
- **Critical paths (higher threshold):** `lib/fsrs.ts`, `lib/implicit-metrics.ts`, `lib/services/drillReviewService.ts`, `lib/confidence/**`, `lib/srs/**`, `store/**`, `functions/api/_shared/**`

### Test Patterns
- Tests in `tests/`, also colocated in `lib/`, `functions/`, `components/`, `services/`, `hooks/`
- Mock setup: `vitest.setup.ts` + `vitest-mocks/sentry-stub.ts`
- **Known exclusions:** React 19 compat issues in `components/admin`, Goals, offline tests

### Test Data Rules
- Never depend on insertion order for assertions
- Use deterministic IDs, not random UUIDs, in fixtures
- FSRS math assertions must account for floating-point precision

---

## Current Priorities (2026-04-18)

1. Generate questions for under-represented PANCE blueprint areas (CV, PULM)
2. Finish/resume the parked QuizView refactor on `wip/quizview-refactor-parked` (currently 192 TS errors — state + button primitives need rewiring)
3. Resolve drill routing split (DrillShell vs. useDrillFSRS) — decide which drill types consolidate
4. Pending Prisma migrations — awaiting approval to apply:
   - `UserDailyInsight` model (daily-insights cron cache) — DDL proposal at `prisma/audit/proposed_migration_user_daily_insight.sql`. Schema.prisma already updated with the model.
   - Missing foreign keys on `QuestionAttempt`, `ReviewLog.conditionId`, `Card.questionId`, `StudentReservoirItem` (userId + questionId), `ItemDifficulty.cardId` — DDL proposal at `prisma/audit/proposed_migration_add_missing_fks.sql`. Orphan probe returned 0 orphans on 2026-04-17; free to apply (no cleanup required).
   - Missing composite indexes: PreGen `(validationStatus, qualityScore)`, PreGen `(validationStatus, flagCount)`, Question `(lifecycleStatus, contentHealthScore)`, ConfusionPair `(userId, count DESC, lastOccurrence DESC)` — DDL proposal at `prisma/audit/proposed_migration_missing_composite_indexes.sql`. Schema.prisma already updated with the matching `@@index` directives.
   - `ContentGap` model (Sprint 15) — migration drafted at `prisma/migrations/20260418120000_add_content_gap/migration.sql`; schema.prisma still needs the corresponding model declaration before `prisma generate` will type the client.
   - `NotificationLog` model (Sprint 18) — migration drafted at `prisma/migrations/20260418120100_add_notification_log/migration.sql`; schema.prisma still needs the corresponding model declaration. `PushSubscription` is already in schema (line 3487) — do NOT re-add.
   - `banditState` field on `UserPreferences` (Sprint 16) — not yet drafted.
5. Production dependency: `web-push` npm package for notification cron (Sprint 18) — needs Aaron's approval.
6. Applied via Supabase MCP on 2026-04-17, registered as Prisma migration files in this branch (resolve with `npx prisma migrate resolve --applied <dir>` when pulling):
   - `20260418000000_enable_rls_student_reservoir_item`
   - `20260418000100_drop_redundant_indexes` (removed `MC_buzzwords_gin_idx`, `idx_user_question_seen_user_last`, `idx_ubm_user_created`, `Drug_drugClass_idx`)
   - `20260418000200_question_embedding_ivfflat_to_hnsw` (re-tunes to repo standard m=24, ef_construction=200)

### Recently Completed (2026-04-13 Integration Session)
- ✅ KB content loading — SmartConditionView already has comprehensive error/loading/retry states
- ✅ Skill descriptions — already well-optimized with trigger phrases
- ✅ 12 new services (Sprints 13-25) written and tested (263+ tests)
- ✅ 8 services wired into production: CRAG+reranker→RAG, bandit→selector, clustering→dashboard, self-refine→generate-rag, FIRe→drillReviewService, error patterns, daily load, item metrics
- ✅ 5 new API endpoints: error-patterns, daily-load, learner-profile, knowledge-graph, compute-item-metrics
- ✅ 5 new dashboard widgets: DailyLoadWidget, ErrorPatternWidget, LearnerInsightsCard, KnowledgeGraphWidget
- ✅ Dashboard personalization: 3 new WidgetIds registered across PANCE_PREP + CLINICAL_ROTATION configs
- ✅ Landing page redesign: HeroSection, FeaturesGrid, HowItWorks, SocialProof, FinalCTA
- ✅ Code review: confidence overflow fix, aria-expanded accessibility, auth policy review (5/5 pass)
- ✅ Test suite: 205/213 files pass, 3200+/3219 tests pass, 0 new regressions

---

## Verified Fixes (2026-03-31)

- **syncManager auth bug (FIXED):** Token provider pattern added; `useSyncManager(getToken)` in `OfflineSyncIndicator.tsx`.
- **drillReviewService FSRS gating (FIXED):** `sessionType='drill'` now included in FSRS updates.
- **ReviewLog session type (FIXED):** Drills now correctly map to `DRILL` enum (not `CRAM`).

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| `process.env` in Edge function | Use `context.env.*` instead |
| Prisma import in browser bundle | Vite plugin stubs it; never import directly in components |
| OOM during typecheck | Always use `NODE_OPTIONS="--max-old-space-size=4096"` |
| Missing `safePrismaDisconnect` | Every Edge function must call it in `finally` |
| FSRS update for Cram/rapid_recall | Only `MAIN` and `DRILL` session types trigger FSRS |
| Self-rated difficulty buttons | PANaCEa uses **implicit-only** rating — no user-facing buttons |
| Hard/Easy rating values | Deprecated. Binary Again(0)/Good(1) only |
| Test ordering assumptions | Never assert based on array insertion order |
| Clock skew auth errors | Set `CLERK_AUTH_DEBUG=true` to diagnose "token-not-active-yet" |
| Git lock errors with Desktop Commander | Delete `.git/index.lock` before retrying |

---

## Custom Skills (27)

PANaCEa has 27 custom Claude skills in `.claude/skills/`. These auto-trigger based on description matching. See `.claude/skills/SKILL-ROUTING-QUICK.md` for a quick reference routing guide.

**Tier 1 (always relevant):**
`panacea-dev`, `panacea-navigator`, `panacea-verify`, `sprint-pipeline`, `panacea-fsrs-wiring`

**Tier 2 (commonly used):**
`fsrs-pipeline`, `fsrs-domain`, `session-orchestration`, `cf-edge-api`, `clinical-content-gen`, `react-refactor`, `vitest-author`, `dashboard-trust`, `panacea-style-system`, `panacea-component-sprint`

**Tier 3 (specialized):**
`ai-generation-safety`, `async-state-hardening`, `auth-policy-review`, `clinical-library-search`, `clinical-safety-review`, `desktop-commander-deploy`, `model-routing-escalation`, `osce-architect`, `prisma-data-integrity`, `repo-hygiene`, `ui-primitive-consolidation`, `skill-creator`

---

## Decision Authority & Safety

These rules apply to ALL PANaCEa work. Full framework in `~/Documents/Claude/CLAUDE.md`.

**Just Do It** (all true: reversible, within scope, no external impact, no emotional weight):
Bug fixes, refactors, test fixes, dependency patches, documentation, daily improvement commits.

**Ask First** (any one: one-way door, user-facing change, new feature, ambiguous scope):
Present a Decision Card: `**[DECISION]** summary | **Rec:** X | **Risk:** Y | **Reversible?** Yes/No`

**Safety hook active** (`~/.claude/hooks/safety-guard.sh`):
No `rm`, no `sudo`, no `git add .`, no `git push --force`, no hardcoded secrets.
Use `mv <target> ~/.Trash/` for deletion. Stage specific files only.

**Session wrap-up:** Run `/wrap-up` at end of substantive sessions to commit, write handoff to `~/Documents/Claude/handoff.md`.

## Conventions

- **Commit style:** Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`)
- **Branch naming:** `feat/description`, `fix/description`, `chore/description`
- **File naming:** PascalCase for components (`DrillShell.tsx`), camelCase for services/utils (`drillReviewService.ts`), kebab-case for API routes (`submit-review.ts`)
- **Import ordering:** React → third-party → `@/lib` → `@/hooks` → `@/components` → relative
- **Error handling:** Always structured `{ error: string }` responses from API; Sentry capture for unexpected errors
- **New endpoints:** Use `authenticatedEndpoint` wrapper, Prisma Edge client, `safePrismaDisconnect` in finally
- **New drills:** Must wire through `useDrillFSRS` hook → `submit-review` endpoint for FSRS integration
- **New components:** Use Tailwind + semantic color tokens from `tailwind.config.js`; respect the design system in `.claude/skills/panacea-style-system`
