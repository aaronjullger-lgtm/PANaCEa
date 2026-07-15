# Learner Agent — Current State (Phase 0 Discovery)

**Date:** 2026-07-15  
**Branch:** `cursor/learner-agent-45f9`  
**Base commit:** `1f0d0ed5` (main)

## Repository snapshot

| Item | Value |
|------|-------|
| Package manager | npm |
| Node | 22 (`.node-version`) |
| Frontend | React 19 + Vite + Tailwind + Framer Motion |
| Production API | Cloudflare Pages Functions (`functions/api/`) |
| Database | PostgreSQL via Prisma 7.6 (hosted on Supabase) |
| Auth | **Clerk** (`@clerk/backend` in Edge, `@clerk/clerk-react` client) |
| AI | Google Gemini |
| Tests | Vitest (`npm test`), Playwright (`npm run test:e2e`) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` (production tsconfig) |
| Build | `npm run build` |
| Wrangler | `npm run pages:dev` / `wrangler pages dev` |

### Git status at discovery

- Clean working tree on `main` (detached HEAD at start; feature branch created for implementation).
- No existing `LearnerAgent` module, `@cloudflare/agents` dependency, or `ENABLE_LEARNER_AGENT` flag.

## Documentation vs code contradictions

| Topic | Documentation / prompt | Actual code |
|-------|------------------------|-------------|
| Authentication | "Supabase authentication flow" | **Clerk** is canonical (`functions/api/_shared/auth.ts`). Supabase is used for storage (service role) and client anon key, not session auth. |
| Next-best-action | Single orchestrator implied | **Fragmented** across `adaptiveLearning.ts`, `dailyStudyAllocatorService.ts`, `studyPlanService.ts`, `drillRecommendationEngine.ts`, `recommendationService.ts` |
| Graph memory | Graphiti / Neo4j mentioned in research | **Not integrated.** Postgres `GraphNode`/`GraphEdge` + `graphRag.ts` only. `docs/memory-architecture.md` is aspirational. |
| Cloudflare Agents | Required for Learner Agent | **Not present.** OSCE uses hand-rolled `DurableObject` (`workers/osce-session.ts`); DO bindings commented out in `wrangler.toml` for Pages deploy. |
| Assignments | Course assignments with due dates | **Weak.** `StudyPlan`/`StudyPlanItem` with `dueAt`; no separate coursework assignment model. A/B `assignment` refers to experiments. |
| Agent chat | Learner-facing coach | **Stateless** `POST /api/agents/run` with read-only tools; no session continuity or write tools. |

## Data ownership table

| Data type | Canonical owner | Access pattern | Notes |
|-----------|-----------------|----------------|-------|
| User identity & RBAC | Postgres `User` + Clerk | `resolveOrCreateUserRecord`, RLS on Supabase | Clerk ID → internal `userId` |
| Learner profile | Postgres `User`, `UserLearningProfile` | `functions/api/user/profile.ts` | Rotation, exam dates on `User` |
| Preferences | Postgres `UserPreferences` | Profile/preferences APIs | Daily goal, reminders, FSRS toggles |
| Courses / rotations | Postgres `User` fields + `config/rotation-systems.ts` | Profile + session lane `eor` | No formal rotation enrollment table |
| Exams (PANCE date) | Postgres `User.examDate` | Profile API | |
| Assignments / due tasks | Postgres `StudyPlan`, `StudyPlanItem`, `DailyStudyPlan` | `/api/users/me/daily-plan`, study-plan APIs | JSON task payloads in `DailyStudyPlan` |
| Question bank | Postgres `Question`, `PreGeneratedQuestion` | Session/drill APIs | Lifecycle + health scores |
| Attempts | Postgres `QuestionAttempt` | Written by `drillReviewService` only | Legacy `/api/questions/attempt` is non-canonical for FSRS |
| Review history | Postgres `ReviewLog` | Via `submitDrillReview` | Full telemetry |
| FSRS scheduling | Postgres `UserProgress`, `Card`, `UserTopicProgress` | `drillReviewService`, selectors | Binary Again/Good only |
| Mastery signals | Wilson service, `UserTopicProgress` | Read-only analytics | Must not be model-writable |
| Study plans | Postgres `StudyPlan`, `DailyStudyPlan` | `studyPlanService.ts` | Duplicate helpers in `functions/api/_shared/studyPlanService.ts` |
| Recommendations | Postgres `StudyRecommendation` | `adaptiveLearning.ts` | Virtual Attending pattern |
| Content provenance | Postgres content models + library ingest | `functions/api/content/library/*` | Approved content only for grounding |
| Graph clinical knowledge | Postgres `GraphNode`, `GraphEdge` | `graphRag.ts` | Not learner episodic memory |
| Learner episodic memory | **None today** | — | Target: agent DO + KV, not second copy of attempts |
| Agent conversation (ephemeral) | **None today** | Stateless `/api/agents/run` | Target: LearnerAgent DO state |
| Rate limits / cache | Cloudflare KV | `RATE_LIMIT_KV`, `CACHE` | |
| Secrets | Cloudflare dashboard / `context.env` | Never client-exposed | |

## Existing learning-engine map

### FSRS (deterministic — do not duplicate in prompts)

- `lib/fsrs.ts` — FSRS v6 algorithm
- `lib/implicit-metrics.ts` — behavioral → rating
- `lib/services/drillReviewService.ts` — **canonical write path**
- `hooks/useDrillFSRS.ts` — client drill integration
- `lib/services/sync/syncManager.ts` — offline → `submit-review`

### Next-best-action (fragmented — unify behind Learner Agent tools)

| Service | Key export | Data source |
|---------|------------|-------------|
| `lib/services/adaptiveLearning.ts` | `getNextBestAction()` | `UserTopicProgress`, `StudyRecommendation` |
| `lib/services/dailyStudyAllocatorService.ts` | `getDailyStudyAllocation()` | Blueprint gaps, FSRS due/overdue |
| `lib/services/studyPlanService.ts` | `getOrCreateDailyStudyPlan()` | `DailyStudyPlan` JSON tasks |
| `lib/services/drillRecommendationEngine.ts` | Drill mode ranking | Weakness profile |
| `services/optimizer/pathGenerator.ts` | Multi-day path | Gaps + reviews |

### Session orchestration

- `components/session/QuizView.tsx` — main study UI
- `functions/api/questions/session.ts` — question delivery
- `lib/services/session/sessionService.ts` — blueprint + EOR lanes

### Existing agent framework (stateless)

- `lib/services/agents/agentRunner.ts` — Gemini tool loop
- `functions/api/agents/run.ts` — `aiEndpoint`, read-only default
- `components/agents/AgentChat.tsx` — one-shot UI
- Tools: `clinical_library_search`, `user_progress_summary`, `fsrs_due_count`, + admin tools

### Feature flags

- `functions/api/_shared/feature-flags.ts` — env-var booleans (`1`, `true`, `yes`, `on`)
- Known: `ENABLE_LEGACY_EXAM_API`, `ENABLE_OSCE_BETA`, `ENABLE_REVIEW_GATE`

### Cloudflare infrastructure

- Pages project `panacea` — no DO bindings active
- Separate cron worker: `crons/panacea-cron-worker/`
- OSCE DO code exists but not bound: `workers/osce-session.ts`

### Cloudflare Agents SDK (verified 2026-07-15)

- npm package: `agents@0.17.4`
- `Agent` class extends Durable Object with WebSocket, `setState`, `schedule`, `runWorkflow`
- `AgentWorkflow` for durable multi-step work with `step.do()`, `reportProgress`, `mergeAgentState`
- `scheduleEvery()` for recurring idempotent tasks
- Requires separate Worker with `durable_objects` + `workflows` in wrangler config
- Pages cannot deploy DO from same project (documented in `wrangler.toml` OSCE comment)

## Gaps for Learner Agent

1. No durable per-learner agent instance
2. No unified deterministic `getNextBestAction` across allocator + plan + FSRS
3. No write-capable learner tools (start session, complete task, record attempt via services)
4. No memory policy or user-confirmed episodic store
5. No workflow for study-plan revision / reminders
6. No feature flag or UI integration for learner coach (distinct from generic `AgentChat`)
7. No correlation-ID observability across agent + session + recommendation

## Verification commands recorded

```bash
git status && git branch -a && git log --oneline -5
npm test          # full suite — run after implementation
npm run typecheck
npm run lint
npm run build
```

## Recommended canonical boundaries for implementation

| Concern | Canonical module |
|---------|------------------|
| FSRS writes | `lib/services/drillReviewService.ts` |
| Deterministic NBA | **new** `lib/services/learner/learnerNextActionService.ts` |
| Learner context | **new** `lib/services/learner/learnerContextService.ts` |
| Agent tool loop | Reuse `lib/services/agents/agentRunner.ts` |
| Durable agent | **new** `workers/learner-agent/` |
| Pages fallback API | **new** `functions/api/learner-agent/*` (see [API contracts](../api/API_OVERVIEW.md#learner-agent-endpoint-contracts)) |
