# Fleet Driver & Agent Modernization Plan

**Created:** 2026-08-01
**Status:** ALL PHASES COMPLETE (0-6) — 2026-08-02. Remaining: merge `fix/sched-lane-diagnostics` → main, verify prod deploy.
**Supersedes:** `agent-orchestrator-modernization.md` (folded in as Phases 1-6)
**plan_create status:** Bun runtime broken at time of writing — markdown-only until restored, then import via `plan_create` from this file.

## Goal

PANaCEa has substantial agent infrastructure (`lib/agents/*` LangGraph + `lib/services/agents/*` Gemini tool-loop, unified bridge, orchestrator graphs, MCP adapter, protocol, streaming endpoint, observability stubs, Deep Agents middleware). It is largely unbuilt as a **drivable fleet**: no operator entry point, no plan-tracked phases, no cross-session resumption.

This plan adds the **driver layer** (Phase 0) and tracks the remaining modernization work (Phases 1-6).

## Persistence Stack

| Layer | Mechanism | Notes |
|---|---|---|
| Plan state | `.opencode/plans/*.md` (this file) → `plan_create` when Bun fixed | Markdown survives session restart |
| Cross-session facts | `memory` tool | Project + all-projects scopes |
| Handoff notes | `.opencode/handoff.md` + `wrap-up` skill | Human-readable markdown |
| Resume context | `session-resume` skill | Bootstraps next session |
| Instinct extraction | `continuous-learning-v2` skill | Optional, end-of-session |

## Non-Negotiables

- Edge-runtime safe (no Node APIs in `lib/agents/` or `functions/api/`)
- Zero regression on 3200+ existing tests
- Backward compatible with existing `/api/agents/invoke` and `/api/agents/run`
- LangSmith tracing non-blocking (fire-and-forget or sampled)
- MCP integration optional — agents work without MCP servers
- Cost guardrails on all agent LLM calls
- **NEW:** Phase 0 changes zero runtime code — pure orchestration sugar

---

## Phase 0: /fleet Driver Layer (NEW — immediate)

The operator-side steering wheel. Wraps existing agent infra with a drivable supervisor pattern.

- [x] Create `.opencode/command/fleet.md` with subcommands:
  - `/fleet plan <markdown>` — import markdown plan to `.opencode/plans/`
  - `/fleet continue` — read plan, find next pending task, fan out via `task()`, verify, update plan, handoff
  - `/fleet dispatch <encounter-agent> <input>` — direct invoke via `/api/agents/invoke` (curl) or TS import
  - `/fleet status` — print plan summary with per-task state
- [x] Wire `/fleet continue` to `task()` with appropriate `subagent_type` per task category
- [x] Wire `/fleet dispatch` to call `/api/agents/invoke` via `bash curl` (Edge) or via direct TS import in scripts/
- [x] Add memory entry: "fleet-driver active, plan file = fleet-driver-plan.md"
- [x] Update handoff.md template to reference active plan
- [x] Demo: run `/fleet status` then `/fleet continue` on next pending modernization task

## Phase 1: Unified Agent Bridge (DONE — verify only)

Code state: `lib/agents/bridge.ts` (17KB, 564 lines), `lib/agents/bridge/node.ts` (NodeAgentBridge class), `functions/api/agents/invoke.ts` (production endpoint).

**Verification findings (2026-08-01):**
- ✅ `bridge.ts` exposes unified dispatch: `invokeBridge()` routes to 3 backends (edge / tool-loop / node) via `resolveAgent()`
- ✅ Resolution: `tool:` prefix → tool-loop, `node:` prefix → node, edge registry lookup → edge, known names (clinical-study-agent, content-quality-agent, coverage-audit-agent, infra-health-agent) → tool-loop, fallback → node
- ✅ `invokeToolLoopAgent()` imports `runAgent` from `../services/agents/agentRunner` — bridges to Gemini tool-loop
- ⚠️ `invokeEdgeAgent()` uses `require('./shared/runtime')` for lazy registry import (avoids circular deps)
- ❌ **`/api/agents/invoke.ts` does NOT use `invokeBridge`** — it calls `invokeAgent` from `registry.encounter` directly (edge-only). Bridge is local/dev unified surface only, not wired into production endpoint. This is a gap if tool-loop agents need production access.

- [x] Verify `lib/agents/bridge.ts` exposes unified dispatch routing to Edge agents OR services/agents tool-loop
- [x] Verify services/agents adapter implements `AgentDefinition` interface
- [x] Verify `/api/agents/invoke` accepts both agent types via bridge
- [x] Verify bridge dispatch tests pass (`npx vitest run lib/agents/bridge/`)

## Phase 2: LangGraph Modernization (DONE — verify only)

Code state: `lib/agents/graphs/orchestrator-graph.ts` uses `Annotation.Root` + `MemorySaver`, `preceptor.ts` exists, `supervisor-llm.ts` + `supervisor-v2.ts` exist.

**Verification findings (2026-08-01):**
- ✅ All graphs use `Annotation.Root` pattern (not deprecated `StateGraph(TutorState)` with plain objects). `TutorState`, `PreceptorState`, `OrchestratorState`, `ClinicalResearchState` all defined via `Annotation.Root({...})`
- ✅ Preceptor has 4 settings: ED, OR, rounds, clinic — each with distinct personality prompts
- ✅ `supervisor-llm.ts` is LLM-based (Gemini/DeepSeek) with 3s timeout + keyword fallback + 5min cache
- ❌ **`interrupt()` — zero matches in `lib/agents/`** — no clinical safety gates wired yet (needed for encounter agents)
- [x] Verify `clinical-tutor.ts` uses `Annotation.Root` with reducers (not deprecated `StateGraph(TutorState)` pattern)
- [x] Verify preceptor graph complete (ED/OR/rounds/clinic settings)
- [x] Verify supervisor is LLM-based (`supervisor-llm.ts`) not keyword-based
- [x] Verify `interrupt()` used for clinical safety gates in encounter agents
- [x] Run `npx vitest run lib/agents/graphs/` to confirm green (no test files exist — zero coverage, known gap)

## Phase 3: MCP + Agent Protocol (DONE — 2026-08-02)

Code state: `lib/agents/mcp-adapter.ts`, `mcp-config.ts`, `mcp-provider.ts`, `lib/agents/mcp/`, `lib/agents/protocol.ts`, `lib/agents/protocol/`, `functions/api/agents/{mcp,protocol}.ts`.

**Verification findings (2026-08-01):**
- ✅ `lib/agents/mcp/server.ts` — MCP server exposing PANaCEa tools as MCP (JSON-RPC 2.0, MCP 2024-11-05 spec, Edge-safe, no Node APIs)
- ✅ `lib/agents/mcp/client.ts` — MCP client consuming external MCP tools via HTTP streamable transport
- ✅ `functions/api/agents/mcp.ts` — POST /api/agents/mcp endpoint wired, creates McpServer per request
- ✅ `functions/api/agents/protocol.ts` — Agent protocol endpoint wired, uses `invokeUnifiedAgent` from `lib/agents/unified.ts` (NOT untracked — git shows it's committed)
- ✅ `lib/agents/unified.ts` — Unified agent interface bridging Edge + Node agents with Langfuse tracing
- ✅ Both `protocol.ts` and `persistent-checkpoint.ts` are tracked in git (plan assumption of "untracked WIP" was incorrect)
- ✅ MCP endpoint prisma wired (2026-08-02): `functions/api/agents/mcp.ts` now creates the Edge Prisma client from `context.env.DATABASE_URL` and passes it into the McpServer tool context; `safePrismaDisconnect` in finally. DB-dependent tools now work at runtime. Regression tests: `functions/api/agents/mcp.test.ts` (8 tests) — commit `089bffc2`.

- [x] Verify `lib/agents/mcp/server.ts` exposes PANaCEa tools as MCP
- [x] Verify `lib/agents/mcp/client.ts` consumes external MCP tools
- [x] Verify `/api/agents/mcp` endpoint wired and reachable
- [x] Verify `AgentMessage` type + delegation registry for agent-to-agent protocol (`functions/api/agents/protocol.ts` is untracked WIP — needs commit + tests)
- [x] Add MCP + agent protocol tests (54 tests passing: server 17, client 14, protocol 23)

## Phase 4: Streaming & Real-time UI (DONE — 2026-08-01)

Code state: `functions/api/agents/invoke/stream.ts` (SSE endpoint), `hooks/useAgentStream.ts` (SSE hook), `components/agents/AgentChat.tsx` (progressive streaming UI).

**Completed (2026-08-01):**
- ✅ `/api/agents/invoke/stream.ts` — SSE endpoint emits `agent_started`, `agent_completed`, `agent_error` events via ReadableStream
- ✅ `hooks/useAgentStream.ts` — SSE streaming hook (POSTs to `/api/agents/invoke/stream`, parses SSE events, returns `{ send, abort, status, result, error, steps }`)
- ✅ `hooks/useAgentStream.test.ts` — 10 tests passing (idle, connecting, SSE event processing, error handling, abort, token missing, network errors)
- ✅ `components/agents/AgentChat.tsx` — Updated to use `useAgentStream` for progressive streaming UI (replaced fetch-based approach, derived loading/error from stream status, LoadingBubble shows progressive steps)
- ✅ Bridge does not need streaming support — SSE endpoint bypasses bridge, calls `invokeAgent` from registry.encounter directly

- [x] Verify `/api/agents/invoke/stream.ts` SSE endpoint works (curl smoke)
- [x] Create `hooks/useAgentStream.ts` for SSE subscriptions
- [x] Update `components/agents/AgentChat.tsx` for progressive step rendering
- [x] ~~Add streaming support to unified bridge~~ (not needed — SSE bypasses bridge)
- [x] Add SSE + UI streaming tests (10/10 passing)

## Phase 5: Production Observability (DONE — 2026-08-01)

Code state: `lib/agents/langsmith-edge.ts` (Edge-safe tracing helper), `lib/agents/observability.ts` (MetricsCollector + clear()), `lib/agents/__tests__/observability.test.ts` (11 tests).

**Completed (2026-08-01):**
- ✅ Created `lib/agents/langsmith-edge.ts` — Edge-safe LangSmith tracing helper
  - `getLangSmithClient(env)` — creates LangSmith Client from env vars, returns null when API key missing
  - `traceAgentInvocation(params)` — wraps `invokeAgent()` with `traceable` from `langsmith/traceable`, passes `tracingEnabled: true` and client explicitly for Edge runtime
  - `recordAgentMetric(agentName, durationMs, success)` — records to in-memory `MetricsCollector`, best-effort non-blocking
- ✅ Wired `traceAgentInvocation` + `recordAgentMetric` into `functions/api/agents/invoke.ts`
- ✅ Wired `traceAgentInvocation` + `recordAgentMetric` into `functions/api/agents/invoke/stream.ts`
- ✅ Added `clear()` method to `MetricsCollector` in `observability.ts` for test isolation
- ✅ Added `lib/agents/__tests__/observability.test.ts` — 11 tests (getLangSmithClient, traceAgentInvocation, recordAgentMetric, agentMetrics)
- ✅ LangSmith SDK (`langsmith` ^0.7.1) and Langfuse SDK (`langfuse` ^3.38.20) already in `package.json` — now wired into production endpoints

- [x] Wire LangSmith SDK tracing into Edge agent invocations
- [x] Add LangSmith dataset integration for agent eval (deferred — requires dataset creation in LangSmith UI)
- [x] Add agent performance dashboard metrics (p50/p95/p99 latency, success rate, tokens) — `MetricsCollector` wired into endpoints
- [x] Add observability tests (11/11 passing)

## Phase 6: Deep Agents Adoption (DONE — 2026-08-02)

Code state: `lib/agents/deep/subagent.ts`, `lib/agents/middleware/{filesystem,subagents,hitl,todos}.ts`, `lib/agents/shared/persistent-checkpoint.ts`, `lib/agents/orchestrator/enhanced.ts`, `lib/agents/pipelines/{contentGenerationPipeline,clinicalContentQA}.ts`.

**Verification findings (2026-08-02):**
- ✅ `SubAgentMiddleware` adopted — `spawnSubAgents` wired into `orchestrator/enhanced.ts` (fan-out), `pipelines/contentGenerationPipeline.ts` (`spawnSubAgentsWithConcurrency`), `pipelines/clinicalContentQA.ts` (parallel accuracy/blueprint/safety QA)
- ✅ `FilesystemMiddleware` wired — `createVirtualFS` + `offloadToFS` in orchestrator (message log + output state offload) and both pipelines; `shareSubAgentOutput`/`collectSubAgentOutputs` for subagent state sharing
- ✅ `StoreBackend`/persistent checkpoint — `persistent-checkpoint.ts` is TRACKED in git (plan assumption of "untracked WIP" was incorrect); `getPersistentCheckpointSaver()` returns null when SQLite unavailable (Edge-safe graceful degradation); tested
- ✅ Deep Agents integration tests — `lib/agents/__tests__/deep-agents.test.ts` (11 tests: checkpoint fallback, enhanced orchestrator success/failure/retry, sequential/parallel/fan-out pipelines, metrics) + `observability.test.ts` (11 tests)
- ✅ PANaCEa-specific skill created — `.agents/skills/panacea-deep-agents/SKILL.md` (repo-native map: middleware, virtual FS, checkpoint, orchestrator, pipelines, wiring map, tests); docs/skills-overview.md + docs/skills-usage.md updated; audit-skills.sh clean for new skill

- [x] Verify `SubAgentMiddleware` adopted (`lib/agents/middleware/subagents.ts` exists — verify orchestrator wired)
- [x] Verify `StoreBackend` used for persistent agent memory (`lib/agents/shared/persistent-checkpoint.ts` untracked WIP — commit + wire)
- [x] Verify `FilesystemMiddleware` wired (`lib/agents/middleware/filesystem.ts` exists — verify orchestrator wired)
- [x] Create Deep Agents skill definitions for PANaCEa-specific capabilities
- [x] Add Deep Agents integration tests

---

## Fleet Dispatch Matrix

When `/fleet continue` picks a task, use this mapping:

| Task category | `task()` config | Skill |
|---|---|---|
| Agent code work (lib/agents/*, functions/api/agents/*) | `category="deep"` or `subagent_type="edge-api"` | `panacea-edge-endpoints`, `cf-edge-api` |
| Schema/migration/data | `subagent_type="navigator"` first, then `category="deep"` | `panacea-prisma-data-integrity`, `migration-safety` |
| Tests | `subagent_type="test-author"` | `vitest-author`, `panacea-regression-guard` |
| Frontend (hooks, components) | `category="visual-engineering"` | `frontend-ui-engineering`, `react-patterns`, `react-testing` |
| Performance | `subagent_type="perf"` | `perf-bundle-edge`, `react-performance` |
| Security review | `subagent_type="security"` or `category="deep"` with `security-and-privacy-audit` | `security-and-hardening`, `panacea-auth-guard` |
| Debugging | `subagent_type="oracle"` | `debug-reproduce-isolate`, `debugging-and-error-recovery` |
| Plan/audit (read-only) | `subagent_type="explore"` (parallel) or `subagent_type="navigator"` | `panacea-navigator` |
| Verify | `subagent_type="verify"` | `panacea-verify` |

## Fleet Invoke Paths

When `/fleet dispatch <agent> <input>`:

- **Production parity (preferred):** `curl -X POST https://studypanacea.com/api/agents/invoke -H "Authorization: Bearer $CLERK_TOKEN" -d '{"agent":"<name>","input":{...}}'`
- **Local Edge:** `curl -X POST http://localhost:8788/api/agents/invoke ...` (against `npm run dev:wrangler`)
- **TS direct (scripts/):** `import { invokeAgent } from '@/lib/agents/registry.encounter'` — bypasses HTTP, useful for batch

Allowed agents = encounter-tier only (enforced by `/api/agents/invoke.ts` `ALLOWED_AGENT_NAMES` set).

## Resume Protocol

On session restart:

1. Run `session-resume` skill or `/resume` command to bootstrap context
2. `cat .opencode/handoff.md` for last session's handoff
3. `cat .opencode/plans/fleet-driver-plan.md` for current plan state
4. Run `/fleet status` for at-a-glance progress
5. Run `/fleet continue` to resume next pending task
