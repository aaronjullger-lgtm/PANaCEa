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
