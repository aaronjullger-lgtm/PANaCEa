# Push Reminder Runtime Plan

**Date:** 2026-07-09
**Scope:** `functions/api/push/subscribe.ts`, `functions/api/cron/push-reminders.ts`,
`prisma/schema.prisma` (`PushSubscription`, `NotificationLog`), `.github/workflows/**`.

## 1. Current state (verified — much further along than the audit implies)

| Piece | State | Evidence |
|---|---|---|
| `PushSubscription` model | ✅ In schema | `prisma/schema.prisma`. |
| Subscribe endpoint | ✅ Exists | `functions/api/push/subscribe.ts`. |
| Cron auth | ✅ `CRON_SECRET` bearer-gated | `functions/api/cron/push-reminders.ts` via `cronEndpoint`. |
| **`NotificationLog` model** | ✅ **In schema** (`schema.prisma:3903`) — the audit's "does not exist" is **STALE** | model + 4 indexes + `User` FK. |
| **`NotificationLog` migration** | ✅ **Drafted** with table + FKs + indexes + **RLS policies** | `prisma/migrations/20260418120100_add_notification_log/migration.sql`. |
| Delivery logging write path | ✅ **Implemented** (reads via `count`, writes via `create`, fire-and-forget with defensive `.catch`) | `push-reminders.ts:341,405` — the old `notificationsSent24h: 0 // TODO` is gone. |
| Habit throttler using log counts | ✅ Uses `notificationsSent24h` / `notificationsSent7d` | `push-reminders.ts`. |
| Send mechanism | ⚠️ Raw `fetch()` to `subscription.endpoint` — no VAPID signing | `push-reminders.ts:175` `sendPushNotification` ("consider `web-push` for production"). |
| Scheduler ownership | ❌ **No workflow invokes `push-reminders`** | `.github/workflows/**` grep = none. |
| `web-push` dependency | ❌ Not installed | `package.json`. |

## 2. What is DONE (no action needed)

Schema model, migration draft (with RLS), the delivery-logging read/write path, and the
habit-formation throttler are all implemented. The audit findings "add NotificationLog schema +
migration" and "notification delivery logging not started" are **stale**.

## 3. What remains — ALL Ask-First

| Item | Gate | Notes |
|---|---|---|
| Apply the `NotificationLog` migration to the DB | **Schema migration → Ask First** | Draft is greenfield-safe (`CREATE TABLE IF NOT EXISTS`, additive, RLS). If applied via Supabase MCP, register with `npx prisma migrate resolve --applied 20260418120100_add_notification_log` (per `CLAUDE.md` convention). |
| Choose a scheduler owner | **Scheduler activation → Ask First** | Options: (a) a GitHub `sched-*` workflow calling the CRON_SECRET endpoint (matches existing cron lanes); (b) a Cloudflare Cron Trigger; (c) a runtime queue. Recommendation: reuse the existing GitHub `sched-daily-ops`-style lane hitting the endpoint, since the endpoint + auth already exist. |
| Proper VAPID signing | **Prod dependency → Ask First** | Add `web-push` and sign payloads instead of raw `fetch()`. Current raw-fetch send is unreliable for real Web Push delivery. |

## 4. Safe now (no approval)

- **Route hardening / validation / tests only.** `push-reminders.ts` is CRON_SECRET-gated (correct
  out-of-band model; Zod N/A). The `NotificationLog` write is already defensively wrapped.
- Add unit tests for the throttler decision logic (max-per-day, type rotation) if not already covered,
  mocking `prisma.notificationLog.count`.

## 5. NotificationLog migration proposal (for the Ask-First approval packet)

- **Model shape:** `id, userId(FK→User, cascade), channel(PUSH|EMAIL|IN_APP), notificationType, title,
  body, actionUrl?, payload?(Json), endpoint?, status(SENT|FAILED|EXPIRED|DELIVERED|OPENED),
  errorDetail?, sentAt, deliveredAt?, openedAt?` — matches `schema.prisma:3903` and the drafted SQL.
- **Write path:** cron `push-reminders.ts` inserts one row per send attempt (fire-and-forget; never
  fails the send loop). Status transitions (DELIVERED/OPENED) are future client-side updates.
- **Idempotency:** each send attempt logs a distinct row (append-only audit). If dedupe is desired, add
  a `(userId, notificationType, sentAt-bucket)` uniqueness check before send. Current design favors a
  full audit trail over dedupe.
- **Retry strategy:** none today (fire-and-forget). If reliability matters, move to a queue with retry;
  `status=FAILED` + `errorDetail` already capture failures for later reconciliation.
- **Privacy/security:** RLS `select/insert/update own` policies present; cron inserts via service role
  (bypasses RLS). No PII beyond notification title/body (already user-facing). Do not log secrets.
- **Rollout:** apply migration → backfill not required (append-only) → wire scheduler → monitor
  `NotificationLog` counts and `status=FAILED` rate before widening cadence.

**Do not** apply the migration, activate the scheduler, or add `web-push` without explicit approval.
