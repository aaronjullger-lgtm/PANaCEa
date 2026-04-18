# Rollback Procedure — PANaCEa Production

Fast-path rollback for the Cloudflare Pages deployment at studypanacea.com.

Last updated: 2026-04-18.

---

## When to roll back vs. roll forward

**Roll back immediately** if any of the following:

- Auth is broken for all users (Clerk misconfiguration, token provider drift).
- Study sessions crash or fail to submit (FSRS pipeline / `drillReviewService` regression).
- Data integrity issue being written to the DB (wrong user scope, missing `userId`).
- 5xx rate above 2% sustained for >5 minutes.
- Core Web Vital regression >20% (likely bundle or build regression).

**Roll forward** (do not roll back) if:

- The bug is in a feature flag that can be turned off in the Cloudflare env vars.
- The bug is cosmetic and affects <10% of users.
- A Prisma migration has already run against production. Migrations are
  forward-only; rolling back code does not roll back schema. See "Database
  considerations" below.

---

## Method 1 — Cloudflare Dashboard (recommended, <60s)

Fastest path. Reverts the deployed bundle without redeploying.

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **panacea**.
2. Click the **Deployments** tab.
3. Find the last known-good production deployment (marked with the commit SHA
   matching a green CI run).
4. Click the **⋯** menu on that deployment → **"Rollback to this deployment"**.
5. Confirm in the dialog.

Cloudflare swaps the active production deployment within seconds. The preview
URL for the bad deployment stays accessible for post-mortem.

**Verification:**

```bash
curl -sS https://studypanacea.com/api/health | jq .
# Expect { status: "healthy", ... } within 60s of rollback.
```

---

## Method 2 — Wrangler CLI (for automation)

Use when the dashboard is unavailable, or scripting a rollback.

```bash
# 1. List recent deployments to find the target SHA.
npx wrangler pages deployment list --project-name=panacea

# 2. Redeploy from the known-good git commit.
git checkout <known-good-sha>
npx prisma generate
npm run build
npx wrangler pages deploy dist --project-name=panacea --branch=main --commit-dirty=true

# 3. Verify.
curl -sS https://studypanacea.com/api/health | jq .
```

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment.

---

## Database considerations

**Prisma migrations are forward-only.** Rolling back application code does not
roll back schema changes. Before rolling back, answer:

1. Did the bad deploy include a Prisma migration? (`prisma/migrations/` diff).
2. Does the previous version's code work against the new schema?

If the previous code cannot tolerate the new schema (dropped column, renamed
field, changed constraint), you have two options:

- **Write a compensating migration** that re-adds the dropped column as nullable.
  Deploy that migration, then roll back the code.
- **Forward-fix instead.** Push a hotfix that makes the code compatible with
  the new schema.

Never try to revert a Prisma migration by running the previous migration
backwards — that path has dataloss risk and no tooling support.

---

## Feature-flag kill switches

Some regressions can be neutralized without rolling back the full deploy.

| Symptom | Kill switch |
|---|---|
| AI generation producing bad output | Set `GEMINI_KILLSWITCH=true` in Cloudflare env vars; restart deployment |
| New drill type crashing | Remove from `config/training-modes.ts` feature list (needs redeploy — not a true killswitch today) |
| Rate limiting too aggressive | Raise limits in `RATE_LIMIT_KV` or disable middleware via env var |

If a kill switch would fix the issue, prefer that over a full rollback.

---

## Post-rollback checklist

After the dashboard or CLI rollback completes:

- [ ] `curl https://studypanacea.com/api/health` returns `status: healthy`.
- [ ] Smoke test: sign in → start a study session → submit one answer → verify it persisted.
- [ ] Check Sentry for new error signatures in the last 10 minutes.
- [ ] Post a short note in the incident channel (what, when, why, ETA on fix).
- [ ] Open a follow-up ticket: root cause + plan to roll forward.
- [ ] Add a regression test to prevent the same failure mode.

---

## Rollback runbook for common failure modes

### Auth broken after Clerk config change

1. Roll back code (Method 1).
2. Verify Clerk secret keys in Cloudflare env vars still match the Clerk
   dashboard (production instance).
3. Check clock skew: set `CLERK_AUTH_DEBUG=true` temporarily if needed.

### Bundle size explosion / white screen on load

1. Roll back code (Method 1) — the old bundle is still cached on Cloudflare's
   edge, so rollback is near-instant.
2. After rollback, investigate what added the weight: compare
   `npm run build:check-size` output against the last green run.

### Sync manager dropping answers

1. Roll back code immediately — user progress is at risk.
2. Check `syncQueue` table in Prisma for stuck items.
3. Do not re-deploy the fix until you have a test reproducing the issue.

---

## Rollback safety net in CI

- `deploy.yml` only triggers on `workflow_run` success of the CI workflow on
  `main`. If CI is red, deploy does not run.
- Source maps are uploaded to Sentry on every deploy — release-name indexing
  means Sentry can symbolicate the bad release after rollback.
- The last 20 Cloudflare Pages deployments are retained by default; rollback
  targets remain available for weeks.

---

## Escalation

If the rollback procedure itself fails (dashboard down, wrangler errors,
database unreachable), escalate to:

- Cloudflare status: [status.cloudflarestatus.com](https://www.cloudflarestatus.com)
- Supabase status: [status.supabase.com](https://status.supabase.com)
- Clerk status: [status.clerk.com](https://status.clerk.com)

If all three are green and rollback still fails, the issue is in PANaCEa's
configuration — diagnose with Sentry + Cloudflare Pages build logs before
attempting further deploys.
