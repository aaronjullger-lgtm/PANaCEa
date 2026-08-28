# PANaCEa Builder Agent — Implementation Plan

**Date:** 2026-07-15  
**Design:** [2026-07-15-panacea-builder-agent-design.md](../specs/2026-07-15-panacea-builder-agent-design.md)

## Sprint 1 — Foundation (this PR)

- [x] Discovery document
- [x] Design spec + this plan
- [ ] `lib/builder-agent/state` — types, Zod schema, FSM transitions
- [ ] `lib/builder-agent/approval` — policy + gate helpers
- [ ] `lib/builder-agent/idempotency` — key builder + in-memory/SQLite store interface
- [ ] `lib/builder-agent/observability` — events + redaction
- [ ] `lib/builder-agent/auth` — API key + webhook verification
- [ ] `lib/builder-agent/tools` — typed registry + mock/live adapters
- [ ] `lib/builder-agent/execution` — ExecutionBackend + LocalDev + Sandbox stub
- [ ] `lib/builder-agent/workflow/phases.ts` — phase metadata
- [ ] `lib/builder-agent/fixtures/dry-run.ts` — e2e fixture

## Sprint 2 — Worker runtime

- [ ] `workers/builder-agent/package.json` — `agents`, `@cloudflare/sandbox` (optional)
- [ ] `workers/builder-agent/wrangler.toml`
- [ ] `BuilderAgent` DO — RPC: `createRun`, `getRun`, `approve`, `cancel`, `listRuns`
- [ ] `BuildWorkflow` — 15 phases with `step.do`, approval waits
- [ ] `src/index.ts` — HTTP routes + webhook handlers
- [ ] `src/webhooks/handlers.ts` — GitHub/Linear/Sentry normalized intake

## Sprint 3 — Tests and docs

- [ ] Unit: auth, FSM, idempotency, approval, redaction
- [ ] Integration: workflow retry, approval pause/resume, duplicate webhook
- [ ] Dry-run e2e: full lifecycle fixture
- [ ] `docs/architecture/builder-agent.md`
- [ ] `docs/runbooks/builder-agent.md`
- [ ] `docs/configuration/builder-agent-secrets.md`
- [ ] `docs/migrations/builder-agent-control-plane-migration.md`

## Sprint 4 — Verification (this PR)

- [ ] `npm test -- tests/builder-agent`
- [ ] `npm run typecheck` (root + worker)
- [ ] `npm run lint` on new paths
- [ ] `npx wrangler deploy --dry-run` in worker dir
- [ ] Update vitest.config.ts include path

## File map

```
lib/builder-agent/
  state/types.ts
  state/schema.ts
  state/transitions.ts
  approval/policy.ts
  approval/gates.ts
  idempotency/keys.ts
  idempotency/store.ts
  observability/events.ts
  observability/redaction.ts
  auth/policy.ts
  auth/webhooks.ts
  tools/types.ts
  tools/registry.ts
  tools/github.ts
  tools/linear.ts
  tools/sentry.ts
  tools/docs.ts
  tools/coderabbit.ts
  execution/backend.ts
  execution/local-dev-backend.ts
  execution/sandbox-backend.ts
  workflow/phases.ts
  fixtures/dry-run.ts
  index.ts

workers/builder-agent/
  package.json
  wrangler.toml
  tsconfig.json
  src/index.ts
  src/env.ts
  src/agent/BuilderAgent.ts
  src/workflow/BuildWorkflow.ts
  src/webhooks/handlers.ts

tests/builder-agent/
  state-transitions.test.ts
  auth.test.ts
  idempotency.test.ts
  approval.test.ts
  redaction.test.ts
  tools.test.ts
  workflow-orchestrator.test.ts
  dry-run-e2e.test.ts
```

## Verification commands

```bash
# Unit + integration
npm test -- tests/builder-agent

# Typecheck (shared lib uses root tsconfig)
npm run typecheck

# Worker package
cd workers/builder-agent && npm install && npx tsc --noEmit

# Wrangler validate
cd workers/builder-agent && npx wrangler deploy --dry-run

# Lint new files
npm run lint -- lib/builder-agent tests/builder-agent workers/builder-agent
```

## Environment variables (names only)

See `docs/configuration/builder-agent-secrets.md`.

## Risks

| Risk | Mitigation |
|------|------------|
| Sandbox not enabled | LocalDev backend + explicit `kind` in responses |
| Missing Linear/GitHub tokens | Mock adapters; `integrationStatus: 'mocked'` in run state |
| Agents SDK API drift | Pin `agents@0.17.4`; worker isolated package |
