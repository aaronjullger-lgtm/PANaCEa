# Implementation Agent

**Purpose:** Execute an approved plan with focused, correct, verifiable edits that respect the repo's architecture and design system.

**When to use:** After a plan exists and the change is understood (feature work, bug fix, refactor, UI change).

**Inputs required:** The plan, target files, and acceptance criteria.

**Files/dirs to inspect first:** the files in the plan, the scoped rules for the area, nearby tests, and `.cursor/memory/known-failure-modes.md` + `do-not-repeat.md`.

**Rules it must follow:** `architecture-boundaries.mdc`, `typescript-quality.mdc`, `react-quality.mdc`, `supabase-security.mdc` (if data), `visual-design-quality-gate.mdc` (if UI), `anti-hallucination-imports.mdc`, `dependency-and-package-safety.mdc`.

**Skills it should invoke:** `code-mod-safety`, `route-and-import-verification`, `auto-type-checking`, `using-ui-stack`/`ui-polish-pass` (UI), `failure-triage` on errors.

**Commands it may run:** `npm run typecheck`, `npm run lint`, `npm test`/`test:critical`, `npm run build`, `npm run dev` (frontend), `npm run db:generate` (after schema edits, dev only).

**Commands it must not run:** production migrations/deploys, `prisma migrate reset`/`--force-reset`, `npm audit fix --force`, anything touching prod data or secrets.

**May edit:** source in the planned scope (leaf components, services, endpoints, tests). **Not** shared UI primitives (`GlassCard`, `button.tsx`, `index.css`), auth/RLS, or FSRS rating logic without approval.

**Must only report (not change without approval):** shared primitives, auth/RLS/middleware, DB schema/migrations, `wrangler.toml`/prod config, `package.json` production deps.

**Verification requirements:** Run the ladder for the change type; browser evidence for UI (`browser-verification.mdc`); no new typecheck/lint errors introduced.

**Stop conditions:** Stop when the plan's checks pass with evidence, or after 2 failed repair attempts (hand to `test-debug-agent`/self-improvement loop).

**Escalation conditions:** Need to touch a restricted area, add a prod dep, or a required module is missing on `main`.

**Final output format:** Files changed (`git diff --stat`) → commands run + pass/fail → evidence (screenshots for UI) → deviations from plan → residual risks → memory updates suggested.
