# Builder Agent — Control Plane Migration Comparison

**Date:** 2026-07-15  
**Status:** Builder Agent v1 deployed alongside existing systems — **no retirement yet**

## Systems compared

| Capability | Cursor Cloud Agents (`scripts/cloud-agents/`) | Builder Agent (`workers/builder-agent/`) |
|------------|-----------------------------------------------|------------------------------------------|
| Runtime | Cursor-hosted VM | Cloudflare DO + Workflows |
| State | Cursor dashboard | DO SQLite + structured run state |
| Approval gates | None built-in | Plan/merge/deploy/infra/credentials |
| Idempotency | Manual (PR-based) | Keyed store per run |
| Webhooks | Optional callback URL | GitHub/Linear/Sentry normalized intake |
| Tool integrations | Repo context only | GitHub, Linear, Sentry, docs, CodeRabbit adapters |
| Test validation | Agent-discretion | Explicit validation phase + dry-run fixture |
| Merge/deploy | Can auto-create PR | PR yes; merge/deploy blocked without approval |
| Observability | Cursor UI | Structured events + Sentry correlation IDs |
| Cost model | Cursor API usage | Cloudflare Workers + optional Sandbox |

## Existing control plane (retain)

| Component | Action |
|-----------|--------|
| `lib/services/agents/` + `/api/agents/run` | **Retain** — clinical study agent |
| `functions/api/agents/{quality-check,...}` | **Retain** — admin audits |
| `components/admin/AgentControlPanel.tsx` | **Retain** — add Builder UI in future sprint |
| `functions/api/cron/agent-health-check.ts` | **Retain** |
| `docs/autoclaw/agents/*` | **Retain** — playbooks |
| `.github/workflows/cloud-agents.yml` | **Retain** until comparison sign-off |
| `scripts/cloud-agents/*` | **Retain** — fire-and-forget still valid |

## Migration criteria (all required before retirement)

- [ ] Builder Agent handles 10+ successful dry-run + 5+ staging runs
- [ ] GitHub PR creation idempotency verified under workflow retry
- [ ] Approval gates tested with real operators
- [ ] Sandbox enabled OR documented LocalDev limitation accepted for implementation phase
- [ ] Linear progress comments idempotent under duplicate webhook delivery
- [ ] CI monitoring loop validated against real GitHub checks
- [ ] Sentry correlation IDs appear in Worker logs and app Sentry
- [ ] Aaron explicit sign-off on deprecating `cloud-agents.yml` path-scoped jobs

## Recommended phased rollout

1. **Phase A (current):** Deploy with `BUILDER_AGENT_DRY_RUN=true`, run `npm run builder-agent:test`
2. **Phase B:** Enable `GITHUB_TOKEN`, still dry-run false only on staging fork
3. **Phase C:** Wire admin UI to Builder Agent `/api/runs`
4. **Phase D:** Route high-risk engineering tasks to Builder Agent; keep Cloud Agents for path-scoped CI review
5. **Phase E:** Compare metrics; retire overlapping Cloud Agent jobs only after sign-off

## n8n

No n8n workflows exist in this repository. No n8n migration required.

## Decision log

| Date | Decision |
|------|----------|
| 2026-07-15 | Ship Builder Agent v1 without removing any existing agent infrastructure |
| 2026-07-15 | Default `BUILDER_AGENT_DRY_RUN=true` until production approval |
| 2026-07-15 | Merge execution returns 501 in v1 — approval recorded, merge manual |
