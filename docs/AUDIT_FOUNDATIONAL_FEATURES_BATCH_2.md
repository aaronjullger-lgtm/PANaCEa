# Audit: Foundational Features – Batch 2

**Date:** February 2026  
**Scope:** Sync/webhooks, SRS/FSRS, analytics, drill modes, admin/access.

---

## 1. Sync / Clerk webhook

**Status:** ✅ Functional

- **Sync API:** `GET /api/sync` and `POST /api/sync` in `functions/api/sync.ts`. Authenticated. GET returns cloud state (performance records, SRS items, saved questions) for the user; POST accepts `performanceRecords`, `srsItems`, `savedQuestions`, and optional `localDeletions` (deletion timestamp map). Merge behavior is timestamp-based 3-way conflict resolution (newest wins while respecting local deletions). Uses Prisma, retry logic for transient failures, and `safePrismaDisconnect`. Client: `useUserStats` and sync manager call `/api/sync`.
- **Clerk webhook:** `POST /api/webhooks/clerk` in `functions/api/webhooks/clerk.ts`. Verifies Svix signature with `CLERK_WEBHOOK_SECRET`; handles `user.created`, `user.updated`, `user.deleted`. Upserts `User` by `clerkId` (email, firstName, lastName). No auth middleware (webhook secret only). Requires `CLERK_WEBHOOK_SECRET` and `DATABASE_URL`.
- **Gap:** None. Ensure webhook URL is registered in Clerk dashboard.

---

## 2. SRS / FSRS (next, submit, due)

**Status:** ✅ Functional (one improvement applied)

- **GET /api/srs/next:** Returns next due SRS item (UserTopicProgress “Second Chance” or SRSItem). Authenticated. **Change:** Now uses `source: 'query'` and flat schema `SRSNextQuerySchema` so `mode` comes from query params correctly.
- **POST /api/srs/submit:** Accepts `questionId`, `rating` (1–4), `isCorrect`, optional `topicProgressId`, `srsItemId`, `telemetry`, `attemptId`. Runs FSRS scheduling, optional Ghost Grader (`analyzeBehaviorGemini`), updates UserTopicProgress/SRSItem. Used by `SrsFlashcardView` and session flow.
- **GET /api/srs/due:** Returns list of due SRS items (limit 100). Authenticated. Used by `useSRSItems` and dashboard.
- **Gap:** None. FSRS lib in `lib/fsrs`; Prisma models `SRSItem`, `UserTopicProgress`.

---

## 3. Analytics (session, user)

**Status:** ✅ Functional

- **POST /api/analytics/session:** Schema from `sessionAnalyticsSchema` (zodSchemas). Creates `StudySession` with totalQuestions, correctAnswers, accuracy, totalTimeMs, streaks, momentum, errorClusters, etc. Client: `sessionAnalyticsSyncService` sends session data after study.
- **GET /api/user/analytics:** Query param `range` optional. Returns `UserAnalytics`: overall (totalQuestions, accuracy, streaks, questionsToday/Week), systemPerformance, conditionMastery, weakAreas, recentActivity, srsStats. Used by dashboard and analytics views.
- **Gap:** None. Cron `aggregate-analytics` can backfill aggregates if used.

---

## 4. Drill modes (photo, DDx, condition)

**Status:** ✅ Functional

- **Photo / media:** `GET /api/drills/media?modality=ecg|derm|radiology&count=` (publicEndpoint). Uses `getMediaDrillCases`. Legacy `GET /api/drill/photo-batch` still works (same backend). Used by `use-photo-drill`, PhotoDrillSession, E2E.
- **DDx:** `GET /api/ddx/compare?ids=`, `GET /api/ddx/comparison?correctId=&selectedId=`, `GET /api/ddx/generate?topic=`, confusion-pairs, related, workup, smart-suggest. Public or authenticated as per route. Used by DdxTrainer, confusionService, DDxCompareDrill.
- **Condition drill:** `POST /api/questions/condition-drill` (system, subcategory, difficulty, count). Returns random questions for condition drill. Used by `use-condition-drill`.
- **Other drills:** `GET /api/drills/code-blue`, `antibiotics`, `fluids`, `lab-cases`, `pharm`, `related-content`, `smart-review`; `POST /api/drills/submit-review`; contrastive (sets, start, generate, submit). All wired in hooks and modes.
- **Gap:** None. photo-batch uses `context: any` (minor).

---

## 5. Admin / access (check, staging, media)

**Status:** ✅ Functional

- **GET /api/admin/check-access:** Authenticated. Returns `hasAccess`, `role` (admin/superadmin). Checks `ADMIN_USER_IDS` and `SUPERADMIN_USER_IDS` (env), then DB role. Used by AdminDashboard, requireAdmin pattern.
- **Staging:** `functions/api/admin/staging/` – list, approve, reject, update, run-critic. Admin-only (withAdminRole). Staging questions workflow.
- **Media:** `POST /api/admin/media/upload` (multipart, category, conditionId, etc.), `GET` list; `approve`, `pending`, `[id]`, `stats`. Uses Supabase storage, Prisma MediaAsset. Admin-only.
- **Gap:** None. Set `ADMIN_USER_IDS` or `SUPERADMIN_USER_IDS` for admin access.

---

## Summary Batch 2

| # | Feature           | Status | Notes                          |
|---|-------------------|--------|---------------------------------|
| 1 | Sync / webhook    | ✅     | GET/POST sync, Clerk webhook   |
| 2 | SRS next/submit/due | ✅  | source: 'query' for next       |
| 3 | Analytics         | ✅     | Session POST, user analytics GET |
| 4 | Drill modes       | ✅     | Media, DDx, condition, others  |
| 5 | Admin             | ✅     | check-access, staging, media   |
