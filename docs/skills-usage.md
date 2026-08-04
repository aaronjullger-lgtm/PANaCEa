# Codex Skills Usage Guide

Use this guide when deciding which `.agents/skills` workflow should drive a StudyPANaCEa task.

## Routing Order

1. Start with `skill-routing-and-usage` when a request could match multiple skills, asks to optimize skill usage, or changes `.agents/skills`.
2. For StudyPANaCEa code work, use `panacea-navigator` first when file ownership or data flow is unclear.
3. Prefer narrow PANaCEa-specific skills over generic reusable skills when product internals are involved.
4. Add generic reusable skills as workflow wrappers only when they add process discipline: `debug-reproduce-isolate`, `security-and-privacy-audit`, `performance-audit-optimise`, `release-readiness`, or `post-launch-monitoring-and-response`.
5. Use `panacea-verify` to choose validation commands for code changes. Do not guess verification commands when this skill has a more precise route.
6. Use `supabase` as a secondary skill for Supabase-specific implementation details; use `panacea-prisma-data-integrity` as primary when Prisma schema, migrations, or PANaCEa data relationships are central.
7. Do not load every plausible skill. Pick one primary skill, then one or two secondary skills only when they add necessary constraints.

## Common Skill Combinations

| Request | Primary skill | Secondary skills |
| --- | --- | --- |
| "Find where this belongs" | `panacea-navigator` | Narrower `panacea-*` skill once identified |
| "Fix an API endpoint" | `panacea-edge-endpoints` | `security-and-privacy-audit`, `api-database-audit-and-fix`, `panacea-verify` |
| "Change FSRS or review scheduling" | `panacea-fsrs-guardrails` | `spaced-repetition-scheduler-improve`, `panacea-session-pipeline`, `panacea-verify` |
| "Fix answer submission or drill telemetry" | `panacea-session-pipeline` | `panacea-fsrs-guardrails`, `panacea-offline-sync`, `panacea-verify` |
| "Work on dashboard readiness metrics" | `panacea-dashboard-analytics` | `panacea-prisma-data-integrity`, `panacea-verify` |
| "Redesign a page or navigation flow" | `panacea-view-composition` | `aidesigner-frontend`, `performance-audit-optimise`, `panacea-verify` |
| "Improve clinical content generation" | `panacea-content-refinery` | `ai-agent-design-and-eval`, `security-and-privacy-audit` |
| "Audit memory or retrieval architecture" | `memory-discovery` | `rag-quality`, `memory-safety`, `panacea-prisma-data-integrity` |
| "Improve RAG answer quality" | `rag-quality` | `hybrid-retrieval`, `memory-regression-eval`, `memory-safety` |
| "Work on graph-backed learning paths" | `graph-memory` | `memory-regression-eval`, `panacea-prisma-data-integrity`, `panacea-verify` |
| "Review SQL-backed learner memory" | `tabular-memory` | `memory-safety`, `panacea-prisma-data-integrity`, `panacea-verify` |
| "Audit auth, secrets, privacy, or cross-user access" | `security-and-privacy-audit` | `panacea-edge-endpoints`, `panacea-prisma-data-integrity` |
| "Prepare to ship" | `release-readiness` | `panacea-verify`, `optimize-ci-cd`, `security-and-privacy-audit` |
| "Monitor after launch or handle an incident" | `post-launch-monitoring-and-response` | `debug-reproduce-isolate`, affected `panacea-*` skill |
| "Coordinate multi-agent sprint or sequencing" | `panacea-syncytium-coordinator` | `panacea-navigator`, `panacea-verify`, affected `panacea-*` skill |
| "Resolve file ownership conflicts" | `panacea-syncytium-coordinator` | `panacea-navigator` |
| "Determine next priority / what to work on" | `panacea-syncytium-coordinator` | `product-improvement-planner` |
| "Audit clinical/medical content correctness" | `panacea-clinical-content-auditor` | `panacea-content-refinery`, `panacea-prisma-data-integrity` |
| "Work on AI question generation pipeline" | `panacea-question-generation` | `panacea-content-refinery`, `panacea-edge-endpoints`, `panacea-verify` |
| "Write regression tests or hunt regressions" | `panacea-regression-guard` | `panacea-verify`, affected `panacea-*` skill, `setup-testing-safety-net` |
| "Deploy or configure Cloudflare/Wrangler" | `panacea-deployment-guard` | `release-readiness`, `security-and-privacy-audit`, `panacea-verify` |
| "Design or run identity/schema migration" | `panacea-identity-migration` | `panacea-prisma-data-integrity`, `panacea-verify` |
| "Clean up dead code or repo debt" | `panacea-repo-hygiene` | `repo-operating-system`, `panacea-verify` |
| "Audit Clerk auth/RBAC/token security" | `panacea-auth-guard` | `security-and-privacy-audit`, `panacea-edge-endpoints` |
| "Fix study plan generation or V2 consolidation" | `panacea-study-plan` | `panacea-fsrs-guardrails`, `panacea-dashboard-analytics`, `panacea-session-pipeline` |
| "Audit API, database, or Supabase connection issues" | `api-database-audit-and-fix` | `supabase`, `security-and-privacy-audit`, `panacea-edge-endpoints` |
| "Optimize CI/CD, GitHub Actions, or deployment pipeline" | `optimize-ci-cd` | `release-readiness`, `panacea-deployment-guard`, `panacea-verify` |
| "Work on OSCE, virtual patients, SOAP notes, or station flow" | `panacea-osce-simulation` | `ai-agent-design-and-eval`, `security-and-privacy-audit`, `panacea-edge-endpoints` |
| "Work on subagent fan-out, virtual FS, or agent pipelines" | `panacea-deep-agents` | `ai-agent-design-and-eval`, `panacea-edge-endpoints`, `panacea-verify` |
| "Combine vector, keyword, graph, and table memory" | `hybrid-retrieval` | `rag-quality`, `memory-regression-eval`, `memory-safety` |
| "End session, save progress, write handoff, commit" | `wrap-up` | Release or verification skill if near ship point |
| "Personal decision support or priority reasoning" | `think` | None (non-code work) |
| "WCAG 2.2 / ARIA / accessibility audit or implementation" | `accessibility` | `panacea-style-system`, `panacea-verify` |
| "React 19 hooks, Suspense, state decision, or component patterns" | `react-patterns` | `react-refactor` (if decomposition needed), `panacea-style-system` |
| "React rendering perf, bundle, or hydration optimization" | `react-performance` | `perf-bundle-edge`, `performance-audit-optimise`, `panacea-verify` |
| "React component test (RTL/Vitest/MSW) or component-vs-E2E boundary" | `react-testing` | `vitest-author` (PANaCEa conventions), `panacea-regression-guard` |
| "vite.config.ts edit, plugin work, or build-perf" | `vite-patterns` | `perf-bundle-edge`, `panacea-verify` |
| "Prisma ORM pattern or trap (updateMany, $transaction, N+1)" | `prisma-patterns` | `panacea-prisma-data-integrity` (PANaCEa integrity primary), `migration-safety` |
| "Postgres schema, indexing, or query optimization" | `postgres-patterns` | `panacea-prisma-data-integrity`, `supabase`, `panacea-verify` |
| "Typed errors, retries, circuit breakers, error UX" | `error-handling` | `async-state-hardening`, `panacea-edge-endpoints` |
| "Playwright E2E pattern, POM, or flaky-test strategy" | `e2e-testing` | `panacea-regression-guard`, `panacea-verify` |
| "Build a new MCP server (TS SDK, tools/resources/prompts)" | `mcp-server-patterns` | `panacea-verify` |
| "Clinical scoring, dose validation, drug interaction logic" | `healthcare-cdss-patterns` | `panacea-clinical-content-auditor`, `clinical-content-gen`, `panacea-content-refinery` |
| "PubMed literature search for citation grounding" | `scientific-db-pubmed-database` | `clinical-library-search`, `panacea-clinical-content-auditor` |
| "Chat/codegen via 9Router gateway" | `9router-chat` | `9router` (setup/model discovery on first use) |
| "Image/TTS/STT/embeddings via 9Router" | `9router-image` / `9router-tts` / `9router-stt` / `9router-embeddings` | `9router` (setup/model discovery on first use) |
| "Web search or URL fetch via 9Router" | `9router-web-search` / `9router-web-fetch` | `9router` (setup/model discovery on first use) |

## Prompt Engineering Defaults

1. State the intended outcome before implementation: bug fix, feature, audit, refactor, verification, release, or incident response.
2. Name the primary skill and any secondary skills in the working summary when a task is broad.
3. Ask Codex for specific output when useful: changed files, verification commands, risks, rollback notes, or follow-up tasks.
4. Prefer narrow, evidence-seeking prompts: "Trace the answer submission path and add a regression test for duplicate ReviewLog writes" is better than "fix the drill system."
5. For safety-critical work, include explicit constraints: no FSRS Hard/Easy ratings, no production migrations without approval, no secrets in logs, no frontend Prisma imports, and no medical diagnosis claims.
6. For UI work, include the StudyPANaCEa visual direction from `AGENTS.md` and ask for browser verification when changing visible pages.

## Maintenance Workflow

1. Add skills only under `.agents/skills/<skill-name>`.
2. Keep `SKILL.md` front matter trigger-oriented. The description should say when to use the skill and when not to use it if false activation is likely.
3. Keep skill bodies procedural: numbered steps, safety rules, acceptance criteria, verification commands, and summary requirements.
4. Move large examples or route matrices into `references/`. Move deterministic checks into `scripts/`.
5. Update `docs/skills-overview.md` whenever skills are added, renamed, removed, or substantially repurposed.
6. For memory-skill changes, keep `npm run verify:memory` green or document the blocker.
7. Run `.agents/skills/skill-routing-and-usage/scripts/audit-skills.sh /Users/aaronullger/GitHub/StudyPANaCEa` after skill edits.

## Codex Discovery

Codex discovers repo-local skills from `.agents/skills` when working inside this repository. Keeping the reusable skills inside this repo makes them available to Codex sessions even when the user-level `/Users/aaronullger/.agents/skills` directory is outside the repository discovery path.
