# 🔗 Unified Analytics Implementation Plan

**Date:** January 13, 2026  
**Status:** 📋 Ready for Implementation  
**Goal:** Connect all statistics, improve user tendency storage, implement intelligent scheduling

---

## Executive Summary

This document provides a **complete implementation plan** to:

1. Create the database schema for unified analytics
2. Connect disparate statistics systems
3. Implement intelligent review scheduling
4. Improve user tendency storage and access patterns

---

## Part 1: Database Schema Design

### 1.1 New Tables Required

```sql
-- ============================================================================
-- PART 1: USER BEHAVIORAL METRICS (Per-Question Level)
-- ============================================================================

CREATE TABLE "UserBehaviorMetrics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "questionAttemptId" UUID REFERENCES "QuestionAttempt"("id"),

  -- Core Timing (milliseconds)
  "timeToFirstInteraction" INTEGER,
  "readingTime" INTEGER,           -- Time before first option interaction
  "deliberationTime" INTEGER,      -- Time between interactions
  "totalResponseTime" INTEGER,

  -- Behavioral Signals
  "optionHoverSequence" JSONB,     -- e.g., [2, 0, 3, 1]
  "hoverDurations" JSONB,          -- e.g., {"0": 500, "1": 200}
  "answerChanges" INTEGER DEFAULT 0,
  "scrollEvents" INTEGER DEFAULT 0,
  "backspaceCount" INTEGER DEFAULT 0,

  -- Derived Metrics (computed at submission)
  "implicitConfidence" FLOAT,      -- 0-1, from JOL
  "latencyRatio" FLOAT,            -- actual / expected
  "cognitiveLoad" FLOAT,           -- estimated 0-1
  "fluencyScore" FLOAT,            -- from fluency-scoring.ts
  "hesitationCount" INTEGER DEFAULT 0,

  -- Context
  "questionIndexInSession" INTEGER,
  "sessionId" UUID,
  "timeOfDay" INTEGER,             -- 0-23
  "dayOfWeek" INTEGER,             -- 0-6
  "deviceType" TEXT,               -- 'mobile' | 'tablet' | 'desktop'

  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX "idx_behavior_user" ON "UserBehaviorMetrics"("userId");
CREATE INDEX "idx_behavior_session" ON "UserBehaviorMetrics"("sessionId");
CREATE INDEX "idx_behavior_time" ON "UserBehaviorMetrics"("timeOfDay");


-- ============================================================================
-- PART 2: SESSION ANALYTICS (Aggregated per session)
-- ============================================================================

CREATE TABLE "SessionAnalytics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "sessionId" UUID NOT NULL REFERENCES "StudySession"("id"),

  -- Performance Curve
  "accuracyQ1" FLOAT,              -- First quarter accuracy
  "accuracyQ2" FLOAT,
  "accuracyQ3" FLOAT,
  "accuracyQ4" FLOAT,
  "accuracyTrend" TEXT,            -- 'improving' | 'stable' | 'declining'
  "fatiguePointIndex" INTEGER,     -- Question index where accuracy drops

  -- Timing Metrics
  "avgResponseTime" INTEGER,
  "responseTimeVariance" FLOAT,
  "responseTimeTrend" TEXT,        -- 'speeding_up' | 'stable' | 'slowing_down'
  "totalDurationMinutes" FLOAT,

  -- Metacognition (from JOL)
  "sessionBrierScore" FLOAT,       -- 0-1, lower is better
  "calibrationState" TEXT,         -- 'overconfident' | 'underconfident' | 'calibrated'
  "overconfidenceBias" FLOAT,      -- -1 to 1

  -- Flow State
  "flowStateMinutes" FLOAT,        -- Time in optimal challenge zone
  "interruptionCount" INTEGER DEFAULT 0,
  "wasCompleted" BOOLEAN DEFAULT TRUE,

  -- System Distribution
  "systemDistribution" JSONB,      -- e.g., {"CV": 5, "PULM": 3}
  "difficultyDistribution" JSONB,  -- e.g., {"easy": 3, "medium": 5, "hard": 2}

  "computedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX "idx_session_analytics_user" ON "SessionAnalytics"("userId");
CREATE INDEX "idx_session_analytics_date" ON "SessionAnalytics"("computedAt");


-- ============================================================================
-- PART 3: USER CIRCADIAN PROFILE (Aggregated over time)
-- ============================================================================

CREATE TABLE "UserCircadianProfile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT UNIQUE NOT NULL REFERENCES "User"("id"),

  -- Hourly Performance (0-23)
  "hourlyAccuracy" JSONB,          -- e.g., {"0": 0.65, "1": 0.62, ..., "23": 0.70}
  "hourlyAttempts" JSONB,          -- e.g., {"0": 5, "1": 3, ..., "23": 12}
  "hourlyAvgResponseTime" JSONB,

  -- Derived Insights
  "peakHours" JSONB,               -- e.g., [9, 10, 11, 14, 15]
  "avoidHours" JSONB,              -- e.g., [3, 4, 5]
  "chronotype" TEXT,               -- 'morning' | 'afternoon' | 'evening' | 'night'

  -- Weekly Patterns
  "dayOfWeekAccuracy" JSONB,       -- e.g., {"0": 0.72, ..., "6": 0.68}
  "studyDaysOfWeek" JSONB,         -- e.g., [1, 2, 3, 4, 5] (Mon-Fri)
  "avgDailyMinutes" FLOAT,
  "avgSessionsPerWeek" FLOAT,

  -- Optimal Session Parameters
  "optimalSessionLength" INTEGER,  -- Questions before fatigue
  "optimalNewCardsPerDay" INTEGER,

  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================================
-- PART 4: PERSONALIZED FSRS PARAMETERS
-- ============================================================================

CREATE TABLE "PersonalizedFSRSParams" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT UNIQUE NOT NULL REFERENCES "User"("id"),

  -- Optimized w[] array (19 parameters)
  "w" JSONB NOT NULL,              -- The 19 FSRS weights

  -- Optimization Metadata
  "sampleSize" INTEGER,            -- Reviews used for optimization
  "lastOptimizedAt" TIMESTAMP WITH TIME ZONE,
  "improvementOverDefault" FLOAT,  -- % Brier score reduction
  "optimizationIterations" INTEGER,

  -- Per-System Adjustments
  "systemModifiers" JSONB,         -- e.g., {"CV": {"stabilityMult": 1.1, "diffOffset": 0.2}}

  -- Validation
  "validationBrierScore" FLOAT,    -- Score on holdout set
  "parameterBounds" JSONB,         -- Constraints used

  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================================
-- PART 5: USER CONFUSION PATTERNS (Per-user, not global)
-- ============================================================================

CREATE TABLE "UserConfusionPattern" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES "User"("id"),

  -- Confusion Pair
  "conditionA" TEXT NOT NULL,
  "conditionB" TEXT NOT NULL,

  -- Statistics
  "occurrences" INTEGER DEFAULT 1,
  "lastOccurrence" TIMESTAMP WITH TIME ZONE,
  "firstOccurrence" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Resolution
  "wasResolved" BOOLEAN DEFAULT FALSE,
  "resolvedAt" TIMESTAMP WITH TIME ZONE,
  "interventionType" TEXT,         -- 'DDx_drill' | 'explanation' | 'natural'

  -- Context
  "triggerQuestionIds" JSONB,      -- Questions that triggered confusion

  UNIQUE("userId", "conditionA", "conditionB")
);

CREATE INDEX "idx_confusion_user" ON "UserConfusionPattern"("userId");
CREATE INDEX "idx_confusion_unresolved" ON "UserConfusionPattern"("userId") WHERE "wasResolved" = FALSE;


-- ============================================================================
-- PART 6: INTELLIGENT SCHEDULING QUEUE
-- ============================================================================

CREATE TABLE "ScheduledReview" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "conditionId" TEXT NOT NULL,

  -- Scheduling
  "dueAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "originalDueAt" TIMESTAMP WITH TIME ZONE,  -- Before adjustments
  "priority" INTEGER DEFAULT 50,              -- 0-100, higher = more urgent

  -- FSRS State (cached for quick access)
  "stability" FLOAT,
  "difficulty" FLOAT,
  "retrievability" FLOAT,          -- P(recall) at dueAt

  -- Adjustments Applied
  "confidenceAdjustment" FLOAT DEFAULT 0,    -- From JOL calibration
  "circadianAdjustment" FLOAT DEFAULT 0,     -- From circadian profile
  "interferencePenalty" FLOAT DEFAULT 0,     -- From confusion patterns

  -- Metadata
  "lastUpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "schedulingReason" TEXT,

  UNIQUE("userId", "conditionId")
);

CREATE INDEX "idx_scheduled_user_due" ON "ScheduledReview"("userId", "dueAt");
CREATE INDEX "idx_scheduled_priority" ON "ScheduledReview"("userId", "priority" DESC);
```

### 1.2 Schema Migration File

```sql
-- prisma/migrations/add_unified_analytics.sql

-- Run with: prisma migrate dev --name add_unified_analytics

-- Part 1: UserBehaviorMetrics
-- Part 2: SessionAnalytics
-- Part 3: UserCircadianProfile
-- Part 4: PersonalizedFSRSParams
-- Part 5: UserConfusionPattern
-- Part 6: ScheduledReview

-- (Include all SQL above)
```

---

## Part 2: Statistics Interweaving Architecture

### 2.1 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                                   │
│                     (Question Answer Submitted)                              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REAL-TIME COLLECTION                                  │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Implicit       │  JOL            │  Circadian      │  FSRS                 │
│  Metrics        │  Calibration    │  Position       │  Update               │
│  (latency,      │  (confidence,   │  (time of day,  │  (stability,          │
│  hesitation)    │  Brier score)   │  peak hours)    │  difficulty)          │
└────────┬────────┴────────┬────────┴────────┬────────┴──────────┬────────────┘
         │                 │                 │                   │
         v                 v                 v                   v
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STORAGE (Per Question)                                │
│                      UserBehaviorMetrics Table                               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                v (Session Complete)
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SESSION AGGREGATION JOB                                 │
│                     (Triggered on session end)                               │
│  • Compute fatigue curve                                                     │
│  • Calculate session Brier score                                             │
│  • Detect flow state periods                                                 │
│  • Store in SessionAnalytics                                                 │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                v (Daily Aggregation)
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DAILY AGGREGATION JOBS                                 │
├─────────────────────────┬───────────────────────────────────────────────────┤
│  Circadian Profile      │  Confusion Pattern                                │
│  Update                 │  Detection                                        │
│  • Update hourly stats  │  • Identify new confusions                        │
│  • Detect chronotype    │  • Check resolution                               │
│  • Find peak hours      │  • Update UserConfusionPattern                    │
└─────────────────────────┴───────────────────────────────────────────────────┘
                                │
                                v (Weekly Optimization)
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WEEKLY OPTIMIZATION JOB                                 │
│  • Optimize FSRS parameters (if 100+ reviews)                               │
│  • Update PersonalizedFSRSParams                                            │
│  • Recalculate all scheduled reviews                                        │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────────────────┐
│                     INTELLIGENT SCHEDULING                                   │
│  • Base: FSRS interval                                                       │
│  • Adjust: JOL confidence                                                    │
│  • Adjust: Circadian peak hours                                              │
│  • Penalize: Interference from confusions                                    │
│  • Store: ScheduledReview table                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Connection Points Between Systems

| From                      | To                                       | Connection Logic                         |
| ------------------------- | ---------------------------------------- | ---------------------------------------- |
| `lib/implicit-metrics.ts` | `UserBehaviorMetrics`                    | Store all implicit signals at submission |
| `lib/jol-calibration.ts`  | `UserBehaviorMetrics.implicitConfidence` | Derive confidence from behavior          |
| `lib/jol-calibration.ts`  | `SessionAnalytics.calibrationState`      | Aggregate JOL to session level           |
| `lib/circadian.ts`        | `UserCircadianProfile`                   | Daily aggregation updates profile        |
| `lib/fsrs.ts`             | `PersonalizedFSRSParams`                 | Weekly optimization uses review history  |
| `PersonalizedFSRSParams`  | `lib/fsrs.ts`                            | Use personalized params for scheduling   |
| `SessionAnalytics`        | `UserCircadianProfile`                   | Session accuracy feeds hourly stats      |
| `UserCircadianProfile`    | `ScheduledReview`                        | Peak hours adjust due dates              |
| `JOL calibration`         | `ScheduledReview`                        | Confidence adjusts intervals             |
| `UserConfusionPattern`    | `ScheduledReview`                        | Interference penalty for confused items  |

---

## Part 3: Implementation Files

### 3.1 Core Services to Create

```
lib/
├── analytics/
│   ├── behaviorMetricsCollector.ts   # Collect metrics during question
│   ├── sessionAggregator.ts          # Aggregate session on completion
│   ├── circadianAnalyzer.ts          # Daily circadian update
│   ├── confusionDetector.ts          # Detect and track confusions
│   └── index.ts                      # Re-exports
│
├── fsrs/
│   ├── fsrs.ts                       # (existing) Core FSRS algorithm
│   ├── fsrsOptimizer.ts              # L-BFGS parameter optimization
│   ├── fsrsScheduler.ts              # Intelligent scheduling with adjustments
│   └── index.ts                      # Re-exports
│
└── scheduling/
    ├── schedulingEngine.ts           # Main scheduling orchestrator
    ├── intervalAdjustments.ts        # Confidence/circadian/interference adjustments
    └── reviewQueueManager.ts         # Manage ScheduledReview table

scripts/automation/jobs/
├── sessionAnalytics.ts               # On session complete
├── circadianProfileUpdate.ts         # Daily
├── confusionPatternDetection.ts      # Daily
├── fsrsParameterOptimization.ts      # Weekly
└── scheduledReviewRefresh.ts         # After param optimization
```

### 3.2 API Endpoints to Create

```
functions/api/
├── analytics/
│   ├── behavior-metrics.ts           # POST: Store metrics
│   ├── session-analytics.ts          # GET: Session stats
│   └── circadian-profile.ts          # GET: User's circadian profile
│
├── scheduling/
│   ├── due-reviews.ts                # GET: Items due for review
│   ├── optimal-session.ts            # GET: Build optimal session
│   └── refresh-schedule.ts           # POST: Recalculate due dates
│
└── user/
    ├── fsrs-params.ts                # GET/POST: Personalized FSRS params
    ├── confusion-patterns.ts         # GET: User's confusion pairs
    └── learning-profile.ts           # GET: Comprehensive user profile
```

---

## Part 4: Key Algorithm Implementations

### 4.1 Intelligent Scheduling Algorithm

```typescript
// lib/scheduling/schedulingEngine.ts

interface SchedulingInput {
  userId: string;
  conditionId: string;
  fsrsCard: FSRSCard;

  // From JOL
  calibrationState: 'overconfident' | 'underconfident' | 'calibrated';
  lastImplicitConfidence: number;

  // From Circadian
  peakHours: number[];
  currentHour: number;

  // From Confusions
  hasActiveConfusion: boolean;
  confusionSeverity: number; // 0-1
}

interface SchedulingOutput {
  dueAt: Date;
  priority: number;
  adjustments: {
    confidence: number;
    circadian: number;
    interference: number;
  };
}

export function computeIntelligentSchedule(input: SchedulingInput): SchedulingOutput {
  // Step 1: Get base FSRS interval
  const baseInterval = computeFSRSInterval(input.fsrsCard);

  // Step 2: Confidence adjustment
  let confidenceAdj = 0;
  if (input.calibrationState === 'overconfident' && input.lastImplicitConfidence > 0.7) {
    // User thinks they know it but often wrong - schedule sooner
    confidenceAdj = -baseInterval * 0.15; // 15% shorter
  } else if (input.calibrationState === 'underconfident') {
    // User doubts but usually correct - can schedule later
    confidenceAdj = baseInterval * 0.1; // 10% longer
  }

  // Step 3: Circadian adjustment
  // Try to schedule during peak hours if possible
  let circadianAdj = 0;
  const baseDueTime = new Date(Date.now() + baseInterval * 86400000);
  const dueHour = baseDueTime.getHours();

  if (!input.peakHours.includes(dueHour)) {
    // Find nearest peak hour
    const nearestPeak = findNearestPeakHour(dueHour, input.peakHours);
    const hourDiff = nearestPeak - dueHour;
    if (Math.abs(hourDiff) < 4) {
      circadianAdj = hourDiff / 24; // Shift by hours (in days)
    }
  }

  // Step 4: Interference penalty for confused items
  let interferenceAdj = 0;
  if (input.hasActiveConfusion) {
    // Schedule confused items sooner to resolve interference
    interferenceAdj = -baseInterval * input.confusionSeverity * 0.2;
  }

  // Step 5: Compute final interval
  const finalInterval = Math.max(
    0.0035, // Minimum 5 minutes
    baseInterval + confidenceAdj + circadianAdj + interferenceAdj
  );

  // Step 6: Compute priority
  // Higher priority = more urgent
  let priority = 50; // Default
  if (input.hasActiveConfusion) priority += 20;
  if (input.calibrationState === 'overconfident') priority += 10;
  if (input.fsrsCard.stability < 1) priority += 15; // Unstable items

  const dueAt = new Date(Date.now() + finalInterval * 86400000);

  return {
    dueAt,
    priority: Math.min(100, priority),
    adjustments: {
      confidence: confidenceAdj,
      circadian: circadianAdj,
      interference: interferenceAdj,
    },
  };
}
```

### 4.2 FSRS Parameter Optimization

```typescript
// lib/fsrs/fsrsOptimizer.ts

interface OptimizationResult {
  w: number[];
  brierScore: number;
  sampleSize: number;
  improvement: number;
}

export async function optimizeFSRSParameters(
  userId: string,
  reviewHistory: ReviewSnapshot[]
): Promise<OptimizationResult> {
  // Minimum sample size
  if (reviewHistory.length < 100) {
    return {
      w: defaultParameters.w,
      brierScore: 0.25,
      sampleSize: reviewHistory.length,
      improvement: 0,
    };
  }

  // Split into train/validation (80/20)
  const shuffled = [...reviewHistory].sort(() => Math.random() - 0.5);
  const trainSize = Math.floor(shuffled.length * 0.8);
  const trainSet = shuffled.slice(0, trainSize);
  const validSet = shuffled.slice(trainSize);

  // Compute Brier score with default params
  const defaultBrier = computeBrierScore(defaultParameters.w, trainSet);

  // L-BFGS Optimization
  const optimized = lbfgsMinimize({
    initialParams: defaultParameters.w,
    objective: (w) => computeBrierScore(w, trainSet),
    gradient: (w) => computeGradient(w, trainSet),
    bounds: PARAMETER_BOUNDS,
    maxIterations: 500,
    tolerance: 1e-6,
  });

  // Validate on holdout set
  const validationBrier = computeBrierScore(optimized.params, validSet);

  return {
    w: optimized.params,
    brierScore: validationBrier,
    sampleSize: reviewHistory.length,
    improvement: (defaultBrier - validationBrier) / defaultBrier,
  };
}

function computeBrierScore(w: number[], reviews: ReviewSnapshot[]): number {
  let sum = 0;

  for (const review of reviews) {
    // Predict P(recall) based on FSRS with these parameters
    const predicted = predictRecall(w, review);
    const actual = review.rating >= 3 ? 1 : 0; // Pass = 1, Fail = 0

    sum += Math.pow(predicted - actual, 2);
  }

  return sum / reviews.length;
}
```

### 4.3 Session Analytics Aggregator

```typescript
// lib/analytics/sessionAggregator.ts

export interface SessionAggregation {
  accuracyByQuarter: [number, number, number, number];
  accuracyTrend: 'improving' | 'stable' | 'declining';
  fatiguePointIndex?: number;
  sessionBrierScore: number;
  calibrationState: string;
  flowStateMinutes: number;
}

export function aggregateSession(
  metrics: UserBehaviorMetrics[],
  attempts: QuestionAttempt[]
): SessionAggregation {
  const n = attempts.length;
  const quarterSize = Math.ceil(n / 4);

  // Accuracy by quarter
  const quarters = [
    attempts.slice(0, quarterSize),
    attempts.slice(quarterSize, quarterSize * 2),
    attempts.slice(quarterSize * 2, quarterSize * 3),
    attempts.slice(quarterSize * 3),
  ];

  const accuracyByQuarter = quarters.map((q) => q.filter((a) => a.isCorrect).length / q.length) as [
    number,
    number,
    number,
    number,
  ];

  // Detect trend
  const slope = linearRegression(accuracyByQuarter);
  const accuracyTrend = slope > 0.05 ? 'improving' : slope < -0.05 ? 'declining' : 'stable';

  // Detect fatigue point
  let fatiguePointIndex: number | undefined;
  for (let i = 0; i < n - 5; i++) {
    const before = attempts.slice(0, i + 1).filter((a) => a.isCorrect).length / (i + 1);
    const after = attempts.slice(i + 1).filter((a) => a.isCorrect).length / (n - i - 1);

    if (before - after > 0.15) {
      fatiguePointIndex = i;
      break;
    }
  }

  // Compute session Brier score from JOL observations
  const brierSum = metrics.reduce((sum, m) => {
    const correct = attempts.find((a) => a.id === m.questionAttemptId)?.isCorrect ? 1 : 0;
    return sum + Math.pow((m.implicitConfidence ?? 0.5) - correct, 2);
  }, 0);
  const sessionBrierScore = brierSum / metrics.length;

  // Determine calibration state
  const avgConfidence =
    metrics.reduce((s, m) => s + (m.implicitConfidence ?? 0.5), 0) / metrics.length;
  const avgAccuracy = attempts.filter((a) => a.isCorrect).length / n;
  const bias = avgConfidence - avgAccuracy;

  const calibrationState =
    bias > 0.1 ? 'overconfident' : bias < -0.1 ? 'underconfident' : 'calibrated';

  // Flow state: periods of high accuracy + optimal response time
  const flowStateMinutes = calculateFlowState(metrics, attempts);

  return {
    accuracyByQuarter,
    accuracyTrend,
    fatiguePointIndex,
    sessionBrierScore,
    calibrationState,
    flowStateMinutes,
  };
}
```

---

## Part 5: Implementation Schedule

### Sprint 1 (Week 1): Database & Collection

- [ ] Create migration with all new tables
- [ ] Implement `behaviorMetricsCollector.ts`
- [ ] Create `POST /api/analytics/behavior-metrics` endpoint
- [ ] Update `submit-review.ts` to collect and store metrics

### Sprint 2 (Week 2): Session Analytics

- [ ] Implement `sessionAggregator.ts`
- [ ] Create session completion hook
- [ ] Create `sessionAnalytics.ts` automation job
- [ ] Test session analytics pipeline

### Sprint 3 (Week 3): Circadian & Confusion

- [ ] Implement `circadianAnalyzer.ts`
- [ ] Create `circadianProfileUpdate.ts` daily job
- [ ] Implement `confusionDetector.ts`
- [ ] Create confusion detection daily job

### Sprint 4 (Week 4): FSRS Optimization

- [ ] Implement `fsrsOptimizer.ts` with L-BFGS
- [ ] Create weekly optimization job
- [ ] Create `GET/POST /api/user/fsrs-params` endpoint
- [ ] Test parameter personalization

### Sprint 5 (Week 5): Intelligent Scheduling

- [ ] Implement `schedulingEngine.ts`
- [ ] Implement `intervalAdjustments.ts`
- [ ] Create `GET /api/scheduling/due-reviews` endpoint
- [ ] Create `GET /api/scheduling/optimal-session` endpoint

### Sprint 6 (Week 6): Integration & Testing

- [ ] Connect all systems end-to-end
- [ ] Create dashboard for analytics visualization
- [ ] Performance testing
- [ ] Documentation

---

## Part 6: API Contracts

### 6.1 Store Behavior Metrics

```typescript
// POST /api/analytics/behavior-metrics
interface Request {
  questionAttemptId: string;
  sessionId: string;

  // Timing
  timeToFirstInteraction: number;
  readingTime: number;
  deliberationTime: number;
  totalResponseTime: number;

  // Behavior
  optionHoverSequence: number[];
  hoverDurations: Record<number, number>;
  answerChanges: number;
  scrollEvents: number;

  // Context
  questionIndexInSession: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

interface Response {
  success: boolean;
  metricsId: string;
  derivedMetrics: {
    implicitConfidence: number;
    latencyRatio: number;
    cognitiveLoad: number;
  };
}
```

### 6.2 Get Due Reviews

```typescript
// GET /api/scheduling/due-reviews?limit=20
interface Response {
  success: boolean;
  reviews: Array<{
    conditionId: string;
    conditionName: string;
    dueAt: string;
    priority: number;
    stability: number;
    difficulty: number;
    retrievability: number;
    adjustments: {
      confidence: number;
      circadian: number;
      interference: number;
    };
    hasConfusion: boolean;
  }>;
  totalDue: number;
  nextReviewAt?: string;
}
```

### 6.3 Get Optimal Session

```typescript
// GET /api/scheduling/optimal-session?duration=20&newCards=5
interface Response {
  success: boolean;
  session: {
    questions: Question[];
    metadata: {
      totalQuestions: number;
      newCards: number;
      reviewCards: number;
      systemDistribution: Record<string, number>;
      estimatedDuration: number;
      circadianOptimal: boolean;
    };
  };
}
```

---

## Related Documentation

- [FSRS_STATISTICAL_OPTIMIZATION.md](./FSRS_STATISTICAL_OPTIMIZATION.md) - FSRS algorithm details
- [USER_DATA_IMPROVEMENT_PLAN.md](./USER_DATA_IMPROVEMENT_PLAN.md) - User data storage
- [PHASE_2_COGNITIVE_ENGINE.md](./PHASE_2_COGNITIVE_ENGINE.md) - Cognitive engine design

---

**Report Generated:** January 13, 2026
