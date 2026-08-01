# Agent Orchestrator Runbook

The orchestration layer lives in [`packages/agent-orchestrator`](../../packages/agent-orchestrator) with a
control-plane dashboard in [`packages/agents-dashboard`](../../packages/agents-dashboard). Everything is
traced (Langfuse + LangSmith), uses Qdrant for long-term memory, and can file Linear issues / trigger n8n
workflows / read Sentry + GitHub. The setup was guided by the official docs + reference repos (LangGraph.js
quickstart, Langfuse LangChain integration, Qdrant JS client, `@mseep/linear-mcp-server`, Sentry MCP).

## Quick start

```bash
cd packages/agent-orchestrator
npm install --legacy-peer-deps        # already done if you're reading this

# 1. surface capability status (no LLM call)
npx tsx src/cli.ts --health

# 2. ensure Qdrant memory collections exist
npx tsx src/cli.ts --ensure-collections

# 3. offline build smoke — compiles every agent graph + binds tools, no API call
npx tsx src/smoke.test.ts

# 4. run an agent (needs real creds via 1Password or packages/agent-orchestrator/.env)
npm run run:content-audit
npm run run:pr-triage 1234
npm run run:incident-responder
npm run run:content-enrichment "Atrial fibrillation + 2023 ACC/AHA guideline"
npm run run:weekly-report
npm run smoke
```

## Environment

Copy [`packages/agent-orchestrator/.env.agents.example`](../../packages/agent-orchestrator/.env.agents.example) to
`packages/agent-orchestrator/.env` (gitignored), or rely on 1Password injection.

The orchestrator is alias-aware so it reads either name where the 1Password `PANaCEa` Environment uses a
different key than the orchestrator's preferred name:

| Orchestrator reads | 1Password alias |
|---|---|
| `LANGFUSE_HOST` | `LANGFUSE_BASE_URL` |
| `QDRANT_URL` | `QDRANT_ENDPOINT` |
| `VERCEL_TOKEN` | `VERCEL_API_KEY` |
| `LANGSMITH_API_KEY` | `LANGCHAIN_API_KEY` |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_AUTH_TOKEN` |

Secrets already present in the `PANaCEa` 1Password Environment: `GEMINI_API_KEY`, `LANGFUSE_*`,
`LANGSMITH_*`, `QDRANT_*`, `COMPOSIO_API_KEY`, `LINEAR_API_KEY`, `N8N_API_KEY`, `SENTRY_*`, `GITHUB_PAT`,
`CLOUDFLARE_*`, `VERCEL_API_KEY`.

Added (concealed placeholders, fill in the 1Password UI): `N8N_API_URL`, `LINEAR_TEAM_ID`, `GITHUB_REPO`,
`VERCEL_PROJECT_ID`, `ORCHESTRATOR_PORT/MODEL/ENV`, `QDRANT_URL`.

## Architecture

```
packages/agent-orchestrator/src/
├── config/env.ts            typed env + alias getters + capability flags
├── clients/
│   ├── tracing.ts           Langfuse CallbackHandler (dynamic optional dep)
│   ├── llm.ts               Gemini-first LLM factory (falls back OpenAI/Anthropic)
│   ├── qdrant.ts            long-term memory: runs/decisions/context collections
│   ├── linear.ts            @linear/sdk direct client
│   ├── github.ts            PR diff fetch + review post (raw fetch)
│   ├── sentry.ts            issue list + details (raw fetch)
│   └── integrations.ts      n8n trigger (webhook first, REST execute fallback) + Composio client
├── tools/index.ts           tool() wrappers per role (memory, linear, github, sentry, n8n)
├── orchestrator/factory.ts  createReactAgent + Langfuse callbacks + normalized invoke surface
├── agents/                  5 starter agents + registry
├── server/api.ts            HTTP API on :4100 (/health, /agents, /agents/:role/invoke, /memories)
├── cli.ts                   `npm run run:<role>`, --health, --ensure-collections, --smoke
└── index.ts                 public package surface
```

## Agents

| Role | Tools | Output |
|---|---|---|
| `content-audit` | Linear create/search, remember/recall, n8n trigger | Linear issues for actionable audit findings |
| `pr-triage` | GitHub get_pr_info/post_pr_review, Linear, memory | GitHub review COMMENT/APPROVE/REQUEST_CHANGES |
| `incident-responder` | Sentry list_issues, Linear, memory, n8n | Linear issues by severity + n8n on-call for P0 |
| `content-enrichment` | memory recall/remember, Linear | Structured enrichment candidates (confidence-gated) |
| `weekly-report` | memory recall, Linear, Sentry | Weekly markdown digest remembered to Qdrant |

## Tracing

- **Langfuse**: every `.invoke()` passes the `CallbackHandler` from `@langfuse/langchain`. Filter traces in
  the Langfuse UI by tags `panacea` + the agent role. Each agent run is one trace.
- **LangSmith**: env-driven — set `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` and LangGraph traces flow
  automatically (project `panacea-agents`). No per-call handler needed.
- Both can run simultaneously; Langfuse is the open-source long-term store, LangSmith is for LangChain-native
  eval/datasets.

## Dashboard (Vercel)

```bash
cd packages/agents-dashboard
npm install
npm run dev          # http://localhost:4300, proxies /api/orchestrator/* → :4100
# ORCHESTRATOR_API_URL=https://your-orchestrator-host npm run build && npm start
```

Deploy to Vercel; set `ORCHESTRATOR_API_URL` to the orchestrator's public URL. The dashboard proxies agent
invokes through a rewrite so the browser never holds the orchestrator's Bearer token.

**Edge production routes** (Cloudflare Pages): see [`docs/api/API_OVERVIEW.md`](../../api/API_OVERVIEW.md) for
`/api/agents/protocol`, `/api/agents/invoke`, `/api/agents/run`, Agent Protocol `runs`/`threads`, and MCP.

## MCP configuration

These were wired so agents-in-your-editor (Claude Code, Cursor, Codex, OpenCode) can also drive Linear + Qdrant
+ Composio + n8n directly:

- [`/Users/aaronullger/.config/opencode/opencode.json`](...) — `linear` + `qdrant` (enabled) + existing
  `composio`/`n8n`/`langfuse`/`sentry`/`supabase`/`cloudflare`
- [`/.mcp.json`](../../.mcp.json) — `linear`, `qdrant`, `composio`, `n8n` (in addition to existing `aidesigner`)
- [`/mcp_config.json`](../../mcp_config.json) — `linear`, `composio`, `n8n`, `qdrant` alongside existing servers
- [`/.codex/config.toml`](../../.codex/config.toml) — `linear`, `qdrant`, `composio`, `n8n`

The Linear MCP server is [`@mseep/linear-mcp-server`](https://www.npmjs.com/package/@mseep/linear-mcp-server)
(researched 2026-07; exposes `linear_create_issue`, `linear_search_issues`, `linear_add_comment`).
Qdrant MCP is [`qdrant-mcp-server`](https://www.npmjs.com/package/qdrant-mcp-server).

## Verification commands

```bash
cd packages/agent-orchestrator
npm run typecheck          # tsc --noEmit — clean (exit 0)
npm run smoke              # builds all 6 agent graphs, no API call — PASS
npx tsx src/cli.ts --health
npx tsx src/cli.ts --ensure-collections
npx tsx src/cli.ts --inspect    # report Qdrant collection status + config
```

## v2 improvements (Phases 1–5)

### Phase 1 — Safety net + DX

**LangGraph Studio** (`langgraph.json` at package root):
```bash
npm run langgraph:dev      # boots LangGraph Studio UI — visualizes all 6 graphs live
```
Graph entry files live in `src/graphs/*.graph.ts`. Studio shows node execution, message history, and state inspection.

**Langfuse monitors** — proactive alerting on agent failures:
```bash
npm run monitors:provision   # provisions 4 monitors via Langfuse REST API
```
Monitors: `panacea-agent-error` (ERROR traces), `panacea-agent-cost-spike` (3× cost), `panacea-incident-responder-latency` (>90s), `panacea-pr-triage-failure-rate` (>20%).
Set `LANGFUSE_MONITOR_WEBHOOK_URL` in `.env.agents` to route alerts to Slack/Discord.

**CI gate** — `.github/workflows/agent-orchestrator-smoke.yml` runs typecheck + smoke on every PR touching `packages/agent-orchestrator/**`.

### Phase 2 — Reliability

**Checkpoint resume** — agent runs survive crashes/rate-limits:
- SQLite checkpoint saver at `.checkpoint/orchestrator.sqlite` (gitignored)
- Re-invoking the same agent with the same `threadId` resumes from the last checkpoint
- Set `ORCHESTRATOR_CHECKPOINT=off` to disable (e.g. serverless/ephemeral)
- Falls back to in-memory `MemorySaver` if `@langchain/langgraph-checkpoint-sqlite` is missing

**LLM-as-judge eval pipeline** — scores agent output quality:
```bash
npm run eval:judge                      # all roles, last 24h
npm run eval:judge -- incident-responder 168   # single role, 7 days
```
Posts `correctness` (0–1) + `severity_appropriateness` (0–1) scores back to each Langfuse trace. Each role has a specific rubric (see `src/eval/judge.ts`). Cost guardrail: one judge call per trace, bounded by the time window.

### Phase 3 — Qdrant optimization

**Payload indexing** — O(log n) filtered recall:
- `runs`: indexed on `role`, `startedAt`, `via`, `error`
- `decisions`: indexed on `kind`, `severity`, `conditionId`
- `context`: indexed on `source`, `conditionId`

**Scalar quantization** — int8 quantization (`quantile: 0.99, always_ram: true`) on all 3 collections cuts memory ~3× with negligible recall loss.

**Hybrid dense+sparse retrieval (RRF)** — the `decisions` collection has a BM25 sparse vector index alongside dense. `recallHybrid()` fuses both retrievals via reciprocal rank fusion (`rrf_k: 60`). The `recallMemoryTool` automatically uses hybrid for decisions (exact clinical-term matches get priority over pure semantic similarity). Other collections fall back to plain dense.

Inspect: `npx tsx src/cli.ts --inspect` reports collection status.

### Phase 4 — Agent capability

**Managed prompts** — agent system prompts live in Langfuse (versioned, A/B-deployable), with code constants as fallback:
```bash
npm run prompts:push   # uploads all 5 in-code prompts to Langfuse managed prompts
```
After pushing, edit prompts in the Langfuse UI without a package release. The `resolvePrompt()` resolver fetches managed versions at agent-build time and falls back to the code constant (`src/clients/seedPrompts.ts`) if Langfuse is down or the prompt is missing. Source of truth for the text is `seedPrompts.ts` (leaf module — breaks the circular dependency that would otherwise arise).

**Composio tool surface** — the incident-responder's Linear + Sentry tools now route through `clients/composio.ts` (Composio SDK's pre-built authenticated actions) with graceful fallback to the raw-fetch clients. Set `COMPOSIO_CONNECTED_USER` (a stable user-id Composio recognizes) after linking Linear + Sentry in the Composio dashboard. When unset, tools use the direct SDK/fetch path transparently.

**Weekly-report supervisor** — a multi-agent supervisor graph (`@langchain/langgraph-supervisor` `createSupervisor`) that delegates to the `incident-responder` and `content-audit` sub-agents, then synthesizes their results into the weekly digest. Falls back to a standard ReAct agent if the supervisor graph build fails. Registered as `weekly-report-supervisor` in the agent registry with its own Studio graph entry.

### Phase 5 — Live streaming

**Server SSE endpoint** — `POST /agents/:role/invoke-stream` streams LangGraph `streamEvents` (v2) as Server-Sent Events:
- `on_chat_model_stream` — token-by-token LLM output
- `on_tool_start` / `on_tool_end` — tool call lifecycle
- `complete` / `done` / `error` — terminal events

**Dashboard streaming** — the run dialog has a "Stream live" checkbox (default on). When enabled, the dashboard uses `streamAgent()` (fetch + ReadableStream reader) to consume the SSE endpoint, showing live token output as the agent reasons + calls tools. Falls back to the non-streaming `invokeAgent()` POST if the orchestrator returns a non-SSE response.

## Guardrails honored

- No LLM bulk calls — every agent run is a single, gated `npm run run:<role>` / dashboard button.
- No changes to Prisma schema, Cloudflare deploy, or the PANaCEa product runtime.
- Orchestrator is a self-contained workspace package (own node_modules) — never bundled into the client.
- Clinical-content agents never assert medical claims without a source citation (enrichment prompt).
- Agents file Linear issues for *human* action; they never mutate the DB or auto-resolve Sentry.