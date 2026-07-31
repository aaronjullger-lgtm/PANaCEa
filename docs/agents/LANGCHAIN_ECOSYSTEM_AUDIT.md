# LangChain Ecosystem Audit — PANaCEa Agent Infrastructure

> **Date:** 2026-07-31 | **Scope:** Full agent/orchestration stack vs. LangChain ecosystem capabilities

---

## Executive Summary

PANaCEa has built a **sophisticated, production-grade agent infrastructure** that in many ways parallels and in some areas exceeds the LangChain ecosystem's offerings. The audit reveals **10 high-ROI improvement opportunities**, of which **5 are implementable now** without new dependencies or schema changes.

**Overall maturity:** 7.5/10 — Strong foundation, gaps in MCP integration, production observability, and specialized agent patterns.

---

## 1. Current State Inventory

### 1.1 Agent Infrastructure (`lib/agents/`)

| Component | Lines | Status | Notes |
|-----------|-------|--------|-------|
| `orchestrator.ts` | 322 | ✅ Production | Sequential/parallel/supervisor strategies, 4 built-in orchestrators |
| `unified.ts` | 310 | ✅ Production | Edge↔Node bridge, team workflows, Langfuse tracing |
| `supervisor.ts` | 249 | ✅ Production | 3 supervisors (clinical, ops, content), broadcast execution |
| `registry.ts` | 42 | ✅ Production | 11 registered agents, auto-import pattern |
| `shared/types.ts` | 73 | ✅ Production | Typed AgentDefinition, InvokeResult, AgentContext |
| `shared/runtime.ts` | 72 | ✅ Production | Registry CRUD, invokeAgent dispatcher |

**11 Registered Agents:**
- **Encounter (7):** standardizedPatient, intentRouter, spbenchGrader, ddxGenerator, diagnosticWorkupAdvisor, feedbackSummarizer, soapNoteGrader
- **Ops (4):** callGeminiAuditor, promptContractValidator, schemaDriftDetector, envVarAuditor

### 1.2 LangChain Integration (`lib/langchain/`)

| Component | Lines | Status | Notes |
|-----------|-------|--------|-------|
| `agent.ts` | 333 | ✅ Production | `createAgent()` factory, Annotation.Root, 3 pre-built agents |
| `graphs/osceEncounter.ts` | 380 | ✅ Production | 6-phase OSCE graph, intent classification, SPBench grading |
| `graphs/questionPipeline.ts` | 281 | ✅ Production | Generate→Critique→Refine loop, structured output |
| `chains/` | — | ✅ Production | Question + content generation chains |
| `router.ts` | — | ✅ Production | Multi-model routing with fallback chains |
| `models.ts` | — | ✅ Production | 6 providers (Gemini, OpenAI, Anthropic, DeepSeek, DeepInfra, OpenRouter) |
| `tracing.ts` | — | ✅ Production | LangSmith auto-instrumentation |
| `config.ts` | — | ✅ Production | Model registry, task→model mapping |
| `evals/` | — | ✅ Production | Evaluation pipeline, datasets |

### 1.3 Agent Orchestrator Package (`packages/agent-orchestrator/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `factory.ts` | ✅ Production | `buildAgent()` using `createReactAgent` from LangGraph prebuilt |
| 5 Starter Agents | ✅ Production | content-audit, pr-triage, incident-responder, content-enrichment, weekly-report |
| Tracing | ✅ Production | Langfuse CallbackHandler + LangSmith auto-instrumentation |
| Memory | ✅ Production | Qdrant (runs, decisions, context collections) |
| Integrations | ✅ Production | Linear, GitHub, Sentry, n8n, Composio |
| HTTP API | ✅ Production | `:4100` — /health, /agents, /agents/:role/invoke, /memories |
| v2 Improvements | ✅ Complete | Checkpoint resume, LLM-as-judge eval, Qdrant optimization, managed prompts, supervisor, SSE streaming |

### 1.4 Agent Services (`lib/services/agents/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `toolRegistry.ts` | ✅ Production | Typed tool registry, Gemini function declarations |
| 12 Tools | ✅ Production | blueprintCoverageCheck, clinicalLibrarySearch, conditionVerify, contentHealthAudit, databaseIntegrityCheck, drillCoverageCheck, fsrsCalibrationStatus, fsrsDueCount, questionQualityCheck, userProgressSummary |
| `agentRunner.ts` | ✅ Production | Multi-turn agent execution loop |
| `geminiAgentClient.ts` | ✅ Production | Gemini-specific turn parsing |
| `telemetry.ts` | ✅ Production | Agent telemetry logging |

### 1.5 Agent Environment (`docs/agent-env/`)

| Component | Status | Notes |
|-----------|--------|-------|
| 7 Hooks | ✅ Active | Safety, migration, dependency, edge-runtime, format, session-start, session-handoff |
| 9 Slash Commands | ✅ Active | resume, sprint, review, ship, handoff, audit, verify, status |
| 3 Subagents | ✅ Active | security-reviewer, migration-reviewer, aidesigner-frontend |
| 4 MCP Servers | ✅ Configured | AIDesigner, Context7, Sentry, Supabase |
| 31 Skills | ✅ Tracked | Full inventory in `00-inventory.md` |

---

## 2. LangChain Ecosystem Capability Map

### 2.1 Deep Agents SDK (`deepagents`)

| Capability | PANaCEa Equivalent | Gap |
|-----------|-------------------|-----|
| Remote sandboxes | ❌ None | **GAP** — No sandboxed code execution for agents |
| Goals and rubrics | ❌ None | **GAP** — No measurable agent objectives |
| Subagents | ✅ Team workflows (`unified.ts`) | Covered |
| Persistent memory | ✅ Qdrant (orchestrator) | Covered |
| Context compaction | ❌ None | **GAP** — No automatic context summarization |
| Human-in-the-loop | ✅ Checkpoint resume | Partial — no structured approval UI |
| Skills system | ✅ 31 `.agents/skills/` | Covered (different implementation) |
| MCP tools | ⚠️ Static config only | **GAP** — No dynamic MCP tool loading |
| LangSmith tracing | ✅ Full coverage | Covered |

### 2.2 LangSmith Observability

| Capability | PANaCEa Status | Gap |
|-----------|---------------|-----|
| Trace viewing | ✅ Langfuse + LangSmith | Covered |
| Dashboards | ❌ Not configured | **GAP** — No agent performance dashboards |
| Alerts | ⚠️ Langfuse monitors only | Partial — no LangSmith alerts |
| Automations (rules) | ❌ Not configured | **GAP** — No automated quality gates |
| Online evaluations | ⚠️ LLM-as-judge only | Partial — no continuous eval pipeline |
| User feedback | ❌ Not implemented | **GAP** — No feedback collection |
| Engine (issue detection) | ❌ Not used | **GAP** — No automatic issue detection |

### 2.3 LangChain MCP Adapters

| Capability | PANaCEa Status | Gap |
|-----------|---------------|-----|
| Dynamic MCP tool loading | ❌ Not implemented | **GAP** — Tools are hardcoded |
| Multi-server MCP client | ❌ Not implemented | **GAP** — No unified MCP client |
| Streamable HTTP | ❌ Not implemented | **GAP** — No HTTP MCP transport |
| Runtime headers | ❌ Not implemented | **GAP** — No auth header passthrough |
| Tool error handling | ✅ Custom implementation | Covered |
| LangGraph integration | ✅ Native | Covered |

### 2.4 Open Deep Research

| Pattern | PANaCEa Equivalent | Gap |
|---------|-------------------|-----|
| Supervisor-researcher | ⚠️ Supervisor only (no researcher sub-agents) | **GAP** — No research-specific agent |
| Plan-and-execute | ❌ None | **GAP** — No planning phase before execution |
| Multi-agent parallel research | ✅ Broadcast supervisor | Covered |
| MCP search tools | ❌ None | **GAP** — No web search tools |
| Evaluation framework | ⚠️ LLM-as-judge only | Partial |

### 2.5 Langflow

| Capability | PANaCEa Status | Gap |
|-----------|---------------|-----|
| Visual flow builder | ❌ None | **GAP** — No visual prototyping |
| Agent components | ❌ None | **GAP** — Python-only, not applicable |
| MCP server/client | ❌ None | **GAP** — Python-only |

### 2.6 Agent Protocol

| Capability | PANaCEa Status | Gap |
|-----------|---------------|-----|
| Standardized messages | ⚠️ Custom types | Partial — no interoperability |
| Capability discovery | ❌ None | **GAP** — No agent capability advertisement |
| Task lifecycle | ⚠️ Implicit only | Partial — no explicit task states |
| Error standardization | ✅ AgentError type | Covered |

---

## 3. Prioritized Improvement Opportunities

### Tier 1 — High ROI, Implement Now (no new deps)

| # | Improvement | Effort | Impact | Files |
|---|------------|--------|--------|-------|
| 1 | **Agent Capability Registry** — Centralized catalog of all agents, tools, capabilities | 2h | High | `lib/agents/capabilities.ts` |
| 2 | **Agent Protocol Types** — Standardized message protocol inspired by agent-protocol | 2h | High | `lib/agents/protocol.ts` |
| 3 | **MCP Tool Bridge** — Dynamic MCP tool discovery adapter (pattern only, no new deps) | 3h | High | `lib/agents/mcp/bridge.ts` |
| 4 | **Clinical Research Agent** — Supervisor-researcher pattern for EBM literature review | 4h | High | `lib/agents/graphs/clinical-research.ts` |
| 5 | **LangSmith Dashboard Config** — Dashboard + alert configuration docs | 1h | Medium | `docs/agents/langsmith-observability.md` |

### Tier 2 — Medium ROI, Requires Approval

| # | Improvement | Blocker |
|---|------------|---------|
| 6 | `langchain-mcp-adapters` npm package | New production dep |
| 7 | LangSmith Engine setup | LangSmith plan tier |
| 8 | Remote sandboxes for code execution | Deep Agents SDK dep |
| 9 | Langflow prototyping environment | Python infrastructure |
| 10 | Agent Protocol full implementation | `@agent-protocol/core` dep |

---

## 4. Architecture Recommendations

### 4.1 Unify Agent Communication

**Current:** Agents communicate through ad-hoc interfaces (`InvokeResult`, `TeamResult`, `SupervisorResult`).

**Recommendation:** Adopt a unified message protocol with:
- Standardized message types (request, response, error, event)
- Capability discovery (what can each agent do?)
- Task lifecycle (created → running → completed → failed)
- Structured error taxonomy

### 4.2 Dynamic Tool Discovery

**Current:** Tools are hardcoded in `lib/services/agents/tools/` and `lib/agents/` registries.

**Recommendation:** Add an MCP tool bridge that:
- Discovers tools from configured MCP servers at agent build time
- Caches tool schemas for fast subsequent loads
- Falls back gracefully when MCP servers are unavailable
- Respects the existing `ToolRegistry` interface

### 4.3 Specialized Agent Patterns

**Current:** Generic orchestrator patterns (sequential, parallel, supervisor).

**Recommendation:** Add domain-specific agent patterns:
- **Clinical Research Agent:** Supervisor→Researcher→Synthesizer→Grader (from Open Deep Research)
- **Content Audit Agent:** Plan→Audit→Report→File (plan-and-execute)
- **Study Plan Agent:** Analyze→Generate→Validate→Deliver (pipeline with validation gate)

### 4.4 Production Observability

**Current:** Langfuse + LangSmith tracing, but no dashboards or alerts.

**Recommendation:**
- LangSmith dashboards for agent performance (latency, success rate, cost)
- Alerts for agent failures, cost spikes, and latency degradation
- Online evaluations for continuous quality monitoring
- Feedback collection from agent consumers

---

## 5. Implementation Plan

### Phase 1: Foundation (this session)
- [x] Audit document (this file)
- [ ] Agent capability registry (`lib/agents/capabilities.ts`)
- [ ] Agent protocol types (`lib/agents/protocol.ts`)

### Phase 2: MCP Bridge (this session)
- [ ] MCP tool adapter (`lib/agents/mcp/bridge.ts`)
- [ ] Wire existing MCP servers as discoverable tools
- [ ] Integration with agent orchestrator factory

### Phase 3: Clinical Research Agent (this session)
- [ ] ClinicalResearchAgent graph (`lib/agents/graphs/clinical-research.ts`)
- [ ] Literature search, guideline synthesis, evidence grading tools
- [ ] Registration in orchestrator

### Phase 4: Observability (this session)
- [ ] LangSmith dashboard configuration docs
- [ ] Agent health endpoint enhancement
- [ ] Full test suite verification

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing agent tests | Low | High | Run full test suite after each phase |
| Edge runtime incompatibility | Low | High | All new code uses `context.env.*`, no Node APIs |
| Increased bundle size | None | None | All agent code is server-side only |
| MCP server unavailability | Medium | Low | Graceful fallback in MCP bridge |
| LangSmith API changes | Low | Low | Config-only, no runtime dependency |

---

## 7. Success Metrics

- All existing agent tests pass (agentRunner, geminiAgentClient, toolRegistry, toolIntegration)
- Agent capability registry catalogs 100% of existing agents
- MCP tool bridge discovers tools from ≥1 configured MCP server
- Clinical research agent graph compiles without errors
- LangSmith dashboard config is documented and deployable
- Zero new production dependencies
- Zero schema changes
