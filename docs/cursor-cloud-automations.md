# Cursor Cloud Automations — Ready-to-Use Prompts

Copy/paste prompts for Cursor Cloud Agents (or scheduled automations). Each defines a trigger, scope, instructions, verification commands, what to report, and what **not** to touch. All follow `docs/agent-safety-checklist.md` and the `.cursor/rules/*.mdc`.

> Commands are this repo's actual npm scripts. Pre-existing conditions to expect: `npm run lint` exits non-zero from 3 known `no-empty` errors; `dev:all`/`dev:wrangler` are broken on `main` (use `npm run dev`).

---

## 1. Daily code health review

- **Trigger:** Scheduled daily (or on demand).
- **Scope:** Whole repo, read-mostly. Report + tiny safe fixes only.
- **Instructions:** Run typecheck, lint, and the unit suite. Summarize new failures/warnings vs. the known baseline. Propose (don't force) small, safe fixes for clearly-introduced issues.
- **Verify:** `npm run typecheck:ci` · `npm run lint` · `npm test`
- **Report:** Pass/fail per command, new vs. pre-existing failures, top risks, suggested next actions.
- **Do not:** Refactor broadly, change deps, touch auth/RLS/FSRS, or "fix" the known `no-empty` errors by editing unrelated files.

## 2. PR security review

- **Trigger:** On PR open/update (or manual).
- **Scope:** The PR diff only.
- **Instructions:** Follow the `auditing-security` skill and `security-review.mdc`. Scan for leaked secrets, unauthenticated/over-privileged endpoints, missing Zod validation, RLS weakening, `process.env` in Edge code, and PII/secret logging.
- **Verify:** `git diff <base>...HEAD | rg -in "sk_live|pk_live|whsec_|service_role|postgres://|prisma://|api[_-]?key"` · `npm run typecheck` · `npm run lint`
- **Report:** Findings by severity with file/line, each mapped to a control; explicit residual risks; whether human review is needed.
- **Do not:** Modify code (review only unless asked); never weaken a control to resolve a finding.

## 3. UI regression check

- **Trigger:** On PRs touching `components/`, `src/`, or styles.
- **Scope:** Screens affected by the diff.
- **Instructions:** Use `verifying-in-browser` + `visual-qa-testing`. Start `npm run dev`, open affected screens (dev-auth URL for authed views), capture before/after screenshots, compare against `ui-design-system.mdc`.
- **Verify:** `npm run build` · browser screenshots at desktop width.
- **Report:** Screenshots + a list of visual diffs/issues mapped to design-system rules.
- **Do not:** Edit shared primitives without approval; claim QA without screenshots.

## 4. Accessibility audit

- **Trigger:** Weekly, or on PRs touching UI.
- **Scope:** Changed/target pages.
- **Instructions:** Use `accessibility-auditing` + `accessibility.mdc`. Run axe and a manual keyboard/contrast pass in light and dark.
- **Verify:** `npx playwright install` (once) · `npm run test:e2e:a11y`
- **Report:** axe violations + manual findings, each with WCAG criterion and element; fixes if in scope, re-run to confirm.
- **Do not:** Remove focus outlines; add global `transition-*` to base elements; touch shared primitives without approval.

## 5. Test failure fixer

- **Trigger:** On red CI / failing suite.
- **Scope:** Failing tests + their root-cause source.
- **Instructions:** Use `parallel-test-fixing`. Capture the full failure list, group by root cause, fix the source or shared mocks, re-run affected files, then the full suite.
- **Verify:** `npm test` (or `npx vitest run <file>` while iterating) · `npm run typecheck`
- **Report:** Root causes fixed, files changed, before/after pass counts, any remaining pre-existing failures.
- **Do not:** Delete/skip tests, weaken assertions, or add retries to mask flakiness.

## 6. Dependency update reviewer

- **Trigger:** On dependency-bump PRs (or monthly).
- **Scope:** `package.json` / lockfile changes.
- **Instructions:** Summarize what changed and why; check for breaking changes/major bumps; run install + full verification. Flag any new **production** dependency for human approval (do not add prod deps autonomously).
- **Verify:** `npm install` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`
- **Report:** Diff summary, risk of each bump, verification results, items needing approval.
- **Do not:** Add/upgrade production deps without approval; bypass lockfile.

## 7. Supabase / RLS safety audit

- **Trigger:** On PRs touching `prisma/`, `functions/api/`, or Supabase config.
- **Scope:** Schema, migrations, endpoints that read/write data.
- **Instructions:** Follow `supabase-security.mdc`. Verify RLS is present/unweakened for user-scoped tables, migrations are additive/non-destructive, service-role key stays server-side, and connection strings aren't hardcoded.
- **Verify:** `npm run db:generate` · `npm run typecheck` · `npm run db:validate` (where applicable)
- **Report:** RLS/migration risk assessment; confirm no prod DB access; residual risks.
- **Do not:** Run migrations against prod, run `migrate reset`/`--force-reset`, or disable RLS.

## 8. Landing page visual QA

- **Trigger:** On changes to `LandingPage`/marketing routes.
- **Scope:** Public landing/marketing pages.
- **Instructions:** Use `visual-qa-testing` + `responsive-testing` + `dark-mode-testing`. Verify hero, CTAs (one primary), sections, at mobile/tablet/desktop, in light and dark.
- **Verify:** `npm run dev` + screenshots per breakpoint/theme · `npm run build`
- **Report:** Screenshots grid + issues.
- **Do not:** Remove `LandingPage.tsx` inline styles (Tailwind-purge safety net); touch shared primitives.

## 9. Pre-deploy checklist

- **Trigger:** Before a release/deploy request.
- **Scope:** Whole repo, verification only.
- **Instructions:** Run the full verification ladder and confirm no secrets/`.env`/`.cursor/mcp.json` are staged. Summarize readiness; do not deploy.
- **Verify:** `npm run typecheck:ci` · `npm run lint` · `npm test` · `npm run build`
- **Report:** Go/no-go with evidence; outstanding risks; note that deploy + prod migrations require human approval.
- **Do not:** Deploy (`deploy:local`/`wrangler pages deploy`) or run prod migrations autonomously.

## 10. Documentation refresh

- **Trigger:** Monthly, or after notable stack/command changes.
- **Scope:** `docs/`, `README.md`, `.cursor/README.md`, `AGENTS.md` (factual accuracy).
- **Instructions:** Reconcile documented commands/paths against reality (`package.json`, config). Fix drift; keep it concise; reference source-of-truth docs rather than duplicating.
- **Verify:** Spot-run documented commands (`npm run typecheck`, `npm run build`) to confirm they exist/work.
- **Report:** What was stale and what changed.
- **Do not:** Invent features/commands; add secrets; rewrite domain docs wholesale.
