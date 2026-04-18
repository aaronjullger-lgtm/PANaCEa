# PANaCEa Incident Runbook

What to do at 2 AM when something breaks.

Written for a solo operator — Aaron. Assumes no team, no paging system.
Keep this file short and scannable. If you're reading it mid-incident,
you should find the answer in under 60 seconds.

Last updated: 2026-04-18.

---

## 0. Before you do anything

**Breathe.** Most PANaCEa "outages" are symptoms a tired user sees, not
real outages. Check the signal before acting.

Open these tabs in order:

1. [studypanacea.com/api/health](https://studypanacea.com/api/health) — is
   the app itself up?
2. [Cloudflare Dashboard → Pages → panacea](https://dash.cloudflare.com) —
   latest deploy status, recent errors.
3. [Sentry → panacea project](https://sentry.io) — new error signatures
   in the last hour.
4. [status.cloudflarestatus.com](https://www.cloudflarestatus.com),
   [status.supabase.com](https://status.supabase.com),
   [status.clerk.com](https://status.clerk.com) — provider outages.

If all four are clean, the issue is probably a single user's device or
network — not production. Do not deploy a fix for one user at 2 AM.

---

## 1. Severity triage

| Severity | Symptom | Response time |
|---|---|---|
| **SEV-1** | Site down, auth broken for all users, data loss risk | Stop everything, roll back |
| **SEV-2** | Major flow broken (study sessions, submit-review), >20% users affected | Roll back or killswitch within 30 min |
| **SEV-3** | Feature broken, workaround exists, <20% users affected | Hotfix next morning |
| **SEV-4** | Cosmetic, rare error signature | Log it, triage in next sprint |

**Default to SEV-3 unless you have evidence otherwise.** The cost of a
bad 2 AM deploy is usually higher than the cost of the bug.

---

## 2. Decision tree

```
Is the site returning 5xx?
├── Yes → Is it auth-related (401/403 storm)? → Section 3A
│       └── No → Is it DB-related (timeouts, "connection refused")? → Section 3B
│              └── No → Rollback (ROLLBACK.md Method 1)
│
├── No → Are study sessions failing to submit?
│       ├── Yes → Section 3C (FSRS / drillReviewService)
│       └── No → Are questions failing to generate?
│              ├── Yes → Section 3D (Gemini / AI)
│              └── No → Is it a PWA / cache issue?
│                      ├── Yes → Section 3E
│                      └── No → Probably a false alarm. Capture in Sentry, go back to sleep.
```

---

## 3. Runbooks by failure mode

### 3A. Auth storm (401/403 for everyone)

**Likely causes:** Clerk secret rotated but not updated in CF env vars;
Clerk instance mismatch (dev key in prod); clock skew on the edge.

**Diagnose:**

```bash
# 1. Verify the Clerk secret in Cloudflare matches the Clerk dashboard.
#    Cloudflare → Pages → panacea → Settings → Environment variables →
#    CLERK_SECRET_KEY should start with `sk_live_`.

# 2. Check Clerk dashboard for any recent rotations or instance switches.

# 3. Temporary diagnostic flag — set CLERK_AUTH_DEBUG=true in CF env
#    and redeploy. Sentry will capture token-not-active-yet errors and
#    JWT verification failures with full context.
```

**Fix:**

- If secrets drifted → update the CF env var, redeploy. Do NOT roll back
  code (the code is fine, the config is wrong).
- If Clerk instance mismatch → swap to correct instance secrets, redeploy.
- If clock skew → this is a Cloudflare edge issue. Open a support ticket.
  No rollback will fix it.

### 3B. DB pressure (timeouts, connection refused, "too many connections")

**Likely causes:** Runaway query; pgbouncer pool exhausted; Supabase
maintenance; migration in flight.

**Diagnose:**

```bash
# 1. Check Supabase dashboard → Database → Connections. If near max,
#    something is leaking connections.

# 2. Check for missing safePrismaDisconnect in recent edge function deploys.
#    grep -n "safePrismaDisconnect" functions/api/**/*.ts

# 3. Check Prisma query logs in Sentry for slow queries (>1s).
```

**Fix:**

- Leaked connections → roll back the most recent deploy; missing
  `safePrismaDisconnect` is the usual culprit.
- Supabase-side → check their status page. If they're paused for
  maintenance, wait it out and post a status message.
- Runaway query → find it in Sentry, kill the caller via feature flag or
  rollback, then open a ticket to add an index or rewrite the query.

### 3C. Study sessions failing to submit

**Likely causes:** FSRS pipeline regression; syncManager auth drift;
drillReviewService regression; ReviewLog/QuestionAttempt schema drift.

**This is SEV-1-adjacent.** User progress is being lost if answers aren't
persisting.

**Diagnose:**

```bash
# 1. Check Sentry for errors in:
#    - functions/api/questions/attempt.ts
#    - functions/api/drills/submit-review.ts
#    - lib/services/drillReviewService.ts

# 2. Check syncQueue table for backlog:
#    SELECT COUNT(*), MIN(createdAt) FROM "SyncQueue" WHERE status = 'pending';
#    If the backlog is growing, submit-review is failing silently.

# 3. Re-verify the token provider pattern is intact:
#    grep -n "useSyncManager" components/**/*.tsx
#    Should pass getToken — not call useAuth() directly.
```

**Fix:**

- **Roll back immediately** (ROLLBACK.md Method 1). Do not try to hotfix
  in place — user progress is at risk.
- After rollback, check `SyncQueue` for stuck items. They should drain
  automatically when the previous version is restored.
- Do not re-deploy the fix until you have a regression test reproducing
  the failure.

### 3D. AI generation failing (Gemini)

**Likely causes:** Gemini quota exhausted; bad prompt template deployed;
API key rotated; Gemini service outage.

**Diagnose:**

```bash
# 1. Check Gemini quota:
#    Google Cloud Console → APIs & Services → Dashboard →
#    generativelanguage.googleapis.com.

# 2. Check for recent prompt changes:
#    git log --oneline -10 lib/services/autoAuthor/
#    git log --oneline -10 functions/api/questions/generate/

# 3. Check Sentry for "GoogleGenerativeAIError" or rate-limit patterns.
```

**Fix:**

- Quota exhausted → set `GEMINI_KILLSWITCH=true` in CF env vars, redeploy.
  This disables generation but keeps reviews working. File a quota increase.
- Bad prompt → roll back the prompt-changing commit only. Don't roll back
  the whole deploy.
- Gemini outage → killswitch + wait. Post user-facing notice.

### 3E. PWA / cache issues ("I see the old version")

**Likely causes:** Service worker holding a stale bundle; cache name
didn't bump; users haven't reloaded yet.

**Diagnose:**

```bash
# 1. Check the current SW cache name in vite.config.ts (panacea-v12-offline-first
#    at time of writing). If it matches the last-known-good deploy and a
#    new deploy didn't bump it, SW update won't trigger.

# 2. Ask the user to open DevTools → Application → Service Workers →
#    Update on reload, then hard-refresh.
```

**Fix:**

- If a legit new deploy didn't bump the cache ID, push a patch commit
  that bumps it (the SW will update on next load for all users).
- If it's a one-user report, walk them through hard-refresh. Not a prod
  incident.

---

## 4. Escalation paths

Since there's no team, escalation here means upstream providers.

| Problem | Escalate to |
|---|---|
| CF Pages won't serve | [Cloudflare support](https://dash.cloudflare.com/?to=/:account/support) + status page |
| Supabase DB unreachable | [Supabase support](https://supabase.com/dashboard/support/new) + status page |
| Clerk auth service down | [Clerk Discord](https://discord.com/invite/b5rXHjAg7A) / support email |
| Gemini API degraded | [Google Cloud support](https://console.cloud.google.com/support) |
| Sentry not receiving events | [Sentry status](https://status.sentry.io) |

If all upstream providers are green and PANaCEa is still broken, the
bug is in PANaCEa's code or config.

---

## 5. Post-incident

After every SEV-1 or SEV-2:

1. **Short postmortem** — write in `docs/incidents/YYYY-MM-DD-slug.md`.
   Blameless, even though you're the only one to blame. Focus on what
   signals would have caught this earlier.
2. **Regression test** — add a test that would have caught this specific
   failure mode. Do not ship the fix without it.
3. **Update this runbook** — add the failure mode to Section 3 if it's
   not already covered. Note the diagnostic commands that actually worked.
4. **Monitoring gap?** — if Sentry didn't catch it, or dashboards didn't
   surface it, fix that. One more alert you missed is one more you'll
   miss again.

---

## 6. Things that are NOT incidents (resist the urge to treat them as such)

- A single user reports a bug. Capture in Linear / issue tracker.
- Sentry fires one error out of 10,000 requests. Add to triage queue.
- Lighthouse score regressed by 2 points. Not an incident.
- A feature-flagged beta is flaky. Turn off the flag if needed.
- You're tired and things feel broken. Sleep first. Re-verify in the morning.

**Most "emergencies" are fatigue and confirmation bias. The health check
is the source of truth.**

---

## 7. Quick reference — commands

```bash
# Health check
curl -sS https://studypanacea.com/api/health | jq .

# Recent Cloudflare deploys
npx wrangler pages deployment list --project-name=panacea

# Check secret-scan history for this commit
gitleaks detect --source . --config .gitleaks.toml --verbose

# Kill switches available today
# (set these in Cloudflare Pages → Production env vars, then redeploy)
# GEMINI_KILLSWITCH=true       — disables Gemini AI generation
# RATE_LIMIT_DISABLED=true     — disables rate limiting middleware
# CLERK_AUTH_DEBUG=true        — enables verbose Clerk JWT logging

# Rollback (see ROLLBACK.md for details)
# Method 1: CF dashboard → Pages → panacea → Deployments → ⋯ → Rollback
# Method 2: git checkout <sha> && npm run build && npx wrangler pages deploy dist
```

---

## 8. Related docs

- `ROLLBACK.md` — full rollback procedure and safety nets.
- `LAUNCH-CHECKLIST.md` — pre-flight before any release.
- `CI-GATES.md` — what should have caught this before it shipped.
- `PREVIEW-ENVS.md` — if this failure mode could have been caught on a preview.
