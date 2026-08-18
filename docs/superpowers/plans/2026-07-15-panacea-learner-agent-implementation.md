# PANaCEa Learner Agent — Implementation Plan

**Date:** 2026-07-15  
**Design:** `docs/superpowers/specs/2026-07-15-panacea-learner-agent-design.md`

## Sprint 1 — Foundation (this session)

### 1.1 Deterministic engine (`lib/services/learner/`)

- [x] `types.ts` — shared interfaces
- [x] `learnerContextService.ts` — `getLearnerContext`
- [x] `learnerDueItemsService.ts` — `getDueLearningItems`
- [x] `learnerNextActionService.ts` — unified `getNextBestAction`
- [x] `learnerRotationService.ts` — rotation context
- [x] `learnerAssignmentsService.ts` — upcoming plan items
- [x] `learnerProgressService.ts` — progress summary
- [x] `learnerSessionService.ts` — session start/complete
- [x] `learnerGroundedContentService.ts` — grounded retrieval wrapper
- [x] `learnerReminderService.ts` — idempotent reminders (KV)
- [x] `index.ts` — public exports

### 1.2 Agent layer (`lib/services/learnerAgent/`)

- [x] `memoryPolicy.ts` — proposal, confirmation, categories
- [x] `observability.ts` — correlation IDs, redaction
- [x] `prompts.ts` — learner agent system prompt
- [x] `tools/*` — typed tools wrapping learner services
- [x] Feature flag constant

### 1.3 Pages API (`functions/api/learner-agent/`)

- [x] `connect.ts` — auth + connection info
- [x] `recommendation.ts` — deterministic NBA endpoint
- [x] `memory.ts` — list/confirm/delete memories (KV)
- [x] `session.ts` — start/complete session fallback

### 1.4 Worker (`workers/learner-agent/`)

- [x] `package.json`, `wrangler.toml`, `tsconfig.json`
- [x] `LearnerAgent.ts` — Agent subclass
- [x] `StudyPlanRevisionWorkflow.ts`
- [x] `index.ts` — routeAgentRequest

### 1.5 Frontend

- [x] `components/learnerAgent/LearnerAgentPanel.tsx`
- [x] Wire behind feature flag in command center
- [x] `hooks/useLearnerAgent.ts`

### 1.6 Tests

- [x] `tests/learner-agent/surgeryRotationFixture.ts`
- [x] `tests/learner-agent/learnerNextActionService.test.ts`
- [x] `tests/learner-agent/memoryPolicy.test.ts`
- [x] `tests/learner-agent/security.test.ts`
- [x] `tests/learner-agent/learnerEngineBoundary.test.ts`

### 1.7 Documentation

- [x] `docs/architecture/learner-agent.md`
- [x] `docs/architecture/learner-agent-data-ownership.md`
- [x] `docs/runbooks/learner-agent.md`
- [x] `docs/evaluations/learner-agent-evaluations.md`
- [x] `docs/configuration/learner-agent-secrets.md`

## Sprint 2 — Integration hardening (follow-up)

- [ ] Deploy `workers/learner-agent` to staging
- [ ] Bind worker URL in Pages `LEARNER_AGENT_WORKER_URL`
- [ ] E2E Playwright: accept recommendation → launch session
- [ ] Evaluation baseline runs in CI
- [ ] Multi-tab sync verification on DO
- [ ] Postgres `LearnerMemory` model (pending migration approval)

## Sprint 3 — Production readiness

- [ ] Internal dogfood with observability dashboards
- [ ] Memory category disable UI in settings
- [ ] Workflow retry alerting in Sentry
- [ ] Cost controls on model token usage

## Verification checklist

```bash
npm test -- tests/learner-agent
npm run typecheck
npm run lint
npm run build
cd workers/learner-agent && npm install && npm run typecheck
npx wrangler deploy --dry-run  # worker
```

## File touch map (intended)

| Area | New files |
|------|-----------|
| Engine | `lib/services/learner/*` |
| Agent | `lib/services/learnerAgent/*` |
| API | `functions/api/learner-agent/*` |
| Worker | `workers/learner-agent/*` |
| UI | `components/learnerAgent/*`, `hooks/useLearnerAgent.ts` |
| Tests | `tests/learner-agent/*` |
| Docs | `docs/architecture/*`, `docs/runbooks/*`, etc. |

## Risk register

| Risk | Mitigation |
|------|------------|
| Pages cannot host DO | Separate worker; Pages connect proxy |
| Fragmented study plan services | Single `learnerNextActionService` facade |
| Auth doc says Supabase | Clerk verified; documented |
| No Graphiti | PG graphRag for grounding only |
| Test suite runtime | Scoped `tests/learner-agent` first |
