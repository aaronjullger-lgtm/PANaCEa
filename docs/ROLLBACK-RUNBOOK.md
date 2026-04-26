# Private Beta Rollback Runbook

Last updated: 2026-04-26

Use this runbook for private beta incidents that affect sign-in, `/study`,
session generation, answer submission, review/progress persistence, or
production data safety.

## Immediate Triage

1. Freeze beta invites and post the incident start time in the release channel.
2. Check Sentry and Cloudflare logs for the first failing endpoint, request ID,
   release SHA, and error rate.
3. Decide whether the issue is UI-only, API-only, or data-integrity related.
4. If answer submission or review/progress integrity is suspect, disable beta
   traffic first and preserve logs before attempting data repair.

## Rollback Options

### Feature Gate Rollback

Use when partial modes or launch-gated surfaces accidentally become visible.

1. Set `VITE_PRIVATE_BETA_LAUNCH=true` in Production.
2. If a new risky surface still appears, remove it from the private beta allowlist
   and redeploy.
3. Smoke `/study`, `/practice`, command palette, and one direct hidden mode URL.

### Cloudflare Pages Deployment Rollback

Use when the current frontend/API deployment is unhealthy.

1. Open Cloudflare Pages → `panacea` → Deployments.
2. Promote the last known-good production deployment.
3. Verify `/api/health`.
4. Sign in, load `/study`, start a supported session, submit one answer, and
   confirm review/progress updates.

### Database Migration Rollback Or Forward Fix

Use when a schema change caused data or write failures.

1. Stop beta traffic if writes are unsafe.
2. Prefer forward fixes for additive migrations.
3. Only run a down migration if it is explicitly reviewed and data-safe.
4. For the submission idempotency table, rollback is normally non-destructive:
   leave the table in place and disable the calling code by redeploying the
   previous release.

## Verification After Rollback

- `/api/health` returns healthy.
- Clerk sign-in succeeds.
- `/study` renders one primary action.
- Starting a session returns usable questions.
- Submitting the same answer twice does not create duplicate progress/review
  writes.
- Review queue/dashboard reflect the completed attempt.
- Sentry error rate returns to baseline.

## Beta User Communication

Use calm, specific wording:

> We paused the beta briefly while we repaired study-session saving. Your
> progress is safe. We will confirm when sessions are available again.
