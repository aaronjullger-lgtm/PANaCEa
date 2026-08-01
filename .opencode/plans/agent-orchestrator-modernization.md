# Agent & Orchestrator Pipeline Modernization Plan

**Created:** 2026-07-31
**Status:** In Progress

## Audit Summary

PANaCEa has a substantial but fragmented agent infrastructure:

### Strengths
- Clean `AgentDefinition<I,O>` interface with typed I/O contracts
- Registry pattern with supervisor/orchestrator strategies
- 7 encounter agents + 4 ops agents + 10 production tools
- LangGraph ReAct agent factory in `packages/agent-orchestrator/`
- Autonomous dev pipeline with worktree isolation
- Eval framework with datasets, evaluators, judge
- Cost guardrails (costTracker + circuitBreaker)
- Langfuse + LangSmith tracing stubs

### Critical Gaps
1. **Two parallel agent systems** with no bridge: `lib/agents/` (LangGraph) vs `lib/services/agents/` (Gemini tool-loop)
2. **Preceptor graph is a stub** — "implementation pending"
3. **Clinical tutor uses deprecated StateGraph pattern** + `process.env` in Edge
4. **Supervisor routing is keyword-based**, not LLM-based
5. **No MCP integration** despite `@langchain/langchain-mcp-adapters` availability
6. **No HITL** (human-in-the-loop) for clinical safety
7. **No streaming** for agent responses
8. **LangSmith traces are in-memory only** — not wired to SDK
9. **Orchestrator package is Node-only** — can't run in Edge
10. **No agent-to-agent communication protocol**

## Implementation Plan (6 Phases)

### Phase 1: Unified Agent Bridge
**Goal:** Single invocation surface for both agent systems

- [ ] Create `lib/agents/bridge.ts` — unified dispatch routing to Edge agents OR services/agents tool-loop
- [ ] Add `services/agents` adapter implementing `AgentDefinition` interface
- [ ] Update `/api/agents/invoke` to accept both agent types via bridge
- [ ] Add bridge dispatch tests + verify existing tests pass

### Phase 2: LangGraph Modernization
**Goal:** All graphs use Annotation.Root, preceptor is complete, supervisor is LLM-based

- [ ] Migrate `clinical-tutor.ts` from `StateGraph(TutorState)` to `Annotation.Root` with reducers
- [ ] Implement preceptor graph with ED/OR/rounds/clinic settings
- [ ] Replace keyword supervisor with LLM-based router using structured output
- [ ] Add `interrupt()` for clinical safety gates in encounter agents
- [ ] Add tests for all modernized graphs

### Phase 3: MCP + Agent Protocol
**Goal:** PANaCEa tools exposed as MCP, external MCP tools consumable

- [ ] Create `lib/agents/mcp/server.ts` — MCP server exposing PANaCEa tools
- [ ] Create `lib/agents/mcp/client.ts` — MCP client for external tools
- [ ] Wire MCP server into `/api/agents/mcp` endpoint
- [ ] Add agent-to-agent communication protocol (`AgentMessage` type + delegation registry)
- [ ] Add MCP and agent protocol tests

### Phase 4: Streaming & Real-time UI
**Goal:** Real-time agent thinking steps in the UI

- [ ] Add SSE streaming to `/api/agents/invoke/stream`
- [ ] Update `AgentChat.tsx` for progressive step rendering
- [ ] Add `useAgentStream` hook for SSE subscriptions
- [ ] Add streaming support to unified bridge
- [ ] Add SSE and UI streaming tests

### Phase 5: Production Observability
**Goal:** Full LangSmith trace coverage, agent performance dashboard

- [ ] Wire LangSmith SDK tracing into Edge agent invocations
- [ ] Add LangSmith dataset integration for agent eval
- [ ] Add agent performance dashboard metrics (p50/p95/p99 latency, success rate, token usage)
- [ ] Add observability tests

### Phase 6: Deep Agents Adoption
**Goal:** Leverage Deep Agents middleware for robust orchestration

- [ ] Adopt `SubAgentMiddleware` for orchestrator task delegation
- [ ] Adopt `StoreBackend` for persistent agent memory across sessions
- [ ] Add `FilesystemMiddleware` for file-access agents (content audit, PR triage)
- [ ] Create Deep Agents skill definitions for PANaCEa-specific capabilities
- [ ] Add Deep Agents integration tests

## Non-Negotiables
- Edge-runtime safe (no Node APIs in `lib/agents/` or `functions/api/`)
- Zero regression on 3200+ existing tests
- Backward compatible with existing `/api/agents/invoke` and `/api/agents/run`
- LangSmith tracing non-blocking (fire-and-forget or sampled)
- MCP integration optional — agents work without MCP servers
- Cost guardrails on all agent LLM calls
