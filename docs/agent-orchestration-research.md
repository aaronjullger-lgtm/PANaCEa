# PANaCEa Agent & Orchestrator Pipeline — Research Document

**Status:** Research only — no implementation performed.
**Date:** 2026-07-31
**Author:** Sisyphus (research synthesis)
**Audience:** Aaron (solo maintainer) — decision input for the next implementation sprint.

---

## 1. Executive Summary

PANaCEa already has a **substantial, production-safe agent substrate**: a LangGraph-based
agent registry (`lib/agents/`), an orchestrator with sequential/parallel/supervisor/conditional
strategies, an LLM-powered supervisor (`supervisor-v2.ts`), a Deep-Agents-style subagent
delegator, a unified AI gateway with multi-tier model routing, and a LangChain multi-provider
fallback router with cost guardrails. The research below audited four external repositories to
find **what is missing and what to copy**:

| Repo | License | Relevance verdict |
|---|---|---|
| `x1xhlol/system-prompts-and-models-of-ai-tools` | GPL-3.0 | High (patterns only — do **not** copy verbatim) |
| `msitarzewski/agency-agents` | MIT | High (quality gates + agent anatomy doctrine) |
| `Shubhamsaboo/awesome-llm-apps` | Apache-2.0 | Medium-high (RAG variants, agent skills, evals) |
| `garrytan/gstack` | MIT | Medium (verification loops, cross-model review, memory) |

**Headline gaps found in PANaCEa** (detailed in §5):

1. **Edge vs. Node split** forces a reduced production registry (`registry.encounter.ts`);
   ops-tier agents can't run on Cloudflare Edge.
2. **Ad-hoc endpoints bypass the unified runtime** — `generate-enhanced.ts` and
   `live-engine.ts` duplicate prompt/verification/logging logic instead of registering as agents.
3. **No server-side session state coordinator** — `standardizedPatient.ts` is stateless and
   relies on the client replaying the full conversation.
4. **No central user-facing supervisor** — `supervisor-v2.ts` exists but is ops-only; student
   queries aren't routed to Tutor / OSCE / Explainer from one entry point.
5. **No programmatic quality-gate loop with retries** on generated content before it enters
   the reservoir (CoVe exists for one endpoint; it is not a reusable gate).

**Proposed direction (see §6–7):** evolve the existing substrate — don't rebuild it. Add
(1) a central student-facing supervisor, (2) a reusable Dev↔QA quality-gate loop with
structured PASS/FAIL + retry for generated content, (3) typed handoff packages in agent
state, (4) a session-state coordinator (Durable Objects) for OSCE/tutor, and (5) a versioned
prompt library with an eval harness.

---

## 2. Sources & Method

- **Internal audit (live repo):** full map of `lib/agents/**`, `lib/ai/**`, `lib/langchain/**`,
  `lib/services/autoAuthor/**`, `lib/srs/ghostGrader.ts`, `functions/api/osce/**`,
  `functions/api/questions/generate*.ts` — conducted against the current working tree.
- **External audits:** GitHub API tree/metadata inspection + raw file reads + web search for
  context on each of the four repositories below. All findings cite real paths/files.

---

## 3. Repo Audits

### 3.1 `x1xhlol/system-prompts-and-models-of-ai-tools` (GPL-3.0, ~142k★)

**What it is.** A large collection of captured/leaked **system prompts and tool catalogs from
AI coding tools** — Claude Code, Cursor, Devin, Manus, Lovable, v0, Replit, Warp.dev,
Orchids.app, NotionAI, Perplexity, and ~30 more (35 top-level dirs). Also contains model
definitions and `tools.json` catalogs (e.g. `Manus Agent Tools & Prompt/tools.json`).

**Patterns observed (from reading the Orchids.app system prompt + structure):**

- **XML-tag structured prompting** at scale — `<inputs>`, `<task_completion_principle>`,
  `<preservation_principle>`, `<navigation_principle>`, `<reasoning_principles>`,
  `<error_fixing_principles>`, `<ui_ux_principles>`. This is the dominant commercial pattern
  for scoping an agent's behavior and inputs.
- **"Know when to stop" principle** — explicit instruction to end the turn the moment the
  request is satisfied; smallest viable change; no gratuitous refactors. Directly addresses
  agent over-work.
- **Explicit inputs block** — the agent is told exactly which context slots it will receive
  (user query, conversation history, current page, relevant files, design-system reference,
  attachments, selected elements).
- **Tool-delegation architecture** (Orchids.app): the main agent delegates to specialized
  sub-agents/handlers (database, auth, payments) rather than doing everything itself — the
  same orchestration shape PANaCEa's `orchestrator.ts` already implements.
- **Per-tool catalogs** (`Manus/.../tools.json`): agents ship with a declared tool manifest.

**PANaCEa takeaways:**

- **T1 — Adopt an inputs-block + stop-principle header in PANaCEa's agent system prompts**
  (tutor, OSCE standardized patient, question generator, Ghost Grader). Scopes the agent,
  cuts hallucinated work, and matches how the strongest commercial agents are steered.
  Where: `lib/agents/` prompts, `lib/services/autoAuthor/` prompts.
- **T2 — Treat prompts as versioned assets, not string literals.** Keep a `prompts/` catalog
  per agent with a declared tool manifest mirroring `tools.json`. Enables diffing, evals,
  and rollback (see §7 Phase 5).
- **T3 — Study-but-don't-copy.** GPL-3.0 — patterns (structure, principles) are fine to
  imitate; verbatim prompt text would contaminate PANaCEa's licensing posture. Cite
  provenance in the prompt library.

### 3.2 `msitarzewski/agency-agents` — "The Agency" / NEXUS (MIT)

**What it is.** A **prompt-based agent system + deployment doctrine**, not an execution
framework: 55+ highly-specialized agent definitions written as Markdown, installable into
Claude Code / Cursor / Copilot / OpenCode etc. via `convert.sh` / `install.sh`. The repo
itself contains little runtime code; it is a **standardized agent anatomy + orchestration
playbook** (NEXUS = "Network of EXperts, Unified in Strategy").

**Key concepts:**

- **Standardized agent anatomy** — every agent file has: Identity & Memory, Core Mission,
  Critical Rules, Technical Deliverables, Workflow Process, Learning & Memory, Success Metrics.
- **Agents Orchestrator** — the pipeline manager running
  `PM → ArchitectUX → [Developer ↔ EvidenceQA Loop] → Integration`.
- **Quality gates** — mandatory evidence-based approval checkpoints between phases
  (Discovery, Architecture, Foundation, Feature, Production, Launch).
- **Dev ↔ QA loop** — developer implements → QA agent validates (often with screenshot
  evidence) → orchestrator passes or loops back with feedback (≤3 retries).
- **Handoff packages** — typed artifact bundles passed between phases (e.g. Phase 1 → 2
  handoff: strategic plan, brand system, CSS design system, architecture spec, task list).
  A **coordination matrix** (row agent produces → column agent consumes) formalizes dependencies.

**PANaCEa takeaways:**

- **T4 — Reusable quality-gate loop with retry budget.** Route every generated artifact
  (questions, condition content, OSCE cases) through a **validator agent** returning a
  structured `PASS/FAIL + feedback`, auto-retry ≤3 times, then quarantine. This is the
  agency-agents Dev↔QA loop made programmatic — and it already half-exists in
  `generate-enhanced.ts` (CoVe) and `panacea-clinical-validator`; the gap is making it a
  shared service instead of a per-endpoint trick.
- **T5 — Standardize agent anatomy.** Give PANaCEa's `AgentDefinition` prompts a fixed
  anatomy (identity/mission/rules/deliverables/workflow/metrics) so every agent is
  auditable and comparable. Fits cleanly on top of the existing `AgentDefinition<I,O>`
  interface in `lib/agents/`.
- **T6 — Formalize handoff packages.** Replace raw chat history in agent state with typed
  deliverable bundles (patient history → exam findings → DDx → SOAP) — a coordination matrix
  for the OSCE pipeline (see §6, typed handoff state).

### 3.3 `Shubhamsaboo/awesome-llm-apps` (Apache-2.0, ~129k★)

**What it is.** 100+ **open-source, hand-built, end-to-end-tested** AI apps: single-agent apps,
multi-agent apps, autonomous/always-on agents, **24 RAG tutorial variants**, voice agent
teams, MCP-based agents, generative-UI agents, and an `agent_skills/` directory
(`advisor-orchestrator-worker`, `evals`, `self-improving-agent-skills`, `thinking-out-loud`,
`project-graveyard`, etc.). Apache-2.0 — **freely adaptable with attribution**.

**Most instructive areas for PANaCEa:**

- **RAG catalog** (`rag_tutorials/`): corrective RAG, hybrid search, knowledge-graph RAG with
  citations, agentic RAG with reasoning, database-routing RAG, `rag_failure_diagnostics_clinic`.
  PANaCEa's clinical library / question-RAG / deep-context generation map directly onto these.
- **Multi-agent apps** (`advanced_ai_agents/multi_agent_apps/`): orchestration patterns for
  agent teams with shared state.
- **Agent skills + evals** (`agent_skills/`): the `evals` and `self-improving-agent-skills`
  directories demonstrate exactly the eval-loop PANaCEa lacks for agent outputs.
- **Always-on agents** (`always_on_agents/`): cron-style agents — relevant to PANaCEa's
  reservoir maintenance / content refill cron jobs.

**PANaCEa takeaways:**

- **T7 — Mine the RAG catalog for one concrete upgrade.** `corrective_rag` and
  `rag_failure_diagnostics_clinic` are the closest fits for PANaCEa's clinical library
  retrieval (bad search results → self-correcting retrieval). Apache-2.0 → copy/adapt with
  attribution.
- **T8 — Borrow the eval harness shape.** `agent_skills/evals` shows how to eval agent
  outputs continuously — pair with LangSmith (already wired via `lib/langchain/`) to score
  question validity and OSCE grading accuracy over time.
- **T9 — Reference multi-agent app structure** when consolidating PANaCEa's ad-hoc AI
  endpoints onto the orchestrator.

### 3.4 `garrytan/gstack` (MIT)

**What it is.** Garry Tan's open-source Claude Code toolkit: **23 specialist skills + 8 power
tools** that turn a coding agent into a "virtual engineering team" (CEO, Designer, Eng
Manager, QA). Bun-compiled binaries, a **Playwright/Chromium browser daemon** (~100–200 ms
after a ~3 s cold start), a **persistent knowledge base (GBrain)** on PGLite/Supabase with
embeddings for cross-session recall, an enforced sprint loop
(Think → Plan → Build → Review → Test → Ship → Reflect), and layered **prompt-injection
defense (L1–L5)** for agents that browse untrusted pages.

**Key concepts:**

- **Cross-model verification (`/codex`)** — a second, independent model reviews the primary
  model's work as an adversarial check.
- **E2E session runner** — spawns the agent CLI as a subprocess, streams NDJSON transcripts
  to verify skills end-to-end (no mocks).
- **SKILL.md template system** — docs generated from source so documentation can't drift.
- **Slop-scan** — automated detection/refactor of verbose AI-generated code patterns.
- **Continuous checkpoint mode** — auto-commits `WIP:` commits with structured context
  (decisions, remaining work, failed approaches) to survive context loss.

**PANaCEa takeaways:**

- **T10 — Cross-model adversarial review for high-stakes content.** A second model/agent
  reviews generated questions and OSCE grading before persistence — cheap insurance against
  clinical inaccuracy (complements T4; gstack's `/codex` is the reference pattern).
- **T11 — Browser-daemon pattern for E2E QA.** PANaCEa's Playwright suite would benefit from
  a persistent Chromium daemon to cut repeated cold starts on drill/session flows.
- **T12 — GBrain-style persistent memory is a model for OSCE/tutor state** — but PANaCEa
  should use its own stack (Supabase/Postgres or Durable Objects), not add PGLite.
- **T13 — Prompt-injection defense layers** matter for any agent that reads external text
  (OSCE transcripts, web-sourced content) — adopt the layering idea (sanitize inputs,
  canary tokens, classifier) at a scale appropriate to PANaCEa.

---

## 4. PANaCEa Current State (internal audit)

### 4.1 Agent registry & runtime — `lib/agents/`

| File | Role |
|---|---|
| `registry.encounter.ts` | **Production-safe** registry — encounter-tier agents only (standardized-patient, intent-router, soap-note-grader). Deliberately avoids Node-only modules so it loads on Cloudflare Edge. |
| `registry.ts` | Full registry (encounter + ops tier: call-gemini-auditor, schema-drift-detector) — local scripts/CI only. |
| `shared/runtime.ts` | LangGraph runtime registry/dispatcher: `listAgents`, `invokeAgent`, `getAgent`, `clearRegistryForTests`. |
| `shared/state.ts` | `PANaCEaAgentState` — `Annotation.Root` with `env`, `sessionId`, `output`. |
| `shared/tools.ts` | Typed tools via `defineTool()` + Zod: `clinicalLibraryLookup`, `drugInteractionCheck`, `blueprintCoverageCheck`, `AGENT_TOOLS`, `invokeTool`. |
| `orchestrator.ts` | LangGraph `StateGraph` coordinator — `sequential`, `parallel`, `supervisor`, `conditional` strategies. Built-ins: `clinical-encounter` (DDx → SOAP grading → feedback), `diagnostic-workup` (parallel DDx + workup advisor). |
| `supervisor-v2.ts` | LLM-powered semantic routing (`routeWithContext`) with keyword fallback. |
| `subagent.ts` | Deep-Agents-style subagent pattern — isolated instances, timeouts, parallel `Promise.all`, custom mergers. |
| `graphs/clinical-tutor.ts` | Adaptive Socratic tutor graph — `StateGraph` + `MemorySaver`. |
| `encounter/standardizedPatient.ts` | **Stateless** standardized patient for text OSCE turns. |

### 4.2 AI gateway & routing — `lib/ai/`, `lib/langchain/`

- **`lib/ai/aiGateway.ts`** — single entry for direct Gemini calls: `gateway` singleton,
  task→tier mapping (`grading`, `tutoring`, `generation`, `extraction`, `enrichment`,
  `embedding` → fast/balanced/powerful/audio/embedding), streaming, and
  `parseStructured()` with exactly **one schema-repair pass** before `GatewayError`.
- **`lib/langchain/router.ts`** — multi-provider fallback (`routeTask`, `routeTaskStructured`,
  `executeWithFallback`) with exponential backoff, `CostTracker` + `CircuitBreaker`.
- **`lib/langchain/config.ts` / `models.ts`** — task→model registry (e.g.
  `question-generation` → claude-sonnet-5 primary, gpt-4.1 + gemini-2.5-pro fallbacks).

### 4.3 AI feature entry points

| Feature | File | Notes |
|---|---|---|
| Auto-author content | `lib/services/autoAuthor/index.ts` (+ `langchainContentGenerator.ts`) | LangChain fallback chains for missing condition/lab content |
| Ghost Grader | `lib/srs/ghostGrader.ts` | `applyHonestRatingWithDetail` — behavioral-biometric FSRS override |
| OSCE Live | `functions/api/osce/live-engine.ts` → `lib/agents/strategies/liveEngineStrategy.ts` | Gemini Live API WebSocket (gemini-2.0-flash-exp), ephemeral token minting; endpoint delegates to orchestrator strategy |
| Question gen (standard) | `functions/api/questions/generate.ts` | Staging lake, semantic cache, RxNorm validation |
| Question gen (deep) | `functions/api/questions/generate-deep.ts` | 1M+ token PANCE blueprint `cachedContent` |
| Question gen (enhanced) | `functions/api/questions/generate-enhanced.ts` → `lib/agents/strategies/generateEnhancedStrategy.ts` | Chain-of-Verification (CoVe) draft→verify→refine; endpoint delegates to orchestrator strategy |

### 4.4 How Gemini is called today

- **Production endpoints** → unified `gateway` (`lib/ai/aiGateway.ts`) → direct Google SDK/fetch.
- **Background pipelines** (autoAuthor, clinical-tutor) → LangChain wrappers
  (`ChatGoogleGenerativeAI`) for fallback + LangSmith tracing.
- **Structured output** → `parseStructured()` + Zod, one repair pass; CoVe in
  `generate-enhanced.ts`.

---

## 5. Gap Analysis (current vs. target pipeline)

1. **Edge vs. Node split (registry)** — ops-tier agents can't run in production Edge; the
   orchestrator is restricted to encounter-tier agents on the Edge. *Keep the split (it's
   correct), but define a clean contract so ops agents are invocable from local/CI tooling.*
2. **Ad-hoc endpoint wiring** — *Partially addressed (Phase 3):* `generate-enhanced.ts` and `live-engine.ts` now delegate to orchestrator strategies (`runGenerateEnhancedFlow`, `runLiveEngineFlow`) with stable HTTP envelopes. Remaining routes still have duplicated prompt/verification patterns.
3. **Stateless OSCE/tutor** — `standardizedPatient.ts` stateless; client replays full history.
   No persistent server-side session coordinator. *Add Durable-Object or Supabase-backed
   session state.*
4. **No central user-facing supervisor** — `supervisor-v2.ts` is ops-only. Students get no
   single router for "explain this question" vs "start an OSCE" vs "tutor me".
   *Promote/derive a user-facing supervisor agent.*
5. **Quality gates are per-endpoint, not reusable** — `generate-enhanced.ts` uses CoVe; auto-author optionally uses `runQualityGate()` when `ENABLE_QUALITY_GATE=true`. No shared PASS/FAIL gate before reservoir entry for all generation paths.
6. **Prompts are string literals** — no versioning, no eval harness, no declared tool
   manifests. *Evals + prompt library are missing entirely.*

---

## 6. Proposed Target Architecture: Orchestrator + Agent Pipeline

**Design principle: extend, don't rebuild.** The LangGraph registry/orchestrator/supervisor
substrate is already good. The plan wires it into a pipeline with gates and state.

```
                 ┌─────────────────────────────────────────────────────┐
                 │  User-facing Supervisor (supervisor-v2 derived)      │
                 │  LLM semantic routing + keyword fallback             │
                 │  "explain Q" → Tutor · "OSCE" → Encounter ·          │
                 │  "generate" → Generator · "grade" → Grader           │
                 └───────────────┬─────────────────────────────────────┘
                                 │ typed handoff (state.ts)
        ┌────────────────────────┼───────────────────────────┐
        ▼                        ▼                           ▼
 ┌──────────────┐        ┌──────────────┐           ┌──────────────────┐
 │ Tutor agent  │        │ OSCE agents  │           │ Generation agents│
 │ (exists)     │        │ (exist)      │           │ (consolidate)    │
 └──────────────┘        └──────────────┘           └────────┬─────────┘
                                                             ▼
                                             ┌────────────────────────────┐
                                             │ QUALITY GATE (new, shared) │
                                             │ Validator agent → PASS/FAIL│
                                             │ + feedback, retry ≤3, then │
                                             │ quarantine → staging lake  │
                                             │ (+ cross-model adversarial │
                                             │  review for clinical tier) │
                                             └────────────────────────────┘
                                                             │
                                                             ▼
                                             Reservoir / ReviewLog / UserProgress
                                             (existing persistence, unchanged)
```

### 6.1 Components

- **C1 — User-facing supervisor agent** (derived from `supervisor-v2.ts`): routes student
  intents to Tutor / OSCE / Explainer / Generator. Uses `aiGateway` tiers (cheap model for
  simple routing, powerful model when uncertain). First-ever central entry point for all
  student AI interactions.
- **C2 — Shared quality-gate service** (from agency-agents T4 + gstack T10): a reusable
  `runQualityGate(artifact, validatorAgent, { retries: 3 })` used by every generation
  endpoint; structured `PASS/FAIL + feedback`; on final FAIL → quarantine (staging lake
  flag), never the reservoir. Clinical-tier content additionally gets cross-model review.
- **C3 — Typed handoff packages** (T6): extend `PANaCEaAgentState` with explicit deliverable
  fields per pipeline (history → exam → DDx → SOAP) so agents hand structured bundles, not
  chat blobs — cuts token use and cold-start drift.
- **C4 — Session state coordinator**: Cloudflare **Durable Objects** (or Supabase-backed
  state as the lighter option) to persist OSCE/tutor sessions server-side; kills the
  client-replays-everything pattern.
- **C5 — Prompt library + eval harness**: `prompts/<agent>/` versioned Markdown with the
  standardized anatomy (§3.2) + inputs block/stop principle (§3.1), plus a LangSmith-backed
  eval suite (question validity, OSCE grading agreement) borrowing the shape of
  `awesome-llm-apps/agent_skills/evals`.

### 6.2 Where each repo's ideas land

| Idea | Source | PANaCEa landing spot |
|---|---|---|
| Inputs block + stop principle | system-prompts | All agent prompts (C5) |
| Quality gates + Dev↔QA retry loop | agency-agents | `functions/api/questions/generate*.ts`, autoAuthor (C2) |
| Agent anatomy standardization | agency-agents | `AgentDefinition` in `lib/agents/` (C5) |
| RAG corrections / failure diagnostics | awesome-llm-apps | clinical library search, deep-context gen (future) |
| Eval harness | awesome-llm-apps + gstack | LangSmith + new eval suite (C5) |
| Cross-model adversarial review | gstack | Clinical-tier quality gate (C2) |
| Session/memory persistence | gstack (GBrain) | Durable Objects / Supabase (C4) — own stack, not PGLite |
| Prompt-injection layering | gstack | OSCE transcript / web-content ingestion |
| Browser daemon for E2E | gstack | `e2e/` + `panacea-verify` (dev tooling, optional) |
| Tool manifest per agent | system-prompts (Manus) | `AGENT_TOOLS` in `lib/agents/shared/tools.ts` |

---

## 7. Phased Implementation Plan (NOT executed — proposal only)

Each phase is independently shippable and testable. Order = dependency + value.

- **Phase 1 — User-facing supervisor.** Promote `supervisor-v2.ts` → user-facing router with
  intent tests (tutor/OSCE/explain/generate). 1–3 files + tests.
- **Phase 2 — Shared quality gate.** Extract CoVe-style verification into
  `runQualityGate()`; wire into `generate.ts`, `generate-deep.ts`, autoAuthor. Structured
  validator output + retry ≤3 + quarantine flag. Regression tests around
  PASS→reservoir / FAIL→quarantine.
- **Phase 3 — Endpoint consolidation onto orchestrator.** ✅ Done for `generate-enhanced` and
  `live-engine`: flows registered as orchestrator strategies with typed state and standard
  logging/telemetry; endpoint signatures unchanged. See `docs/api/API_OVERVIEW.md`.
- **Phase 4 — Session state coordinator.** Durable Objects (or Supabase sessions) for
  OSCE/tutor; server-side resume; kill client-replay. Verify edge runtime constraints.
- **Phase 5 — Prompt library + evals.** Versioned `prompts/` catalog with anatomy + inputs
  blocks; LangSmith eval suite for question validity and OSCE grading; tool manifests from
  `AGENT_TOOLS`.

**Deliberately out of scope for now:** RAG catalog adoption (T7), always-on agent rewrites,
browser daemon (T11), prompt-injection layering (T13) — parked as future work.

---

## 8. Constraints & Guardrails

- **Edge runtime:** all production agents must stay Node-free (keep `registry.encounter.ts`
  split). No `process.env` — use `context.env.*`. `safePrismaDisconnect` in every handler.
- **No Prisma in frontend; no auth/RLS bypasses; no medical diagnosis claims** in agent
  output (tutor/OSCE/question agents must stay within educational scope).
- **FSRS invariants:** quality gates must never alter binary Again/Good, MVRT filtering, or
  `review_type: 'real'` gating. Ghost Grader remains the only rating override.
- **Licensing:** GPL-3.0 (system-prompts repo) = **patterns only, no verbatim copying**.
  Apache-2.0 (awesome-llm-apps) = adaptable with attribution. MIT (agency-agents, gstack) =
  free. Record provenance in the prompt library.
- **Cost:** routing via `aiGateway` tiers + `CostTracker`; quality-gate retries capped (≤3)
  to bound worst-case spend; cross-model review only on clinical-tier content.
- **Tests:** 3200+ passing suite must stay green; each phase ships with regression tests
  (`npm run test:critical` for FSRS-adjacent changes; targeted Vitest otherwise).

---

## 9. References

- https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools (GPL-3.0)
- https://github.com/msitarzewski/agency-agents (MIT) — esp. `specialized/agents-orchestrator.md`
- https://github.com/Shubhamsaboo/awesome-llm-apps (Apache-2.0) — esp. `rag_tutorials/`,
  `agent_skills/evals`, `advanced_ai_agents/multi_agent_apps/`
- https://github.com/garrytan/gstack (MIT) — esp. `ARCHITECTURE.md`, `ON_THE_LOC_CONTROVERSY.md`
- Internal: `lib/agents/**`, `lib/ai/aiGateway.ts`, `lib/langchain/**`, `lib/services/autoAuthor/**`,
  `lib/srs/ghostGrader.ts`, `functions/api/osce/live-engine.ts`,
  `functions/api/questions/generate*.ts`
