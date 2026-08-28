# PANaCEa Builder Agent — Current State Discovery

**Date:** 2026-07-15  
**Branch at discovery:** `main` @ `1f0d0ed5`  
**Agent run:** Cloud Agent `cursor/panacea-builder-agent-c72f`

## Executive summary

PANaCEa has **production Gemini-based content/infra agents** (Pages Functions + `lib/services/agents`) and **Cursor Cloud Agents** (external API scripts + GitHub Actions). It does **not** yet have a Cloudflare Agents SDK Durable Object orchestrator that converts issues into durable, approval-gated PR workflows. This document records repository evidence and the responsibility matrix for the new Builder Agent.

## Repository snapshot

| Item | Value |
|------|-------|
| Package manager | npm (`package.json`, lockfile) |
| Node | 22 (`.node-version`) |
| Primary deploy | Cloudflare Pages (`wrangler.toml`, `dist/`) |
| Secondary workers | `crons/panacea-cron-worker/` (cron proxy), `workers/osce-session.ts` (DO stub, not bound in Pages) |
| Test runner | Vitest 4.x (`npm test`) |
| Typecheck | `npm run typecheck` (`tsconfig.production.json`) |
| Lint | `npm run lint` (ESLint) |
| Build | `npm run build` (Vite) |
| E2E | Playwright (`npm run test:e2e`) |
| Git status at discovery | Clean on `main` |

## Existing agent / automation inventory

### Retain (wrap, do not remove)

| Component | Location | Role |
|-----------|----------|------|
| Clinical study agent loop | `lib/services/agents/agentRunner.ts`, `functions/api/agents/run.ts` | Student-facing Gemini tool loop (read-only clinical tools) |
| Production admin agents | `functions/api/agents/{quality-check,coverage-audit,infra-health,verify-condition}/` | Content/infra audits via Gemini |
| Agent control UI | `components/admin/AgentControlPanel.tsx`, `pages/admin/AgentControlPage.tsx` | Admin trigger surface |
| Agent health cron | `functions/api/cron/agent-health-check.ts` | Scheduled infra/content checks |
| Cursor Cloud Agents client | `scripts/cloud-agents/client.ts`, `docs/automation/CLOUD_AGENTS_API.md` | External cloud agent launches |
| Cloud Agents CI | `.github/workflows/cloud-agents.yml`, `.github/workflows/agent-verify.yml` | Path-scoped review agents |
| Autoclaw documentation | `docs/autoclaw/agents/*` | Human/agent workflow playbooks (not runtime) |
| Cron worker | `crons/panacea-cron-worker/` | Pages cron proxy (no business logic) |
| Skill registry | `.agents/skills/`, `.claude/skills/` | Prompt/skill routing for IDE agents |

### No evidence found

| Item | Result |
|------|--------|
| n8n workflows | Not present in repo |
| Temporal / Inngest | Not present |
| Cloudflare Agents SDK (`agents` npm) | Not installed at root |
| Cloudflare Workflows bindings | Not configured |
| Cloudflare Sandbox (`@cloudflare/sandbox`) | Not configured |
| Linear SDK / webhooks | No integration code |
| CodeRabbit API client | No integration code |
| Context7 client | No integration code |
| Builder Agent | Does not exist |

### GitHub / Sentry (partial)

| Integration | Status |
|-------------|--------|
| GitHub Actions CI | `.github/workflows/*` — build, test, deploy, cloud-agents |
| Sentry (app) | `@sentry/react`, `lib/monitoring/sentry.ts`, `functions/api/sentry-tunnel.ts` |
| Sentry (agent) | Breadcrumbs via agent runner logging; no issue-fetch adapter |

## Cloudflare platform assessment

| Capability | Repo status | Notes |
|------------|-------------|-------|
| Pages Functions | Production | `functions/api/` — Edge handlers, KV, Prisma |
| Durable Objects | Commented out | OSCE DO exists but Pages cannot deploy DO from this project |
| Workers (standalone) | `crons/panacea-cron-worker` pattern | Correct home for Builder Agent |
| Agents SDK (`agents@0.17.x`) | To be added | Worker-scoped dependency |
| Workflows | To be added | `AgentWorkflow` + wrangler workflow binding |
| Sandbox (`@cloudflare/sandbox@0.12.x`) | **Unknown account availability** | Paid plan required; implement `ExecutionBackend` with local/mock fallback |
| Queues | Not required initially | No fan-out/backpressure need for v1 |

Official docs consulted (2026-07-15):

- [Cloudflare Agents — Run Workflows](https://developers.cloudflare.com/agents/runtime/execution/run-workflows/)
- [Cloudflare Sandbox SDK](https://developers.cloudflare.com/sandbox/) — Workers Paid plan

## Authentication patterns in repo

- **Clerk** — user auth for Pages Functions (`functions/api/_shared/auth.ts`, `authenticatedEndpoint`)
- **CRON_SECRET** — bearer token for cron endpoints
- **CURSOR_AGENTS_API_KEY** — Basic auth for external Cursor Cloud Agents API
- **1Password / Cloudflare secrets** — documented in `docs/deployment/CLOUDFLARE_ENV_SETUP.md`; no secrets in docs

Builder Agent will add:

- `BUILDER_AGENT_API_KEY` — service-to-service auth for worker HTTP/WebSocket
- `BUILDER_AGENT_WEBHOOK_SECRET` — HMAC for GitHub/Linear/Sentry webhooks
- Per-integration tokens (GitHub App or PAT, Linear API, Sentry auth token) as secrets only

## Database / Supabase

- **Canonical app data:** PostgreSQL via Prisma (`prisma/schema.prisma`) — retain
- **Agent operational state:** SQLite inside BuilderAgent Durable Object (Agents SDK) — new, not duplicated in Supabase
- **No new Supabase tables** for agent runs in v1

## Responsibility matrix

| Responsibility | Owner (source of truth) | Builder Agent role | Migration |
|----------------|-------------------------|-------------------|-----------|
| Code, branches, commits, PRs | GitHub | Create branch/commits/PR; never merge without approval | Wrap Cursor Cloud Agents for fire-and-forget; Builder Agent becomes primary for internal engineering |
| Project tasks | Linear (when integrated) | Read issues; idempotent progress comments | New typed adapter; credentials required |
| Production errors | Sentry | Read issues/stack traces; correlate to code | New typed adapter |
| PR review | CodeRabbit | Ingest review comments as revision input | Read-only adapter; no blind apply |
| Documentation lookup | Context7 / official docs | Query current API docs | Adapter with URL recording |
| Secrets | 1Password + Cloudflare secrets | Never log values; document names only | No change |
| Student clinical agent | `lib/services/agents` | **No overlap** — separate product surface | Retain |
| Admin audit agents | `functions/api/agents/*` | **No overlap** — content/infra audits | Retain |
| Cursor Cloud Agents | `scripts/cloud-agents/` | Legacy external runner until migration comparison passes | Migrate comparison doc required before retirement |
| Autoclaw playbooks | `docs/autoclaw/` | Reference for workflow phases | Retain as documentation |
| Cron scheduling | `crons/panacea-cron-worker` | Unchanged | Retain |

## Recommended implementation location

```
workers/builder-agent/     # Cloudflare Worker (Agents SDK + Workflows)
lib/builder-agent/         # Shared types, FSM, tools, execution backends (Vitest-testable)
tests/builder-agent/       # Unit, integration, dry-run e2e
docs/architecture/         # Architecture + migration
docs/runbooks/             # Operations
docs/configuration/        # Secret name documentation
```

Pages Functions may expose a thin authenticated proxy (`functions/api/builder-agent/*`) in a follow-up; v1 routes directly to the Worker.

## Blockers and risks

1. **Sandbox availability** — account may not have Containers/Sandbox; v1 uses `LocalDevExecutionBackend` + documented Sandbox enablement path.
2. **Linear / CodeRabbit / Context7 credentials** — adapters ship mocked until secrets configured.
3. **DO deployment** — separate Worker deploy required (same pattern as cron worker).
4. **Cost guardrail** — LLM calls for spec/plan/implementation must be bounded; approval gates before expensive execution.

## Next steps

1. Design spec: `docs/superpowers/specs/2026-07-15-panacea-builder-agent-design.md`
2. Implementation plan: `docs/superpowers/plans/2026-07-15-panacea-builder-agent-implementation.md`
3. Implement `workers/builder-agent` + `lib/builder-agent` + tests
4. Migration comparison before retiring Cursor Cloud Agents control paths
