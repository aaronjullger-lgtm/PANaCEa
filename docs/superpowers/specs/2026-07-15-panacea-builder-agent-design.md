# PANaCEa Builder Agent — Design Specification

**Date:** 2026-07-15  
**Status:** Pre-approved architecture (adapted to repo evidence)  
**Discovery:** [builder-agent-current-state.md](../architecture/builder-agent-current-state.md)

## 1. Purpose

One internal Cloudflare agent converts ideas, audits, bugs, Sentry issues, Linear tasks, and GitHub issues into reviewed, tested pull requests — with durable state, approval gates, and idempotent side effects.

## 2. Agent identity and instance naming

| Concept | Value |
|---------|-------|
| Worker name | `panacea-builder-agent` |
| Durable Object class | `BuilderAgent` |
| Workflow class | `BuildWorkflow` |
| Instance ID | `workspace:{workspaceId}` — one DO per authorized workspace (default workspace: `panacea`) |
| Run ID | `run_{ulid}` — unique per build run |
| Correlation ID | Propagated to Sentry tags, workflow instance ID, PR body footer |

Authorized users map to workspaces via `BUILDER_AGENT_ALLOWED_USERS` (comma-separated Clerk user IDs or emails) and admin role in Clerk.

## 3. Authentication and authorization

### Inbound

- **HTTP API:** `Authorization: Bearer <BUILDER_AGENT_API_KEY>`
- **Webhooks:** HMAC-SHA256 (`X-Builder-Signature`) with `BUILDER_AGENT_WEBHOOK_SECRET`
- **WebSocket:** Same API key on connect; Clerk JWT optional for UI clients (future)

### Permission tiers

| Tier | Capabilities |
|------|--------------|
| `read` | Intake, context, spec/plan draft, status |
| `write` | Branch, commit, PR, Linear comment |
| `merge` | Merge PR (requires approval record) |
| `deploy` | Production deploy (requires approval) |
| `infrastructure` | Wrangler/schema/migration apply |
| `credentials` | Secret rotation |

Default service key: `read` + `write`. Merge/deploy/infra/credentials require explicit approval tokens.

## 4. State schema

See `lib/builder-agent/state/types.ts`. Required fields:

- `runId`, `requestingUser`, `taskSource`, `sourceId`
- `repository`, `baseBranch`, `objective`
- `status` (FSM enum)
- `specRef`, `planRef`
- `currentStep`, `completedCheckpoints`
- `pendingApprovals`, `toolActivity`
- `testResults`, `ciResults`
- `prUrl`, `branchName`, `artifacts`
- `retryCount`, `errorSummary`
- `createdAt`, `updatedAt`, `correlationId`

SQLite tables in DO (via Agents SDK `this.sql`):

- `runs` — run metadata
- `idempotency_keys` — side-effect dedup
- `approval_records` — decisions with expiry
- `event_log` — structured observability (sanitized)

## 5. Status model

```
intake → analyzing → awaiting_plan_approval → approved → executing → testing
  → awaiting_pr_review → revising → awaiting_merge_approval → completed
failed | canceled (terminal from most states)
```

Invalid transitions rejected at agent RPC layer. Duplicate webhook deliveries are no-ops when idempotency key exists.

## 6. Workflow lifecycle (15 phases)

1. Intake and normalization  
2. Context collection  
3. Risk and scope classification  
4. Specification creation  
5. Implementation planning  
6. Approval when required (`awaiting_plan_approval`)  
7. Workspace preparation (execution backend)  
8. Implementation  
9. Local validation (test/lint/typecheck/build)  
10. Branch and commit creation  
11. Pull-request creation  
12. CI and review monitoring  
13. Revision loop (`revising`)  
14. Final approval (`awaiting_merge_approval`) — merge blocked  
15. Completion and audit summary  

Each phase = one or more `step.do()` blocks in `BuildWorkflow`.

## 7. Tool registry

Typed adapters in `lib/builder-agent/tools/`:

| Tool | Read | Write | Notes |
|------|------|-------|-------|
| `github` | repo, branches, issues, PRs, checks, reviews | branch, commit, PR | Never merge without approval |
| `linear` | issue, links | progress comment | Idempotent comment keys |
| `sentry` | issue, stack, release | — | No auto-resolve |
| `docs` | Context7 / fetch URL | — | Record source URLs |
| `coderabbit` | PR review comments | — | Validate before apply |
| `execution` | — | shell in sandbox/local | Command allowlist |

Registry pattern mirrors `lib/services/agents/toolRegistry.ts` but for engineering operations.

## 8. Execution backend

```typescript
interface ExecutionBackend {
  readonly kind: 'local-dev' | 'sandbox' | 'mock';
  prepareWorkspace(repo: string, ref: string): Promise<WorkspaceHandle>;
  runCommand(handle, cmd, opts): Promise<CommandResult>;
  dispose(handle): Promise<void>;
}
```

- **v1 default:** `LocalDevExecutionBackend` — in-memory fixture workspace for tests/dry-run
- **Production:** `SandboxExecutionBackend` when `BUILDER_AGENT_SANDBOX_ENABLED=true` and account supports `@cloudflare/sandbox`
- **Never** falsely report remote execution

## 9. Approval policy

| Action | Auto | Approval required |
|--------|------|-------------------|
| Spec/plan (low risk) | Yes | No |
| Spec/plan (schema/infra/auth) | No | `plan` |
| Implementation | After plan approval | — |
| PR creation | After tests pass | No |
| Merge | Never auto | `merge` |
| Deploy | Never auto | `deploy` |
| DB migration apply | Never auto | `infrastructure` |
| Secret change | Never auto | `credentials` |

Approvals: `step.waitForEvent({ type: 'approval', timeout: '7d' })` + agent `approveRun(approvalId)`.

## 10. Idempotency

- Key format: `{runId}:{action}:{targetHash}`
- Stored in DO SQLite before external mutation
- Retries check store; duplicates return prior result
- Applies to: Linear comments, branches, commits, PRs, deployment attempts

## 11. Error handling and recovery

- Workflow steps retry with exponential backoff (Workflows default)
- `retryCount` incremented on phase failure
- After max retries → `failed` with sanitized `errorSummary`
- `revising` loop max 5 iterations then `failed`
- Cancel: user RPC → `canceled`, workflow `terminateWorkflow`

## 12. Observability

Structured events (`lib/builder-agent/observability/events.ts`):

`agent.connected`, `run.created`, `state.transition`, `workflow.phase`, `tool.invoked`, `approval.requested`, `approval.resolved`, `retry`, `test.result`, `pr.created`, `ci.result`, `run.failed`, `run.canceled`

Sentry: tag `builder_agent.run_id`, `correlation_id` — no prompts, secrets, or full diffs.

## 13. Secret handling

Document names only in `docs/configuration/builder-agent-secrets.md`. Values via `wrangler secret put`. Redaction in `lib/builder-agent/observability/redaction.ts`.

## 14. Testing strategy

| Layer | Location |
|-------|----------|
| Unit | `tests/builder-agent/*.test.ts` |
| Integration | Mock tool adapters |
| Dry-run e2e | `lib/builder-agent/fixtures/dry-run.ts` — no production repo mutations |

## 15. Rollout and migration

1. Deploy worker to staging with `BUILDER_AGENT_DRY_RUN=true`
2. Run dry-run e2e in CI
3. Compare against Cursor Cloud Agents (`docs/migrations/builder-agent-control-plane-migration.md`)
4. Enable write operations per workspace
5. Do **not** remove existing agents or cloud-agents.yml until comparison sign-off

## 16. Wrangler resources

```toml
# workers/builder-agent/wrangler.toml
durable_objects.bindings → BUILDER_AGENT
workflows → BUILD_BUILDFLOW
migrations → new_sqlite_classes = ["BuilderAgent"]
# optional: containers / sandbox binding when enabled
```

## 17. Out of scope (v1)

- Code Mode dependency
- Temporal / Inngest / n8n replacement
- Separate planner/tester/reviewer agents
- Production merge or deploy without approval
- Supabase duplicate state store
