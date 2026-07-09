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

---

# Community-inspired automation prompts (v2)

Polished, ready-to-run prompts using a fuller schema (trigger · inspect · commands · evidence · auto-change · report-only · output). These extend the set above; where they overlap, prefer this richer version. All follow `docs/agent-safety-checklist.md`, the `.cursor/rules/*.mdc`, and the workflows in `docs/cursor-agent-operating-system.md`. Known pre-existing failures to expect: 3 `no-empty` lint errors; 2 typecheck errors in `lib/study/renderStructuredRationale.ts`; `dev:all`/`dev:wrangler` broken on `main`.

## 1. Weekly repo health audit
- **Trigger:** Schedule weekly (Mon AM).
- **Inspect:** whole repo; `git log --since=7.days`; open issues/PRs.
- **Commands:** `npm run typecheck:ci` · `npm run lint` · `npm test` · `npm run build`.
- **Evidence:** command outputs; new-vs-baseline failure counts.
- **Auto-change:** none (report-only) beyond trivial, clearly-safe fixes if asked.
- **Report-only:** new failures, flaky tests, risk hotspots, suggested next actions.
- **Output:** short markdown report (status table + top 5 risks + recommended actions).

## 2. Weekly dependency risk review
- **Trigger:** weekly, or on Dependabot/renovate PRs. Use skill `dependency-review`.
- **Inspect:** `package.json`, `package-lock.json`, changelogs of bumped deps.
- **Commands:** `npm install` · `npm audit` (report only) · `npm run typecheck` · `npm run build` · `npm test` · `npm run build:check-size`.
- **Evidence:** advisories, version diffs, build/test results, bundle delta.
- **Auto-change:** none — do not run `npm audit fix --force`; do not add prod deps.
- **Report-only:** risky bumps, advisories, prod deps needing approval.
- **Output:** table of {dep, old→new, risk, action}.

## 3. PR review gate
- **Trigger:** on PR open/update. Use skill `pr-review` + `pr-review-quality-gate.mdc`.
- **Inspect:** `git diff <base>...HEAD`, `--stat`, changed tests.
- **Commands:** verification ladder for the change type; secret scan `git diff <base>...HEAD | rg -in "sk_live|pk_live|whsec_|service_role|postgres://|prisma://|api[_-]?key"`.
- **Evidence:** diff findings by file/line; command results.
- **Auto-change:** none (review-only unless asked).
- **Report-only:** scope/correctness/tests/security/arch/UI findings by severity; go/no-go.
- **Output:** review comment (checklist pass/fail + findings + residual risk).

## 4. Security regression review
- **Trigger:** on PRs touching `functions/api/`, auth, or on schedule. Use `auditing-security`.
- **Inspect:** `functions/api/**`, `lib/**` auth/middleware, `public/_headers`, changed endpoints.
- **Commands:** secret scan; `npm run typecheck`; confirm `authenticatedEndpoint`/RLS usage.
- **Evidence:** endpoint authz map; secret-scan result.
- **Auto-change:** none.
- **Report-only:** unauthenticated/over-privileged endpoints, weakened RLS, injection/PII risks.
- **Output:** severity-ranked findings + human-review recommendation.

## 5. Visual design QA pass
- **Trigger:** on PRs touching `components/`, `src/`, styles. Use `visual-qa-testing` + `visual-design-quality-gate.mdc`.
- **Inspect:** affected screens/components.
- **Commands:** `npm run dev` (port 3000) + browser; `rg -n "#[0-9a-fA-F]{3,6}"` on changed files; `npm run lint`.
- **Evidence:** light+dark screenshots; hex-scan output.
- **Auto-change:** token/spacing fixes in leaf components only (not shared primitives).
- **Report-only:** design-system violations needing primitive changes (need approval).
- **Output:** screenshot grid + issue list mapped to `ui-design-system.mdc`.

## 6. Accessibility regression review
- **Trigger:** weekly, or on UI PRs. Use `accessibility-auditing` + `accessibility.mdc`.
- **Inspect:** changed pages/components.
- **Commands:** `npx playwright install` (once) · `npm run test:e2e:a11y`.
- **Evidence:** axe violations + manual keyboard/contrast notes (light+dark).
- **Auto-change:** safe a11y fixes (aria-label, labels, focus) in leaf components.
- **Report-only:** issues needing primitive/design changes.
- **Output:** violations list (WCAG criterion + element) + before/after.

## 7. Test failure triage
- **Trigger:** on red CI/suite. Use `failure-triage` → `parallel-test-fixing`.
- **Inspect:** failing specs + their source.
- **Commands:** `npm test 2>&1 | tee /tmp/test.log`; `npx vitest run <file>` while iterating.
- **Evidence:** grouped root causes; before/after pass counts.
- **Auto-change:** fix source/shared mocks; never delete/skip/weaken tests.
- **Report-only:** pre-existing/unrelated failures.
- **Output:** {root cause → fix → files} table + final pass count.

## 8. Broken import / dead file sweep
- **Trigger:** monthly, or after refactors. Use `route-and-import-verification` + `anti-hallucination-imports.mdc`.
- **Inspect:** imports/routes across `src/`, `components/`, `lib/`, `functions/`.
- **Commands:** `npm run typecheck` · `npm run build`; `rg` for imports of known-missing modules (`routes/`, `lib/services/tokenMatchCache.ts`).
- **Evidence:** unresolved imports; unreferenced files (candidate dead code).
- **Auto-change:** fix clearly-broken imports; do NOT delete files (propose only).
- **Report-only:** dead-code candidates, missing modules.
- **Output:** list of broken imports (fixed) + dead-file candidates (proposed).

## 9. Agent memory / doc refresh
- **Trigger:** monthly, or after stack changes. Use `repo-memory-update`.
- **Inspect:** `AGENTS.md`, `CLAUDE.md`, `APP_FUNCTIONALITY_PLAN.md`, `docs/cursor-*.md`, `README.md`.
- **Commands:** spot-run documented commands to confirm accuracy.
- **Evidence:** drift found (stale commands/paths/claims).
- **Auto-change:** fix factual drift; keep concise; reference not duplicate.
- **Report-only:** larger doc restructures.
- **Output:** what was stale + what changed (no secrets).

## 10. "AI slop" UI audit
- **Trigger:** on landing/marketing changes, or quarterly. Use `no-ai-slop-visual-audit`.
- **Inspect:** landing/marketing/hero screens.
- **Commands:** `npm run dev` + browser; screenshots.
- **Evidence:** flagged slop signals vs. AGENTS.md "should NOT feel like" list.
- **Auto-change:** realign to clinical identity within tokens/primitives (leaf only).
- **Report-only:** changes needing primitives/new deps/approval.
- **Output:** before/after screenshots + slop findings addressed.

## 11. Cloudflare deployment readiness
- **Trigger:** before a release request. (Report-only — never deploy.)
- **Inspect:** `wrangler.toml`, `functions/api/**` (no `process.env`/Node built-ins), `public/_headers`, `.node-version`.
- **Commands:** `npm run build`; `npm run env:check:compat-date`; `npm run typecheck:ci`.
- **Evidence:** build result; Edge-safety scan; known-broken `dev:wrangler` note.
- **Auto-change:** none.
- **Report-only:** go/no-go, blockers (e.g., missing `tokenMatchCache.ts` breaks Functions bundle), required dashboard secrets.
- **Output:** readiness checklist with pass/fail; explicit "deploy needs human approval."

## 12. Supabase / RLS safety check
- **Trigger:** on PRs touching `prisma/` or DB code. Use `auditing-security` + `supabase-security.mdc`.
- **Inspect:** `prisma/schema.prisma`, migrations, endpoints reading/writing data.
- **Commands:** `npm run db:generate` · `npm run typecheck` · `npm run db:validate` (where applicable).
- **Evidence:** RLS coverage; migration additivity; connection-string handling.
- **Auto-change:** none against any DB. Never run migrations here.
- **Report-only:** weakened RLS, destructive/non-additive migrations, prod-pointing config.
- **Output:** RLS/migration risk assessment; "prod migration needs approval."

## 13. Performance budget review
- **Trigger:** monthly, or on perf-sensitive PRs.
- **Inspect:** heavy routes/components (charts, `three`/3D), lazy-loading, query patterns in `functions/api/`.
- **Commands:** `npm run build` (chunk sizes); optional `npm run build:analyze`.
- **Evidence:** largest chunks, non-lazy heavy imports, N+1 risks.
- **Auto-change:** safe wins (add `React.lazy`/`Suspense`, memoization) in leaf components.
- **Report-only:** structural perf work needing design decisions.
- **Output:** top offenders + applied/ proposed fixes.

## 14. Bundle-size review
- **Trigger:** on PRs adding deps or heavy imports. Use `dependency-review`.
- **Inspect:** `package.json` diff, new imports, `vite.config.ts` chunking.
- **Commands:** `npm run build:check-size`; `npm run build:analyze` (writes `dist/stats.html`).
- **Evidence:** bundle delta vs. baseline; new large chunks.
- **Auto-change:** dynamic-import heavy modules; avoid pulling full libs.
- **Report-only:** deps that materially grow the bundle (approval).
- **Output:** size delta table + recommendations.

## 15. Design-system drift review
- **Trigger:** on UI PRs, or monthly. Use `design-system-enforcement`.
- **Inspect:** changed `components/`, `src/`, CSS; `index.css`/`lib/tokens/`.
- **Commands:** `rg -n "#[0-9a-fA-F]{3,6}"` (outside `lib/tokens/`); `npm run lint` (design-token lint); `npm run typecheck`.
- **Evidence:** raw-hex hits, reinvented primitives, off-token colors.
- **Auto-change:** replace with tokens/primitives in leaf components.
- **Report-only:** changes needing shared-primitive edits or new tokens (approval).
- **Output:** drift list + fixes applied + items needing approval.

---

# Orchestrated multi-agent automations (v3, loop-safe)

Advanced prompts that drive the agent **orchestration system** (`docs/agent-workflow-orchestration.md`, `.cursor/agents/`, `.cursor/workflows/`). Every prompt is **loop-safe**: a hard loop limit, explicit allowed/forbidden commands, and human-approval gates. All follow `docs/agent-safety-checklist.md` and `.cursor/memory/do-not-repeat.md`. Known pre-existing failures (2 typecheck in `renderStructuredRationale.ts`, 3 `no-empty` lint) are baseline — don't attribute them to the run.

## 1. Agent Orchestrated Feature Build
- **Trigger:** "build <small feature>" on a feature branch.
- **Agents:** Orchestrator → Planner → Implementation → UI/UX QA* → Reviewer → Security* → Documentation.
- **Loop limit:** 2 repair attempts (then escalate via `self-improvement-loop`).
- **Commands allowed:** `npm run typecheck|lint|test|test:critical|build`, `npm run dev`, `git status|diff`.
- **Commands forbidden:** deploys, migrations, `npm audit fix --force`, prod/destructive, secret access.
- **Evidence:** ladder output + `git diff --stat` + screenshots (UI, light+dark).
- **May edit:** planned source files, tests, docs/memory.
- **Report-only:** shared primitives, auth/RLS, DB schema, prod config.
- **Final report:** `feature-build.workflow.md` template (+ `agent-final-report-rubric.md`).
- **Approval gates:** new prod dep, auth/RLS/DB, prod config.

## 2. Multi-Agent PR Review
- **Trigger:** PR opened/updated.
- **Agents:** Orchestrator → Reviewer + Security* + UI/UX QA* + Test/Debug* (parallel lenses via subagents).
- **Loop limit:** 1 pass (+1 re-review after fixes).
- **Commands allowed:** `git diff`, secret scan, verification ladder for the change type.
- **Commands forbidden:** edits during review-only, deploys/migrations.
- **Evidence:** findings by file/line + command results.
- **May edit:** nothing (review-only) unless asked.
- **Report-only:** entire diff.
- **Final report:** `pr-review.workflow.md` template; verdict pass/block.
- **Approval gates:** merge is human; flag auth/RLS/secret/DB items.

## 3. Self-Healing Test Failure Triage
- **Trigger:** red CI/suite.
- **Agents:** Orchestrator → Test/Debug → Implementation → Reviewer.
- **Loop limit:** **2** repair attempts, diagnosis-first; then escalate.
- **Commands allowed:** `npm test`, `npx vitest run <file>`, `npm run typecheck|lint|build`.
- **Commands forbidden:** deleting/skipping tests, `@ts-ignore`/lint-disable, blind reinstalls, prod/destructive.
- **Evidence:** before/after pass counts + root-cause grouping + attempt log.
- **May edit:** source/shared mocks, tests (add/repair).
- **Report-only:** pre-existing/unrelated failures.
- **Final report:** `test-failure-triage.workflow.md` template.
- **Approval gates:** root cause in auth/RLS/schema.

## 4. Weekly Agent Memory Refresh
- **Trigger:** weekly.
- **Agents:** Orchestrator → Documentation → Reviewer.
- **Loop limit:** 1.
- **Commands allowed:** read-only + secret scan.
- **Commands forbidden:** anything mutating code/data.
- **Evidence:** entries added/updated/removed + dedupe actions.
- **May edit:** `.cursor/memory/*`, durable docs.
- **Report-only:** conflicting guidance needing a human decision.
- **Final report:** `agent-memory-refresh.workflow.md` template.
- **Approval gates:** none (flag conflicts).

## 5. Weekly Design-System Drift Review
- **Trigger:** weekly / on UI PRs.
- **Agents:** Orchestrator → UI/UX QA → Reviewer.
- **Loop limit:** 1.
- **Commands allowed:** `npm run dev`, `rg` hex scan, `npm run lint|typecheck`.
- **Commands forbidden:** shared-primitive edits, new deps, prod/destructive.
- **Evidence:** screenshots (light+dark) + hex-scan output.
- **May edit:** leaf components (token/spacing fixes).
- **Report-only:** shared-primitive/new-token changes.
- **Final report:** drift list + fixes + approval items.
- **Approval gates:** shared primitives, new deps.

## 6. Weekly Security Regression Audit
- **Trigger:** weekly / on `functions/api` or auth PRs.
- **Agents:** Orchestrator → Security → Reviewer.
- **Loop limit:** 1 (report-first).
- **Commands allowed:** secret scan, `npm run typecheck`, read-only inspection.
- **Commands forbidden:** editing auth/RLS, prod/destructive, secret printing.
- **Evidence:** secret-scan output + per-endpoint authz map.
- **May edit:** nothing by default (report-first); additive hardening only with approval.
- **Report-only:** all auth/RLS/secret findings.
- **Final report:** `security-review.workflow.md` template (+ `security-review-rubric.md`).
- **Approval gates:** any auth/RLS/secret change.

## 7. Cloudflare Functions Safety Review
- **Trigger:** changes under `functions/api/`.
- **Agents:** Orchestrator → Security → Reviewer → Test/Debug*.
- **Loop limit:** 2 (for build fixes).
- **Commands allowed:** `npm run typecheck|build`, `rg -n "process\.env" functions/api`.
- **Commands forbidden:** deploys, prod/destructive.
- **Evidence:** Edge-safety scan + authz/validation notes.
- **May edit:** endpoint code within Edge rules (additive authz/validation w/ approval).
- **Report-only:** auth/RLS changes.
- **Final report:** `cloudflare-functions-review.workflow.md` template.
- **Approval gates:** auth/RLS, deploy.

## 8. Supabase/Prisma Safety Review
- **Trigger:** changes to `prisma/` or DB code.
- **Agents:** Orchestrator → Database Safety → Security → Reviewer.
- **Loop limit:** 1.
- **Commands allowed:** `npm run db:generate|typecheck|db:validate`.
- **Commands forbidden:** **any** migration apply/reset, `db push`, prod DB access, destructive SQL.
- **Evidence:** schema-compiles + additivity + RLS assessment.
- **May edit:** `schema.prisma` / draft migration SQL (not applied).
- **Report-only:** anything destructive/non-additive, RLS, prod targets.
- **Final report:** `database-change-review.workflow.md` template (+ `database-change-rubric.md`).
- **Approval gates:** applying migrations, RLS changes, prod access.

## 9. Dependency Upgrade Risk Review
- **Trigger:** dependency-bump PR / periodic.
- **Agents:** Orchestrator → Reviewer → Security.
- **Loop limit:** 1.
- **Commands allowed:** `npm install`, `npm audit` (report), `npm run typecheck|build|test`, `npm run build:check-size`.
- **Commands forbidden:** `npm audit fix --force`, hand-editing lockfile, adding prod deps without approval.
- **Evidence:** advisories + version diffs + bundle delta.
- **May edit:** lockfile via `npm install` for approved changes.
- **Report-only:** new prod deps.
- **Final report:** `dependency-update-review.workflow.md` template.
- **Approval gates:** any production dependency.

## 10. Release Readiness Council
- **Trigger:** release request.
- **Agents:** Orchestrator → Release Readiness + Security + Reviewer.
- **Loop limit:** 1 (assessment only).
- **Commands allowed:** `npm run typecheck:ci|lint|test|build|env:check:compat-date`, secret scan.
- **Commands forbidden:** **any** deploy/migration; nothing mutating.
- **Evidence:** full ladder (pre-existing vs introduced) + secret scan + Edge scan.
- **May edit:** the readiness report only.
- **Report-only:** everything.
- **Final report:** `predeploy-readiness.workflow.md` template; Go/No-Go.
- **Approval gates:** the deploy itself + prod migrations (always human).

## 11. UI Polish Swarm
- **Trigger:** "polish these screens".
- **Agents:** Orchestrator → UI/UX QA (lead) → Implementation → Reviewer; parallelize screens via subagents.
- **Loop limit:** 1 per screen.
- **Commands allowed:** `npm run dev`, `rg` hex scan, `npm run lint|typecheck`.
- **Commands forbidden:** shared-primitive edits, new deps, prod/destructive.
- **Evidence:** before/after screenshots (light+dark) per screen.
- **May edit:** leaf components.
- **Report-only:** shared-primitive/dep needs.
- **Final report:** `ui-polish.workflow.md` template per screen + `ui-quality-rubric.md`.
- **Approval gates:** shared primitives, new deps.

## 12. Broken Import Sweep
- **Trigger:** after refactors / monthly.
- **Agents:** Orchestrator → Test/Debug → Implementation → Reviewer.
- **Loop limit:** 2 (for fixes).
- **Commands allowed:** `npm run typecheck|build`, `rg`.
- **Commands forbidden:** deleting files, inventing stub modules, prod/destructive.
- **Evidence:** broken imports fixed + dead-file candidates.
- **May edit:** import statements/paths.
- **Report-only:** dead-file candidates, missing modules (`routes/`, `tokenMatchCache.ts`).
- **Final report:** `broken-import-sweep.workflow.md` template.
- **Approval gates:** deleting files, restoring missing modules.

## 13. Agent Retrospective and Rule Suggestion
- **Trigger:** after a complex/failed task or monthly.
- **Agents:** Orchestrator → Documentation → Reviewer.
- **Loop limit:** 1.
- **Commands allowed:** read-only + secret scan.
- **Commands forbidden:** mutating code/data; creating speculative rules.
- **Evidence:** retrospective entry + any memory updates + repeated-pattern evidence for a proposed rule.
- **May edit:** `.cursor/memory/*`; propose (not force) a new rule/skill only if a pattern repeated ≥2×.
- **Report-only:** proposed rule/hook changes (human decides).
- **Final report:** retrospective + proposed improvements + rationale.
- **Approval gates:** adopting any new rule/hook that affects many files or safety gates.
