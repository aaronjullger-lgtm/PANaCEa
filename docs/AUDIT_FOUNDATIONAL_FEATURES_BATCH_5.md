# Audit: Foundational Features – Batch 5

**Date:** February 2026  
**Scope:** Exam, targeted-daily, intelligence/tutor, cron, feedback.

---

## 1. Exam (start, complete, generate)

**Status:** ✅ Functional

- **POST /api/exam/start:** Body `configId`, optional `resumeAttemptId`. Creates or resumes ExamAttempt; returns attempt and questions. Uses ExamService, Prisma ExamAttempt/ExamConfig.
- **POST /api/exam/complete:** Submit exam answers; compute score and persist. **GET /api/exam/generate:** Generate exam (if implemented). Frontend: exam flow, ExamHistoryList.
- **Gap:** None. Requires ExamConfig and question pool.

---

## 2. Targeted daily (today, submit)

**Status:** ✅ Functional

- **GET /api/targeted-daily/today?systems=CV,PULM,...:** Authenticated. One question per day per user (UTC); server-authoritative; never returns correct answers. Returns `status: 'active'` with question or `status: 'completed'` with stats.
- **POST /api/targeted-daily/submit:** Submit answer for today’s question. Used by DailyPrescription, targeted-daily widget.
- **Gap:** None. Cron or client triggers as designed.

---

## 3. Intelligence / tutor (tutor, profile, concept-gaps)

**Status:** ✅ Functional

- **POST /api/intelligence/tutor:** Body `message`, optional `history`, `cachedContent`. Uses Gemini; optional weak-spot profile from WeaknessPattern; returns reply and thoughtSignatures. Used by ReasoningTutorMode, TutorChatPage.
- **GET /api/intelligence/profile:** Learning profile. **GET /api/intelligence/concept-gaps:** Concept gaps. **POST /api/intelligence/analyze-session:** Analyze session. Frontend: learning profile dashboards, tutor chat.
- **Gap:** None. Requires GEMINI_API_KEY.

---

## 4. Cron (daily-prescription, replenish-pool, aggregate-analytics)

**Status:** ✅ Functional

- **POST /api/cron/daily-prescription:** Auth via `Authorization: Bearer ${CRON_SECRET}`. Gets active users (last 7 days), generates daily prescription (FSRS + weak areas). Called by Cloudflare Scheduled Handler (e.g. 6 AM UTC).
- **POST /api/cron/replenish-pool:** Replenish question pool. **POST /api/cron/aggregate-analytics:** Aggregate analytics. Each uses CRON_SECRET or equivalent.
- **Gap:** None. Set CRON_SECRET and configure scheduler in Cloudflare.

---

## 5. Feedback / sentry-tunnel

**Status:** ✅ Functional

- **POST /api/feedback/submit:** Body `questionId` (1–200), `flagType` (`incorrect_fact` \| `unclear_question` \| `typo` \| `outdated` \| `other`), `description` (1–2000), optional `questionText` (max 5000), `topic` (max 200), `system` (max 100). Unknown fields rejected (`.strict()`). Creates `QuestionFlag` (`201` + `feedbackId`). Used by flag-question flow, `FlagQuestionModal`. See `docs/api/API_OVERVIEW.md`.
- **Sentry tunnel:** `POST /api/sentry-tunnel` (if present) forwards client errors to Sentry. Used by frontend error reporting.
- **Gap:** None. Feedback stored in DB; Sentry DSN/keys in env for tunnel.

---

## Summary Batch 5

| # | Feature       | Status | Notes                          |
|---|---------------|--------|---------------------------------|
| 1 | Exam          | ✅     | start, complete, generate      |
| 2 | Targeted daily| ✅     | today, submit                   |
| 3 | Intelligence  | ✅     | tutor, profile, concept-gaps    |
| 4 | Cron          | ✅     | daily-prescription, replenish, aggregate |
| 5 | Feedback      | ✅     | submit, sentry-tunnel           |
