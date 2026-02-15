# Cloudflare Pages Worker Debugging Guide

When the Workers runtime reports **"code had hung"** or you see 503/500 spikes, use this checklist.

## 1. Track the Sentry Trace

Failed requests from the browser include a `sentry-trace` header. The **Trace ID** is the first segment (e.g. `8995ab8ee95f4c95a594aeb06e6f82bc`).

- **Response headers:** The API forwards `sentry-trace` to the response as `Sentry-Trace` when present.
- **Logs:** On error, handlers log `sentryTraceId` so it appears in Cloudflare Workers logs. Search for that ID in the dashboard.
- **Sentry UI:** In Sentry, open **Discover** or **Issues** and search by trace ID to see the exact span/transaction that was active when the Worker was killed.

Example: trace ID `8995ab8ee95f4c95a594aeb06e6f82bc` → plug into Sentry to see which DB call or function was in progress.

## 2. Unresolved Promises (Silent Killer)

Cloudflare kills the Worker when an `await` never resolves (e.g. DB or HTTP call that never completes).

- **DB/Prisma:** All Prisma work in `/api/user/rolling-360-stats` and `/api/user/stability-trend` is wrapped in `withTimeout()` (8–10s). We return 503 before the isolate is killed. Prisma/Accelerate cannot be aborted from here; the timeout only stops *our* wait.
- **External HTTP:** Use `fetchWithTimeout()` from `functions/api/_shared/timeout.ts` so `fetch()` is aborted via `AbortController` after 5–10s. Never `await fetch()` without a timeout in Workers.

## 3. Database Connection Exhaustion

- **Prisma Accelerate:** Production uses Prisma Accelerate (HTTP). There are no direct DB connections from the Worker; Accelerate handles pooling. Ensure `DATABASE_URL` is an Accelerate URL (`prisma://...` or `prisma+postgres://...`).
- **Singleton:** `createEdgePrismaClient()` reuses one client per isolate (see `functions/api/_shared/prisma-edge.ts`). We do not create a new connection per request.
- If you use direct PostgreSQL (e.g. in dev), use a pooler (e.g. Supabase pooler on port 6543) to avoid exhausting connections.

## 4. Isolate the Culprit via CI/CD

To find a regression that started the timeouts:

```bash
# Recent commits that touched stats or Prisma
git log -p --follow -S "rolling-360" -- functions/api/user/rolling-360-stats.ts lib/services/rolling360Service.ts
git log -p --follow -S "createEdgePrismaClient" -- functions/api/_shared/prisma-edge.ts

# Deployments: check your GitHub Actions or Cloudflare Pages deploy history
# for the first deploy where 503s/spikes appeared, then diff that commit.
```

Focus on:

- ORM or Prisma version bumps
- New queries or aggregation in rolling-360-stats / stability-trend
- Changes to Prisma client creation or connection URL

## Quick Reference

| Item | Location |
|------|----------|
| Sentry trace ID in logs | `sentryTraceId` in handler error logs |
| Response Sentry header | `Sentry-Trace` (forwarded from request) |
| Timeout for rolling-360 | 8s (`ROLLING_360_TIMEOUT_MS`) |
| Timeout for stability-trend | 10s (`STABILITY_TREND_TIMEOUT_MS`) |
| Fetch with abort | `fetchWithTimeout()` in `_shared/timeout.ts` |
| Prisma singleton | `prisma-edge.ts` global `__EDGE_PRISMA__` |
