# Question System Improvements

## Overview

This document outlines the improvements made to the question generation, storage, and tracking system to ensure high-quality, properly-linked questions with comprehensive analytics.

## Problems Addressed

### 1. Fragmented Question Tables
**Before:** Questions scattered across 5+ tables with no unified tracking
**After:** Clear hierarchy with proper FK relationships

### 2. Optional Condition Linkage
**Before:** `conditionId` was nullable - questions could exist without medical context
**After:** All questions MUST be linked to a condition via `medicalContentId`

### 3. No User Tracking
**Before:** No way to know if a user had seen a specific question
**After:** `UserQuestionSeen` junction table tracks every view

### 4. Weak Statistics
**Before:** Basic `timesSeen/timesCorrect` counters easily out of sync
**After:** Real-time aggregation from `QuestionAttempt` table

## Database Schema Changes

### New Table: `UserQuestionSeen`
```prisma
model UserQuestionSeen {
  id              String   @id @default(uuid())
  userId          String
  questionId      String   // Can be Question, PreGeneratedQuestion, etc.
  questionType    String   // 'question' | 'pre_generated' | 'seed'
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @default(now())
  timesShown      Int      @default(1)
  
  // Performance tracking
  timesCorrect    Int      @default(0)
  timesIncorrect  Int      @default(0)
  avgTimeMs       Int?
  
  User User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, questionId, questionType])
  @@index([userId, questionType])
  @@index([questionId])
}
```

### Enhanced `QuestionAttempt`
- Added FK to Question table
- Added session tracking
- Added timing data

### Question Quality Scoring
All question types now have:
- `qualityScore` (Float) - AI-assessed quality 0-100
- `conditionAccuracy` (Float) - How well question tests the linked condition
- `validatedAt` (DateTime) - When human validated
- `validatedBy` (String) - Who validated

## API Changes

### GET /api/questions/session
Now excludes questions the user has already seen (unless in review mode).

```typescript
// New behavior
const seenQuestionIds = await getSeenQuestionIds(userId);
const questions = await getPooledQuestions({
  exclude: seenQuestionIds,
  limit: 20,
});
```

### POST /api/questions/attempt
Now automatically updates:
1. `UserQuestionSeen` table
2. `Question.timesSeen` counter
3. User's accuracy for that condition
4. Session analytics

## Generation Pipeline Improvements

### 1. Strict Validation
```typescript
const generated = await generateQuestion(condition);

// Must pass validation before storage
const validation = await validateGeneratedQuestion(generated, condition);
if (validation.score < 0.7) {
  throw new Error('Question quality too low');
}
```

### 2. Condition Accuracy Check
```typescript
// Verify the question tests the right condition
const accuracyCheck = await checkConditionAccuracy(
  generated.question,
  generated.correctAnswer,
  condition.id
);

if (accuracyCheck.score < 0.8) {
  // Question doesn't properly test this condition
  await flagForReview(generated, 'low_condition_accuracy');
}
```

### 3. Duplicate Detection
```typescript
// Semantic similarity check against existing questions
const duplicates = await findDuplicateQuestions(generated.question);
if (duplicates.length > 0 && duplicates[0].similarity > 0.9) {
  throw new Error('Duplicate question detected');
}
```

## Implementation Status

### ✅ Phase 1: Consolidated Tracking (COMPLETED)

**Date:** January 10, 2026

1. **SessionService Migration**
   - Now reads from `UserQuestionSeen` instead of `UserQuestionHistory`
   - Records questions as seen with full metrics via `recordQuestionSeen()`
   - Maps source types to questionType enum

2. **no-repeat.ts Complete Rewrite**
   - `recordQuestionSeen()` - Records with wasCorrect, timeMs
   - `updateQuestionPerformance()` - Updates metrics after answer
   - `getUserSeenQuestions()` - Get seen question IDs
   - `getUserSeenQuestionsDetailed()` - Get full metrics
   - `fetchUnseenQuestions()` - Fetch unseen from pool
   - `getUserQuestionStats()` - Aggregate performance stats

3. **attempt.ts Enhanced**
   - Now upserts to `UserQuestionSeen` on every attempt
   - Calculates rolling average time
   - Tracks correct/incorrect counts

### ✅ Phase 2: Timing Capture (COMPLETED)

**Date:** January 10, 2026

1. **useConditionDrill Hook Enhanced**
   - Added `questionStartTimeRef` to track when question is displayed
   - Timer resets on `startSession`, `nextQuestion`, `reset`
   - `timeSpentMs` calculated on answer submit and passed to endpoint

2. **Data Flow**
   - Frontend captures timing → API receives `timeSpentMs`
   - `UserQuestionSeen.avgTimeMs` updated with rolling average

### ✅ Phase 3: Quality Scoring (COMPLETED)

**Date:** January 10, 2026

1. **Schema Enhanced** (`PreGeneratedQuestion` model)
   - `qualityScore` (0-100): AI-assessed quality
   - `conditionAccuracy` (0-1): How well it tests the condition
   - `contentRelevance` (0-1): PANCE relevance
   - `distractorQuality` (0-1): Wrong answer quality
   - `validationStatus`: pending | approved | rejected | needs_revision
   - `semanticHash`: For duplicate detection
   - `similarQuestionIds`: Array of related questions
   - Usage stats: `timesServed`, `timesCorrect`, `timesIncorrect`, `avgTimeMs`, `flagCount`, `flagRate`

2. **Quality Service** (`services/questionQualityService.ts`)
   - `generateSemanticHash()` - SHA-256 hash of normalized question content
   - `calculateTextSimilarity()` - Jaccard index similarity scoring
   - `assessDistractorQuality()` - Evaluates wrong answer options
   - `quickQualityCheck()` - Rule-based quality assessment
   - `validateQuestionQuality()` - Main validation function
   - `determineValidationStatus()` - Auto-approve/reject logic
   - `buildQualityAssessmentPrompt()` - AI prompt for enhanced scoring

### ✅ Phase 4: Analytics Dashboard (COMPLETED)

**Date:** January 10, 2026

1. **API Endpoint** (`GET /api/analytics/question-quality`)
   - Overview stats: total questions, avg quality score, flag rate, accuracy
   - Validation status breakdown by status type
   - Quality distribution (excellent/good/fair/poor)
   - System coverage with per-system quality and flag rates
   - Top 10 flagged questions
   - Recently validated questions list

2. **Dashboard Component** (`components/admin/QuestionQualityDashboard.tsx`)
   - Overview stat cards with color-coded quality indicators
   - System and validation status filters
   - Animated validation status progress bars
   - Quality distribution horizontal bar chart
   - System coverage table with sortable columns
   - Top flagged questions alert list
   - Skeleton loading states for async data

## Migration Path (Legacy)

1. Add new columns (nullable first)
2. Backfill existing data
3. Make columns required
4. Update API endpoints
5. Deploy frontend changes

## Monitoring

### Key Metrics
- Questions per condition (should be balanced)
- Accuracy by condition (identifies problem questions)
- Time per question by difficulty
- Question flag rate (quality indicator)

### Alerts
- Condition with < 5 questions
- Question with > 30% flag rate
- System with < 20 questions
