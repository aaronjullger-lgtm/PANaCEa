# Audit: Foundational Features — Batch 6

**Date:** February 2026  
**Scope:** Achievements, streaks (record/use-freeze), user preferences/goals/pearls, dashboard daily-triad/review-queue/stats, admin content-audit/platform-stats.

---

## 1. Achievements (unlock, list)

**Status:** ✅ Functional

- **POST /api/achievements/unlock** (`functions/api/achievements/unlock.ts`): Authenticated. Body: `achievementId` (UUID), optional `progress` (0–100). Upserts `UserAchievement` for `auth.userId`; returns `unlockedAt`, `progress`. Uses Prisma singleton and `safePrismaDisconnect` in `finally`.
- **GET /api/achievements/:userId** (`functions/api/achievements/[userId].ts`): Authenticated. Users may only fetch their own achievements (`auth.userId === requestedUserId`). Returns `achievements`, `totalUnlocked`.
- **Gap:** None. Achievement definitions (e.g. “25 total”) could come from config/DB for `totalAvailable` if desired.

---

## 2. Streaks (record, get, use-freeze)

**Status:** ✅ Functional (one bug fixed)

- **POST /api/streaks/record** (`functions/api/streaks/record.ts`): Authenticated. Body: `questionsAnswered`, `accuracyPercent`, optional `date`, `studyMinutes`. Upserts `DailyStreak`; computes current streak via `lib/streakCalc` (supports `streakGoalDays` and `StreakFreezeUse`). Awards coins via `calculateCoinsEarned`; awards one freeze per 7 consecutive goal days (writes `lastFreezeEarnedStreak` in `customSettings`). Returns `coinsEarned`, `freezeEarned`.
- **GET /api/streaks/:userId** (`functions/api/streaks/[userId].ts`): Authenticated; self-only. Returns `currentStreak`, `longestStreak`, `isActiveToday`, `flameLevel`, `lastActivity`, `streakFreezes`, `userCoins`, `streakGoalDays`. Uses `computeCurrentStreak` and `computeLongestStreak` with frozen dates.
- **POST /api/streaks/use-freeze** (`functions/api/streaks/use-freeze.ts`): Authenticated. Body: `date` (YYYY-MM-DD). Validates date ≤ today; ensures user has ≥1 `streakFreezes`; in a transaction: upserts `StreakFreezeUse` for that date and decrements `userPreferences.streakFreezes`. **Fix applied:** Replaced erroneous `internalUserId` with `auth.userId` in `userPreferences.findUnique` so freezes are checked for the correct user.
- **Gap:** None. See `docs/AUDIT_STREAK_FRAGILITY.md` for edge-case notes.

---

## 3. User preferences

**Status:** ✅ Functional

- **GET/POST/PATCH/DELETE /api/user/preferences** (`functions/api/user/preferences.ts`): Authenticated. GET returns or creates default preferences. POST full upsert; PATCH partial update with `customSettings` merge (null clears keys). DELETE removes row. Zod schemas cover study, timing, UI, learning, review, advanced, notifications, privacy, `streakGoalDays`, `customSettings`. Uses Prisma singleton and disconnect in `finally`.
- **Gap:** None. Frontend sync (e.g. `usePreferences`, `utils/preferencesSync`) should call these for cross-device consistency.

---

## 4. User goals

**Status:** ✅ Functional

- **GET /api/user/goals** (`functions/api/user/goals.ts`): Authenticated. Query: optional `status`, `goalType`, `limit`. Returns user’s goals (ownership enforced).
- **POST /api/user/goals**: Body: `title`, `goalType` (daily/weekly/exam_date/mastery), optional `targetValue`, `targetUnit`, `targetDate`, `targetSystem`, `targetStability`, `isRecurring`, etc. Creates goal with `status: 'active'`.
- **PATCH /api/user/goals** (path: goal id): Body: optional `currentValue`, `status`, `completedAt`, streaks, etc. Ownership checked; progress percentage and auto-complete (and recurring reset) applied.
- **DELETE /api/user/goals** (path: goal id): Ownership checked; deletes goal.
- **Gap:** PATCH/DELETE rely on path parsing (last segment as goal id). Consider explicit route `api/user/goals/[goalId].ts` for clarity if adding more sub-routes.

---

## 5. User pearls (daily, list, save, useful)

**Status:** ✅ Functional

- **GET /api/user/pearls/daily** (`functions/api/user/pearls/daily.ts`): Optional auth. Date-based deterministic selection; if authenticated, prefers pearls from user’s question history (`UserQuestionSeen` → `ClinicalPearl`); fallback global pearl. Returns `pearl`, `date`, `personalized`. Uses legacy `EventContext`/`authenticateRequest` and `prisma.$disconnect()` (consider migrating to `authenticatedEndpoint` + `safePrismaDisconnect` for consistency).
- **Other pearls APIs:** `functions/api/user/pearls.ts`, `pearls/[id]/save.ts`, `pearls/[id]/useful.ts`; condition pearls: `functions/api/conditions/pearls.ts`, `conditions/[conditionId]/pearls.ts`. Not fully audited here but present.
- **Gap:** Minor: daily pearl handler uses older request pattern; optional cleanup for consistency with other endpoints.

---

## 6. Dashboard daily-triad and review-queue

**Status:** ✅ Functional

- **GET /api/dashboard/daily-triad** (`functions/api/dashboard/daily-triad.ts`): Authenticated. Fetches one random high-yield fact from `MedicalContent` (published, with `gold_standard_dx` or `clinical_pearls`). Returns `conditionId`, `condition`, `system`, `subcategory`, `type` (gold_standard | clinical_pearl), `highlight`, `buzzwords`, `panceYield`, `source: 'database'`. Uses `extractPearl()` for varied pearl shapes.
- **POST /api/dashboard/daily-triad/review** (`functions/api/dashboard/daily-triad/review.ts`): Authenticated. No-op that logs “marked as reviewed”; can be extended to persist reviewed state.
- **GET /api/dashboard/review-queue** (`functions/api/dashboard/review-queue.ts`): Authenticated. Uses `resolveUserId`; returns SRS-scheduled concepts due today from `StudyRecommendation` (`type: 'review'`, `status: 'pending'`, `data.source === 'metacognition_srs'`, `scheduledFor` ≤ today). Returns `dueToday`, `count`; items include `topic`, `reason`, `priority`, `scheduledFor`, `passed`, `system`, `conditionId`.
- **Gap:** None. Daily triad is DB-only (no AI); review-queue depends on recommendation engine populating `StudyRecommendation`.

---

## 7. Dashboard stats (reuse from Batch 1)

**Status:** ✅ Functional

- **GET /api/dashboard/stats** (`functions/api/dashboard/stats.ts`): Authenticated. Uses `resolveUserId`; aggregates `currentStreak` (with freezes and `streakGoalDays`), `weakestSystem` from concept gaps + blueprint, `predictedPassChance` from OSCE/quiz, plus `streakFreezes`, `userCoins`, `streakGoalDays`. Documented in Batch 1; no change.

---

## 8. Admin content-audit

**Status:** ✅ Functional

- **GET /api/admin/content-audit** (`functions/api/admin/content-audit.ts`): Authenticated; admin-only (checks `User.role` for ADMIN/SUPERADMIN). Query: optional `system`, `limit`, `includeComplete`. Scans `MedicalContent`; required fields (overview, symptoms, treatment, diagnostics) and high-yield fields (gold_standard_dx, clinical_pearls, etc.) checked for filled or explicit N/A. Returns `totalConditions`, `fullyComplete`, `partiallyComplete`, `criticalMissing`, `byField` stats, `incompleteConditions` (with missing lists and completeness score), `topPriorityToFix` (priority: critical/high/medium/low).
- **Gap:** None. Useful for content ops and prioritization.

---

## 9. Admin platform-stats

**Status:** ✅ Functional

- **GET /api/admin/platform-stats** (`functions/api/admin/platform-stats.ts`): Authenticated; admin-only via `isAdmin(role)` from `_shared/rbac`. Query: optional `start`, `end`, `limit`. Reads `PlatformStatistics` for date range; returns aggregated platform-wide metrics (e.g. DAU, activity counts). Depends on `PlatformStatistics` being populated (e.g. cron/script).
- **Gap:** None. Ensure a job (e.g. `scripts/automation/jobs/platformStatistics.ts`) fills `PlatformStatistics` if this endpoint is used in production.

---

## Summary

| # | Feature | Status | Notes |
|---|--------|--------|-------|
| 1 | Achievements (unlock, list) | ✅ | Self-only GET; unlock upsert |
| 2 | Streaks (record, get, use-freeze) | ✅ | Bug fix: use-freeze used auth.userId |
| 3 | User preferences | ✅ | GET/POST/PATCH/DELETE, customSettings merge |
| 4 | User goals | ✅ | CRUD; path-based id for PATCH/DELETE |
| 5 | User pearls (daily, etc.) | ✅ | Daily optional auth; legacy handler style |
| 6 | Dashboard daily-triad, review-queue | ✅ | DB-only triad; review-queue from StudyRecommendation |
| 7 | Dashboard stats | ✅ | See Batch 1 |
| 8 | Admin content-audit | ✅ | Role check; completeness + priority |
| 9 | Admin platform-stats | ✅ | Role via rbac; date range |

**Fix applied this batch:** `functions/api/streaks/use-freeze.ts` — use `auth.userId` instead of `internalUserId` when loading user preferences for streak freeze count.
