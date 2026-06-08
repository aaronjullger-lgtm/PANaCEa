# CI Gates & Release Readiness

[//]: # SAFE-OVERRIDE: documentation file, no shell execution

Source of truth for what blocks a merge to `main` and what is advisory.
Kept in sync with `.github/workflows/ci.yml`.

Last updated: 2026-04-19 (Sprint 7 — typecheck expansion + all-gates-pass aggregator).

---

## The single required check

Branch protection on `main` requires **one** status check:

> **"All Blocking Gates Pass"**

That job (`all-gates-pass` in `ci.yml`) runs with `if: always()` and explicitly
verifies the result of every blocking job. Pinning protection to this
aggregator means individual job renames, reorderings, or additions don't break
branch-protection configuration — only the list inside `all-gates-pass.needs`
matters.

Do not pin branch protection to individual job names.

---

## Blocking gates (6)

A failure in any of these fails the merge. They run in parallel.

| Gate | Command / job | Scope | Typical time |
|---|---|---|---|
| **Lint** | `npm run lint` | ESLint with `--max-warnings 2000` | &lt;2 min |
| **Typecheck** | `npm run typecheck:ci` | `tsconfig.ci.json` — FSRS core + drillReviewService + confidence pipeline + _shared auth/prisma | &lt;2 min |
| **Unit — critical** | `npm run test:critical` | FSRS math + study store | &lt;4 min |
| **Build + bundle** | `npm run build && npm run build:check-size` | Full prod build; 1400 kB JS / 200 kB CSS / 350 kB max chunk | ~5 min |
| **Secret scan** | `gitleaks` against `.gitleaks.toml` | Full-history scan on push | &lt;1 min |
| **A11y (axe-core)** | `npm run test:e2e:a11y` | axe-core WCAG 2.1 AA on SPA routes via `vite preview` | &lt;5 min |

Compatibility-date parity is checked locally with `npm run env:check:compat-date`.
That script fails if `wrangler.toml` and the Wrangler command in
`.github/workflows/ci.yml` drift from the same `YYYY-MM-DD` value. The current
Pages runtime date is `2025-12-15`.

### Rationale per gate

- **Lint** — `--max-warnings 2000` is the current ceiling, not the target. See
  the Ratchet plan below.
- **Typecheck** — Sprint 7 complete: scope now includes `lib/services/drillReviewService.ts`,
  `lib/confidence/**`, and `functions/api/_shared/{auth,prisma-edge,error-handler,env-validation,middleware}.ts`.
  Full-tree typecheck is still blocked by parked QuizView refactor debt; deferred to Sprint 8.
- **Unit — critical** — `test:critical` covers FSRS math and the study store.
  These are the paths where a regression corrupts user scheduling data.
- **Build + bundle** — A green build proves the prod bundle compiles; the size
  check enforces budgets. A single budget breach fails the build.
- **Secret scan** — `gitleaks` scans the full history on push to main;
  shallow-scans PRs (via fetch-depth 0 on checkout).
- **A11y** — `playwright.ci-a11y.config.ts` runs axe against the built SPA on
  `vite preview` (port 4173). No wrangler required — Clerk redirects to landing/
  sign-in which axe scans. Promoted from advisory in Sprint 7.

---

## Advisory gates (2)

These run with `continue-on-error: true` and surface regressions without
failing the merge.

| Gate | Command | Why advisory today |
|---|---|---|
| **Unit — full** | `npm test` (full Vitest) | 8 known-failing files per CLAUDE.md (React 19 compat issues in admin / Goals / offline). Demoted so the rest of the gate is actionable. |
| **API smoke** | Playwright `e2e/api-health.spec.ts` via `wrangler pages dev --compatibility-date=2025-12-15 --compatibility-flags=nodejs_compat` | `wrangler pages dev` pg/Node-builtins issue: the `nodejs_compat` flag is set but `pg` still fails to start the runtime locally in CI. Advisory until the runtime fix is verified across 3+ consecutive CI runs. |

Advisory jobs still upload artifacts (coverage, Playwright reports) so
regressions are diagnosable.

---

## Post-deploy gates (advisory, in deploy.yml)

These run in `deploy.yml` after every production deployment.

| Gate | Blocking? | Why |
|---|---|---|
| **Health check** | Yes (in deploy.yml) | Hard gate within the deploy job: accepts `200`/`503`, fails on `000`/`4xx`. |
| **Lighthouse CI** | Advisory (`continue-on-error`) | Conservative thresholds; promote to blocking after 3 consecutive green runs. |

---

## Orthogonal jobs (informational)

These live in separate workflows, do not feed into `all-gates-pass`, and do
not block merges:

- `.github/workflows/deploy.yml` — triggered on CI success on `main`;
  runs `prisma migrate deploy`, build, `wrangler pages deploy`, health check, Lighthouse CI.
- `.github/workflows/playwright.yml` — full Playwright suite on push/PR; uploads
  report artifact for diagnostics.
- `.github/workflows/cloud-agents.yml` — path-filtered Cursor Cloud Agent
  fan-out (PR review, edge-guard, living-docs, etc.). Independent of the gate.
- `.github/workflows/neon_workflow.yml` — creates a Neon preview DB branch per
  PR (migrations commented out; see `PREVIEW-ENVS.md`).
- Scheduled automation lanes (`sched-*.yml`) — content health, reservoir supply,
  runtime sanity, etc. Independent.

---

## Ratchet plan

The gate stays actionable by tightening thresholds on a schedule, never by
adding aspirational blocking jobs that aren't green yet.

### Done (Sprint 7)

- `tsconfig.ci.json` scope expanded: drillReviewService + confidence pipeline + _shared auth/prisma.
- `all-gates-pass` aggregator job added — single status check for branch protection.
- `e2e-a11y` promoted from advisory to blocking (split from wrangler-dependent smoke).
- Post-deploy health check added to `deploy.yml` (blocks the deploy itself).
- Lighthouse CI advisory job added to `deploy.yml` (artifacts + visible reporting).

### Next (Sprint 8+)

1. **Fix or explicitly exclude the 8 failing Vitest files.** Then promote
   `test-full` from advisory to blocking.
2. **Broaden `typecheck:ci` further.** Add the remainder of `lib/services/**`
   and `functions/api/**` once the parked QuizView refactor lands.
3. **Ratchet lint.** `--max-warnings 2000` → 1500 → 1000 → 500 → 0, one
   sprint at a time, measuring the delta first. Do not bulk-autofix.
4. **Promote Lighthouse CI to blocking** once three consecutive main-branch
   post-deploy runs are green.
5. **Resolve wrangler API smoke** once the `nodejs_compat` + `pg` runtime
   issue is confirmed fixed; then promote `e2e-api-smoke` from advisory.
6. **Add coverage floors for critical paths** beyond the repo-wide floor
   (40%/35%) — drillReviewService + FSRS at ≥80%.

Every ratchet step needs a measured baseline before the threshold moves.

---

## Demotion policy (when to make a blocking gate advisory)

Demote a gate only if **all three** of the following are true:

1. The gate is flaking on infrastructure reasons (not code bugs), and
2. A fix is actively scheduled in the current or next sprint, and
3. The demotion is documented in this file with a sunset date.

Never demote a gate silently. Never demote to dodge a real regression.

---

## Emergency bypass

In a production incident, a repo admin can push directly to main with branch
protection disabled temporarily. Policy:

1. Document the reason in the commit message.
2. Open a follow-up issue to restore protection and backfill the missing check.
3. Re-enable protection within 24h.

This is an escape hatch, not a workflow.
