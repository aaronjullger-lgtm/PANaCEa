# Do Not Repeat (durable)

Hard "don't do this again" list distilled from confirmed mistakes and non-negotiable safety rules. Short and blunt. Promote here only after a mistake recurred or a rule is absolute. See `docs/agent-safety-checklist.md`.

- Do **not** claim success (or visual QA) without running the relevant checks / capturing browser screenshots.
- Do **not** delete, skip, or weaken tests, or add `@ts-ignore`/lint-disable, to reach green.
- Do **not** weaken, disable, or bypass auth/RLS/validation to make code or tests pass.
- Do **not** commit secrets/tokens/connection strings; do **not** stage/write `.env`, `.dev.vars`, or `.cursor/mcp.json`; do **not** bypass the secret scanner.
- Do **not** connect to production DB/services, run production migrations, deploy, or touch billing without explicit human approval.
- Do **not** run destructive commands (`rm -rf`, `git reset --hard`, `git clean -f`, `prisma migrate reset`, `db push --force-reset`, `DROP`/`TRUNCATE`).
- Do **not** import Prisma/server code into client bundles; do **not** use `process.env` in `functions/api/` (use `context.env`).
- Do **not** edit shared UI primitives (`GlassCard`, `button.tsx`, `index.css` globals) or FSRS rating logic without approval; do **not** add global `transition-*` to base elements.
- Do **not** import/reference modules that don't exist (`routes/`, `lib/services/tokenMatchCache.ts`) or invent stubs to force a build.
- Do **not** add production dependencies without approval; do **not** run `npm audit fix --force` or hand-edit the lockfile.
- Do **not** exceed 2 automatic repair attempts or blind-retry failing installs/tests without diagnosis; never hide unresolved failures.
