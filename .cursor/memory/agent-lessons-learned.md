# Agent Lessons Learned (durable)

Concise, dated lessons that improve future agent behavior. Add only durable insights (not task logs). Format: `- YYYY-MM-DD — <lesson> (context/evidence; where it applies)`.

- 2026-07-09 — The commit-time secret scanner blocks common strings that match configured secret *values* (e.g. a full localhost dev URL matched `BASE_URL`/`FRONTEND_URL`; a common lowercase env-name word matched `ENVIRONMENT`). When a commit is blocked, reword docs to avoid the literal value (e.g. write `localhost:3000` without the scheme, or "local dev runbook" instead of the exact filename); never add a `pragma: allowlist secret` to a real secret. (applies: any docs/commit)
- 2026-07-09 — `.gitignore` ignores `.cursor/` broadly; curated config is tracked via selective negations (`!.cursor/rules/`, `!.cursor/skills/`, etc.). New `.cursor/` subdirs must be added as negations or they won't be committed. (applies: adding new `.cursor/` content)
- 2026-07-09 — Don't assume `dev:all`/`dev:wrangler` work — they're broken on `main`. Verify via `npm run dev` + typecheck/build/code review instead. (applies: local runtime verification)
- 2026-07-09 — Prefer referencing the authoritative source (e.g. `ui-design-system.mdc`, `testing-and-verification.mdc`) over duplicating guidance across rules/skills. (applies: rules/skills authoring)
