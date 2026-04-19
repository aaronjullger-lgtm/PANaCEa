# CI Gates & Release Readiness

Source of truth for what blocks a merge to `main` and what is advisory.
Kept in sync with `.github/workflows/ci.yml`.

Last updated: 2026-04-18 (Sprint 1 + 2 consolidation).

---

## The single required check

Branch protection on `main` should require **one** status check:

> **"All blocking gates pass"**

That job (`all-gates-pass` in `ci.yml`) runs with `if: always()` and explicitly
verifies the result of every blocking job. Pinning protection to this
aggregator means individual job renames, reorderings, or additions don't break
branch-protection configuration — only the list inside `all-gates-pass.needs`
matters.

Do not pin branch protection to individual job names.

---

## Blocking gates (5)

A failure in any of these fails the merge. They run in parallel.

| Gate | Command | Scope | Typical time |
|---|---|---|---|
| **Lint** | `npm run lint` | ESLint with `--max-warnings 2000` | <2 min |
| **Typecheck** | `npm run typecheck:ci` | `tsconfig.ci.json` — FSRS core only | <2 min |
| **Unit — critical** | `npm run test:critical` | FSRS math + study store | <4 min |
| **Build + bundle** | `npm run build && npm run build:check-size` | Full prod build; 1400 kB JS / 200 kB CSS / 350 kB max chunk | ~5 min |
| **Secret scan** | `gitleaks` against `.gitleaks.toml` | Full-history scan on push | <1 min |

### Rationale per gate

- **Lint** — `--max-warnings 2000` is the current ceiling, not the target. See
  the Ratchet plan below.
- **Typecheck** — Full-tree typecheck has known errors (parked QuizView refactor
  branch bled some into main). `tsconfig.ci.json` narrows scope to the FSRS core
  — the most safety-critical surface. Broadens in Sprint 7.
- **Unit — critical** — `test:critical` covers FSRS math and the study store.
  These are the paths where a regression corrupts user scheduling data.
- **Build + bundle** — A green build proves the prod bundle compiles; the size
  check enforces budgets. A single budget breach fails the build.
- **Secret scan** — `gitleaks` scans the full history on push to main;
  shallow-scans PRs (via fetch-depth 0 on checkout).

---

## Advisory gates (2)

These run with `continue-on-error: true` and surface regressions without
failing the merge.

| Gate | Command | Why advisory today |
|---|---|---|
| **Unit — full** | `npm test` (full Vitest) | 8 known-failing files per CLAUDE.md (React 19 compat issues in admin / Goals / offline). Demoted so the rest of the gate is actionable. |
| **E2E a11y** | `playwright test --project=a11y` against `vite preview` | Recently restored after the `wrangler pages dev` pg/Node-builtins issue broke the prior e2e-smoke. Advisory until a clean baseline is stable across 3+ runs. |

Advisory jobs still upload artifacts (coverage, Playwright reports) so
regressions are diagnosable.

---

## Orthogonal jobs (informational)

These live in separate workflows, do not feed into `all-gates-pass`, and do
not block merges:

- `.github/workflows/deploy.yml` — triggered on CI success on `main`;
  runs `prisma migrate deploy`, build, `wrangler pages deploy`.
- `.github/workflows/cloud-agents.yml` — path-filtered Cursor Cloud Agent
  fan-out (PR review, edge-guard, living-docs, etc.). Independent of the gate.
- `.github/workflows/daily-automation.yml`, `weekly-automation.yml` — cron
  jobs for content + health checks. Independent.
- `.github/workflows/neon_workflow.yml` — creates a Neon preview DB branch
  per PR (migrations are commented out; see `PREVIEW-ENVS.md`).

---

## Ratchet plan (Sprint 7 and beyond)

The gate stays actionable by tightening thresholds on a schedule, never by
adding aspirational blocking jobs that aren't green yet.

1. **Fix or explicitly exclude the 8 failing Vitest files.** Then promote
   `test-full` from advisory to blocking.
2. **Broaden `typecheck:ci` scope.** Today it covers 6 FSRS files. Add
   `lib/services/drillReviewService.ts`, `lib/confidence/**`, and
   `functions/api/_shared/**` next, then the remainder once the parked
   QuizView refactor lands.
3. **Ratchet lint.** `--max-warnings 2000` → 1500 → 1000 → 500 → 0, one
   sprint at a time, measuring the delta first. Do not bulk-autofix.
4. **Promote `e2e-a11y` to blocking** once three consecutive main-branch
   runs are green.
5. **Add Lighthouse CI as advisory**, then blocking once a stable baseline
   exists (see `lighthouserc.prod.js`).
6. **Add coverage floors for critical paths** beyond the repo-wide floor
   (40%/35%) — critical paths should be ≥80%. Already partially enforced in
   `vitest.config.ts`.

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
