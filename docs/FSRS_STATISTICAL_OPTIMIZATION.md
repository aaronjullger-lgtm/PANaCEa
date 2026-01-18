# 📊 FSRS Statistical Optimization - 10-Step Advanced Plan

**Date:** January 13, 2026  
**Status:** 📋 Planning Complete - Ready for Implementation  
**Focus:** Data collection complexity, analysis sophistication, and FSRS personalization

---

## Executive Summary

This plan transforms PANaCEa's spaced repetition from static FSRS to a **data-driven, personalized adaptive learning system** by connecting existing analytics infrastructure (JOL calibration, implicit metrics, circadian analysis) to FSRS parameter optimization.

---

## Current Infrastructure Assessment

### ✅ Sophisticated Components Already Built

| Component          | Location                  | Sophistication                                |
| ------------------ | ------------------------- | --------------------------------------------- |
| FSRS v5 Algorithm  | `lib/fsrs.ts`             | ⚠️ Static parameters                          |
| JOL Calibration    | `lib/jol-calibration.ts`  | ✅ Advanced (Brier score, calibration curves) |
| Implicit Metrics   | `lib/implicit-metrics.ts` | ✅ Advanced (latency, hesitation)             |
| Circadian Analysis | `lib/circadian.ts`        | ✅ Basic                                      |
| Fluency Scoring    | `lib/fluency-scoring.ts`  | ✅ Advanced                                   |
| Metacognition      | `lib/metacognition.ts`    | ✅ JOL integration                            |

### 🚨 Critical Gap

**These systems are disconnected from FSRS parameter optimization.**

The JOL system detects overconfidence, but FSRS doesn't use this signal.

---

## 🔟 10-Step Advanced Plan

### **Phase 1: Enhanced Data Collection**

#### **Step 1: Per-Question Micro-Analytics** 🔴 P0

**Current**: Basic timing data in QuestionAttempt  
**Goal**: Rich behavioral signals per question

```typescript
interface QuestionMicroAnalytics {
  // Timing (ms)
  timeToFirstInteraction: number; // When user first interacts
  readingTime: number; // Time before first click
  deliberationTime: number; // Time between interactions
  totalResponseTime: number; // Total time

  // Behavioral
  optionHoverSequence: number[]; // Order of options hovered
  hoverDurations: Record<number, number>; // ms per option
  answerChanges: number; // Times answer changed
  scrollEvents: number; // Scroll interactions

  // Derived (from existing libs)
  implicitConfidence: number; // From JOL calibration
  latencyRatio: number; // Actual / expected time
  cognitiveLoad: number; // Estimated from behavior
  fluencyScore: number; // From fluency-scoring.ts

  // Context
  questionIndexInSession: number;
  timeOfDay: number; // 0-23
  deviceType: 'mobile' | 'tablet' | 'desktop';
}
```

**Storage**: Extend `QuestionAttempt.metadata` JSONB field

---

#### **Step 2: Session-Level Aggregation** 🔴 P0

**Goal**: Detect fatigue, attention decay, and optimal session length

```typescript
interface SessionAnalytics {
  // Performance curve
  accuracyByQuarter: [number, number, number, number]; // Q1-Q4
  accuracyTrend: 'improving' | 'stable' | 'declining';
  fatiguePoint?: number; // Question index where accuracy drops

  // Timing metrics
  avgResponseTime: number;
  responseTimeVariance: number; // Higher = less consistent attention
  responseTimeTrend: 'speeding_up' | 'stable' | 'slowing_down';

  // Metacognition
  sessionBrierScore: number; // From JOL
  calibrationState: 'overconfident' | 'underconfident' | 'calibrated';

  // Flow state indicators
  flowStateMinutes: number; // Time in optimal challenge zone
  interruptionCount: number;
}
```

**Implementation**: `scripts/automation/jobs/sessionAnalytics.ts`

---

#### **Step 3: Longitudinal User Profiles** 🟠 P1

**Goal**: Track user evolution over weeks/months

```typescript
interface UserLongitudinalProfile {
  // Learning velocity
  velocityBySystem: Record<string, number>; // Cards/day to mastery
  overallVelocity: number;

  // Retention characteristics
  retentionCurveShape: 'exponential' | 'power_law' | 'mixed';
  avgStabilityGrowth: number; // Per successful review
  avgStabilityDecay: number; // Per lapse

  // Optimal parameters
  optimalSessionLength: number; // Questions before fatigue
  optimalNewCardsPerDay: number;
  peakPerformanceHours: number[]; // e.g., [9, 10, 11, 14, 15]

  // Metacognitive profile
  calibrationTrend: number; // -1 to 1 (under to over)
  metacognitiveGrowth: number; // Improvement in calibration
}
```

**Implementation**: Weekly aggregation job

---

### **Phase 2: Advanced Analysis**

#### **Step 4: FSRS Parameter Personalization** 🔴 P0 (Highest Impact)

**Current**: Static `defaultParameters` for all users
**Goal**: Per-user optimized w[] parameters

```typescript
interface PersonalizedFSRSParams {
  userId: string;

  // Optimized parameters (19 weights)
  w: number[];

  // Optimization metadata
  calibrationDate: Date;
  sampleSize: number; // Reviews used for optimization
  improvementOverDefault: number; // % Brier score reduction

  // Per-system adjustments
  systemModifiers?: Record<
    string,
    {
      stabilityMultiplier: number; // Some systems need longer intervals
      difficultyOffset: number; // Some systems are inherently harder
    }
  >;
}
```

**Optimization Algorithm**:

```typescript
async function optimizeFSRSParameters(
  userId: string,
  reviewHistory: ReviewSnapshot[]
): Promise<PersonalizedFSRSParams> {
  // Minimum 100 reviews required
  if (reviewHistory.length < 100) {
    return { w: defaultParameters.w, ... };
  }

  // L-BFGS optimization to minimize Brier score
  // Predicts P(recall) for each review based on parameters
  // Compares to actual outcome (correct/incorrect)
  // Iteratively adjusts w[] to minimize error

  const optimized = lbfgsOptimize(
    initialParams: defaultParameters.w,
    objective: (params) => computeBrierScore(params, reviewHistory),
    bounds: PARAMETER_BOUNDS,
    maxIterations: 1000
  );

  return {
    w: optimized.params,
    improvementOverDefault:
      (computeBrierScore(defaultParameters.w, reviewHistory) -
       computeBrierScore(optimized.params, reviewHistory)) /
      computeBrierScore(defaultParameters.w, reviewHistory)
  };
}
```

**File**: `lib/fsrs-optimizer.ts`

---

#### **Step 5: Bayesian Difficulty Estimation** 🟠 P1

**Current**: Static difficulty labels (easy/medium/hard)
**Goal**: Dynamic difficulty based on population performance

**Model**: Item Response Theory (IRT) 2-Parameter Logistic

```typescript
interface BayesianDifficulty {
  questionId: string;

  // IRT parameters
  difficulty: number; // b parameter (-3 to 3)
  discrimination: number; // a parameter (0.5 to 2.5)
  guessing: number; // c parameter (0.25 for 4-option MCQ)

  // Confidence
  posteriorVariance: number;
  credibleInterval: [number, number];
  sampleSize: number;

  lastUpdated: Date;
}
```

**Update Rule**: Bayesian posterior update after each attempt

---

#### **Step 6: Retrievability-Adjusted Scheduling** 🟠 P1

**Current**: interval = stability × retention_factor
**Goal**: Factor in implicit confidence and circadian patterns

```typescript
function computeOptimalInterval(params: {
  stability: number;
  difficulty: number;
  targetRetention: number;

  // NEW: Behavioral signals
  implicitConfidence: number; // From JOL
  calibrationState: string; // User's calibration

  // NEW: Circadian factors
  currentHour: number;
  userChronotype: string;
  peakHours: number[];

  // NEW: Cognitive state
  fatigueLevel: number; // 0-1
  sessionProgress: number; // How far into session
}): number {
  let baseInterval = computeFSRSInterval(stability, targetRetention);

  // Adjust for confidence calibration
  if (calibrationState === 'overconfident' && implicitConfidence > 0.8) {
    // User thinks they know it but often wrong - schedule sooner
    baseInterval *= 0.8;
  } else if (calibrationState === 'underconfident' && implicitConfidence < 0.5) {
    // User doubts themselves but usually correct - schedule later
    baseInterval *= 1.1;
  }

  // Adjust for circadian rhythm
  const hoursUntilPeak = findNextPeakHour(currentHour, peakHours);
  if (hoursUntilPeak < baseInterval * 24) {
    // Schedule to land during peak hours if possible
    baseInterval = adjustToTargetHour(baseInterval, peakHours);
  }

  return baseInterval;
}
```

---

### **Phase 3: Intelligent Integration**

#### **Step 7: Predictive Performance Model** 🟡 P2

**Goal**: ML model to predict question outcome

**Features**:

- All micro-analytics (Step 1)
- User profile (Step 3)
- Question difficulty (Step 5)
- Circadian position
- Session fatigue level

**Output**:

- P(correct) prediction
- Confidence interval
- Optimal difficulty to serve next

---

#### **Step 8: Calibration-Driven Interventions** 🟡 P2

**Goal**: Automatically correct metacognitive biases

| Detected State         | Intervention                                             |
| ---------------------- | -------------------------------------------------------- |
| Overconfident          | Serve harder questions, add "desirable difficulties"     |
| Underconfident         | Serve confidence-building questions, show progress       |
| Illusion of Competence | Force slower responses, add friction, require reflection |
| Well-Calibrated        | Maintain current approach                                |

---

#### **Step 9: Cohort Benchmarking** 🟡 P2

**Goal**: Compare individual to population

**Metrics**:

- Percentile rank per system
- Stability growth vs cohort
- Time to mastery vs cohort
- Identify underperforming areas

---

#### **Step 10: A/B Testing Infrastructure** 🟢 P3

**Goal**: Test algorithm variations

```typescript
interface ABTest {
  id: string;
  name: string;

  // Variants
  control: {
    description: string;
    fsrsParams: FSRSParameters;
    schedulingStrategy: string;
  };
  treatment: {
    description: string;
    fsrsParams: FSRSParameters;
    schedulingStrategy: string;
  };

  // Assignment
  userAllocation: 'random' | 'stratified';
  treatmentPercentage: number;

  // Metrics
  primaryMetric: 'retention_rate' | 'learning_velocity' | 'engagement';
  secondaryMetrics: string[];

  // Status
  startDate: Date;
  endDate?: Date;
  sampleSize: number;
  statisticalSignificance?: number;
}
```

---

## Implementation Priority Matrix

| Step                     | Effort    | Impact    | Priority | Dependencies             |
| ------------------------ | --------- | --------- | -------- | ------------------------ |
| 1. Micro-Analytics       | Medium    | Very High | 🔴 P0    | None                     |
| 2. Session Aggregation   | Low       | High      | 🔴 P0    | Step 1                   |
| 3. Longitudinal Profiles | Medium    | High      | 🟠 P1    | Steps 1-2                |
| 4. FSRS Personalization  | High      | Very High | 🔴 P0    | None (use existing data) |
| 5. Bayesian Difficulty   | High      | High      | 🟠 P1    | Population data          |
| 6. Retrievability Adjust | Medium    | High      | 🟠 P1    | Steps 4, JOL             |
| 7. Predictive Model      | Very High | Very High | 🟡 P2    | Steps 1-6                |
| 8. Interventions         | Medium    | High      | 🟡 P2    | JOL, Steps 1-3           |
| 9. Benchmarking          | Medium    | Medium    | 🟡 P2    | Population data          |
| 10. A/B Testing          | High      | Medium    | 🟢 P3    | All above                |

---

## Files to Create

| File                                          | Purpose                           |
| --------------------------------------------- | --------------------------------- |
| `lib/fsrs-optimizer.ts`                       | L-BFGS parameter optimization     |
| `lib/bayesian-irt.ts`                         | Item Response Theory model        |
| `lib/micro-analytics.ts`                      | Per-question data collection      |
| `lib/session-aggregator.ts`                   | Session-level computations        |
| `lib/adaptive-scheduler.ts`                   | Retrievability-adjusted intervals |
| `services/analytics/predictiveModel.ts`       | ML prediction service             |
| `functions/api/user/fsrs-params.ts`           | Personalized params API           |
| `scripts/automation/jobs/fsrsOptimization.ts` | Weekly param optimization         |

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA COLLECTION LAYER                         │
├────────────────┬────────────────┬────────────────┬──────────────┤
│  QuestionAttempt│  StudySession  │  UserProgress  │  Population  │
│  + microAnalytics│  + sessionStats│  + reviewHistory│  + IRTParams │
└────────┬───────┴────────┬───────┴────────┬───────┴──────┬───────┘
         │                │                │              │
         v                v                v              v
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYSIS LAYER                                │
├────────────────┬────────────────┬────────────────┬──────────────┤
│  JOL           │  FSRS          │  Bayesian      │  Circadian   │
│  Calibration   │  Optimizer     │  IRT           │  Analysis    │
└────────┬───────┴────────┬───────┴────────┬───────┴──────┬───────┘
         │                │                │              │
         v                v                v              v
┌─────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                            │
├────────────────┬────────────────┬────────────────┬──────────────┤
│  Personalized  │  Adaptive      │  Calibration   │  Predictive  │
│  FSRS Params   │  Scheduling    │  Interventions │  Model       │
└────────────────┴────────────────┴────────────────┴──────────────┘
         │
         v
┌─────────────────────────────────────────────────────────────────┐
│                    USER EXPERIENCE                               │
│  - Optimally timed reviews                                      │
│  - Personalized difficulty                                       │
│  - Metacognitive feedback                                        │
│  - Peak hour notifications                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Expected Outcomes

| Metric                    | Current  | Target               |
| ------------------------- | -------- | -------------------- |
| Retention rate (7-day)    | ~75%     | 85%+                 |
| Learning velocity         | Baseline | +25% faster          |
| User engagement           | Baseline | +20%                 |
| FSRS Brier score          | 0.25     | 0.15                 |
| Metacognitive calibration | Varies   | 80%+ well-calibrated |

---

## Related Documentation

- [USER_DATA_IMPROVEMENT_PLAN.md](./USER_DATA_IMPROVEMENT_PLAN.md) - User data collection
- [STATISTICS_IMPROVEMENT_PLAN.md](./STATISTICS_IMPROVEMENT_PLAN.md) - Platform statistics
- [PHASE_2_COGNITIVE_ENGINE.md](./PHASE_2_COGNITIVE_ENGINE.md) - Cognitive engine design

---

**Report Generated:** January 13, 2026
