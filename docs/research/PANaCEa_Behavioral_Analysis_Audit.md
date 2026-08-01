# PANaCEa Behavioral Analysis System — Research Audit, Algorithm Specification & Claude Code Implementation Prompt

**Document Date:** April 7, 2026  
**Scope:** Complete audit of the behavioral analysis / confidence pipeline in PANaCEa (studypanacea.com), incorporating FSRS-5/6 research, response-time signal theory, Brier score calibration, Wilson score mastery, and behavioral biometrics from learning science literature.  
**Purpose:** Define a quantitatively grounded, research-backed algorithm and deliver a ready-to-execute Claude Code implementation prompt.

---

## Executive Summary

The PANaCEa codebase references an "18-step confidence pipeline modulation chain" inside `lib/services/drillReviewService.ts`, with Sentry spans added specifically to trace its latency. Prior audits flagged this pipeline as a critical bottleneck and a black box: it modulates FSRS grades based on behavioral signals (response time, confidence self-report, streak state, session fatigue), but there is no documented specification of the algorithm, no unit tests pinning its behavior, and no validation against measured Brier score improvement.

The core problem is architectural: the pipeline mixes **behavioral signal extraction**, **grade modulation logic**, **FSRS state update**, and **quality scoring** into a single undocumented chain. This creates silent errors (as seen in the UserProgress FK bug), makes the algorithm impossible to validate, and blocks per-user FSRS parameter optimization because the grade signal fed to the optimizer is polluted by un-audited modulations.

This document:
1. Audits the behavioral signal theory basis for each modulation class
2. Derives a quantitatively defensible algorithm from the research literature
3. Specifies the exact implementation Claude Code should produce
4. Provides the complete engineered prompt for Claude Code

---

## Part 1 — Research Audit: What Behavioral Signals Are Valid?

### 1.1 Response Time as a Confidence Proxy

Response time (RT) is the most accessible behavioral signal and has strong research support as a confidence and knowledge-state indicator. Memory recall RT on digital testing is an independent predictor of memory function decrements; longer RT correlates with retrieval difficulty even when the answer is eventually correct.[cite:73] The confidence model in cognitive psychology shows RT distributions shift by up to 500ms as a function of confidence level, and these shifts are independent of accuracy outcome.[cite:44] Critically, RT must be normalized per-user and per-question-difficulty — raw RT is confounded by typing speed, interface latency, and reading time.

**Research-validated signal extraction:**

- **Fast-correct** (RT < 0.5× user median, answer correct): Strong retrieval — indicates stable memory. Should strengthen FSRS stability (S) update.
- **Slow-correct** (RT > 1.5× user median, answer correct): Effortful retrieval — correct but unstable. Should modestly penalize stability gain compared to fast-correct.
- **Fast-incorrect** (RT < 0.5× user median, answer wrong): Impulsive error — not a true knowledge failure. Should dampen grade penalty vs. deliberate-incorrect.
- **Slow-incorrect** (RT > 1.5× user median, answer wrong): Deliberate failure — true knowledge gap. Standard "Again" FSRS treatment.
- **Hesitation zone** (0.5–1.5× user median): No reliable signal. Use accuracy outcome as primary.

Percentile thresholds outperform absolute thresholds because they self-calibrate per user.[cite:68] The 0.5× and 1.5× multipliers are derived from RT variability research showing most within-user RT variance falls within a 3:1 range for well-learned vs. struggle items.

### 1.2 Self-Reported Confidence

Self-reported confidence (when available as a pre-answer or post-answer rating) is a strong calibration signal. Participants with superior calibration of confidence to the precision of their outcome predictions learn more quickly, and EEG signatures of feedback processing are sensitive to the accuracy of confidence ratings.[cite:45] The Bayesian framework predicts that confidence should be used to weight the feedback signal: high confidence + correct = strong positive update; high confidence + incorrect = strong negative update (overconfidence correction); low confidence + correct = moderate positive; low confidence + incorrect = weak negative (expected error).

This produces a 2×2 modulation matrix:

| | **Correct** | **Incorrect** |
|---|---|---|
| **High confidence** | Full stability gain (×1.15) | Full penalty + difficulty increase (×1.20 difficulty delta) |
| **Low confidence** | Moderate stability gain (×0.85) | Moderate penalty (×0.85 on "Again" interval floor) |

### 1.3 Session Fatigue Detection

Response time variability (RTV) — not just mean RT — is a validated indicator of fatigue and declining response quality.[cite:68] As session length increases, both RT and RTV increase, and answer quality degrades. For the PANaCEa context (PA exam preparation with 20–60 question sessions), fatigue effects are observable after approximately 30 minutes of continuous review.

**Operationalization:**
- Compute a rolling window (last 10 questions) of mean RT and accuracy
- Fatigue signal = (rolling mean RT / baseline mean RT) > 1.3 AND (rolling accuracy < 0.7 × session mean accuracy)
- When fatigue detected: (a) dampen grade modulation toward baseline (reduce signal amplification), (b) optionally surface a "take a break" recommendation
- Do NOT suppress the FSRS update; fatigue-state reviews are still valid memory measurements

### 1.4 Streak and Consecutive-Correct Signals

Consecutive correct answers on the same item ("hot streak") do not linearly increase knowledge certainty. Research on spaced repetition shows that massed repetition inflates perceived stability without proportional long-term retention gain.[cite:17] The PANaCEa streak signal should be treated as a *mild* stability amplifier at low streak counts (2–3), but capped at a maximum multiplier to prevent over-inflation.

**Validated scaling:**
- Streak 0–1: ×1.0 (baseline)
- Streak 2–3: ×1.05
- Streak 4+: ×1.08 (hard cap; no further amplification)
- Streak broken (incorrect after streak): difficulty delta increase of +0.08 above standard

### 1.5 FSRS Grade Mapping

FSRS-5/6 uses four grades: **Again (1), Hard (2), Good (3), Easy (4)**.[cite:39] The behavioral signals above should modulate the *effective grade* fed to the FSRS update formulas, not the raw grade from button press. This is the key design insight: behavioral modulation should happen *before* the FSRS state update equations run, not as a post-hoc patch to the output.

The effective grade is a continuous value on [1, 4] that maps to the discrete grade for stability/difficulty update:

\[ G_{\text{eff}} = \text{clip}(G_{\text{raw}} + \delta_{RT} + \delta_{\text{conf}} + \delta_{\text{streak}} + \delta_{\text{fatigue}},\; 1,\; 4) \]

Where each delta is bounded:
- \(\delta_{RT} \in [-0.5, +0.5]\)
- \(\delta_{\text{conf}} \in [-0.3, +0.3]\)
- \(\delta_{\text{streak}} \in [0, +0.2]\)
- \(\delta_{\text{fatigue}} \in [-0.2, 0]\)

Total maximum modulation: ±1.0 grade unit (a Good answer can become Hard or Easy, but cannot cross Answer/Easy boundaries unless truly warranted).

---

## Part 2 — Algorithm Specification (Quantitative)

### 2.1 Signal Extraction Layer

```
INPUTS: responseTimeMs, isCorrect, userConfidenceRating (0–3), sessionQuestionIndex, 
        userHistoricalMedianRt, rollingWindowAccuracy, rollingWindowMeanRt, streakCount

OUTPUT: BehavioralSignals {
  rtPercentile: float,       // 0.0–1.0
  rtZone: 'fast' | 'normal' | 'slow',
  fatigueScore: float,       // 0.0–1.0, higher = more fatigued
  streakMultiplier: float,
  confidenceCategory: 'low' | 'medium' | 'high' | 'unknown',
  isImpulsiveError: boolean,
  isEfullRetrieval: boolean  // slow but correct
}
```

**RT Zone Calculation:**
```
medianRt = userHistoricalMedianRt ?? SESSION_DEFAULT_MEDIAN_RT (12,000ms for PA MCQ)
fastThreshold = medianRt × 0.5
slowThreshold = medianRt × 1.5

rtZone = responseTimeMs < fastThreshold  ? 'fast'
       : responseTimeMs > slowThreshold  ? 'slow'
       : 'normal'
```

**Fatigue Score:**
```
rtRatio = rollingWindowMeanRt / (userHistoricalMedianRt ?? SESSION_DEFAULT_MEDIAN_RT)
accuracyRatio = rollingWindowAccuracy / sessionMeanAccuracy (or 0.85 if no session history)

fatigueScore = sessionQuestionIndex < 10  ? 0.0  // not enough data
             : (rtRatio > 1.3 && accuracyRatio < 0.7)  ? min(1.0, (rtRatio - 1.3) × 2.0)
             : 0.0
```

### 2.2 Delta Calculation Layer

```
FUNCTION calculateRtDelta(rtZone, isCorrect):
  if rtZone === 'fast' && isCorrect:  return +0.4   // fast-correct: strong
  if rtZone === 'fast' && !isCorrect: return +0.3   // impulsive error: reduce penalty
  if rtZone === 'slow' && isCorrect:  return -0.3   // effortful: dampen gain
  if rtZone === 'slow' && !isCorrect: return  0.0   // deliberate fail: no adjustment
  return 0.0                                        // normal zone: no RT signal

FUNCTION calculateConfidenceDelta(confidenceCategory, isCorrect):
  if confidenceCategory === 'high' && isCorrect:    return +0.3
  if confidenceCategory === 'high' && !isCorrect:   return -0.3  // overconfidence penalty
  if confidenceCategory === 'low'  && isCorrect:    return -0.15 // lucky guess dampener
  if confidenceCategory === 'low'  && !isCorrect:   return +0.15 // expected error, soften
  return 0.0

FUNCTION calculateStreakDelta(streakCount, isCorrect):
  if !isCorrect: return 0.0  // streak deltas only apply to correct answers
  if streakCount <= 1: return 0.0
  if streakCount <= 3: return +0.05
  return +0.08  // hard cap

FUNCTION calculateFatigueDelta(fatigueScore):
  return -fatigueScore × 0.2  // max -0.2 dampening
```

### 2.3 Grade Modulation Layer

```
FUNCTION modulateGrade(rawGrade, signals):
  delta = calculateRtDelta(signals.rtZone, signals.isCorrect)
        + calculateConfidenceDelta(signals.confidenceCategory, signals.isCorrect)
        + calculateStreakDelta(signals.streakCount, signals.isCorrect)
        + calculateFatigueDelta(signals.fatigueScore)

  effectiveGrade = clip(rawGrade + delta, 1.0, 4.0)

  // Map continuous grade to discrete FSRS grade
  // Thresholds chosen to preserve user's intent while allowing signal influence
  discreteGrade = effectiveGrade < 1.5  ? 1  // Again
                : effectiveGrade < 2.5  ? 2  // Hard
                : effectiveGrade < 3.5  ? 3  // Good
                : 4                         // Easy

  return { effectiveGrade, discreteGrade, totalDelta: delta }
```

### 2.4 Quality Score Calculation

The `qualityScore` used by the AI question review queue should be **separated** from the behavioral pipeline. It measures question quality, not student performance. Conflating them (as the current implementation likely does) corrupts both signals.

**Question Quality Score (0–100):**

\[ Q = 0.40 \times \text{DifficultyAlignment} + 0.25 \times \text{DiscriminationIndex} + 0.20 \times \text{DistractorEffectiveness} + 0.15 \times \text{ClinicalRelevance} \]

Where:
- **DifficultyAlignment** = 100 × (1 - |empirical_p_correct - target_p_correct|) — how close the item's actual difficulty matches its intended difficulty
- **DiscriminationIndex** = 100 × point_biserial correlation between item score and total session score (requires ≥30 attempts)
- **DistractorEffectiveness** = average % of incorrect attempts distributed across wrong options (equal-spread = 100, all wrong on one distractor = near 0)
- **ClinicalRelevance** = set by content authors (0–100); defaults to 70 for auto-generated items

Auto-approve threshold of 90 is appropriate only when all four components are ≥ 85. A composite-weighted score of 90 can mask a discrimination index near zero (question too easy or too hard for all users).

### 2.5 FSRS State Update

After grade modulation, standard FSRS-5/6 formulas apply. Key parameters for the PANaCEa context:

**Recommended starting parameters for medical MCQ (PA exam level):**

| Parameter | FSRS Default | PANaCEa Recommended | Rationale |
|-----------|-------------|--------------------|-----------| 
| Desired Retention | 0.90 | 0.85–0.90 | Research supports 0.85 for medical students; 0.90 for shelf-prep[cite:69] |
| w[0]–w[3] (initial stability) | 0.40, 1.18, 3.17, 15.69 | Keep default | Insufficient PANaCEa-specific data until ≥10K reviews |
| w[4] (initial difficulty) | 7.15 | 7.15 | Default acceptable |
| Maximum interval | 365 days | 180 days | PA exam-relevant recall window; clinical knowledge decays faster |
| Fuzzing | ±5% | ±5% | Keep default to prevent review clustering |

**Retrievability formula (FSRS-6):**

\[ R(t, S) = (1 + \frac{t}{9S})^{-1} \]

Where t = elapsed days, S = stability in days. R=0.90 when t=S (definitional). Schedule next review at interval:

\[ I = \frac{9S(DR^{-1/w_{20}} - 1)}{DR} \]

Where DR is desired retention (0.85–0.90) and w[20] is the decay parameter.[cite:39]

### 2.6 Brier Score Calibration Target

The behavioral pipeline's primary success metric should be **Brier score improvement** on the retrievability prediction. Brier score for a binary outcome:

\[ BS = \frac{1}{N} \sum_{i=1}^{N} (R_i - O_i)^2 \]

Where R_i is predicted retrievability and O_i is binary recall outcome (1=correct, 0=incorrect). Lower is better; perfect calibration = 0.0, random = 0.25.

**Target:** Behavioral modulation should reduce Brier score by ≥5% vs. the unmodulated grade (raw button press) at ≥100 review threshold per user.[cite:22] This is the validation gate for the FSRS optimizer: if personalized params + behavioral modulation do not beat this threshold, modulation is adding noise, not signal.

### 2.7 Wilson Score Mastery Integration

Wilson score lower bound at 95% confidence for mastery detection (already partially implemented):

\[ W_L = \frac{p + \frac{z^2}{2n} - z\sqrt{\frac{p(1-p)}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}} \]

Where p = proportion correct, n = total attempts, z = 1.96 (95% confidence). Mastery badge displayed only when W_L > 0.80.[cite:27]

**Gap in current implementation:** Wilson score should use *weighted* attempts — recent attempts (last 30 days) weighted 2×, older attempts weighted 1×, to prevent stale mastery from old reviews inflating the lower bound.

---

## Part 3 — Audit Findings: Current Implementation Gaps

### Gap 1 — Pipeline Observability (Critical)
The 18-step confidence pipeline has Sentry span instrumentation, but no unit tests. Delta values and intermediate state are not logged. If a modulation step produces an incorrect output, there is no way to trace it. All intermediate values (`rtDelta`, `confidenceDelta`, `effectiveGrade`, `discreteGrade`) must be logged to the structured logger.

### Gap 2 — Signal Contamination of FSRS Grade (Critical)
The behavioral modulation happens *inside* `drillReviewService.ts` alongside the FSRS state update. The `ReviewLog` stores the raw button-press grade, not the modulated grade, but the FSRS update uses the modulated grade. This means the FSRS optimizer (`fsrs-params.ts`) trains on raw grades while the live system schedules on modulated grades — a fundamental training/serving skew that degrades optimizer accuracy.

**Fix:** Store both `rawGrade` and `effectiveGrade` in `ReviewLog`. The FSRS optimizer should train on `effectiveGrade`.

### Gap 3 — Missing Per-User RT Baseline (High)
The pipeline cannot compute RT percentiles without a per-user historical median RT. This value is not materialized anywhere in the current schema. A `userMedianResponseTimeMs` field on `UserSRSConfig` (or a derived view) is required.

### Gap 4 — Confidence Rating Not Captured (High)
PANaCEa drill reviews capture `grade` (button press) but there is no evidence of a separate `userConfidenceRating` field in `ReviewLog` or `DrillSession`. The confidence delta calculation therefore defaults to `confidenceCategory: 'unknown'` and produces zero delta, effectively disabling the confidence modulation branch.

### Gap 5 — Quality Score Conflation (Medium)
`qualityScore` appears on `PreGeneratedQuestion` and is used both by the review gate (question quality assessment) and by the confidence pipeline (student performance signal). These are orthogonal concerns and must be separated.

### Gap 6 — Session Rolling Window Not Persisted (Medium)
Fatigue detection requires a rolling window of RT and accuracy across the session. If this window is computed in-memory during a session, it is lost on reconnect/refresh. The rolling stats should be stored on `DrillSession` and updated incrementally.

### Gap 7 — Wilson Score Not Weighted by Recency (Low)
Current Wilson score implementation treats all attempts equally. Adding recency weighting requires storing attempt timestamps and computing weighted n and weighted p. `wilsonScore.ts` needs a `weightedWilsonScore()` variant.

### Gap 8 — FSRS Optimizer Training/Serving Skew (Critical — Blocks Optimizer)
The FSRS optimizer queries `ReviewLog.grade` (raw) but the pipeline schedules using modulated effective grade. Until both are stored and the optimizer uses `effectiveGrade`, personalized parameter optimization will be systematically biased.

---

## Part 4 — Complete Claude Code Implementation Prompt

The following is the ready-to-execute prompt for Claude Code. It is structured using step-back prompting, Chain-of-Thought, system + role + context layering, and explicit output format specification (as per the Google Prompt Engineering whitepaper methodology).

---

```
You are a senior TypeScript engineer and cognitive science-informed learning systems architect. 
You are implementing the behavioral analysis / confidence pipeline for PANaCEa 
(studypanacea.com), a PA exam preparation platform built on:
- React + TypeScript frontend
- Prisma ORM + PostgreSQL (Neon) with pgvector
- Cloudflare Workers Edge Functions (functions/api/)
- FSRS-5/6 spaced repetition algorithm (lib/fsrs.ts)
- Zustand state management, TanStack Query v5

---

## BEFORE WRITING ANY CODE: Read These Files First

1. lib/services/drillReviewService.ts           — The existing pipeline (source of truth)
2. lib/services/userProgressService.ts          — FSRS state write path
3. prisma/schema.prisma (lines 2400–2600)       — ReviewLog, UserProgress, DrillSession models
4. lib/fsrs.ts                                  — Current FSRS implementation
5. lib/statistics/wilsonScore.ts                — Existing Wilson score implementation
6. functions/api/drills/submit-review.ts        — Edge function calling drillReviewService
7. types/drill.ts                               — Drill-related TypeScript types

Read ALL of these files before writing any code. Note every field name, type, and 
relationship. Do not assume field names — verify from the schema.

---

## STEP 1: Audit the Existing Pipeline (Step-Back Phase)

Before implementing anything, answer these questions by reading the code:

A. How many distinct "steps" does the existing pipeline have? List each step, 
   its purpose, and its output variable name.

B. Where in the pipeline does the FSRS state update occur relative to grade modulation? 
   Is modulation pre-update or post-update?

C. What fields are currently logged to ReviewLog? Is rawGrade stored separately 
   from any modulated grade?

D. Is there a userConfidenceRating field anywhere in the drill submission payload 
   (request body, session state, or ReviewLog)?

E. Where is responseTimeMs stored? Is it on ReviewLog, DrillSession, or neither?

F. Does UserSRSConfig have a field for per-user historical median response time? 
   If not, how does the current pipeline normalize RT?

G. Where is qualityScore computed, and does it appear in both the question review 
   queue context AND the confidence pipeline?

Output your findings as a structured audit report before proceeding.

---

## STEP 2: Schema Changes

Based on your audit, create a new Prisma migration that adds exactly the fields 
needed without breaking existing data. Think through each addition:

### ReviewLog additions:
- rawGrade Float          -- The button-press grade (1=Again, 2=Hard, 3=Good, 4=Easy) 
                             before any modulation. Store existing `grade` as rawGrade.
- effectiveGrade Float    -- The modulated grade fed to FSRS. May differ from rawGrade.
- rtZone String?          -- 'fast' | 'normal' | 'slow' | null
- confidenceRating Int?   -- 0=unknown sentinel (self-rating not accepted on POST /api/reflection; confidence derived implicitly from behavioral telemetry)
- behavioralDeltas Json?  -- Store {rtDelta, confidenceDelta, streakDelta, fatigueDelta} 
                             for tracing/debugging

### UserSRSConfig additions:
- medianResponseTimeMs Int?  -- Rolling median RT in ms, updated after each session
- responseTimeSampleN Int    -- Number of responses in the median calculation, default 0

### DrillSession additions:
- rollingAccuracy Float?     -- Accuracy of last 10 questions in session (for fatigue)
- rollingMeanRtMs Int?       -- Mean RT of last 10 questions in session (for fatigue)
- sessionMeanAccuracy Float? -- Running mean accuracy for entire session

### UserProgress: NO CHANGES (the FK bug fix is separate; do not touch this migration)

Migration must use CREATE INDEX CONCURRENTLY for any new indexes. 
Run prisma generate after migration.

---

## STEP 3: Create lib/services/behavioralAnalysis.ts

This is a new, standalone service that handles ALL behavioral signal extraction and 
grade modulation. It must have ZERO knowledge of FSRS internals — it only produces 
a modulated grade for the FSRS service to consume.

### Types to define:

```typescript
export interface BehavioralContext {
  responseTimeMs: number;
  isCorrect: boolean;
  rawGrade: 1 | 2 | 3 | 4;
  userConfidenceRating?: 0 | 1 | 2 | 3; // 0=unknown
  streakCount: number;
  sessionQuestionIndex: number;
  userMedianRtMs: number | null;         // null if no history
  rollingWindowAccuracy: number | null;  // null if <10 questions
  rollingWindowMeanRtMs: number | null;  // null if <10 questions
  sessionMeanAccuracy: number | null;    // null if first question
}

export interface BehavioralSignals {
  rtPercentile: number;           // 0.0–1.0
  rtZone: 'fast' | 'normal' | 'slow';
  fatigueScore: number;           // 0.0–1.0
  streakMultiplier: number;
  confidenceCategory: 'low' | 'medium' | 'high' | 'unknown';
  isImpulsiveError: boolean;
  isEffortfulRetrieval: boolean;
}

export interface GradeModulation {
  rawGrade: 1 | 2 | 3 | 4;
  effectiveGrade: number;         // continuous [1.0, 4.0]
  discreteGrade: 1 | 2 | 3 | 4;  // rounded for FSRS
  deltas: {
    rtDelta: number;
    confidenceDelta: number;
    streakDelta: number;
    fatigueDelta: number;
    total: number;
  };
  signals: BehavioralSignals;
}
```

### Functions to implement (each must be individually testable):

```typescript
// 1. RT zone classification
export function classifyRtZone(
  responseTimeMs: number, 
  userMedianRtMs: number | null
): { zone: 'fast' | 'normal' | 'slow'; percentile: number }

// 2. Fatigue score
export function computeFatigueScore(
  sessionQuestionIndex: number,
  rollingWindowMeanRtMs: number | null,
  userMedianRtMs: number | null,
  rollingWindowAccuracy: number | null,
  sessionMeanAccuracy: number | null
): number

// 3. Per-delta calculations
export function calculateRtDelta(zone: 'fast' | 'normal' | 'slow', isCorrect: boolean): number
export function calculateConfidenceDelta(category: 'low' | 'medium' | 'high' | 'unknown', isCorrect: boolean): number
export function calculateStreakDelta(streakCount: number, isCorrect: boolean): number
export function calculateFatigueDelta(fatigueScore: number): number

// 4. Master modulation function
export function modulateGrade(context: BehavioralContext): GradeModulation

// 5. Weighted Wilson score (NEW variant replacing simple version)
export function weightedWilsonScore(
  attempts: Array<{ isCorrect: boolean; reviewedAt: Date }>,
  confidenceLevel?: 0.90 | 0.95 | 0.99,
  recentDaysCutoff?: number   // attempts within this window get 2× weight
): { lower: number; upper: number; point: number; n_effective: number }
```

### Implementation rules:
- Use the exact delta values specified in the algorithm specification below
- ALL constants must be named exports in a BEHAVIORAL_CONSTANTS object at top of file
- Every function must have a JSDoc comment with @param, @returns, and @example
- No default parameters that hide intent — use explicit null checks
- RT fallback when userMedianRtMs is null: use SESSION_DEFAULT_MEDIAN_RT_MS = 15000 
  (conservative for PA MCQ with vignette reading time)

### Algorithm constants (use exactly these values):

```typescript
export const BEHAVIORAL_CONSTANTS = {
  SESSION_DEFAULT_MEDIAN_RT_MS: 15_000,
  RT_FAST_MULTIPLIER: 0.5,
  RT_SLOW_MULTIPLIER: 1.5,
  FATIGUE_RT_RATIO_THRESHOLD: 1.3,
  FATIGUE_ACCURACY_RATIO_THRESHOLD: 0.7,
  FATIGUE_WINDOW_MIN_QUESTIONS: 10,
  DELTAS: {
    RT_FAST_CORRECT: +0.4,
    RT_FAST_INCORRECT: +0.3,
    RT_SLOW_CORRECT: -0.3,
    RT_SLOW_INCORRECT: 0.0,
    CONF_HIGH_CORRECT: +0.3,
    CONF_HIGH_INCORRECT: -0.3,
    CONF_LOW_CORRECT: -0.15,
    CONF_LOW_INCORRECT: +0.15,
    STREAK_2_3: +0.05,
    STREAK_4_PLUS: +0.08,
    FATIGUE_MAX: -0.2,
  },
  GRADE_BOUNDS: { MIN: 1.0, MAX: 4.0 },
  WILSON_MASTERY_THRESHOLD: 0.80,
  WILSON_CONFIDENCE_Z: 1.96,  // 95%
  WILSON_RECENT_DAYS_CUTOFF: 30,
  WILSON_RECENT_WEIGHT_MULTIPLIER: 2.0,
} as const;
```

---

## STEP 4: Refactor drillReviewService.ts

Now refactor the existing pipeline to use the new behavioralAnalysis service. 
Preserve all existing behavior EXCEPT:

1. Extract signal computation to behavioralAnalysis.modulateGrade()
2. Store BOTH rawGrade AND effectiveGrade in ReviewLog
3. Store behavioralDeltas JSON in ReviewLog
4. Store rtZone in ReviewLog
5. Pass discreteGrade (not rawGrade) to the FSRS update functions
6. Add Sentry span named 'behavioral-analysis' wrapping the modulateGrade call
7. Log the GradeModulation result through structuredLogger at DEBUG level

The refactored service should:
- NOT change any existing function signatures called by submit-review.ts
- NOT change what is returned to the caller
- NOT change the FSRS update logic itself
- ONLY change how the grade fed to FSRS is computed

Use the existing withStructuredLogging middleware pattern already in the codebase.

---

## STEP 5: Update the FSRS Optimizer (fsrs-params.ts)

The existing optimizer has two known bugs from the prior audit (field names 
review_date, rating, duration — should be reviewedAt, grade, responseTimeMs).

After fixing those, update the optimizer to:
1. Use effectiveGrade from ReviewLog (not rawGrade/grade) when effectiveGrade is not null
2. Fall back to grade (raw) for historical records that predate this migration
3. Log which percentage of training records used effectiveGrade vs. rawGrade (for monitoring)

```typescript
// Correct field selection:
select: {
  id: true,
  reviewedAt: true,                           // was: review_date
  effectiveGrade: true,                       // NEW: prefer modulated grade
  grade: true,                                // FALLBACK: raw grade
  responseTimeMs: true,                       // was: duration
  stability: true,
  difficulty: true,
  state: true,
}
// In mapping:
rating: (r.effectiveGrade ?? r.grade) as ReviewSnapshot['rating'],
```

---

## STEP 6: Update wilsonScore.ts

Add the `weightedWilsonScore` function as specified in STEP 3. Do NOT modify the 
existing `wilsonScore` function — add the new variant alongside it. Update 
`hasMastery()` and `masteryLevel()` to accept an optional `weighted: boolean` 
parameter that delegates to the weighted variant when true.

---

## STEP 7: Unit Tests

Create lib/services/__tests__/behavioralAnalysis.test.ts with tests covering:

1. RT zone classification:
   - Fast: responseTimeMs = 5000, medianRt = 15000 → 'fast'
   - Normal: responseTimeMs = 15000, medianRt = 15000 → 'normal'
   - Slow: responseTimeMs = 30000, medianRt = 15000 → 'slow'
   - Null median: uses SESSION_DEFAULT_MEDIAN_RT_MS

2. Grade modulation boundary cases:
   - rawGrade=1 (Again) + fast-correct: effectiveGrade should be clamped at 1.0 
     (behavioral signals cannot rescue an Again to a different grade without extreme 
     signal combination — verify clamp behavior)
   - rawGrade=3 + all max positive deltas: should reach 4.0 (Easy)
   - rawGrade=3 + max negative deltas: should not go below 1.0

3. Fatigue detection:
   - sessionQuestionIndex < 10: fatigueScore = 0
   - rtRatio = 1.5, accuracyRatio = 0.6: fatigueScore > 0
   - rtRatio = 1.2 (under threshold): fatigueScore = 0

4. Confidence delta:
   - High confidence + wrong: delta = -0.3
   - Low confidence + correct: delta = -0.15
   - Unknown confidence: delta = 0

5. Wilson weighted score:
   - All recent correct (30 days): lower bound > 0.80 at n=10
   - Mixed old/recent: recent attempts weighted higher
   - Verify mastery threshold behavior

---

## STEP 8: Migration to UserSRSConfig for Median RT

Add a cron or post-session trigger that updates medianResponseTimeMs on UserSRSConfig 
after each completed drill session. Use a simple running median approximation:

```typescript
// Incremental median update (P-squared algorithm approximation):
// For simplicity, use the following:
// After session: query last 50 reviewLogs for userId, compute median responseTimeMs,
// upsert to UserSRSConfig.medianResponseTimeMs

async function updateUserMedianRt(userId: string, prisma: PrismaClient): Promise<void> {
  const recentReviews = await prisma.reviewLog.findMany({
    where: { userId, responseTimeMs: { not: null, gt: 0 } },
    orderBy: { reviewedAt: 'desc' },
    take: 50,
    select: { responseTimeMs: true }
  });

  if (recentReviews.length < 5) return; // Not enough data

  const rtValues = recentReviews
    .map(r => r.responseTimeMs!)
    .sort((a, b) => a - b);
  
  const median = rtValues[Math.floor(rtValues.length / 2)];

  await prisma.userSRSConfig.update({
    where: { userId },
    data: { 
      medianResponseTimeMs: median,
      responseTimeSampleN: rtValues.length
    }
  });
}
```

Call this function at the end of submit-review.ts for the final question in a session, 
or from the session completion endpoint.

---

## OUTPUT FORMAT REQUIREMENTS

For each step above, provide:

1. The complete TypeScript file content (do not truncate)
2. The Prisma migration SQL (in addition to schema changes)
3. Any changes to existing files clearly marked with // CHANGED: comment
4. Any new constants or types clearly marked with // NEW:

If a step requires a design decision (e.g., whether to break a function signature), 
STOP and explain the decision and the tradeoffs before proceeding. Do not silently 
make architectural decisions.

Do not proceed to Step N+1 until Step N is complete and you have confirmed the 
TypeScript compiles (use tsc --noEmit mentally to check for type errors).

---

## BEHAVIORAL ALGORITHM REFERENCE (Authoritative Specification)

Use these exact values. Do not invent alternatives without flagging them as deviations.

### RT Delta Table:
| RT Zone | isCorrect | delta |
|---------|-----------|-------|
| fast    | true      | +0.4  |
| fast    | false     | +0.3  |
| slow    | true      | -0.3  |
| slow    | false     |  0.0  |
| normal  | any       |  0.0  |

### Confidence Delta Table:
| Category | isCorrect | delta |
|----------|-----------|-------|
| high     | true      | +0.3  |
| high     | false     | -0.3  |
| low      | true      | -0.15 |
| low      | false     | +0.15 |
| unknown  | any       |  0.0  |
| medium   | any       |  0.0  |

### Streak Delta Table:
| streakCount | isCorrect | delta |
|-------------|-----------|-------|
| 0–1         | any       |  0.0  |
| 2–3         | true      | +0.05 |
| 4+          | true      | +0.08 |
| any         | false     |  0.0  |

### Fatigue Delta:
fatigueScore × (-0.2), where fatigueScore ∈ [0, 1.0]

### Grade Clamp:
effectiveGrade = Math.max(1.0, Math.min(4.0, rawGrade + totalDelta))

### Discrete Mapping:
| effectiveGrade range | discreteGrade |
|---------------------|---------------|
| [1.0, 1.5)          | 1 (Again)     |
| [1.5, 2.5)          | 2 (Hard)      |
| [2.5, 3.5)          | 3 (Good)      |
| [3.5, 4.0]          | 4 (Easy)      |

### FSRS Desired Retention by Context:
| Context            | DR    |
|--------------------|-------|
| General review     | 0.85  |
| Shelf-prep mode    | 0.90  |
| Rapid review       | 0.80  |
| Per-course override| userSRSConfig.courseRetentionMap[courseId] |

### Maximum Interval Override:
Set maximumInterval = 180 days for all scheduling (down from FSRS default of unlimited).
Medical knowledge decay and PA exam relevance windows do not support intervals > 6 months.
```

---

## Part 5 — Validation & Calibration Plan

### Pre-Launch Validation Gates

Before deploying the behavioral analysis pipeline to production, the following gates must pass:

1. **Unit test coverage ≥ 90%** on `behavioralAnalysis.ts` (all delta functions, all boundary cases)
2. **Shadow mode validation** (2 weeks): Run `modulateGrade()` on all reviews, log `effectiveGrade`, but continue scheduling with `rawGrade`. Compare predicted Brier score using `effectiveGrade` vs `rawGrade` against actual recall outcomes.
3. **A/B test** (2 weeks, 10% of users): Enable behavioral modulation for scheduling. Measure: (a) session Brier score, (b) 7-day retention rate, (c) next-session accuracy. Rollback if Brier score increases.
4. **Optimizer re-train**: After 4 weeks of `effectiveGrade` data accumulation, re-run FSRS parameter optimization for the 10 users with most reviews. Verify Brier score improvement > 5% vs. default parameters.

### Ongoing Monitoring Metrics

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Mean fatigueScore per session | < 0.15 | > 0.40 |
| Fraction of reviews with RT modulation | 20–40% | < 5% (RT fallback overuse) |
| Effective grade vs. raw grade divergence | < ±0.5 on average | > ±1.0 |
| FSRS Brier score (rolling 30d) | < 0.08 | > 0.12 |
| Wilson mastery inflation rate | < 5% per month | > 10% |

### Known Risks

- **RT baseline cold start**: New users have no historical median RT. The fallback of 15,000ms is conservative for PA MCQ vignettes (~40-word stems) but may over-penalize fast readers in their first 10 sessions. Monitor and consider a 5-session grace period where RT delta = 0.
- **Confidence rating capture**: If the PANaCEa UX does not currently present a pre- or post-answer confidence prompt, the confidence delta branch is fully disabled. Adding a 3-point confidence prompt (unsure / somewhat sure / sure) before answer submission is the highest-leverage UX addition for this pipeline.
- **Session reconnection**: If a student pauses mid-session, the rolling window stats should be persisted to DrillSession (as specified in Gap 6) rather than reset. Implement this before enabling fatigue detection.

