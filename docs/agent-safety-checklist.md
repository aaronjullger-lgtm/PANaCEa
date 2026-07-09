# Agent Safety Checklist ("Do Not Break")

Non-negotiable rules for any AI agent (local or Cloud) working in this repo. This complements `.cursor/rules/agent-operating-procedure.mdc` and the per-domain rules.

## Never

- **Never edit or add secrets/tokens/keys/connection strings.** Read them from env / `context.env.*`. Do not bypass the commit-time secret scanner.
- **Never change or use production credentials, and never connect to production databases/services.** Use dev/branch databases and read-only scopes.
- **Never weaken auth, RLS, or middleware** to make a feature or test pass. Auth/RLS/security changes are high-risk and prefer human review.
- **Never delete, skip, or weaken tests** to get a green build. Do not water down assertions or mock away the behavior under test.
- **Never claim visual/UI QA without screenshots or a real browser verification.**
- **Never claim success without running the relevant checks** and pasting the real output.
- **Never run destructive commands** (`rm -rf`, `git reset --hard`, `git clean -f`, `prisma migrate reset`, `db push --force-reset`, `DROP`/`TRUNCATE`). The `beforeShellExecution` hook will flag these, but you are still responsible.
- **Never modify shared UI primitives** (`GlassCard`, `button.tsx`, `index.css` globals) or **FSRS rating logic** (no Hard/Easy; binary implicit only) without explicit approval.
- **Never add production dependencies, run production migrations, or deploy** without explicit approval.
- **Never use `process.env` in Edge functions** (`functions/api/`) — use `context.env`.

## Always

- **Always** read the files you'll change and the relevant `.cursor/rules/*.mdc` first.
- **Always** confirm referenced modules/exports actually exist before importing (some are missing on `main`).
- **Always** run the checks that match your change: `npm run typecheck`, `npm run lint`, `npm test` (or `test:critical`), `npm run build`; add browser verification for UI.
- **Always** keep changes focused and reviewable; keep `.env`/`.cursor/mcp.json` out of commits.
- **Always** summarize: files changed, commands run (pass/fail), remaining risks, and anything you couldn't verify (including pre-existing failures like the known `no-empty` lint errors and broken `dev:all`/`dev:wrangler`).

## Pre-completion gate (quick copy)

- [ ] No secrets in the diff (`git diff` reviewed)
- [ ] No prod DB/service touched
- [ ] Auth/RLS unchanged or strengthened
- [ ] Tests still present and meaningful; suite run
- [ ] Typecheck + lint run; no new errors introduced
- [ ] UI changes verified in browser with screenshots
- [ ] `git diff --stat` shows only intended files
- [ ] Summary of changes + risks written
