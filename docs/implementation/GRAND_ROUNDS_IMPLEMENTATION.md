# Grand Rounds Daily Challenge - Implementation Complete

## Overview

Grand Rounds is a daily competitive mode where users compete globally on a timed challenge with speed-weighted scoring. Users get **one attempt per day**, with challenges resetting at midnight UTC.

## Architecture

### Database Models

**GrandRoundsChallenge**

```prisma
model GrandRoundsChallenge {
  id          String   @id @default(uuid())
  date        DateTime @unique // UTC date, ensures one challenge per day
  questionIds String[] // Array of Question IDs
  createdAt   DateTime @default(now())

  attempts GrandRoundsAttempt[]
}
```

**GrandRoundsAttempt**

```prisma
model GrandRoundsAttempt {
  id          String   @id @default(uuid())
  userId      String   // Internal user ID (not clerkId)
  challengeId String
  score       Int
  timeSpentMs Int
  completedAt DateTime @default(now())

  challenge GrandRoundsChallenge @relation(...)
  user      User                 @relation(...)

  @@unique([userId, challengeId]) // One attempt per user per challenge
}
```

### API Endpoints

#### GET /api/grand-rounds/today

Fetches today's challenge. Returns different responses based on completion status.

**Response (not completed)**:

```json
{
  "status": "active",
  "challengeId": "uuid",
  "questions": [
    {
      "id": "uuid",
      "vignette": "...",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "system": "CV",
      "difficulty": "medium"
      // Note: correctAnswer is excluded for security
    }
  ]
}
```

**Response (already completed)**:

```json
{
  "status": "completed",
  "stats": {
    "score": 120,
    "correctCount": 4,
    "totalQuestions": 5,
    "timeSpentMs": 450000,
    "percentile": 85.5,
    "ranking": 12
  }
}
```

#### POST /api/grand-rounds/submit

Submits answers for a challenge.

**Request**:

```json
{
  "challengeId": "uuid",
  "answers": {
    "question-id-1": 0, // Selected answer index
    "question-id-2": 2,
    "question-id-3": 1
  },
  "timeSpentMs": 450000
}
```

**Response**:

```json
{
  "success": true,
  "score": 120,
  "correctCount": 4,
  "percentile": 85.5,
  "ranking": 12,
  "speedBonus": 20
}
```

**Validation**:

- Requires authentication via Clerk
- Validates challengeId exists
- Ensures user hasn't already submitted (@@unique constraint)
- Validates answers object format
- Validates timeSpentMs is a number

### Services

#### grandRoundsService.ts

**getOrCreateDailyChallenge()**

- Queries for today's challenge by UTC date
- If none exists, creates one with 5 random questions
- Returns GrandRoundsChallenge

**getUserAttemptForChallenge(userId, challengeId)**

- Checks if user has already completed this challenge
- Returns GrandRoundsAttempt or null

**calculatePercentile(challengeId, score)**

- Queries all attempts for the challenge
- Calculates percentile ranking (higher is better)
- Returns number (0-100)

**getRankingForChallenge(challengeId, userId)**

- Queries attempts ordered by score DESC, timeSpentMs ASC
- Finds user's position in leaderboard
- Returns rank number (1-indexed)

### Scoring System

**Base Points**: 20 points per correct answer

**Speed Bonus**: Up to 20 additional points based on completion time

- Formula: `max(0, 20 - Math.floor(timeSpentMs / 60000))`
- Complete under 1 minute: +20 points
- Complete under 10 minutes: +10 points
- Complete under 20 minutes: +0 points

**Example**:

- 5 questions, 4 correct in 8 minutes
- Base: 4 × 20 = 80 points
- Speed bonus: 20 - 8 = 12 points
- **Total: 92 points**

## Frontend Component

### GrandRoundsMode.tsx

**View States**:

- `loading`: Fetching challenge data
- `completed`: Already finished today (shows stats + countdown)
- `landing`: Intro screen before starting
- `active`: Quiz in progress
- `summary`: Just finished (shows results)
- `error`: Error state

**Key Features**:

1. **Global Timer**: 20-minute countdown, cannot be paused
2. **Auto-submit**: Automatically submits when time runs out
3. **Answer Tracking**: Saves answers in state, submits all at once
4. **Next Challenge Countdown**: Shows HH:MM:SS until midnight UTC
5. **Percentile Badge**: Special badge if scored in top 10%

**Flow**:

```
Mount → Fetch /api/grand-rounds/today
  ↓
If status=completed → Show stats + countdown
If status=active → Show landing page
  ↓
User clicks "Start Challenge"
  ↓
Active quiz (timer starts)
  ↓
User answers questions
  ↓
Last question → Submit to /api/grand-rounds/submit
  ↓
Show summary with score/rank/percentile
```

## Security Considerations

1. **No Correct Answers in Active Response**: Server excludes `correctAnswer` field when sending questions
2. **Server-Side Grading**: All answer validation happens on backend
3. **One Attempt Enforcement**: Database unique constraint on (userId, challengeId)
4. **Authentication Required**: All endpoints require Clerk auth middleware
5. **Input Validation**: Validates request body structure and types

## Testing Checklist

- [ ] Challenge creation at midnight UTC
- [ ] Duplicate challenge prevention (@@unique on date)
- [ ] Question fetching excludes correct answers
- [ ] Answer submission validates format
- [ ] Score calculation includes speed bonus
- [ ] Percentile calculation is accurate
- [ ] Ranking calculation handles ties (by time)
- [ ] One attempt enforcement works
- [ ] Timer auto-submits at 20 minutes
- [ ] Countdown to next challenge updates every second
- [ ] Top 10% badge shows correctly

## Performance Optimizations

1. **Index on GrandRoundsChallenge.date**: Fast lookup for today's challenge
2. **Index on GrandRoundsAttempt.challengeId**: Fast percentile/ranking queries
3. **Minimal Question Fields**: Only fetch needed fields (excludes correctAnswer)
4. **Client-Side Timer**: No server polling, reduces load

## Future Enhancements

- [ ] Historical leaderboards (past challenges)
- [ ] Weekly/monthly aggregate rankings
- [ ] Achievement badges (e.g., "5-day streak")
- [ ] Social features (challenge friends)
- [ ] Question difficulty balancing (ensure fair distribution)
- [ ] Analytics dashboard (average scores over time)

## Database Migration

Run to add Grand Rounds tables:

```bash
npx prisma migrate dev --name add_grand_rounds
npx prisma generate
```

## Related Files

- **Component**: `components/modes/GrandRoundsMode.tsx`
- **Service**: `lib/services/grandRoundsService.ts`
- **API**: `server.ts` lines 2721-2850
- **Schema**: `prisma/schema.prisma` (GrandRoundsChallenge, GrandRoundsAttempt models)
- **Types**: `src/types/index.ts` (Question interface)

## Known Limitations

1. **Score Approximation**: When loading completed stats, correctCount is approximated from score (doesn't account for speed bonus). Consider storing correctCount in GrandRoundsAttempt.
2. **No Partial Saves**: If user closes browser, progress is lost. Consider adding draft/resume functionality.
3. **No Question Preview**: Users can't see question content before starting timer.
4. **Fixed Question Count**: Always 5 questions. Consider making configurable.
