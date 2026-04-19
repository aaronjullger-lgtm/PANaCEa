# Launch Readiness Checklist

Pre-flight for any PANaCEa production release — patch, minor, or major.

Use as a checklist, not a recipe.

Last updated: 2026-04-18.

---

## T-minus 1 day (or before merging the release branch)

### Code & tests

- [ ] All blocking CI gates green on the release commit (see `CI-GATES.md`).
- [ ] Advisory gates reviewed — no new regressions vs. last release.
- [ ] No `[DEPRECATED]` workflows manually triggered on the release branch.
- [ ] Bundle budget: `npm run build:check-size` → no breach. Note deltas.
- [ ] No new TODO / FIXME / XXX comments in the diff that imply known bugs.

### Database

- [ ] Any new Prisma migration has been reviewed by Aaron.
- [ ] Migration is backward-compatible (old code works against new schema) OR
      a compensating migration exists.
- [ ] Migration tested against a Neon branch preview (see `PREVIEW-ENVS.md`).
- [ ] Backfills have been run in a separate, idempotent script if needed.

### Configuration

- [ ] All required secrets set in Cloudflare Pages → Production:
  - `CLERK_SECRET_KEY`
  - `DATABASE_URL` (pgbouncer / Accelerate)
  - `DIRECT_DATABASE_URL` (migrations)
  - `GEMINI_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SENTRY_AUTH_TOKEN`
  - `CRON_SECRET`
- [ ] `wrangler.toml` compatibility_date recent enough for any new API usage.
- [ ] KV namespaces bound (`RATE_LIMIT_KV`, `CACHE`) in both Production and
      Preview environments in Cloudflare.

### Content & AI

- [ ] Clinical-content review if any drug/condition/guideline data shipped.
      See `clinical-safety-review` skill.
- [ ] Gemini rate-limit budgets reviewed if generation volume changes.
- [ ] Cost estimate for the new release doesn't exceed monthly budget.

### Observability

- [ ] Sentry project name + release set in `vite.config.ts` Sentry plugin.
- [ ] Source maps will upload on deploy (secrets present).
- [ ] New endpoints have structured logging (`structuredLogger`) — not `console.log`.

---

## T-minus 1 hour

- [ ] Merge release PR to `main`. CI runs.
- [ ] Watch CI — all blocking gates green.
- [ ] `deploy.yml` workflow_run fires automatically on CI success.
- [ ] Prisma migrations deploy successfully — check logs for `Applied N migrations`.
- [ ] Cloudflare Pages build completes — note the deployment URL.

---

## T-zero — deploy

- [ ] `curl -sS https://studypanacea.com/api/health` → `status: healthy`.
- [ ] Smoke test (actual user flow, not just a ping):
  1. Sign in with a test account.
  2. Load dashboard — no console errors.
  3. Start a study session — questions load.
  4. Submit an answer — response returns with `isCorrect`, `rating`, `nextReview`.
  5. Check the review shows up on the dashboard's review queue.
- [ ] First 5 minutes: watch Sentry for new error signatures.
- [ ] First 30 minutes: watch error rate dashboard (if set up — otherwise Sentry).

---

## T-plus 1 hour

- [ ] Error rate within normal bounds (compare to previous 24h baseline).
- [ ] Median API latency within 10% of pre-deploy baseline.
- [ ] No unexpected Cloudflare Worker CPU-time spikes.
- [ ] No abnormal KV write volume (usually stable day-over-day).
- [ ] No abnormal DB connection-pool pressure.

---

## T-plus 24 hours

- [ ] Daily retention metrics tracked (see `userStatistics.ts`).
- [ ] Any new feature flagged user-facing features getting used as expected.
- [ ] Review Sentry for low-rate but recurring new errors — open triage tickets.

---

## Release artifacts

After launch, capture:

- Cloudflare Pages deployment URL + SHA in release notes.
- Prisma migration names applied (from `prisma migrate deploy` log).
- Bundle sizes (JS + CSS + max chunk) in a CHANGELOG entry.
- Sentry release ID for correlation.

---

## If the launch goes sideways

Decision tree:

1. Is user data at risk (wrong writes, missing writes, auth leak)?
   → **Roll back now.** See `ROLLBACK.md`.
2. Is the site responsive but degraded?
   → Check feature-flag killswitches. If one applies, use it and stay up.
   → Otherwise, roll back.
3. Is the issue cosmetic / affects <10% of users?
   → Roll forward with a hotfix. Don't roll back.

Explicit non-goal: zero downtime for every launch. PA students studying is
higher priority than uptime vanity — if something is wrong, roll back and
fix it right.

---

## Known gaps to close before v1.0

These items should be in place before a wider public launch:

- [ ] Lighthouse CI gate promoted from advisory to blocking (see `CI-GATES.md`).
- [ ] Full-suite Vitest blocking (8 known-failing files fixed or excluded).
- [ ] `typecheck:ci` scope broadened beyond FSRS core.
- [ ] Preview deployments with isolated KV and Neon DB (see `PREVIEW-ENVS.md`).
- [ ] Rollback procedure dry-run executed end-to-end by Aaron.
- [ ] Incident response runbook with on-call rotation (even solo — a clear
      written playbook for "what to do at 2 AM when something breaks").
