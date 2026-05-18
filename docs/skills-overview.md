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
| `think` | `.agents/skills/think` | Support strategic decision-making and priority reasoning outside direct repo execution. |
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

## Reusable Engineering Skills

| Skill | Folder | Description |
| --- | --- | --- |
| `api-database-audit-and-fix` | `.agents/skills/api-database-audit-and-fix` | Audit and fix API endpoints, database connections, environment config, authorization rules, and RLS policies. |
| `optimize-ci-cd` | `.agents/skills/optimize-ci-cd` | Audit, fix, and optimize CI/CD workflows, caching, environment variables, secrets, and deployment steps. |
| `security-and-privacy-audit` | `.agents/skills/security-and-privacy-audit` | Identify and fix high-risk authentication, authorization, secrets, API, database, payment, and logging issues. |
| `performance-audit-optimise` | `.agents/skills/performance-audit-optimise` | Audit and optimize route performance, bundle size, rendering, images, 3D components, API calls, and database queries. |
| `spaced-repetition-scheduler-improve` | `.agents/skills/spaced-repetition-scheduler-improve` | Improve spaced repetition, review queues, study scheduling, retention, due dates, and readiness scheduling. |
| `ai-agent-design-and-eval` | `.agents/skills/ai-agent-design-and-eval` | Design, implement, evaluate, and improve task-specific AI agents, tutors, schedulers, generators, and explainers. |
| `product-improvement-planner` | `.agents/skills/product-improvement-planner` | Analyze product journeys, brainstorm improvements, prioritize by impact/effort/risk, and plan implementation. |
| `release-readiness` | `.agents/skills/release-readiness` | Verify functionality, safety, performance, accessibility, docs, release notes, and rollback before production deployment. |
| `post-launch-monitoring-and-response` | `.agents/skills/post-launch-monitoring-and-response` | Set up post-launch monitoring, incident triage, runbooks, user communication, and postmortems. |
| `supabase` | `.agents/skills/supabase` | Handle Supabase products, auth, SSR integrations, RLS, migrations, storage, realtime, vectors, CLI, and MCP work. |
