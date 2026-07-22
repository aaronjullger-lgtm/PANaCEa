# PANaCEa Builder Agent — Implementation Audit Matrix

**Date:** 2026-07-22  
**Branch:** `cursor/panacea-builder-agent-c72f`  
**PR:** #257 (draft)  
**Audit basis:** Code and tests only — not design documents.

## Status legend

| Status | Meaning |
|--------|---------|
| **Implemented** | Working in code with passing tests |
| **Partial** | Scaffolded; incomplete or only works in test/dry-run |
| **Mocked** | Returns fixtures; no verified external API |
| **Unverified** | Code path exists when token/env set; not integration-tested |
| **Blocked** | Explicitly fail-closed or disabled |
| **Missing** | Not implemented |

---

## Requirement matrix

| # | Requirement (from design) | Status | Evidence | Gaps / notes |
|---|---------------------------|--------|----------|--------------|
| 1 | Worker `panacea-builder-agent` | **Implemented** | `workers/builder-agent/wrangler.toml` | Not deployed |
| 2 | Durable Object `BuilderAgent` | **Partial** | `workers/builder-agent/src/agent/BuilderAgent.ts` | In-memory `setState`, not DO SQLite (`this.sql`) |
| 3 | Workflow `BuildWorkflow` | **Partial** | `workers/builder-agent/src/workflow/BuildWorkflow.ts` | Phases 8–13 are placeholders; Worker validation fails without Sandbox |
| 4 | Instance ID `workspace:{workspaceId}` | **Implemented** | `workers/builder-agent/src/index.ts` `agentStub()` | Tested via workspace isolation unit tests |
| 5 | Run ID `run_{uuid}` | **Implemented** | `BuilderAgent.startRun()` | — |
| 6 | Correlation ID propagation | **Partial** | Events include `correlationId` | Not wired to Sentry tags in Worker |
| 7 | HTTP API Bearer auth | **Implemented** | `lib/builder-agent/auth/policy.ts` | Empty API key throws 503 |
| 8 | Webhook HMAC-SHA256 | **Implemented** | `lib/builder-agent/auth/webhooks.ts` | `timestamp.body` format, timing-safe compare |
| 9 | Webhook replay protection | **Implemented** | `WEBHOOK_MAX_AGE_SECONDS=300` | Tested |
| 10 | Webhook delivery dedup | **Partial** | `intakeFromWebhook()` atomic `setState` | Simulated in tests; not DO integration test |
| 11 | WebSocket auth | **Missing** | `routeAgentRequest` only | No explicit WS API key check |
| 12 | Permission tiers (read/write/merge/deploy/infra/credentials) | **Partial** | `requirePermission` + `attempt*` RPCs | Service key only gets read+write; merge/deploy routes require perm then 501 |
| 13 | Workspace allowlist | **Implemented** | `lib/builder-agent/auth/workspace.ts` | `BUILDER_AGENT_ALLOWED_WORKSPACES` |
| 14 | Cross-workspace isolation | **Implemented** | `resolveAuthorizedWorkspace`, `bindIntakeToWorkspace` | Unit tests |
| 15 | State schema fields | **Partial** | `lib/builder-agent/state/types.ts` | `toolActivity` lightly used |
| 16 | DO SQLite tables (runs, idempotency, approvals, event_log) | **Missing** | Agent uses `initialState` object | Design called for `this.sql` tables |
| 17 | FSM transitions | **Implemented** | `lib/builder-agent/state/transitions.ts` | 36+ tests |
| 18 | 15-phase workflow | **Partial** | `BUILD_PHASES` + `BuildWorkflow` | implement/revise/ci are placeholders |
| 19 | `step.do()` per phase | **Implemented** | `BuildWorkflow.run()` loop | — |
| 20 | `waitForApproval` + resume | **Partial** | `this.waitForApproval(step)` + `approveWorkflow()` | Tested in lib; not Worker integration test |
| 21 | Approval expiry | **Implemented** | `approval/gates.ts` | Tested |
| 22 | Merge never auto | **Blocked** | `prohibitedWithoutApproval`, dry-run blocks merge | 403/501 on API |
| 23 | Deploy/infra/credentials blocked | **Blocked** | `attemptDeploy` etc. | 501 after permission check |
| 24 | Idempotency keys | **Partial** | `withIdempotency`, webhook keys | Workflow uses `InMemoryIdempotencyStore` (lost on retry) |
| 25 | Tool registry (github, linear, sentry, docs, coderabbit) | **Partial** | `lib/builder-agent/tools/` | Typed adapters; live paths unverified |
| 26 | ExecutionBackend interface | **Implemented** | `execution/backend.ts` | — |
| 27 | LocalDev for tests/dry-run only | **Implemented** | `selectExecutionBackend('test')` | Worker never selects LocalDev |
| 28 | Sandbox for Worker | **Blocked** | `SandboxExecutionBackend` | `runCommand` throws even when "available" |
| 29 | Fail closed without backend | **Implemented** | `UnavailableExecutionBackend` | Tested |
| 30 | Dry-run default mandatory | **Implemented** | `BUILDER_AGENT_DRY_RUN=true`, `startRun()` logic | Client `dryRun:false` alone insufficient |
| 31 | GitHub branch/PR/CI (live) | **Unverified** | `tools/github.ts` | Token presence ≠ verified; Worker fails closed |
| 32 | Linear/Sentry webhooks | **Partial** | `webhooks/handlers.ts` | Normalization only; no outbound live |
| 33 | Observability events | **Implemented** | `observability/events.ts` | Console JSON only |
| 34 | Secret redaction | **Implemented** | `observability/redaction.ts` | Tested |
| 35 | Tool timeout/output bounds | **Partial** | `tools/guard.ts` | Rate limiter added; not wired into all adapters |
| 36 | Specification (LLM) | **Missing** | Static template in dry-run fixture | `capabilities.ts`: placeholder |
| 37 | Planning (LLM) | **Missing** | Static template | placeholder |
| 38 | Implementation (code gen) | **Missing** | `implement` phase pushes artifact name | placeholder |
| 39 | Revision loop | **Partial** | Dry-run fixture only | Worker `revise` is placeholder |
| 40 | CI monitoring (live) | **Unverified** | GitHub adapter | Mocked in dry-run |
| 41 | Cancel + terminate workflow | **Partial** | `cancelRun` + `terminateWorkflow()` | FSM tested; no Worker integration test |
| 42 | Workflow retry on failure | **Partial** | Cloudflare Workflows default | No explicit test against deployed workflow |
| 43 | `retryCount` / max revision 5 | **Partial** | Dry-run increments | Worker does not enforce max 5 |
| 44 | Health endpoint | **Implemented** | `GET /health` | Returns capabilities summary |
| 45 | Wrangler DO + Workflow bindings | **Implemented** | `wrangler.toml` | `wrangler deploy --dry-run` passes |
| 46 | Unit test suite | **Implemented** | `tests/builder-agent/*.test.ts` | 65+ tests |
| 47 | Dry-run e2e fixture | **Implemented** | `fixtures/dry-run.ts` | Full lifecycle with CI failure → revision |
| 48 | No production workflow changes | **Implemented** | No edits to `.github/workflows` for builder | — |
| 49 | No admin UI | **Implemented** | No new UI components | — |
| 50 | Agents SDK API usage | **Partial** | `agents@0.17.4`, `AgentWorkflow`, `waitForApproval` | `runWorkflow('BUILD_WORKFLOW')` unverified against deployed binding |

---

## Test scenario coverage map

| Scenario | Test file | Status |
|----------|-----------|--------|
| Auth (API key) | `auth.test.ts` | Covered |
| Webhook HMAC + timestamp + replay | `webhooks-hardening.test.ts` | Covered |
| Webhook normalization | `webhooks.test.ts` | Covered |
| Duplicate webhook delivery | `webhook-dedup.test.ts` | Simulated |
| Workspace isolation | `workspace-isolation.test.ts` | Covered |
| FSM transitions | `state-transitions.test.ts` | Covered |
| Approval expiry / double-resolve | `fsm-approval-hardening.test.ts` | Covered |
| Prohibited merge/deploy/infra/credentials | `prohibited-actions.test.ts`, `dry-run-e2e.test.ts` | Covered |
| Execution fail-closed (Worker) | `select-backend.test.ts` | Covered |
| Sandbox stub failure | `select-backend.test.ts` | Covered |
| Tool timeout | `prohibited-actions.test.ts` | Covered |
| Tool rate limit | `cancellation-and-lifecycle.test.ts` | Covered |
| Idempotency | `idempotency.test.ts` | Covered |
| Dry-run full lifecycle | `dry-run-e2e.test.ts` | Covered |
| CI failure → revision | `dry-run-e2e.test.ts` | Covered |
| Test failure → failed run | `dry-run-e2e.test.ts` | Covered |
| Plan approval pause | `dry-run-e2e.test.ts` | Covered |
| Cancellation FSM | `cancellation-and-lifecycle.test.ts` | Covered |
| Capability honesty boundary | `capabilities.test.ts` | Covered |
| Agent connect event type | `cancellation-and-lifecycle.test.ts` | Event schema only |
| WebSocket disconnect/reconnect | — | **Missing** (no WS client test) |
| Worker workflow integration | — | **Missing** (requires miniflare/deploy) |
| Live GitHub/Linear/Sentry | — | **Not tested** (by design) |

---

## Autonomous builder boundary (honest assessment)

**What works today:** Durable run orchestration shell — intake (HTTP + webhooks), workspace-scoped DO routing, FSM state tracking, approval metadata, webhook dedup, dry-run lifecycle fixture, fail-closed security for production mutations.

**What does NOT work:** Autonomous specification, planning, code implementation, test execution in the deployed Worker (without Sandbox), live PR/CI/revision loops, or merge/deploy.

See `lib/builder-agent/capabilities.ts` and `GET /health` → `capabilities` field.

---

## Integration classification

| Integration | Classification |
|-------------|----------------|
| Cloudflare DO + Workflows (Agents SDK) | Implemented, partially tested |
| Cloudflare Sandbox | Blocked (stub; runCommand throws) |
| LocalDev execution | Mocked (test/dry-run only) |
| GitHub API | Implemented but **unverified** (token → live branch; no integration test) |
| Linear API | Mocked |
| Sentry API | Mocked |
| Context7 / docs | Mocked |
| CodeRabbit | Mocked |
| Sentry Worker reporting | Missing |
| Clerk user→workspace mapping | Missing (`BUILDER_AGENT_ALLOWED_USERS` not implemented) |

---

## Staging readiness

**Not ready for isolated staging dry-run deployment** until:

1. Worker integration test or manual smoke against `wrangler dev` confirms DO + Workflow binding
2. `BUILDER_AGENT_API_KEY` and `BUILDER_AGENT_WEBHOOK_SECRET` secrets provisioned
3. Sandbox decision documented (enable binding or accept fail-at-validate for Worker path)

**Smallest next milestone:** Deploy to a **dedicated staging Worker** (not production Pages) with `BUILDER_AGENT_DRY_RUN=true`, run `POST /api/runs` + webhook smoke, verify DO state and workflow instance creation — no external integrations.

---

## Actions requiring explicit approval

- Production Worker deploy (`wrangler deploy`)
- Setting `BUILDER_AGENT_DRY_RUN=false`
- Enabling `BUILDER_AGENT_SANDBOX_ENABLED` + Containers binding
- Provisioning `GITHUB_TOKEN` / `LINEAR_API_KEY` / `SENTRY_AUTH_TOKEN` for live writes
- Schema/DO SQLite migration (`this.sql` tables)
- Merge/deploy/infrastructure/credential execution (by design blocked until v2)
- Modifying existing `.github/workflows` or production cron paths
