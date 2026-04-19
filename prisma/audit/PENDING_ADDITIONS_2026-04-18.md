# Pending Additions — 2026-04-18

**Author:** Claude (sandbox session, virtiofs-restricted — can create files, cannot run git/npm/migrations)
**Companion doc:** `prisma/audit/DATABASE_AUDIT_2026-04-17.md`
**Intent:** Aaron is running multiple parallel Claude sessions and will compile manually at the end. This doc is the compile sheet for THIS session's deliverables. Only create/new operations — no destructive edits to files other sessions may also be touching.

---

## 0. CLAUDE.md stale-fact corrections

Confirmed on `main` at 2026-04-18:

| Claim in CLAUDE.md (Current Priorities §4) | Actual state | Action |
|---|---|---|
| `PushSubscription + NotificationLog` pending | **PushSubscription already in schema** (line 3483) | Strike PushSubscription from the pending list |
| `web-push npm package for notification cron (Sprint 18)` | **`functions/api/cron/push-reminders.ts` already ships** — uses raw `fetch()` against the subscription endpoint. The `web-push` comment in the file header is explicitly optional ("for production, consider…"). | **Do NOT install `web-push`.** Current impl works without it; VAPID signing can be added later if open-push providers start rejecting unsigned requests. |
| `banditState on UserPreferences (Sprint 16)` | **No `contextualBanditService.ts` file exists on main.** No `bandit` / `LinUCB` references anywhere in the codebase. | Defer — the migration is only useful once the service lands. See §4 below. |
| `ContentGap model (Sprint 15)` | Truly pending | Migration ready — see §1 |

CLAUDE.md also dates itself `2026-04-13` but the env date is `2026-04-18`. The "Recently Completed (2026-04-13 Integration Session)" bullets reference services (contextualBandit, contentGap wiring, etc.) that **don't exist on main**. Likely explanation: those claims describe an unmerged branch. When Aaron compiles, recommend reconciling CLAUDE.md against what's actually on `main`.

---

## 1. ContentGap — READY TO APPLY

**Migration SQL:** `prisma/migrations/20260418120000_add_content_gap/migration.sql` (created this session)

**Schema addition needed** — add this block to `prisma/schema.prisma` (new model, placement: alphabetically or near `UserConditionAccuracy` / `WeaknessPattern` since it's a gap-tracking sibling):

```prisma
/// Sprint 15 — Per-user and global blueprint gap tracking.
/// Populated by lib/services/contentGapService.ts (pending).
/// Consumed by functions/api/analytics/daily-load.ts and learner-profile endpoints.
model ContentGap {
  id             String    @id @default(cuid())
  userId         String?   /// null = global / content-level gap
  system         String    /// blueprint organ system
  taskCategory   String?   /// PANCE task category (History, PE, Dx, Tx, Sci)
  conditionId    String?
  topic          String    /// human-readable topic label
  gapType        String    /// COVERAGE | MASTERY | STALENESS
  severity       Float     @default(0) /// 0..1 gap score
  questionCount  Int       @default(0)
  avgAccuracy    Float?
  lastReviewAt   DateTime?
  detectedAt     DateTime  @default(now())
  resolvedAt     DateTime?
  metadata       Json?
  User           User?     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([system])
  @@index([userId, system])
  @@index([userId, resolvedAt])
  @@index([gapType])
  @@index([severity])
}
```

**Back-relation on User model** — add this line in `model User` alongside the other relation arrays (keep alphabetical; fits near `ConfusionPair` / `ConceptGap` if present):

```prisma
  ContentGap                ContentGap[]
```

**Apply steps (when Aaron runs it):**

```bash
# 1. Edit schema.prisma per above
# 2. Validate
npm run db:validate

# 3. Register migration without re-running SQL (since the DB is greenfield and you
#    may prefer `db push` first; the SQL file is here for fresh envs / CI replay)
npx prisma migrate resolve --applied 20260418120000_add_content_gap

# OR, if you want Prisma to drive the apply:
npm run db:migrate:deploy
```

**RLS note:** Policies included in the migration SQL. Service role bypasses for global rows (`userId IS NULL`).

---

## 2. NotificationLog — READY TO APPLY

**Migration SQL:** `prisma/migrations/20260418120100_add_notification_log/migration.sql` (created this session)

**Unblocks:** the TODO at `functions/api/cron/push-reminders.ts:370-371`:
```ts
notificationsSent24h: 0, // TODO: track via NotificationLog when migration ships
notificationsSent7d: 0,
```

**Schema addition** — add to `prisma/schema.prisma` (natural neighbor: right after `PushSubscription` at line 3496):

```prisma
/// Sprint 18 — Notification audit log for habit-formation throttling.
/// Written from functions/api/cron/push-reminders.ts after each send.
/// Queried by the habit-formation service for rolling-window rate limits.
model NotificationLog {
  id               String    @id @default(cuid())
  userId           String
  channel          String    /// PUSH | EMAIL | IN_APP
  notificationType String    /// REVIEW_DUE | STREAK_RISK | DAILY_GOAL | HABIT_CUE | SYSTEM_NEGLECT | ENCOURAGEMENT
  title            String
  body             String
  actionUrl        String?
  payload          Json?
  endpoint         String?   /// PushSubscription endpoint if channel=PUSH
  status           String    @default("SENT") /// SENT | FAILED | EXPIRED | DELIVERED | OPENED
  errorDetail      String?
  sentAt           DateTime  @default(now())
  deliveredAt      DateTime?
  openedAt         DateTime?
  User             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, sentAt(sort: Desc)])
  @@index([userId, notificationType, sentAt(sort: Desc)])
  @@index([sentAt])
  @@index([channel])
}
```

**Back-relation on User model**:

```prisma
  NotificationLog           NotificationLog[]
```

**Follow-up code changes (not in this session — parallel Claude may own):**

1. In `functions/api/cron/push-reminders.ts` replace the `notificationsSent24h` / `notificationsSent7d` zeros with a real count:
   ```ts
   const [sent24h, sent7d] = await Promise.all([
     prisma.notificationLog.count({
       where: {
         userId: userPref.userId,
         sentAt: { gte: new Date(now.getTime() - 24*60*60*1000) },
         status: 'SENT',
       },
     }),
     prisma.notificationLog.count({
       where: {
         userId: userPref.userId,
         sentAt: { gte: new Date(now.getTime() - 7*24*60*60*1000) },
         status: 'SENT',
       },
     }),
   ]);
   // …
   notificationsSent24h: sent24h,
   notificationsSent7d: sent7d,
   ```
2. After each successful `sendPushNotification()`, write a `NotificationLog` row (status `SENT` on 200/201, `EXPIRED` on 410, `FAILED` otherwise).
3. Delete-and-reinsert pattern is cheap since volume is tiny (≤2 sends per user per day).

---

## 3. web-push — DO NOT INSTALL

`functions/api/cron/push-reminders.ts` already implements Web Push without the library (raw `fetch()` POST to `subscription.endpoint`). Comment at line 183–184 notes VAPID signing is optional.

Remove this item from CLAUDE.md Current Priorities §5. If Apple / Mozilla push services start rejecting unsigned payloads later, revisit — but today the cron works.

---

## 4. banditState on UserPreferences — DEFERRED

No `contextualBanditService.ts`, no `LinUCB`, no `bandit` references anywhere on `main`. The earlier summary referencing this file was describing an unmerged branch.

**Recommendation:** keep this on the backlog, but don't migrate until the service lands. Adding a `banditState Json?` column without a consumer creates dead schema drift and slows future migrations.

When the service does ship, the migration is trivial:

```sql
ALTER TABLE "UserPreferences" ADD COLUMN "banditState" JSONB;
```

and schema:

```prisma
banditState  Json?  /// LinUCB arm state — see lib/services/contextualBanditService.ts
```

---

## 5. Stale quick-reference corrections for CLAUDE.md

When compiling, suggest these edits to `CLAUDE.md`:

- **§ Current Priorities (2026-04-13):** 
  - Bullet 4: drop `PushSubscription + NotificationLog` → just `NotificationLog (Sprint 18)`
  - Bullet 5: remove web-push production-dependency bullet entirely
- **§ Recently Completed (2026-04-13 Integration Session):** Flag for review — several items (contextual bandit, ContentGap wiring, clustering dashboard, error-patterns endpoint) claim completion but the named files don't exist on `main`. Reconcile against `git log --oneline --since='2026-04-10'` before trusting this section.
- **§ Key Files Quick Reference:** `components/session/QuizView.tsx` header says 2274 lines AND 2045 lines in two different rows — unify.

---

## 6. Session checklist (for Aaron to run)

```bash
# Schema edits (one editor session — apply all §1 + §2 additions to schema.prisma)

# Validate schema
npm run db:validate

# Typecheck
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit

# If schema validates and types pass, register migrations
npx prisma migrate resolve --applied 20260418120000_add_content_gap
npx prisma migrate resolve --applied 20260418120100_add_notification_log
# OR, to actually execute the SQL:
npm run db:migrate:deploy

# Regenerate Prisma client so back-relations are picked up
npx prisma generate

# Smoke test (if vitest not stuck)
npm test -- --run prisma
```

---

## 7. What this session DID NOT touch

To keep parallel sessions conflict-free, this session avoided:

- `prisma/schema.prisma` (only new models documented here; Aaron to apply)
- `package.json` (no web-push install needed per §3)
- `functions/api/cron/push-reminders.ts` (code changes listed in §2 as guidance, not applied)
- `CLAUDE.md` (corrections listed in §5, not applied)
- Any file on a parallel branch — `wip/quizview-refactor-parked` etc.

Files created by THIS session:
- `prisma/migrations/20260418120000_add_content_gap/migration.sql`
- `prisma/migrations/20260418120100_add_notification_log/migration.sql`
- `prisma/audit/PENDING_ADDITIONS_2026-04-18.md` (this file)
