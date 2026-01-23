# 📊 FSRS Statistical Optimization - Advanced Plan

Based on my audit of your existing infrastructure, you already have **sophisticated foundations**:

## Current State (Impressive!)

| Component              | Sophistication                       | Location                  |
| ---------------------- | ------------------------------------ | ------------------------- |
| **FSRS v5**            | Basic (static params)                | `lib/fsrs.ts`             |
| **JOL Calibration**    | Advanced (Brier, calibration curves) | `lib/jol-calibration.ts`  |
| **Implicit Metrics**   | Advanced (latency, hesitation)       | `lib/implicit-metrics.ts` |
| **Circadian Analysis** | Basic                                | `lib/circadian.ts`        |
| **Fluency Scoring**    | Advanced                             | `lib/fluency-scoring.ts`  |

**Key Gap**: These systems are **disconnected** from FSRS parameter optimization.

---

## 🎯 10-Step Advanced Statistical Optimization Plan

### **Phase 1: Data Collection Enhancement**

#### **Step 1: Per-Question Micro-Analytics** 🔴 P0

Store granular data per question attempt:

```typescript
interface QuestionMicroAnalytics {
  // Timing
  timeToFirstInteraction: number;
  readingTime: number; // Before first click
  deliberationTime: number; // Between interactions
  totalResponseTime: number;

  // Behavioral
  optionHoverSequence: number[];
  answerChanges: number;
  scrollEvents: number;

  // Derived
  implicitConfidence: number; // From JOL
  latencyRatio: number;
  cognitiveLoad: number; // Estimated from behavior
}
```

#### **Step 2: Session-Level Aggregated Metrics** 🔴 P0

Compute and store per-session:

- Fatigue curve (accuracy decay over questions)
- Attention span (RT variance)
- Metacognitive calibration (Brier score per session)
- Cognitive load threshold detection

#### **Step 3: Longitudinal User Profiles** 🟠 P1

Track evolution over weeks/months:

- Learning velocity per system
- Retention curve shape (exponential vs power law)
- Optimal session length
- Peak performance hours

---

### **Phase 2: Advanced Analysis**

#### **Step 4: FSRS Parameter Personalization** 🔴 P0

**Currently**: Static `defaultParameters` for all users
**Goal**: Per-user optimized w[] parameters

```typescript
interface PersonalizedFSRSParams {
  userId: string;
  optimizedW: number[]; // 19 parameters
  calibrationDate: Date;
  sampleSize: number;
  improvementOverDefault: number; // % reduction in Brier
}
```

**Optimization Method**:

- Collect 100+ reviews per user
- Use L-BFGS optimization to minimize Brier score
- Constrain parameters to valid ranges

#### **Step 5: Bayesian Difficulty Estimation** 🟠 P1

**Currently**: Static difficulty labels (easy/medium/hard)
**Goal**: Dynamic difficulty based on population performance

```typescript
interface BayesianDifficulty {
  questionId: string;
  posteriorDifficulty: number; // 0-10 scale
  confidenceInterval: [number, number];
  sampleSize: number;
  lastUpdated: Date;
}
```

**Method**: Item Response Theory (IRT) 2PL model

#### **Step 6: Retrievability-Adjusted Scheduling** 🟠 P1

**Currently**: Simple interval = stability × retention_factor
**Goal**: Factor in implicit confidence and circadian patterns

```typescript
function computeOptimalInterval(params: {
  stability: number;
  difficulty: number;
  implicitConfidence: number; // From JOL
  timeOfDay: number; // User's current hour
  userChronotype: string;
  fatigueLevel: number;
}): number {
  // Adjust retrievability target based on confidence
  // If user is overconfident, schedule sooner
  // If underconfident, can schedule later
}
```

---

### **Phase 3: Intelligent Integration**

#### **Step 7: Predictive Performance Model** 🟡 P2

Train ML model to predict:

- P(correct) for next question
- Optimal question difficulty to serve
- Fatigue point in session

**Features**: All micro-analytics + user profile + circadian

#### **Step 8: Calibration-Driven Interventions** 🟡 P2

When JOL detects miscalibration:

- **Overconfident**: Serve harder questions, add desirable difficulty
- **Underconfident**: Serve confidence-building questions
- **Illusion of Competence**: Force slower responses, add friction

#### **Step 9: Cohort Benchmarking** 🟡 P2

Compare individual to population:

- Percentile rank by system
- Stability growth vs cohort
- Identify underperforming areas

#### **Step 10: A/B Testing Infrastructure** 🟢 P3

Test algorithm variations:

- Different FSRS parameter sets
- Scheduling strategies
- Intervention effectiveness

---

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA COLLECTION LAYER                     │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Micro-      │  Session     │  Longitudinal│  Population    │
│  Analytics   │  Aggregates  │  Profiles    │  Statistics    │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       v              v              v                v
┌─────────────────────────────────────────────────────────────┐
│                    ANALYSIS LAYER                            │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  JOL         │  FSRS        │  Bayesian    │  Predictive    │
│  Calibration │  Optimizer   │  IRT         │  Model         │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       v              v              v                v
┌─────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Personalized│  Adaptive    │  Calibration │  A/B Test      │
│  Parameters  │  Scheduling  │  Interventions│  Framework    │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

---

## Priority Matrix

| Step                              | Effort    | Impact    | Priority |
| --------------------------------- | --------- | --------- | -------- |
| 1. Micro-Analytics Collection     | Medium    | Very High | 🔴 P0    |
| 2. Session Aggregation            | Low       | High      | 🔴 P0    |
| 3. Longitudinal Profiles          | Medium    | High      | 🟠 P1    |
| 4. FSRS Parameter Personalization | High      | Very High | 🔴 P0    |
| 5. Bayesian Difficulty            | High      | High      | 🟠 P1    |
| 6. Retrievability Adjustment      | Medium    | High      | 🟠 P1    |
| 7. Predictive Model               | Very High | Very High | 🟡 P2    |
| 8. Calibration Interventions      | Medium    | High      | 🟡 P2    |
| 9. Cohort Benchmarking            | Medium    | Medium    | 🟡 P2    |
| 10. A/B Testing                   | High      | Medium    | 🟢 P3    |

---

## Files to Create

| File                                    | Purpose                           |
| --------------------------------------- | --------------------------------- |
| `lib/fsrs-optimizer.ts`                 | L-BFGS parameter optimization     |
| `lib/bayesian-irt.ts`                   | Item Response Theory model        |
| `lib/micro-analytics.ts`                | Per-question data collection      |
| `lib/session-aggregator.ts`             | Session-level computations        |
| `lib/adaptive-scheduler.ts`             | Retrievability-adjusted intervals |
| `services/analytics/predictiveModel.ts` | ML prediction service             |
| `functions/api/user/fsrs-params.ts`     | Personalized params API           |

---

I recommend beginning with:

1. **Step 1**: Micro-analytics collection schema
2. **Step 4**: FSRS optimizer (this will have the biggest impact)
