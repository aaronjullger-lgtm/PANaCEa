# Learner Agent Architecture

**Status:** Implemented (feature-flagged)  
**Discovery:** [learner-agent-current-state.md](./learner-agent-current-state.md)  
**Design:** [../superpowers/specs/2026-07-15-panacea-learner-agent-design.md](../superpowers/specs/2026-07-15-panacea-learner-agent-design.md)

## Overview

The PANaCEa Learner Agent is a durable, learner-facing coach that answers *what to study next* by orchestrating existing deterministic services. It is **not** a replacement for FSRS, study-plan math, or mastery estimation.

## Components

| Layer | Location | Role |
|-------|----------|------|
| Deterministic engine | `lib/services/learner/` | Context, due items, NBA ranking, sessions |
| Agent tools | `lib/services/learnerAgent/tools/` | Typed tool boundary for the model |
| Pages API | `functions/api/learner-agent/` | Auth, NBA, session, memory, stateless run |
| Durable agent | `workers/learner-agent/` | WebSocket continuity, workflows, schedules |
| UI | `components/learnerAgent/LearnerAgentPanel.tsx` | Compact dashboard panel |

## Request flows

### Deterministic recommendation (no model)

```
Client → GET /api/learner-agent/recommendation
       → resolveOrCreateUserRecord (Clerk)
       → getNextBestAction(prisma, userId)
       → Postgres read-only aggregates
```

### Agent turn (model explains, tools decide)

```
Client → POST /api/learner-agent/run
       → runAgent + learner tools
       → get_next_best_action (read) — model must use result
       → start_study_session (write) — session row only
```

### Durable session (worker)

```
Client → POST /api/learner-agent/connect → WebSocket URL + token
       → LearnerAgent DO validates token via KV
       → State: objective, pending recommendation, session id
       → StudyPlanRevisionWorkflow on adjust
```

## Deterministic boundary

FSRS stability, difficulty, and `nextReviewAt` are updated **only** by `lib/services/drillReviewService.ts`. The learner agent:

- **May** call `get_next_best_action`, `get_due_learning_items`, `retrieve_grounded_content`
- **May** create `StudySession` rows and complete them with aggregate stats
- **Must not** import `lib/fsrs.ts` or write `UserProgress` FSRS fields directly

## Feature flag

- Server: `ENABLE_LEARNER_AGENT=true`
- Client: `VITE_ENABLE_LEARNER_AGENT=true`

## Auth note

Product docs reference Supabase auth; this repository uses **Clerk** for session authentication. Postgres remains hosted on Supabase.

## Deployment

Pages Functions deploy with the main app. The Learner Agent Worker deploys separately:

```bash
cd workers/learner-agent && npm install && npx wrangler deploy
```

Set `LEARNER_AGENT_WORKER_URL` on the Pages project to the worker URL.

## Related docs

- [Data ownership](./learner-agent-data-ownership.md)
- [Runbook](../runbooks/learner-agent.md)
- [Evaluations](../evaluations/learner-agent-evaluations.md)
- [Secrets](../configuration/learner-agent-secrets.md)
