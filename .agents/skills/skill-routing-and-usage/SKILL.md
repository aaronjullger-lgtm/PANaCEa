---
name: skill-routing-and-usage
description: Use to choose, combine, audit, or optimize local agent skills. Trigger when the user asks which skill to use, asks to improve skills usage, asks to audit .agents/skills, or gives a broad request that could match multiple workflow skills.
---

1. Inspect the user request and identify the work type before loading domain-specific skills. Classify the request as StudyPANaCEa repo navigation, frontend/UI, content, dashboard analytics, Edge API, FSRS/scheduling, session pipeline, offline sync, OSCE, Prisma/data integrity, verification, setup, debugging, CI/CD, security, performance, AI-agent, product planning, release, monitoring, Supabase, decision support, or session wrap-up.
2. Prefer StudyPANaCEa-specific skills over generic reusable skills when the request touches product internals. Use `panacea-navigator` as the default map for repo work, then choose the narrowest `panacea-*` skill for the affected domain.
3. Select one primary skill that owns the workflow. Prefer the skill whose description names the user's requested outcome, not merely a technology mentioned in passing.
4. Add secondary skills only when they provide required constraints. Use `panacea-verify` for verification selection, `supabase` for Supabase-specific details, `security-and-privacy-audit` for auth/privacy risk, `release-readiness` for production ship gates, and `aidesigner-frontend` for AIDesigner-driven UI generation or redesign.
5. If multiple skills appear equally relevant, choose the safest process skill first: `debug-reproduce-isolate` for failures, `security-and-privacy-audit` for suspected exposure or authorization risk, `repo-operating-system` for setup/documentation, `product-improvement-planner` for open-ended strategy, and `panacea-navigator` for unclear StudyPANaCEa code ownership.
6. Read `references/routing-matrix.md` when the route is unclear, when adding a new skill, or when updating skill descriptions. Keep the matrix aligned with the current `.agents/skills` inventory.
7. For skill library maintenance, run `scripts/audit-skills.sh` from the repository root after edits. Fix missing `SKILL.md` files, invalid front matter, duplicate names, and stale overview rows before reporting completion.
8. Keep skill descriptions concise and trigger-oriented. Include when to use the skill, common trigger words, and important exclusions only when they prevent false activation.
9. Keep skill bodies procedural. Use imperative numbered steps, acceptance criteria, verification commands, safety rules, and final summary requirements. Move detailed examples or matrices into `references/` and deterministic checks into `scripts/`.
10. Do not rewrite unrelated skills while routing. Do not delete existing skills, weaken safety rules, add fake verification commands, expose secrets, or create broad cross-skill abstractions without a clear maintenance benefit.
11. Finish by naming the primary skill selected, any secondary skills used, files changed if maintaining skills, verification commands run, and any routing ambiguity that remains.
