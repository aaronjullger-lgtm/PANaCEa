# Rolling 360 Statistical Engine

> A Dual-Layer Statistical Engine for PANCE Blueprint-Compliant Study Sessions

## Overview

The Rolling 360 system provides **two distinct statistical layers** to optimize both user-facing metrics and spaced repetition scheduling:

| Layer                        | Purpose                          | Data Window                     | Updates                      |
| ---------------------------- | -------------------------------- | ------------------------------- | ---------------------------- |
| **Form Layer** (User-Facing) | Dashboard scores, exam readiness | Last 360 Main Session questions | On every Main Session answer |
| **Growth Layer** (Backend)   | FSRS scheduling, card due dates  | Lifetime history                | On every answer (any mode)   |

---

## Why 360 Questions?

**360 = One Full PANCE Exam**

- The actual PANCE exam has **300 scored questions** + ~60 pilot questions
- By basing user stats on their last 360 Main Session answers, we create a **rolling mock exam score**
- This metric updates with every single question, giving users an always-current "exam simulation"

**Key Insight:** A user who answers 10 questions today improves their score by 10/360 ≈ 2.8% of their total sample.

---

## Database Schema

### Core Tables

```sql
-- Answer log with session mode tagging
CREATE TABLE QuestionAttempt (
  id UUID PRIMARY KEY,
  userId TEXT NOT NULL,
  questionId TEXT NOT NULL,
  isCorrect BOOLEAN NOT NULL,
  answeredAt TIMESTAMP NOT NULL,
  isMainSession BOOLEAN DEFAULT false,  -- Critical flag!
  sessionMode TEXT,                      -- 'mainSession', 'review', 'drill', etc.
  timeToAnswer INTEGER,
  system TEXT,                           -- Organ system for distribution tracking
  ...
);

-- Pre-computed rolling stats (O(1) dashboard reads)
CREATE TABLE UserRolling360Stats (
  userId TEXT PRIMARY KEY,
  totalInWindow INTEGER NOT NULL DEFAULT 0,
  correctInWindow INTEGER NOT NULL DEFAULT 0,
  systemStatsJson JSONB NOT NULL DEFAULT '{}',
  predictedScore INTEGER,
  passLikelihood DECIMAL(5,2),
  blueprintAdherence DECIMAL(5,4),
  lastCalculatedAt TIMESTAMP,
  windowStartTime TIMESTAMP,
  windowEndTime TIMESTAMP,
  ...
);
```

### Key Indexes

```sql
-- Fast Rolling 360 window queries
CREATE INDEX idx_attempts_user_main_time
ON QuestionAttempt(userId, isMainSession, answeredAt DESC)
WHERE isMainSession = true;

-- System distribution queries
CREATE INDEX idx_attempts_user_system_time
ON QuestionAttempt(userId, system, answeredAt DESC)
WHERE isMainSession = true;
```

---

## The Priority Waterfall Algorithm

When generating a Main Session, questions are selected using a **3-tier priority system**:

### Priority A: The Fixer (Blueprint Deficit Correction)

**Goal:** Correct system distribution imbalances

1. Compare user's Rolling 360 distribution against PANCE Blueprint
2. Identify systems where `actualPercent < targetPercent - 2%` (threshold)
3. Select **overdue FSRS cards from deficit systems** first

```typescript
// Example deficit detection
const cardioTarget = 13%;  // Blueprint says 13% Cardiovascular
const cardioActual = 5%;   // User has only 5% in their Rolling 360
const deficit = 8%;        // Severely under-represented!

// Priority A fills this deficit with Cardio questions first
```

### Priority B: The Maintainer (FSRS Due Cards)

**Goal:** Maintain memory through spaced repetition

1. Get all cards due for review (dueDate < now)
2. Sort by most overdue first (urgency)
3. Select cards respecting **interleaving constraint**
4. Enforce max 2 consecutive same-system questions

### Priority C: The Explorer (New Content)

**Goal:** Introduce new material for data-sparse systems

1. Identify systems with minimal data (< 10 questions)
2. Select never-seen questions from these systems
3. Adds diversity and prevents stale question pool

---

## Interleaving Enforcement

The science of learning shows **interleaved practice** improves discrimination and long-term retention.

**Rule:** No more than 2 consecutive questions from the same organ system.

```typescript
// shuffleWithInterleaving() implementation
const MAX_CONSECUTIVE = 2;

function enforceInterleaving(questions: Question[]): Question[] {
  const result: Question[] = [];
  const available = [...questions];
  let lastSystem: string | null = null;
  let consecutiveCount = 0;

  while (available.length > 0) {
    // Find next valid question
    const validIndex = available.findIndex((q) => {
      if (q.system !== lastSystem) return true;
      return consecutiveCount < MAX_CONSECUTIVE;
    });

    if (validIndex === -1) break;

    const question = available.splice(validIndex, 1)[0];

    if (question.system === lastSystem) {
      consecutiveCount++;
    } else {
      lastSystem = question.system;
      consecutiveCount = 1;
    }

    result.push(question);
  }

  return result;
}
```

---

## FSRS vs. Rolling 360: Resolving the Conflict

### The Problem

FSRS wants to show overdue cards to strengthen memory, but this could:

- Bias toward difficult topics (more reviews needed)
- Break PANCE Blueprint distribution
- Create imbalanced "exam simulation" scores

### The Solution

**Blueprint-Constrained FSRS Selection:**

1. Calculate system deficits from Rolling 360 stats
2. For Priority A: Only select FSRS cards from deficit systems
3. For Priority B: Select any due cards but enforce interleaving
4. Never let any single system exceed 25% of a session

```typescript
// Pseudocode for balanced selection
async selectQuestions(userId, sessionSize = 20) {
  const stats = await getRolling360Stats(userId);
  const deficits = calculateDeficits(stats);

  // Priority A: Fix deficits with FSRS cards from those systems
  const deficitCards = await getOverdueFSRSCards({
    userId,
    systems: deficits.map(d => d.system),
    limit: deficits.reduce((sum, d) => sum + d.deficitQuestions, 0)
  });

  // Priority B: Fill with any due FSRS cards
  const remainingSlots = sessionSize - deficitCards.length;
  const dueCards = await getOverdueFSRSCards({
    userId,
    excludeQuestions: deficitCards.map(c => c.questionId),
    limit: remainingSlots
  });

  // Priority C: New questions for data-sparse systems
  const newCards = await getNewQuestions({
    userId,
    excludeQuestions: [...deficitCards, ...dueCards].map(c => c.questionId),
    prioritizeSparse: true,
    limit: remainingSlots - dueCards.length
  });

  // Combine and interleave
  return shuffleWithInterleaving([...deficitCards, ...dueCards, ...newCards]);
}
```

---

## Score Confidence Levels

Not all Rolling 360 scores are equally reliable. We communicate confidence:

| Level         | Questions in Window | Display                    |
| ------------- | ------------------- | -------------------------- |
| `collecting`  | 0-49                | "Building your profile..." |
| `provisional` | 50-179              | "Score is provisional"     |
| `confident`   | 180-360             | "Confident prediction"     |

```typescript
function getScoreConfidence(totalInWindow: number): string {
  if (totalInWindow < 50) return 'collecting';
  if (totalInWindow < 180) return 'provisional';
  return 'confident';
}
```

---

## API Endpoints

### GET /api/user/rolling-360-stats

Returns pre-computed Rolling 360 statistics.

**Response:**

```json
{
  "scoreConfidence": "provisional",
  "totalInWindow": 156,
  "correctInWindow": 109,
  "accuracyPercent": 69.9,
  "predictedScore": 615,
  "passLikelihood": 91.2,
  "blueprintAdherence": 0.87,
  "systemStats": {
    "Cardiovascular": { "total": 20, "correct": 14, "accuracy": 70 },
    "Pulmonary": { "total": 15, "correct": 10, "accuracy": 66.7 },
    ...
  },
  "weakestSystems": ["Pulmonary", "Dermatology"],
  "strongestSystems": ["Neurological", "Gastrointestinal"],
  "questionsNeeded": 24,
  "message": "Score is provisional (156/360). Answer 24 more questions for confident prediction."
}
```

### POST /api/study/session/generate

Generates a new study session using the Priority Waterfall.

**Request:**

```json
{
  "mode": "mainSession",
  "size": 20
}
```

**Response:**

```json
{
  "sessionId": "uuid",
  "mode": "mainSession",
  "questionIds": ["q1", "q2", ...],
  "priorityBreakdown": { "A": 3, "B": 12, "C": 5 },
  "deficitsAddressed": [
    { "system": "Cardiovascular", "deficitPercent": 8.0 }
  ],
  "interleavingEnforced": true,
  "message": "Session includes extra Cardiovascular questions to balance your PANCE blueprint distribution."
}
```

---

## Data Visualization Plan

### User-Facing Dashboard

1. **Exam Readiness Gauge** (0-100%)
   - Based on Rolling 360 accuracy + blueprint adherence
   - Updates after every Main Session question

2. **Predicted Score Badge**
   - Shows estimated PANCE score (400-800 range)
   - Gray when < 50 questions (collecting)
   - Yellow when 50-179 (provisional)
   - Green when ≥ 180 (confident)

3. **System Distribution Radar Chart**
   - Overlay: Target (PANCE Blueprint) vs Actual (Rolling 360)
   - Highlights deficit systems in red

4. **Trend Sparkline**
   - Rolling 7-day accuracy trend
   - Shows momentum (improving/declining)

### Lifetime Progress (Secondary View)

1. **Total Questions Answered** (all modes)
2. **Overall Accuracy** (lifetime)
3. **FSRS Metrics**:
   - Cards mastered
   - Average retention
   - Total review sessions
4. **Study Streak**

---

## Migration Notes

To apply this system:

```bash
# 1. Apply schema migration
npx prisma migrate dev --name add_rolling_360

# 2. Regenerate Prisma client
npx prisma generate

# 3. Backfill isMainSession flag (if needed)
npx tsx scripts/backfill-main-session-flag.ts

# 4. Verify with test script
npx tsx scripts/test-selector.ts
```

---

## Files Reference

| File                                                          | Purpose                           |
| ------------------------------------------------------------- | --------------------------------- |
| `lib/services/rolling360Service.ts`                           | Core Rolling 360 calculation      |
| `lib/services/mainSessionQuestionSelector.ts`                 | Priority Waterfall algorithm      |
| `functions/api/user/rolling-360-stats.ts`                     | Dashboard stats endpoint          |
| `functions/api/study/session/generate.ts`                     | Session generation endpoint       |
| `prisma/migrations/20260114_add_rolling_360/`                 | Schema migration                  |
| `scripts/test-selector.ts`                                    | Verification test                 |
| `hooks/useRolling360Stats.ts`                                 | React SWR hook for dashboard      |
| `hooks/useSessionGenerator.ts`                                | Session generation hook           |
| `components/dashboard/Rolling360/ExamReadinessCard.tsx`       | Main score card with Start button |
| `components/dashboard/Rolling360/SystemPerformanceWidget.tsx` | System weakness visualization     |
| `components/dashboard/Rolling360/index.ts`                    | Component exports                 |

---

## Summary

The Rolling 360 Statistical Engine provides:

✅ **User-facing metrics** based on exam-equivalent sample size  
✅ **Blueprint-compliant** question selection  
✅ **FSRS integration** for optimal memory retention  
✅ **Interleaved practice** for better discrimination  
✅ **Incremental updates** with O(1) dashboard reads  
✅ **Clear confidence communication** to users
