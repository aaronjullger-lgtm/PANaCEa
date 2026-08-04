---
name: panacea-deep-agents
description: "Use for PANaCEa's Deep-Agents-inspired agent infrastructure: subagent fan-out, virtual filesystem context offloading, persistent checkpointing, and the enhanced orchestrator. Trigger when working in lib/agents/middleware, lib/agents/shared/persistent-checkpoint.ts, lib/agents/orchestrator/enhanced.ts, or the agent pipelines (contentGenerationPipeline, clinicalContentQA)."
---

# PANaCEa Deep Agents Adoption

PANaCEa implements a Deep-Agents-inspired pattern **without** the Deep Agents SDK dependency — everything is hand-rolled, Edge-safe TypeScript in `lib/agents/`. The generic `deep-agents-*` skills describe the upstream SDK; this skill is the repo-native map.

## Architecture

```
lib/agents/
├── middleware/
│   ├── subagents.ts        # spawnSubAgents / spawnSubAgentsWithConcurrency / executeSubAgentWorkflow
│   ├── filesystem.ts       # createVirtualFS / writeFile / readFile / offloadToFS / shareSubAgentOutput
│   ├── hitl.ts             # human-in-the-loop approval helpers
│   ├── todos.ts            # task-list helpers
│   └── index.ts            # barrel
├── shared/
│   ├── persistent-checkpoint.ts  # getPersistentCheckpointSaver() — Edge-safe, returns null w/o SQLite
│   ├── checkpoint.ts / runtime.ts / state.ts / tools.ts / types.ts / protocol.ts
├── orchestrator/
│   └── enhanced.ts         # runEnhancedOrchestrator + sequential/parallel/fan-out pipelines
├── pipelines/
│   ├── contentGenerationPipeline.ts  # fan-out question generation via subagents + FS offload
│   └── clinicalContentQA.ts          # parallel accuracy/blueprint/safety QA via subagents
└── deep/subagent.ts        # subagent primitive
```

## Key Patterns

### SubAgent fan-out (`middleware/subagents.ts`)
- `spawnSubAgents(defs, ctx)` — parallel, per-subagent timeout (default 30s) + error isolation
- `spawnSubAgentsWithConcurrency(defs, ctx, n)` — rate-limit-safe batches (default 3)
- Each subagent calls `invokeUnifiedAgent` from `lib/agents/unified.ts` — routes to edge/tool-loop/node backends
- Results: `SubAgentBatchResult { results, totalDurationMs, successCount, failureCount, timeoutCount }`

### Virtual filesystem (`middleware/filesystem.ts`)
- In-memory only (no disk I/O — Edge-safe), JSON-serializable values, 5MB default cap
- `offloadToFS(fs, path, content)` — the core context-offloading pattern: store big intermediate results, pass only the reference into agent context
- `shareSubAgentOutput` / `collectSubAgentOutputs` — subagent state sharing under `subagents/{namespace}/{agentName}/output.json`
- `serializeFSState(fs)` — for LangSmith tracing metadata

### Persistent checkpoint (`shared/persistent-checkpoint.ts`)
- `getPersistentCheckpointSaver()` returns `null` when SQLite is unavailable (always in Edge runtime) — graceful degradation, never throws
- `clearCheckpointCache()` resets the cached saver (test isolation)
- Do NOT wire this into Edge endpoints expecting persistence — it is a Node-context helper

### Enhanced orchestrator (`orchestrator/enhanced.ts`)
- `runEnhancedOrchestrator(cfg, stepFn, ctx)` — retries, circuit breaker, progress emit
- `runSequentialPipeline` / `runParallelPipeline` / `runFanOutPipeline` — composition helpers
- Uses `createVirtualFS` + `offloadToFS` internally for message log + output state offloading

## Wiring Map (verified 2026-08-02)

| Consumer | Uses |
|---|---|
| `orchestrator/enhanced.ts` | `spawnSubAgents`, `createVirtualFS`, `offloadToFS` |
| `pipelines/contentGenerationPipeline.ts` | `spawnSubAgentsWithConcurrency`, `createVirtualFS`, `offloadToFS`, `serializeFSState` |
| `pipelines/clinicalContentQA.ts` | `spawnSubAgents`, `createVirtualFS`, `offloadToFS`, `readFile`, `serializeFSState` |

## Tests

- `lib/agents/__tests__/deep-agents.test.ts` — 11 tests: persistent-checkpoint fallback, enhanced orchestrator (success/failure/retry), sequential/parallel/fan-out pipelines, metrics integration
- `lib/agents/__tests__/observability.test.ts` — 11 tests: LangSmith client, tracing, MetricsCollector

Run: `npx vitest run lib/agents/__tests__/`

## Constraints

- Edge-runtime safe: no `fs`, `child_process`, `process.env` in `lib/agents/` or `functions/api/`
- All agent LLM calls go through `invokeUnifiedAgent` (cost guardrails + Langfuse tracing)
- Zero regression on the 3200+ test suite — new middleware must ship with tests