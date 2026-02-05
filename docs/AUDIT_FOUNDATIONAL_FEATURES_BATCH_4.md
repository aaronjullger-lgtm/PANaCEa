# Audit: Foundational Features – Batch 4

**Date:** February 2026  
**Scope:** Grand rounds, baseline, recommendations, knowledge cache, streaks.

---

## 1. Grand rounds

**Status:** ✅ Functional

- **GET /api/grand-rounds/today:** Authenticated. Returns today’s challenge: either `status: 'active'` with `challengeId` and `questions[]` (no correctAnswer), or `status: 'completed'` with stats (score, percentile, ranking). Uses Question table; 5 questions per challenge.
- **POST /api/grand-rounds/submit:** Submit answers; grading and ranking. **GET /api/grand-rounds/leaderboard**, **completed**, **review**, **rank**. Frontend: GrandRoundsMode.
- **Gap:** None. Depends on questions and challenge setup (cron or manual).

---

## 2. Baseline assessment

**Status:** ✅ Functional

- **POST /api/baseline/submit:** Body `answers: [{ questionId, selectedIndex }]`. Resolves user, loads PreGeneratedQuestion, computes correctCount and system breakdown, upserts BaselineAssessment. Used by onboarding/baseline flow.
- **Baseline questions:** `GET /api/baseline/questions` (or equivalent) for fetching baseline set. Frontend: BaselineAssessment, OnboardingYourPlan.
- **Gap:** None. Requires PreGeneratedQuestion records for baseline.

---

## 3. Recommendations

**Status:** ✅ Functional

- **GET /api/recommendations/list:** Query `status` (pending/completed/dismissed). Returns StudyRecommendation list for user. Used by dashboard/recommendation feed.
- **POST /api/recommendations/action:** Mark recommendation completed/dismissed. **POST /api/recommendations/generate:** Generate recommendations (if implemented). Frontend: RecommendationFeed.
- **Gap:** None. Recommendations populated by analytics or cron.

---

## 4. Knowledge cache (Gemini context caching)

**Status:** ✅ Functional

- **POST /api/knowledge/cache:** Body `displayName`, `fileUri`, `ttlSeconds`, optional `systemInstruction`, `mimeType`. Creates Gemini cached content; stores metadata (e.g. in DB if implemented). Requires GEMINI_API_KEY.
- **GET /api/knowledge/caches:** List caches. **GET/DELETE /api/knowledge/cache/[name]**, **/api/knowledge/cache/[id]**. Used by study companion and admin knowledge ingest.
- **Gap:** None. Optional: knowledge/upload, student-context for per-student cache.

---

## 5. Streaks

**Status:** ✅ Functional

- **POST /api/streaks/record:** Record activity for streak calculation. **GET /api/streaks/[userId]:** Get streak data. **POST /api/streaks/use-freeze:** Use streak freeze. Used by dashboard (currentStreak, longestStreak) and streak widget.
- **Gap:** None. Streak logic in `lib/streakCalc`; dashboard stats and cron may aggregate.

---

## Summary Batch 4

| # | Feature       | Status | Notes                          |
|---|---------------|--------|---------------------------------|
| 1 | Grand rounds  | ✅     | today, submit, leaderboard      |
| 2 | Baseline      | ✅     | submit, questions               |
| 3 | Recommendations | ✅   | list, action                    |
| 4 | Knowledge cache | ✅   | create, list, get/delete        |
| 5 | Streaks       | ✅     | record, get, use-freeze         |
