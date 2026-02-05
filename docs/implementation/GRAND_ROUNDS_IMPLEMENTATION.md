# Grand Rounds Daily Challenge - Implementation

## Overview

Grand Rounds is a daily competitive mode where users compete globally on a timed challenge with speed-weighted scoring. Users get **one attempt per day**, with challenges resetting at midnight UTC. **Targeted Daily Question** (Didactic) uses the same UI but one question from enabled systems and separate APIs (`/api/targeted-daily/*`).

## Question Source (Unified)

**Question table only.** Grand Rounds uses the **Question** table for both challenge creation and grading.

- **GET /api/grand-rounds/today**: If no challenge exists for today (UTC), creates one by selecting 5 questions from the Question table (deterministic shuffle by date seed). Returns question content from Question (vignette, question, options, system, difficulty, topic, tags). **correctAnswer is never sent to the client.**
- **POST /api/grand-rounds/submit**: Grades using Question rows (id, correctAnswer, options). Client sends `answers: Record<questionId, answerIndex>` with **numeric indices** (0–3 or 0–4).

## Grading Convention (correctAnswer vs index)

- **Question.correctAnswer** is stored as `String` (e.g. `"A"`, `"B"`, `"C"`, `"D"` or `"0"`, `"1"`, `"2"`, `"3"`).
- Client sends **answerIndex** (number 0–4).
- In submit, we normalize: if correctAnswer is a letter, map to 0-based index (`A`→0, `B`→1, …); if numeric string, parse to number. Then compare `userAnswerIndex === correctIndex`.

## Database Models

**GrandRoundsChallenge**

- `id`, `date` (UTC date, unique), `questionIds` (String[] – Question IDs), `createdAt`.
- One challenge per day; created on first GET /api/grand-rounds/today if missing.

**GrandRoundsAttempt**

- `id`, `userId`, `challengeId`, `score`, `correctCount`, `timeSpentMs`, `answers` (Json), `completedAt`, `createdAt`.
- Unique on `(userId, challengeId)` – one attempt per user per challenge.

**GrandRoundsHistory**

- `id`, `userId`, `date` (UTC date), `score`, `completionTimeMs`, `correctAnswers`, `createdAt`.
- Unique on `(userId, date)`. Populated on submit; used by leaderboard, rank, and completed APIs.
- **Migration:** `prisma/migrations/20260205000000_add_grand_rounds_history/migration.sql`. Run `npx prisma migrate dev` (or `prisma migrate deploy`) then `npx prisma generate`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/grand-rounds/today | Get or create today's challenge; returns active (questions) or completed (stats). Auth required. |
| POST | /api/grand-rounds/submit | Submit answers; returns score, correctCount, percentile, ranking, speedBonus. Auth required. |
| GET | /api/grand-rounds/leaderboard | Query: `date`, `limit`. Returns leaderboard for date (UTC). Auth required. |
| GET | /api/grand-rounds/rank | Query: `userId`, `date`. Returns user's rank for date. Auth required. |
| GET | /api/grand-rounds/completed | No query. Returns `{ completed: boolean }` for current user today. Auth required. |
| GET | /api/grand-rounds/review | Query: `challengeId`. Returns per-question correct/incorrect and rationale for current user's attempt. Auth required. |

All dates are **UTC** (e.g. `today.setUTCHours(0, 0, 0, 0)`).

## Daily Challenge Creation Strategy

- **Single source:** GET /api/grand-rounds/today creates today's challenge on first request (Question table only).
- **dailyTasks:** Grand Rounds task is a no-op (skipped); creation is handled by the API. See `scripts/automation/dailyTasks.ts`.
- **Generator:** `scripts/generators/grandRoundsChallenge-generator.ts` uses Question table for pre-generating challenges (optional).

## Scoring

- **Base:** 20 points per correct answer.
- **Speed bonus:** `max(0, 20 - floor(timeSpentMs / 60000))` (up to 20 points).
- **Ranking:** By score DESC, then timeSpentMs ASC (faster = better when tied).

## Frontend (GrandRoundsMode.tsx)

- **View states:** loading, completed, landing, active, summary, error.
- **Features:** 20-minute timer, auto-submit on timeout (refs for latest answers), leaderboard on completed/summary, optional "Review answers" (GET review API), accessibility (aria-live for timer/progress).
- **Completion in Command Center:** Derived from GET /api/grand-rounds/completed (server-authoritative), not localStorage.

## Security

- Correct answers never sent in today or review until after completion; grading is server-side only.
- One attempt per user per challenge (DB unique); completed state is server-authoritative.

## Related Files

- **Component:** `components/modes/GrandRoundsMode.tsx`
- **APIs:** `functions/api/grand-rounds/` (today, submit, leaderboard, rank, completed, review)
- **Schema:** `prisma/schema.prisma` (GrandRoundsChallenge, GrandRoundsAttempt, GrandRoundsHistory)
- **Grading util:** `lib/grandRoundsGrading.ts` (correctAnswerToIndex); **tests:** `tests/grandRoundsGrading.test.ts`
- **Daily tasks:** `scripts/automation/dailyTasks.ts` (Grand Rounds create is no-op)
