# Skills Overview

StudyPANaCEa exposes these skills through the repo-local `.agents/skills` directory. For routing rules and prompt guidance, see [skills-usage.md](skills-usage.md).

## Routing And General Workflow

| Skill | Folder | Description |
| --- | --- | --- |
| `skill-routing-and-usage` | `.agents/skills/skill-routing-and-usage` | Choose, combine, audit, or optimize local agent skills; use when a request could match multiple workflow skills. |
| `panacea-navigator` | `.agents/skills/panacea-navigator` | Navigate the StudyPANaCEa codebase, trace ownership, and decide where repo work belongs. |
| `repo-operating-system` | `.agents/skills/repo-operating-system` | Audit the repo and maintain AGENTS.md, repo maps, architecture docs, dev commands, and project standards. |
| `debug-reproduce-isolate` | `.agents/skills/debug-reproduce-isolate` | Reproduce bugs, isolate root causes, implement minimal fixes, and add regression tests. |
| `setup-testing-safety-net` | `.agents/skills/setup-testing-safety-net` | Build or improve unit, integration, and E2E test coverage for critical flows. |
| `panacea-verify` | `.agents/skills/panacea-verify` | Choose and run StudyPANaCEa-specific verification commands and summarize check results. |
| `panacea-regression-guard` | `.agents/skills/panacea-regression-guard` | Write PANaCEa regression tests, hunt for regressions, fill test coverage gaps, and add browser/route smoke tests. |
| `panacea-repo-hygiene` | `.agents/skills/panacea-repo-hygiene` | Find and remove dead code, duplicate pathways, deprecated shells, stale docs, and unused dependencies. |
| `think` | `.agents/skills/think` | Support strategic decision-making and priority reasoning outside direct repo execution. |
| `panacea-syncytium-coordinator` | `.agents/skills/panacea-syncytium-coordinator` | Sequence multi-agent work, prevent conflicting edits, assign ownership, and maintain the living development plan. |
| `wrap-up` | `.agents/skills/wrap-up` | Close a session with issue capture, handoff notes, and optional shipping steps. |

## StudyPANaCEa Product Skills

| Skill | Folder | Description |
| --- | --- | --- |
| `aidesigner-frontend` | `.agents/skills/aidesigner-frontend` | Create or redesign frontends, landing pages, dashboards, marketing pages, and UI flows with AIDesigner guidance. |
| `panacea-view-composition` | `.agents/skills/panacea-view-composition` | Work on pages, routes, lazy components, navigation, app shell layout, protected routes, and frontend composition. |
| `panacea-dashboard-analytics` | `.agents/skills/panacea-dashboard-analytics` | Work on dashboards, readiness projections, analytics APIs, metric cards, charts, and displayed learning metrics. |
| `panacea-content-refinery` | `.agents/skills/panacea-content-refinery` | Work on clinical content ingestion, enrichment, AI question generation, citations, media approval, and quality loops. |
| `panacea-edge-endpoints` | `.agents/skills/panacea-edge-endpoints` | Add, fix, review, or test production Cloudflare Pages Functions endpoints under `functions/api`. |
| `panacea-fsrs-guardrails` | `.agents/skills/panacea-fsrs-guardrails` | Work on FSRS, SRS, spaced repetition, review scheduling, implicit ratings, telemetry, and review submission. |
| `panacea-session-pipeline` | `.agents/skills/panacea-session-pipeline` | Work on study sessions, QuizView, drill modes, answer submission, sync queues, telemetry, and persisted analytics. |
| `panacea-offline-sync` | `.agents/skills/panacea-offline-sync` | Work on offline-first behavior, PWA cache, sync queues, retries, idempotency, and progress-loss bugs. |
| `panacea-osce-simulation` | `.agents/skills/panacea-osce-simulation` | Work on OSCE, virtual patient, SOAP note, grading rubric, station flow, and AI-mediated encounters. |
| `panacea-prisma-data-integrity` | `.agents/skills/panacea-prisma-data-integrity` | Work on Prisma schema, migrations, Supabase/Postgres integrity, model relationships, indexes, and production-like data scripts. |
| `panacea-identity-migration` | `.agents/skills/panacea-identity-migration` | Design and implement canonical question/source/concept identity migrations, backfill scripts, database probes, and identity contract rollout. |
| `panacea-question-generation` | `.agents/skills/panacea-question-generation` | Own the AI question generation pipeline: primary, RAG, enhanced, deep-context, batch, staging, and canonical schema. |
| `panacea-study-plan` | `.agents/skills/panacea-study-plan` | Work on study plan generation, daily planning, StudyPlanTask V2 consolidation, progress tracking, and task completion. |
| `panacea-clinical-content-auditor` | `.agents/skills/panacea-clinical-content-auditor` | Audit medical accuracy, clinical correctness, drug data, condition descriptions, and medical database integrity. |

## Memory And Retrieval Skills

| Skill | Folder | Description |
| --- | --- | --- |
| `memory-discovery` | `.agents/skills/memory-discovery` | Audit RAG, vector memory, graph memory, tabular memory, agent memory, retrieval routing, prompts, context injection, and memory storage/config. |
| `rag-quality` | `.agents/skills/rag-quality` | Improve or review retrieval quality, vector search, embeddings, chunking, reranking, CRAG, library search, question RAG, and source attribution. |
| `hybrid-retrieval` | `.agents/skills/hybrid-retrieval` | Combine vector, keyword, graph, table, and cached-content memory into a single answer context. |
| `graph-memory` | `.agents/skills/graph-memory` | Work on graph memory, entity/relation extraction, knowledge graph schemas, graph traversal, GraphRAG, prerequisite graphs, and graph-backed learning paths. |
| `tabular-memory` | `.agents/skills/tabular-memory` | Review SQL-backed memory, learner progress, FSRS state, question attempts, review logs, study sessions, semantic cache, knowledge cache, CSV imports, and table/query correctness. |
| `memory-safety` | `.agents/skills/memory-safety` | Review memory ingestion, prompt context, cached content, retention/deletion, privacy, provenance, memory poisoning, prompt injection, and source governance. |
| `memory-regression-eval` | `.agents/skills/memory-regression-eval` | Add or run memory evals, golden queries, retrieval regression tests, graph traversal tests, table-memory tests, and CI gates for memory quality. |

Memory workflow scripts:

- `npm run eval:memory`: run the offline golden-query and fixture retrieval gate.
- `npm run test:memory`: run the focused memory/RAG/graph/tabular regression suite.
- `npm run verify:memory`: run both gates in sequence.

## Observability Skills

| Skill | Folder | Description |
| --- | --- | --- |
| `langfuse` | `.agents/skills/langfuse` | Add or audit Langfuse tracing, query traces via the CLI, migrate prompts, manage datasets/scores, and follow Langfuse best practices. Source: [langfuse/skills](https://github.com/langfuse/skills). |

Instrumented in PANaCEa: every AI Gateway call in `lib/ai/aiGateway.ts` (`callText`, `callStructured`, `callVision`, `callStream`) emits a Langfuse trace + generation via `traceGatewayCall` in `lib/observability/langfuse.ts`. No-op when `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` are absent.

## LangChain Ecosystem Skills

Source: [langchain-ai/langchain-skills](https://github.com/langchain-ai/langchain-skills). Used for the `langchain-agent` sibling repo (Python dev agents that operate on PANaCEa). Traced to LangSmith project `panacea-dev-agents`.

### Routing & Primer

| Skill | Folder | Description |
| --- | --- | --- |
| `ecosystem-primer` | `.agents/skills/ecosystem-primer` | INVOKE FIRST for any LangChain/LangGraph/Deep Agents work. Framework selection, env setup, which skill to load next. |
| `langchain-dependencies` | `.agents/skills/langchain-dependencies` | Package version + dependency management reference (Python + TypeScript). |

### Quickstarts

| Skill | Folder | Description |
| --- | --- | --- |
| `langchain-python-quickstart` | `.agents/skills/langchain-python-quickstart` | Minimal local LangChain agent (Python). **Currently used** by `~/GitHub/langchain-agent/`. |
| `langchain-typescript-quickstart` | `.agents/skills/langchain-typescript-quickstart` | Same, TypeScript. |
| `langgraph-python-quickstart` | `.agents/skills/langgraph-python-quickstart` | LangGraph math agent (Python). |
| `langgraph-typescript-quickstart` | `.agents/skills/langgraph-typescript-quickstart` | LangGraph math agent (TypeScript). |
| `deepagents-python-quickstart` | `.agents/skills/deepagents-python-quickstart` | Deep Agents research agent (Python). |
| `deepagents-typescript-quickstart` | `.agents/skills/deepagents-typescript-quickstart` | Deep Agents research agent (TypeScript). |

### LangChain

| Skill | Folder | Description |
| --- | --- | --- |
| `langchain-fundamentals` | `.agents/skills/langchain-fundamentals` | Agents with `create_agent`, tools, structured output, middleware basics. |
| `langchain-middleware` | `.agents/skills/langchain-middleware` | Human-in-the-loop approval, custom middleware, Command resume. |
| `langchain-rag` | `.agents/skills/langchain-rag` | RAG pipeline (document loaders, embeddings, vector stores). |

### LangGraph

| Skill | Folder | Description |
| --- | --- | --- |
| `langgraph-fundamentals` | `.agents/skills/langgraph-fundamentals` | StateGraph, nodes, edges, state reducers. |
| `langgraph-persistence` | `.agents/skills/langgraph-persistence` | Checkpointers, thread_id, cross-thread memory. |
| `langgraph-cli` | `.agents/skills/langgraph-cli` | CLI lifecycle: scaffold, dev, build, deploy, langgraph.json. |
| `langgraph-human-in-the-loop` | `.agents/skills/langgraph-human-in-the-loop` | Interrupts, human review, approval workflows. |

### Deep Agents (destination for autonomous dev agents)

| Skill | Folder | Description |
| --- | --- | --- |
| `deep-agents-core` | `.agents/skills/deep-agents-core` | Agent architecture, harness setup, SKILL.md format. **Next step toward autonomous dev agents.** |
| `deep-agents-memory` | `.agents/skills/deep-agents-memory` | Memory, persistence, filesystem middleware. |
| `deep-agents-orchestration` | `.agents/skills/deep-agents-orchestration` | Subagents, task planning, human-in-the-loop. |
| `managed-deep-agents` | `.agents/skills/managed-deep-agents` | Managed Deep Agents: deploy with the CLI, stream runs, MCP tools, React `useStream`. |
| `panacea-deep-agents` | `.agents/skills/panacea-deep-agents` | Repo-native Deep-Agents-inspired infra: subagent fan-out, virtual FS offload, persistent checkpoint, enhanced orchestrator, agent pipelines. |

### Evaluation & Utilities

| Skill | Folder | Description |
| --- | --- | --- |
| `eval-engineering` | `.agents/skills/eval-engineering` | Build/run/audit Harbor evals for an agent. Requires Harbor + Docker. |
| `swarm` | `.agents/skills/swarm` | Dispatch independent work items in parallel and aggregate results. |

## Reusable Engineering Skills

| Skill | Folder | Description |
| --- | --- | --- |
| `api-database-audit-and-fix` | `.agents/skills/api-database-audit-and-fix` | Audit and fix API endpoints, database connections, environment config, authorization rules, and RLS policies. |
| `optimize-ci-cd` | `.agents/skills/optimize-ci-cd` | Audit, fix, and optimize CI/CD workflows, caching, environment variables, secrets, and deployment steps. |
| `security-and-privacy-audit` | `.agents/skills/security-and-privacy-audit` | Identify and fix high-risk authentication, authorization, secrets, API, database, payment, and logging issues. |
| `panacea-auth-guard` | `.agents/skills/panacea-auth-guard` | Audit PANaCEa-specific Clerk integration, RBAC, token handling, route protection, and authorization consistency. |
| `panacea-deployment-guard` | `.agents/skills/panacea-deployment-guard` | Work on Cloudflare Pages deployment, Wrangler config, KV namespaces, CSP headers, redirects, and deployment smoke. |
| `performance-audit-optimise` | `.agents/skills/performance-audit-optimise` | Audit and optimize route performance, bundle size, rendering, images, 3D components, API calls, and database queries. |
| `spaced-repetition-scheduler-improve` | `.agents/skills/spaced-repetition-scheduler-improve` | Improve spaced repetition, review queues, study scheduling, retention, due dates, and readiness scheduling. |
| `ai-agent-design-and-eval` | `.agents/skills/ai-agent-design-and-eval` | Design, implement, evaluate, and improve task-specific AI agents, tutors, schedulers, generators, and explainers. |
| `product-improvement-planner` | `.agents/skills/product-improvement-planner` | Analyze product journeys, brainstorm improvements, prioritize by impact/effort/risk, and plan implementation. |
| `release-readiness` | `.agents/skills/release-readiness` | Verify functionality, safety, performance, accessibility, docs, release notes, and rollback before production deployment. |
| `post-launch-monitoring-and-response` | `.agents/skills/post-launch-monitoring-and-response` | Set up post-launch monitoring, incident triage, runbooks, user communication, and postmortems. |
| `supabase` | `.agents/skills/supabase` | Handle Supabase products, auth, SSR integrations, RLS, migrations, storage, realtime, vectors, CLI, and MCP work. |

## ECC-Inspired Agent Engineering Skills

Adapted from the [ECC repo](https://github.com/affaan-m/ecc) for PANaCEa's workflow.

| Skill | Folder | Description |
| --- | --- | --- |
| `context-budget` | `.agents/skills/context-budget` | Audit token overhead across agents, skills, MCP servers, and rules. Use when context window feels heavy. |
| `delivery-gate` | `.agents/skills/delivery-gate` | Session-level quality gate — checks uncommitted work, tests, types, console.log, security, and rationalization before declaring done. |
| `continuous-learning-v2` | `.agents/skills/continuous-learning-v2` | Instinct-based learning — extract reusable patterns from sessions with confidence scoring. Use at session end. |
| `eval-harness` | `.agents/skills/eval-harness` | Eval-driven development for AI features — capability evals, regression evals, pass@k metrics for question gen, tutoring, OSCE. |
| `post-edit-verify` | `.agents/skills/post-edit-verify` | Post-edit verification — lint, typecheck, and security scan on changed files. Includes pre-commit hook setup. |
| `agent-introspection` | `.agents/skills/agent-introspection` | Four-phase agent self-debugging loop (capture → diagnosis → recovery → report). Use when agent workflows fail repeatedly. |

## ECC Stack & Domain Skills (vended from upstream)

Vended as-is from the [ECC repo](https://github.com/affaan-m/everything-claude-code) on 2026-08-01. Curated to fill gaps not covered by existing skills; selected from 281 candidates after stack/domain/redundancy filtering. Each is a standalone `SKILL.md` (no `references/` or `scripts/`). Do not duplicate functionality already owned by a `panacea-*` skill — use these as generic pattern references, fall back to project-specific skills for PANaCEa internals.

### Frontend stack patterns (React 19 + Vite 6)

| Skill | Folder | Description |
| --- | --- | --- |
| `accessibility` | `.agents/skills/accessibility` | WCAG 2.2 AA implementation: semantic ARIA, POUR principles, target size, focus appearance, contrast. Use when defining UI specs, auditing a11y barriers, or implementing 2.2 SCs. |
| `react-patterns` | `.agents/skills/react-patterns` | React 18/19 idioms: hooks discipline, Suspense + error boundaries, server/client component boundaries, form actions, state management decision trees, accessibility-first defaults. |
| `react-performance` | `.agents/skills/react-performance` | 70+ Vercel Engineering rules across 8 priority categories (re-renders, bundles, hydration, lazy loading, data fetching). Use when optimizing React rendering or payload. |
| `react-testing` | `.agents/skills/react-testing` | React Testing Library + Vitest/Jest + MSW + axe assertions. Boundary guidance between component tests and Playwright/Cypress. Complements `vitest-author` (project conventions). |
| `vite-patterns` | `.agents/skills/vite-patterns` | Vite config, plugins, HMR, env vars, proxy, library mode, dependency pre-bundling, build optimization. Activate on `vite.config.ts` edits or build-perf work. |

### Data layer patterns (Prisma 7 + Postgres/Supabase)

| Skill | Folder | Description |
| --- | --- | --- |
| `prisma-patterns` | `.agents/skills/prisma-patterns` | Prisma ORM patterns + critical traps (updateMany returns count, `$transaction` timeouts, N+1, pagination, migrations). Complements project-specific `panacea-prisma-data-integrity` and `migration-safety`. |
| `postgres-patterns` | `.agents/skills/postgres-patterns` | Postgres schema design, indexing, query optimization, security. Supabase best practices. Complements `panacea-prisma-data-integrity` (integrity) and `supabase` (Supabase-specific). |

### Quality, infra, and integration

| Skill | Folder | Description |
| --- | --- | --- |
| `error-handling` | `.agents/skills/error-handling` | Typed errors, error boundaries, retries, circuit breakers, user-facing messages. Cross-stack (TS/Py/Go). Complements `async-state-hardening` (loading/empty states). |
| `e2e-testing` | `.agents/skills/e2e-testing` | Playwright patterns: Page Object Model, config, CI integration, artifact management, flaky-test strategies. Use for `e2e/` work. |
| `mcp-server-patterns` | `.agents/skills/mcp-server-patterns` | Build MCP servers with Node/TS SDK: tools, resources, prompts, Zod validation, stdio vs Streamable HTTP. Use when authoring a new MCP server. |

### Clinical domain (synergy with PANaCEa clinical content)

| Skill | Folder | Description |
| --- | --- | --- |
| `healthcare-cdss-patterns` | `.agents/skills/healthcare-cdss-patterns` | Clinical Decision Support patterns: drug interaction checking, dose validation, clinical scoring (NEWS2, qSOFA), alert severity. Relevant to clinical content enrichment, drug data, scoring rubrics. |
| `scientific-db-pubmed-database` | `.agents/skills/scientific-db-pubmed-database` | PubMed/NCBI E-utilities search workflows (MeSH queries, PMID lookup, citation retrieval). Use for evidence-based clinical content grounding and citation provenance. Complements `clinical-library-search` (internal content). |

## AI Gateway (9Router) Skills

9Router is a local/remote AI gateway (`NINEROUTER_URL`, default `http://localhost:20128`) with OpenAI-compatible REST. Copied from user-level opencode global skills on 2026-08-02 so all repo agents (Codex/OpenClaw) can use them. Start/verify/stop: see `docs/STARTUP.md`. Entry skill includes setup, auth, model discovery, and error handling; capability skills cover each REST endpoint.

| Skill | Folder | Description |
| --- | --- | --- |
| `9router` | `.agents/skills/9router` | Entry point — setup, `NINEROUTER_URL`/key env, model discovery (`/v1/models[/image|tts|embedding|web|stt|image-to-text]`), error taxonomy. Fetch the capability SKILL.md referenced for each workflow. |
| `9router-chat` | `.agents/skills/9router-chat` | Chat/codegen via `/v1/chat/completions` or Anthropic `/v1/messages`, streaming, auto-fallback combos. Use to ask an LLM or generate code through the gateway. |
| `9router-image` | `.agents/skills/9router-image` | Image generation via `/v1/images/generations` (OpenAI/Imagen/DALL-E/FLUX/MiniMax/SDWebUI/ComfyUI/Codex). |
| `9router-tts` | `.agents/skills/9router-tts` | Text-to-speech via `/v1/audio/speech` (ElevenLabs/Edge/OpenAI/Deepgram voices). |
| `9router-stt` | `.agents/skills/9router-stt` | Speech-to-text via `/v1/audio/transcriptions` (Whisper/Groq/Gemini/Deepgram). |
| `9router-embeddings` | `.agents/skills/9router-embeddings` | Embeddings via `/v1/embeddings` (OpenAI/Gemini/Mistral/Voyage/Nvidia/GitHub) for RAG, semantic search, similarity. Complements repository RAG/vector work. |
| `9router-web-search` | `.agents/skills/9router-web-search` | Web search via `/v1/search` (Tavily/Exa/Brave/Serper/SearXNG/Google PSE/Linkup/SearchAPI/You.com/Perplexity). Use when gateway search is preferred over built-in websearch. |
| `9router-web-fetch` | `.agents/skills/9router-web-fetch` | URL → markdown/text/HTML via `/v1/web/fetch` (Firecrawl/Jina Reader/Tavily Extract/Exa Contents). Use to scrape or read pages through the gateway. |
