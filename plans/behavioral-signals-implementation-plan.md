# Behavioral Signals Implementation Plan — Three Waves

*10 additions to the PANaCEa confidence/FSRS pipeline — April 2026*

---

## Architecture Overview

All 10 additions feed into the existing confidence pipeline in `drillReviewService.ts`. The pipeline currently runs:

```
deriveContinuousRating() → grade + confidence
  ↓
accumulateConfidence()       — Bayesian blend with card history
  ↓
getUserCalibration()         — Per-user Brier score dampener
  ↓
fluencyIllusionDampener()    — Same-day review discount
  ↓
confidenceStabilityMultiplier() — Sigmoid → [0.72, 1.28]
  ↓
urgencyMultiplier            — EOR exam tightening
  ↓
getStabilityCorrectionFactor() — Predicted vs. actual calibration
  ↓
modifiedStability            — Final FSRS stability
```

New signals slot into this chain at specific points (marked below). No existing steps are removed.

---

## Wave 1 — Server-Only (No Client Changes)

**Scope:** Features #1, #4, #8, #9
**Estimated effort:** 2–3 days
**Risk:** Zero — all data already exists server-side; purely new computation on existing fields.
**No Prisma migration needed.**

---

### 1A. Lapse Severity Index

**What:** When `isCorrect === false` and the card is in review state (state ≥ 2), compute a severity score from the pre-lapse streak length and stability, then amplify the post-lapse difficulty increase.

**New file:** `lib/services/lapseSeverityService.ts`

```typescript
// ── lib/services/lapseSeverityService.ts ──

/**
 * Lapse Severity Index
 *
 * A lapse after 8 consecutive correct reviews across months is qualitatively
 * different from a lapse after 2 reviews. The former signals "false stability"
 * (interference, not just decay) and should receive a harsher difficulty bump.
 *
 * Formula: severity = log2(1 + reps) × log2(1 + stability)
 * Difficulty multiplier: 1 + 0.15 × severity (capped at 1.6)
 *
 * Research: Bjork & Bjork (2011) — retrieval failures after apparent mastery
 * indicate fragile knowledge requiring aggressive rescheduling.
 */

/** Maximum difficulty multiplier to prevent runaway difficulty */
const MAX_SEVERITY_MULTIPLIER = 1.6;

/** Scaling factor for severity → difficulty multiplier */
const SEVERITY_SCALE = 0.15;

export interface LapseSeverityResult {
  /** Raw severity score (0 = first lapse, higher = more severe) */
  severity: number;
  /** Multiplier to apply to post-lapse difficulty increase (1.0–1.6) */
  difficultyMultiplier: number;
  /** Pre-lapse consecutive correct count */
  preLapseReps: number;
  /** Pre-lapse stability value */
  preLapseStability: number;
}

export function computeLapseSeverity(
  preLapseReps: number,
  preLapseStability: number,
  preLapseState: number
): LapseSeverityResult {
  // Only applies to cards in review state (state ≥ 2) with history
  if (preLapseState < 2 || preLapseReps < 1) {
    return {
      severity: 0,
      difficultyMultiplier: 1.0,
      preLapseReps,
      preLapseStability,
    };
  }

  const severity =
    Math.log2(1 + preLapseReps) * Math.log2(1 + Math.max(0, preLapseStability));

  const multiplier = Math.min(
    MAX_SEVERITY_MULTIPLIER,
    1 + SEVERITY_SCALE * severity
  );

  return {
    severity: Math.round(severity * 1000) / 1000,
    difficultyMultiplier: Math.round(multiplier * 1000) / 1000,
    preLapseReps,
    preLapseStability,
  };
}
```

**Integration point in `drillReviewService.ts`:**
Insert *after* `const { card: rawCard } = fsrs.next(...)` (line ~730) and *before* circadian modifier:

```typescript
// ── Lapse severity (Wave 1) ──
import { computeLapseSeverity } from './lapseSeverityService';

// After fsrs.next():
if (!isCorrect && currentCard.state >= 2) {
  const lapseSeverity = computeLapseSeverity(
    currentCard.reps,
    currentCard.stability,
    currentCard.state
  );
  // Amplify the difficulty increase for severe lapses
  if (lapseSeverity.difficultyMultiplier > 1.0) {
    const baseDiffIncrease = rawCard.difficulty - currentCard.difficulty;
    const amplifiedIncrease = baseDiffIncrease * lapseSeverity.difficultyMultiplier;
    rawCard.difficulty = currentCard.difficulty + amplifiedIncrease;
    rawCard.difficulty = Math.min(10, Math.max(1, rawCard.difficulty));
  }
  // Log to telemetry
  // Add to buildReviewLogTelemetry: lapse_severity, lapse_severity_multiplier
}
```

**Telemetry storage:** Add to `server_computed` in `buildReviewLogTelemetry()`:
- `lapse_severity: number`
- `lapse_severity_multiplier: number`
- `pre_lapse_reps: number`
- `pre_lapse_stability: number`

**Tests:** `lib/services/__tests__/lapseSeverityService.test.ts`
- Lapse at reps=0 → multiplier 1.0
- Lapse at reps=2, stability=5 → multiplier ~1.17
- Lapse at reps=8, stability=30 → multiplier ~1.45
- Lapse at reps=15, stability=100 → capped at 1.6
- State < 2 (learning/new) → multiplier 1.0

---

### 1B. RT Change Across Spaced Reviews (Implicit Delayed-JOL)

**What:** For each card with ≥ 2 spaced reviews, compare current RT to the most recent historical RT. Use the ratio to apply a modest stability modifier.

**New file:** `lib/services/rtTrajectoryService.ts`

```typescript
// ── lib/services/rtTrajectoryService.ts ──

/**
 * RT Trajectory Service — Implicit Delayed JOL
 *
 * Compares response time across spaced reviews of the same card.
 * Decreasing RT at increasing intervals = consolidation → stability bonus.
 * Increasing RT = decay despite correct answer → stability penalty.
 *
 * Research: Nelson & Dunlosky (1991) — delayed JOLs predict retention
 * better than immediate JOLs. RT change is the behavioral analog.
 */

export interface RtTrajectoryResult {
  /** Current RT / Previous RT (< 1 = faster, > 1 = slower) */
  rtChangeRatio: number | null;
  /** Stability multiplier: 0.90–1.10 */
  stabilityMultiplier: number;
  /** Previous RT used for comparison (ms) */
  previousRtMs: number | null;
  /** Current RT (ms) */
  currentRtMs: number;
  /** Whether enough history exists for comparison */
  hasHistory: boolean;
}

/** Minimum elapsed days for the comparison to be meaningful (avoid same-day) */
const MIN_ELAPSED_DAYS = 0.5;

/** Thresholds for stability adjustment */
const CONSOLIDATION_THRESHOLD = 0.8; // 20%+ faster → consolidating
const DECAY_THRESHOLD = 1.3;         // 30%+ slower → decaying
const MAX_BONUS = 1.10;              // 10% stability bonus
const MAX_PENALTY = 0.90;            // 10% stability penalty

export function computeRtTrajectory(
  currentRtMs: number,
  previousRtMs: number | null,
  elapsedDays: number
): RtTrajectoryResult {
  if (
    previousRtMs == null ||
    previousRtMs <= 0 ||
    currentRtMs <= 0 ||
    elapsedDays < MIN_ELAPSED_DAYS
  ) {
    return {
      rtChangeRatio: null,
      stabilityMultiplier: 1.0,
      previousRtMs,
      currentRtMs,
      hasHistory: false,
    };
  }

  const ratio = currentRtMs / previousRtMs;

  let multiplier = 1.0;
  if (ratio < CONSOLIDATION_THRESHOLD) {
    // Consolidating: scale linearly from 1.0 at threshold to MAX_BONUS at ratio=0.5
    const scale = (CONSOLIDATION_THRESHOLD - Math.max(ratio, 0.5)) /
                  (CONSOLIDATION_THRESHOLD - 0.5);
    multiplier = 1.0 + (MAX_BONUS - 1.0) * scale;
  } else if (ratio > DECAY_THRESHOLD) {
    // Decaying: scale linearly from 1.0 at threshold to MAX_PENALTY at ratio=2.0
    const scale = Math.min((ratio - DECAY_THRESHOLD) / (2.0 - DECAY_THRESHOLD), 1.0);
    multiplier = 1.0 - (1.0 - MAX_PENALTY) * scale;
  }

  return {
    rtChangeRatio: Math.round(ratio * 1000) / 1000,
    stabilityMultiplier: Math.round(multiplier * 1000) / 1000,
    previousRtMs,
    currentRtMs,
    hasHistory: true,
  };
}
```

**Integration point in `drillReviewService.ts`:**
Insert in the confidence pipeline block (after Bayesian accumulation, ~line 752), reading previous RT from `reviewHistory`:

```typescript
// ── RT trajectory (Wave 1) ──
import { computeRtTrajectory } from './rtTrajectoryService';

// Extract previous RT from most recent review in history
const lastReviewWithRT = reviewHistory
  .filter((r: any) => typeof r.responseTimeMs === 'number' && r.responseTimeMs > 0)
  .at(0); // newest first
const previousRtMs = lastReviewWithRT?.responseTimeMs ?? null;

const rtTrajectory = computeRtTrajectory(
  effectiveDurationMs,
  previousRtMs,
  currentCard.elapsed_days
);

// Apply after confidenceStabilityMultiplier (line ~779):
if (rtTrajectory.hasHistory && isCorrect) {
  modifiedStability *= rtTrajectory.stabilityMultiplier;
}
```

**Telemetry storage:** Add to `server_computed`:
- `rt_change_ratio: number | null`
- `rt_trajectory_multiplier: number`

**Tests:** `lib/services/__tests__/rtTrajectoryService.test.ts`
- No history → multiplier 1.0
- Same-day review (elapsed < 0.5) → multiplier 1.0 (skip)
- RT decreased 30% → multiplier ~1.07
- RT increased 50% → multiplier ~0.96
- RT stable → multiplier 1.0

---

### 1C. Within-Session Accuracy Slope (Confidence Modifier)

**What:** Use the `question_number` already in telemetry plus a new rolling accuracy tracker to detect whether the learner is fatiguing. Apply a confidence modifier when accuracy is declining.

**New file:** `lib/services/sessionAccuracySlopeService.ts`

```typescript
// ── lib/services/sessionAccuracySlopeService.ts ──

/**
 * Session Accuracy Slope Service
 *
 * Complements sessionFatigueService (which adjusts par time) by adjusting
 * confidence when observed accuracy trajectory shows decline.
 *
 * Uses an in-memory per-user-session rolling window. The drillReviewService
 * calls recordOutcome() for each review, then getConfidenceModifier() to
 * get the current session's accuracy-based confidence adjustment.
 *
 * Research: Sievertsen et al. (2016) — ~0.9% SD performance decline per hour.
 */

interface SessionWindow {
  outcomes: boolean[]; // circular buffer of recent outcomes (true = correct)
  pointer: number;
  userId: string;
  sessionStart: number; // timestamp
}

const WINDOW_SIZE = 10;
const DECLINE_THRESHOLD = -0.05; // slope below this → confidence penalty
const WARMUP_THRESHOLD = 0.05;   // slope above this → confidence bonus
const DECLINE_MULTIPLIER = 0.92;
const WARMUP_MULTIPLIER = 1.05;
const MIN_ITEMS_FOR_SLOPE = 6;   // need at least 6 items in window

// In-memory session cache (keyed by `${userId}_${sessionDate}`)
const sessionCache = new Map<string, SessionWindow>();

/** Clear stale sessions older than 4 hours */
function pruneCache(): void {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  for (const [key, session] of sessionCache) {
    if (session.sessionStart < cutoff) sessionCache.delete(key);
  }
}

export function recordOutcome(userId: string, isCorrect: boolean): void {
  const key = `${userId}_${new Date().toISOString().slice(0, 10)}`;

  if (!sessionCache.has(key)) {
    // Prune on new session creation
    if (sessionCache.size > 1000) pruneCache();
    sessionCache.set(key, {
      outcomes: [],
      pointer: 0,
      userId,
      sessionStart: Date.now(),
    });
  }

  const session = sessionCache.get(key)!;
  session.outcomes.push(isCorrect);
}

export interface AccuracySlopeResult {
  slope: number | null;
  confidenceMultiplier: number;
  windowSize: number;
  rollingAccuracy: number | null;
}

export function getConfidenceModifier(userId: string): AccuracySlopeResult {
  const key = `${userId}_${new Date().toISOString().slice(0, 10)}`;
  const session = sessionCache.get(key);

  if (!session || session.outcomes.length < MIN_ITEMS_FOR_SLOPE) {
    return { slope: null, confidenceMultiplier: 1.0, windowSize: 0, rollingAccuracy: null };
  }

  // Take last WINDOW_SIZE items
  const recent = session.outcomes.slice(-WINDOW_SIZE);
  const n = recent.length;

  // Simple linear regression: y = correctness (0/1), x = position (0..n-1)
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const y = recent[i] ? 1 : 0;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const rollingAccuracy = sumY / n;

  let multiplier = 1.0;
  if (slope < DECLINE_THRESHOLD) {
    multiplier = DECLINE_MULTIPLIER;
  } else if (slope > WARMUP_THRESHOLD) {
    multiplier = WARMUP_MULTIPLIER;
  }

  return {
    slope: Math.round(slope * 10000) / 10000,
    confidenceMultiplier: multiplier,
    windowSize: n,
    rollingAccuracy: Math.round(rollingAccuracy * 1000) / 1000,
  };
}

/** For testing */
export function clearSessionCache(): void {
  sessionCache.clear();
}
```

**Integration point in `drillReviewService.ts`:**
Two insertion points:

1. **Record outcome** (after correctness resolution, ~line 250):
```typescript
import { recordOutcome, getConfidenceModifier } from './sessionAccuracySlopeService';

// After isCorrect is determined:
recordOutcome(userId, isCorrect);
```

2. **Apply modifier** (in confidence pipeline, after fluency illusion dampener, ~line 776):
```typescript
// ── Session accuracy slope (Wave 1) ──
const accuracySlope = getConfidenceModifier(userId);
adjustedConfidence *= accuracySlope.confidenceMultiplier;
```

**Telemetry storage:** Add to `server_computed`:
- `session_accuracy_slope: number | null`
- `session_accuracy_multiplier: number`
- `session_rolling_accuracy: number | null`

**Tests:** `lib/services/__tests__/sessionAccuracySlopeService.test.ts`
- Fewer than 6 items → multiplier 1.0
- 10 items all correct → slope ~0, multiplier 1.0
- 10 items declining (first 7 correct, last 3 wrong) → slope negative → 0.92
- 10 items improving (first 3 wrong, last 7 correct) → slope positive → 1.05

---

### 1D. Inter-Review Interval Deviation

**What:** Compare `elapsed_days` vs `scheduled_days` for the card. Scale how much the review updates stability based on the information value of the observation.

**New file:** `lib/services/intervalDeviationService.ts`

```typescript
// ── lib/services/intervalDeviationService.ts ──

/**
 * Inter-Review Interval Deviation
 *
 * A correct answer at 95% retrievability is much less informative than one
 * at 50% retrievability. This service computes the information value of a
 * review based on how early/late it occurred relative to schedule.
 *
 * Research: Bayesian surprise — observations at extreme retrievability carry
 * less information (ceiling/floor effects). Mozer et al. (2009).
 */

export interface IntervalDeviationResult {
  /** actualDays / scheduledDays — <1 = early, >1 = late */
  deviationRatio: number | null;
  /** Multiplier for stability update magnitude (0.85–1.15) */
  informationMultiplier: number;
  /** Classification: 'early' | 'on_time' | 'late' | 'unknown' */
  classification: 'early' | 'on_time' | 'late' | 'unknown';
}

const EARLY_THRESHOLD = 0.5;      // Reviewed at >2× expected retrievability
const LATE_THRESHOLD = 1.5;       // Reviewed much later than scheduled
const ON_TIME_LOW = 0.7;
const ON_TIME_HIGH = 1.3;
const EARLY_MULTIPLIER = 0.85;    // Correct at high R = less informative
const LATE_CORRECT_MULTIPLIER = 1.15; // Correct at low R = very informative
const LATE_INCORRECT_MULTIPLIER = 1.0; // Incorrect at low R = expected, standard
const EARLY_INCORRECT_MULTIPLIER = 1.10; // Incorrect at high R = surprising interference

export function computeIntervalDeviation(
  elapsedDays: number,
  scheduledDays: number,
  isCorrect: boolean
): IntervalDeviationResult {
  // Need meaningful scheduled interval (skip new/learning cards)
  if (scheduledDays <= 0 || elapsedDays < 0) {
    return { deviationRatio: null, informationMultiplier: 1.0, classification: 'unknown' };
  }

  const ratio = elapsedDays / scheduledDays;

  let multiplier = 1.0;
  let classification: IntervalDeviationResult['classification'] = 'on_time';

  if (ratio < EARLY_THRESHOLD) {
    classification = 'early';
    multiplier = isCorrect ? EARLY_MULTIPLIER : EARLY_INCORRECT_MULTIPLIER;
  } else if (ratio < ON_TIME_LOW) {
    classification = 'early';
    // Interpolate between early multiplier and 1.0
    const t = (ratio - EARLY_THRESHOLD) / (ON_TIME_LOW - EARLY_THRESHOLD);
    multiplier = isCorrect
      ? EARLY_MULTIPLIER + t * (1.0 - EARLY_MULTIPLIER)
      : EARLY_INCORRECT_MULTIPLIER + t * (1.0 - EARLY_INCORRECT_MULTIPLIER);
  } else if (ratio > LATE_THRESHOLD) {
    classification = 'late';
    multiplier = isCorrect ? LATE_CORRECT_MULTIPLIER : LATE_INCORRECT_MULTIPLIER;
  } else if (ratio > ON_TIME_HIGH) {
    classification = 'late';
    // Interpolate between 1.0 and late multiplier
    const t = (ratio - ON_TIME_HIGH) / (LATE_THRESHOLD - ON_TIME_HIGH);
    multiplier = isCorrect
      ? 1.0 + t * (LATE_CORRECT_MULTIPLIER - 1.0)
      : 1.0;
  }

  return {
    deviationRatio: Math.round(ratio * 1000) / 1000,
    informationMultiplier: Math.round(multiplier * 1000) / 1000,
    classification,
  };
}
```

**Integration point in `drillReviewService.ts`:**
Insert *after* `confidenceStabilityMultiplier()` application (~line 779), *before* retrievability calibration:

```typescript
// ── Interval deviation (Wave 1) ──
import { computeIntervalDeviation } from './intervalDeviationService';

const intervalDev = computeIntervalDeviation(
  currentCard.elapsed_days,
  currentCard.scheduled_days,
  isCorrect
);
modifiedStability *= intervalDev.informationMultiplier;
```

**Telemetry storage:** Add to `server_computed`:
- `interval_deviation_ratio: number | null`
- `interval_deviation_multiplier: number`
- `interval_deviation_class: string`

**Tests:** `lib/services/__tests__/intervalDeviationService.test.ts`
- New card (scheduled=0) → multiplier 1.0
- On-time correct (ratio 1.0) → multiplier 1.0
- Very early correct (ratio 0.3) → multiplier 0.85
- Late correct (ratio 2.0) → multiplier 1.15
- Late incorrect (ratio 2.0) → multiplier 1.0 (expected failure)
- Early incorrect (ratio 0.3) → multiplier 1.10 (surprising)

---

### Wave 1 Modified Pipeline

After all Wave 1 additions, the confidence/stability pipeline becomes:

```
deriveContinuousRating() → grade + confidence
  ↓
recordOutcome()              — ✨ NEW: feed session accuracy tracker
  ↓
accumulateConfidence()       — Bayesian blend with card history
  ↓
getUserCalibration()         — Per-user Brier score dampener
  ↓
fluencyIllusionDampener()    — Same-day review discount
  ↓
accuracy slope modifier      — ✨ NEW: 0.92× decline / 1.05× warmup
  ↓
confidenceStabilityMultiplier() — Sigmoid → [0.72, 1.28]
  ↓
RT trajectory modifier       — ✨ NEW: 0.90–1.10× based on RT change
  ↓
lapse severity modifier      — ✨ NEW: amplify difficulty on severe lapses
  ↓
interval deviation modifier  — ✨ NEW: 0.85–1.15× based on early/late
  ↓
urgencyMultiplier            — EOR exam tightening
  ↓
getStabilityCorrectionFactor() — Predicted vs. actual calibration
  ↓
modifiedStability            — Final FSRS stability
```

---

## Wave 2 — Client Telemetry Enrichment

**Scope:** Features #2, #7
**Estimated effort:** 3–4 days
**Risk:** Low — additive telemetry fields; no changes to existing data contracts.
**No Prisma migration needed** (new fields go into existing `telemetry` JSON column).

---

### 2A. Distractor Interaction Chronometry

**What:** Log the full sequence of option interactions — which options were selected, in what order, and for how long — not just the final switch count.

**Client changes — `components/quiz/Tracker.tsx`:**

Currently `BehavioralTracker` calls `recordAnswerChange()` which increments a counter. Extend to log the full sequence:

```typescript
// Add to BehavioralTrackerState:
interface OptionInteraction {
  optionId: string;       // 'A', 'B', 'C', 'D'
  selectedAt: number;     // timestamp (performance.now relative)
  deselectedAt?: number;  // when user switched away
}

// Replace answer_change_count with:
optionInteractions: OptionInteraction[];
currentSelection: OptionInteraction | null;

// In recordAnswerChange(optionId):
//   1. Close previous selection (set deselectedAt)
//   2. Push new OptionInteraction { optionId, selectedAt: now }
//   3. Set as currentSelection
// In finalize():
//   Close currentSelection (deselectedAt = now)
//   Set answer_change_count = optionInteractions.length - 1 (backward compat)
```

**Extend `behavioralPayloadToTelemetryData()` in Tracker.tsx:**
```typescript
// Add to TelemetryData output:
option_interactions: payload.optionInteractions.map(i => ({
  option_id: i.optionId,
  selected_at_ms: Math.round(i.selectedAt),
  deselected_at_ms: i.deselectedAt ? Math.round(i.deselectedAt) : null,
  dwell_ms: i.deselectedAt ? Math.round(i.deselectedAt - i.selectedAt) : null,
})),
unique_options_considered: new Set(payload.optionInteractions.map(i => i.optionId)).size,
```

**Server-side processing — new file `lib/services/distractorChronometryService.ts`:**

```typescript
export interface DistractorChronometryResult {
  /** Count of distinct options the learner selected */
  uniqueOptionsConsidered: number;
  /** Was the correct answer ever selected then abandoned? */
  correctOptionAbandoned: boolean;
  /** Max dwell time on any single wrong option (ms) */
  longestDistractorDwellMs: number;
  /** Confidence modifier: 0.80–1.0 */
  confidenceMultiplier: number;
}

export function analyzeDistractorChronometry(
  interactions: Array<{ option_id: string; dwell_ms: number | null }>,
  correctOptionId: string,
  finalSelectedId: string
): DistractorChronometryResult {
  const uniqueOptions = new Set(interactions.map(i => i.option_id));
  const correctEverSelected = interactions.some(i => i.option_id === correctOptionId);
  const correctAbandoned = correctEverSelected && finalSelectedId !== correctOptionId;

  let longestDistractorDwell = 0;
  for (const i of interactions) {
    if (i.option_id !== correctOptionId && i.dwell_ms != null) {
      longestDistractorDwell = Math.max(longestDistractorDwell, i.dwell_ms);
    }
  }

  let multiplier = 1.0;
  // Correct answer was selected then abandoned — fragile knowledge
  if (correctAbandoned) multiplier *= 0.85;
  // Many options tried — high uncertainty
  if (uniqueOptions.size >= 3) multiplier *= 0.95;
  else if (uniqueOptions.size === 1) multiplier *= 1.0; // decisive

  return {
    uniqueOptionsConsidered: uniqueOptions.size,
    correctOptionAbandoned: correctAbandoned,
    longestDistractorDwellMs: longestDistractorDwell,
    confidenceMultiplier: Math.round(Math.max(0.75, multiplier) * 1000) / 1000,
  };
}
```

**Integration in drillReviewService.ts:**
After `deriveContinuousRating()`, if `telemetry.option_interactions` exists:

```typescript
const chronometry = analyzeDistractorChronometry(
  telemetry.option_interactions,
  correctAnswer,
  normalizedSelectedAnswer
);
implicitConfidence *= chronometry.confidenceMultiplier;
```

**Telemetry storage:** Store in `server_computed`:
- `unique_options_considered: number`
- `correct_option_abandoned: boolean`
- `longest_distractor_dwell_ms: number`
- `distractor_chronometry_multiplier: number`

Raw `option_interactions[]` stored in the top-level `telemetry` JSON (not `server_computed`).

---

### 2B. Answer-Switch Direction Tracking

**What:** Classify each answer switch by whether it was right→wrong, wrong→right, or wrong→wrong.

**Client changes — `components/quiz/Tracker.tsx`:**
The client cannot know correctness at switch time (correct answer not revealed yet). The client logs the *sequence of option IDs*; the server resolves correctness.

This is already achieved by Feature 2A's `option_interactions[]` — the switch direction analysis is purely server-side.

**New file:** `lib/services/switchDirectionService.ts`

```typescript
export interface SwitchDirectionResult {
  /** Beneficial switches: wrong → right */
  wrongToRight: number;
  /** Harmful switches: right → wrong */
  rightToWrong: number;
  /** Lateral confusion: wrong → wrong */
  wrongToWrong: number;
  /** Net switch value (positive = good metacognition) */
  netSwitchValue: number;
  /** Proportion of beneficial switches (0–1) */
  metacognitivePrecision: number | null;
  /** Confidence modifier based on switch quality */
  confidenceMultiplier: number;
}

export function analyzeSwitchDirections(
  interactions: Array<{ option_id: string }>,
  correctOptionId: string
): SwitchDirectionResult {
  if (interactions.length < 2) {
    return {
      wrongToRight: 0, rightToWrong: 0, wrongToWrong: 0,
      netSwitchValue: 0, metacognitivePrecision: null,
      confidenceMultiplier: 1.0,
    };
  }

  let wrongToRight = 0, rightToWrong = 0, wrongToWrong = 0;

  for (let i = 1; i < interactions.length; i++) {
    const prevCorrect = interactions[i - 1].option_id === correctOptionId;
    const currCorrect = interactions[i].option_id === correctOptionId;

    if (!prevCorrect && currCorrect) wrongToRight++;
    else if (prevCorrect && !currCorrect) rightToWrong++;
    else if (!prevCorrect && !currCorrect) wrongToWrong++;
    // right → right = no real switch (re-selected same correct option)
  }

  const totalSwitches = wrongToRight + rightToWrong + wrongToWrong;
  const netSwitchValue = wrongToRight - rightToWrong;
  const metacognitivePrecision = totalSwitches > 0
    ? wrongToRight / totalSwitches
    : null;

  let multiplier = 1.0;
  // Right → wrong is the strongest negative signal
  if (rightToWrong > 0) multiplier *= 0.90;
  // Multiple wrong → wrong = flailing
  if (wrongToWrong >= 2) multiplier *= 0.95;
  // Good metacognitive revision gets a small boost
  if (wrongToRight > 0 && rightToWrong === 0) multiplier *= 1.03;

  return {
    wrongToRight,
    rightToWrong,
    wrongToWrong,
    netSwitchValue,
    metacognitivePrecision: metacognitivePrecision != null
      ? Math.round(metacognitivePrecision * 1000) / 1000
      : null,
    confidenceMultiplier: Math.round(Math.max(0.80, multiplier) * 1000) / 1000,
  };
}
```

**Integration in drillReviewService.ts:**
Chain with distractor chronometry (same `option_interactions` data):

```typescript
const switchDirection = analyzeSwitchDirections(
  telemetry.option_interactions,
  correctAnswer
);
implicitConfidence *= switchDirection.confidenceMultiplier;
```

**Telemetry storage:** Add to `server_computed`:
- `switch_wrong_to_right: number`
- `switch_right_to_wrong: number`
- `switch_wrong_to_wrong: number`
- `switch_net_value: number`
- `switch_metacognitive_precision: number | null`
- `switch_direction_multiplier: number`

---

### Wave 2 Client-Side Summary

| File | Change | Backward Compatible |
|---|---|---|
| `components/quiz/Tracker.tsx` | Extend `BehavioralPayload` with `optionInteractions[]` | Yes — `answer_change_count` still computed |
| `types/telemetry.ts` | Add `option_interactions` to `TelemetryData` | Yes — optional field |
| `lib/services/distractorChronometryService.ts` | New file | N/A |
| `lib/services/switchDirectionService.ts` | New file | N/A |
| `lib/services/drillReviewService.ts` | Add 2 multiplier applications | Yes — only activates when `option_interactions` present |

---

## Wave 3 — Post-Answer Engagement + DB Extensions

**Scope:** Features #3, #5, #6, #10
**Estimated effort:** 5–7 days
**Risk:** Medium — #10 requires a Prisma migration (new fields on `ConfusionPair`); #3 and #6 require new client-side instrumentation in `ExplanationPanel`.
**Prisma migration needed for #10.**

---

### 3A. Explanation Engagement Depth

**What:** After answer submission, measure how deeply the learner engages with the explanation panel — dwell time, scroll depth, expanded sections.

**Client changes — `components/session/QuizView.tsx` (ExplanationPanel area):**

Add a new lightweight tracker inside the explanation panel:

```typescript
// New hook: hooks/useExplanationEngagement.ts
export interface ExplanationEngagement {
  viewedMs: number;              // time from reveal to next-question click
  scrollDepth: number;           // 0.0–1.0 (fraction scrolled)
  expandedSections: number;      // count of "Why not X?" sections clicked
  wasCorrect: boolean;           // context: after correct or incorrect answer
}

export function useExplanationEngagement() {
  const startRef = useRef<number | null>(null);
  const scrollRef = useRef(0);
  const sectionsRef = useRef(0);

  const startTracking = useCallback(() => {
    startRef.current = performance.now();
    scrollRef.current = 0;
    sectionsRef.current = 0;
  }, []);

  const recordScroll = useCallback((depth: number) => {
    scrollRef.current = Math.max(scrollRef.current, depth);
  }, []);

  const recordExpand = useCallback(() => {
    sectionsRef.current++;
  }, []);

  const finalize = useCallback((wasCorrect: boolean): ExplanationEngagement => ({
    viewedMs: startRef.current ? Math.round(performance.now() - startRef.current) : 0,
    scrollDepth: scrollRef.current,
    expandedSections: sectionsRef.current,
    wasCorrect,
  }), []);

  return { startTracking, recordScroll, recordExpand, finalize };
}
```

**Extend telemetry payload:**
```typescript
// In TelemetryData:
explanation_engagement?: {
  viewed_ms: number;
  scroll_depth: number;
  expanded_sections: number;
  was_correct: boolean;
};
```

**Server-side — new file `lib/services/explanationEngagementService.ts`:**

```typescript
export interface ExplanationEngagementResult {
  engagementScore: number;          // 0.0–1.0
  confidenceModifier: number;       // Modifier for post-error learning
  stabilityModifier: number;        // Modest bonus for deep error engagement
}

export function analyzeExplanationEngagement(
  viewedMs: number,
  scrollDepth: number,
  expandedSections: number,
  wasCorrect: boolean
): ExplanationEngagementResult {
  // Engagement score: log-scaled dwell × scroll depth
  const dwellSignal = Math.min(1, Math.log(1 + viewedMs / 5000));
  const engagementScore = dwellSignal * Math.max(scrollDepth, 0.3 + expandedSections * 0.15);

  let confidenceModifier = 1.0;
  let stabilityModifier = 1.0;

  if (!wasCorrect) {
    // After errors: deep engagement = better error correction
    if (engagementScore > 0.6) {
      // Reward: reduce the stability penalty slightly (better relearning)
      stabilityModifier = 1.08; // 8% bonus — card was lapsed but learner studied rationale
    } else if (engagementScore < 0.2 && viewedMs > 1000) {
      // Minimal engagement with explanation after error — didn't learn from mistake
      stabilityModifier = 0.95; // Small additional penalty
    }
  } else {
    // After correct: long dwell suggests surprise (lucky guess?)
    if (viewedMs > 15000 && scrollDepth > 0.5) {
      confidenceModifier = 0.95; // Modest confidence reduction — they weren't sure
    }
  }

  return {
    engagementScore: Math.round(engagementScore * 1000) / 1000,
    confidenceModifier: Math.round(confidenceModifier * 1000) / 1000,
    stabilityModifier: Math.round(stabilityModifier * 1000) / 1000,
  };
}
```

**Integration:** Apply `confidenceModifier` in confidence pipeline; apply `stabilityModifier` directly to `modifiedStability`.

---

### 3B. Session Regularity Score

**What:** Compute a per-user habit consistency metric from recent session history; use as a telemetry quality trust modifier.

**New file:** `lib/services/sessionRegularityService.ts`

```typescript
export interface SessionRegularityResult {
  /** Coefficient of variation of inter-session intervals (lower = more regular) */
  intervalCV: number | null;
  /** Consecutive days with ≥ 1 review session */
  streakDays: number;
  /** Telemetry trust multiplier: 0.95–1.0 */
  telemetryTrustMultiplier: number;
  /** Classification */
  regularity: 'regular' | 'moderate' | 'erratic' | 'insufficient_data';
}

export async function computeSessionRegularity(
  prisma: any,
  userId: string,
  lookbackDays: number = 14
): Promise<SessionRegularityResult> {
  const cutoff = new Date(Date.now() - lookbackDays * 86400000);

  const sessions = await prisma.reviewLog.findMany({
    where: { userId, reviewedAt: { gte: cutoff }, review_type: 'real' },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: 'asc' },
  });

  // Group by calendar date
  const sessionDates = [...new Set(
    sessions.map((s: any) => s.reviewedAt.toISOString().slice(0, 10))
  )].sort();

  if (sessionDates.length < 3) {
    return {
      intervalCV: null, streakDays: sessionDates.length,
      telemetryTrustMultiplier: 1.0, regularity: 'insufficient_data',
    };
  }

  // Compute inter-session intervals in days
  const intervals: number[] = [];
  for (let i = 1; i < sessionDates.length; i++) {
    const diff = (new Date(sessionDates[i]).getTime() - new Date(sessionDates[i - 1]).getTime()) / 86400000;
    intervals.push(diff);
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const stdDev = Math.sqrt(
    intervals.reduce((sum, x) => sum + (x - mean) ** 2, 0) / intervals.length
  );
  const cv = mean > 0 ? stdDev / mean : 0;

  // Compute current streak
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (let i = sessionDates.length - 1; i >= 0; i--) {
    const expected = new Date(Date.now() - streak * 86400000).toISOString().slice(0, 10);
    if (sessionDates[i] === expected) streak++;
    else break;
  }

  let regularity: SessionRegularityResult['regularity'];
  let multiplier = 1.0;
  if (cv < 0.3) { regularity = 'regular'; multiplier = 1.0; }
  else if (cv < 0.8) { regularity = 'moderate'; multiplier = 1.0; }
  else { regularity = 'erratic'; multiplier = 0.95; }

  return {
    intervalCV: Math.round(cv * 1000) / 1000,
    streakDays: streak,
    telemetryTrustMultiplier: multiplier,
    regularity,
  };
}
```

**Integration:** Call once per session (cache for 24h). Apply `telemetryTrustMultiplier` to `adjustedConfidence` in the pipeline. Since this is a session-level metric, avoid calling it on every review — use a cached value via a pattern similar to `getUserCalibration()`.

---

### 3C. Relearning Speed (Savings Score)

**What:** When a card re-enters learning after a lapse, compare relearning RT to original learning RT for residual memory detection.

**New file:** `lib/services/relearningSpeedService.ts`

```typescript
export interface RelearningSpeedResult {
  /** 1 - (relearningRT / originalRT). Positive = savings exist. */
  savingsRatio: number | null;
  /** Stability bonus for post-lapse card (1.0–1.25) */
  postLapseStabilityBonus: number;
  /** Whether savings could be computed */
  hasSavings: boolean;
}

export function computeRelearningSpeed(
  currentRtMs: number,
  originalLearningRtMs: number | null,
  cardLapses: number
): RelearningSpeedResult {
  // Only applies to relapsed cards with original learning data
  if (originalLearningRtMs == null || originalLearningRtMs <= 0 || cardLapses < 1) {
    return { savingsRatio: null, postLapseStabilityBonus: 1.0, hasSavings: false };
  }

  const savings = 1 - (currentRtMs / originalLearningRtMs);

  // Positive savings = residual memory → faster recovery
  let bonus = 1.0;
  if (savings > 0.3) {
    bonus = 1.0 + Math.min(savings, 0.5) * 0.5; // Max 1.25
  }

  return {
    savingsRatio: Math.round(savings * 1000) / 1000,
    postLapseStabilityBonus: Math.round(bonus * 1000) / 1000,
    hasSavings: true,
  };
}
```

**Data source:** The original learning RT must be retrieved from `ReviewLog` — query the first-ever review for this `(userId, conditionId)` pair.

**Integration:** Apply `postLapseStabilityBonus` to `modifiedStability` only when `!isCorrect` and the card is re-entering learning (state transitions from ≥2 to 1).

---

### 3D. Confusion Pair Recurrence Rate

**What:** Track repeated confusion between the same pair of conditions and escalate when count crosses thresholds.

**Prisma migration needed:** The `ConfusionPair` model already exists with `count`, `lastOccurrence`, `correctConditionId`, and `selectedConditionId`. No new columns needed — only populate the existing fields that are currently nullable/unused.

**New file:** `lib/services/confusionPairRecurrenceService.ts`

```typescript
export interface ConfusionPairAction {
  /** How many times this exact pair has been confused */
  pairCount: number;
  /** Whether this triggers escalation */
  escalate: boolean;
  /** Difficulty boost to apply to both conditions */
  difficultyBoost: number;
  /** Whether to queue a contrastive drill */
  queueContrastiveDrill: boolean;
  /** Whether to generate a Gemini differentiation explanation */
  generateDifferentiation: boolean;
}

const ESCALATION_THRESHOLD_MILD = 3;
const ESCALATION_THRESHOLD_SEVERE = 5;
const MILD_DIFFICULTY_BOOST = 0.5;
const SEVERE_DIFFICULTY_BOOST = 1.0;

export async function recordAndAnalyzeConfusion(
  prisma: any,
  userId: string,
  correctConditionId: string,
  selectedConditionId: string
): Promise<ConfusionPairAction> {
  // Skip if same condition (not a confusion — just wrong answer on same topic)
  if (correctConditionId === selectedConditionId || !selectedConditionId) {
    return {
      pairCount: 0, escalate: false, difficultyBoost: 0,
      queueContrastiveDrill: false, generateDifferentiation: false,
    };
  }

  // Upsert the confusion pair (bidirectional — normalize order)
  const [condA, condB] = [correctConditionId, selectedConditionId].sort();
  const existing = await prisma.confusionPair.findFirst({
    where: {
      userId,
      OR: [
        { correctConditionId: condA, selectedConditionId: condB },
        { correctConditionId: condB, selectedConditionId: condA },
      ],
    },
  });

  let pairCount: number;
  if (existing) {
    await prisma.confusionPair.update({
      where: { id: existing.id },
      data: { count: { increment: 1 }, lastOccurrence: new Date() },
    });
    pairCount = existing.count + 1;
  } else {
    await prisma.confusionPair.create({
      data: {
        userId,
        realCondition: correctConditionId,
        mistakenFor: selectedConditionId,
        correctConditionId,
        selectedConditionId,
        count: 1,
        lastOccurrence: new Date(),
      },
    });
    pairCount = 1;
  }

  return {
    pairCount,
    escalate: pairCount >= ESCALATION_THRESHOLD_MILD,
    difficultyBoost: pairCount >= ESCALATION_THRESHOLD_SEVERE
      ? SEVERE_DIFFICULTY_BOOST
      : pairCount >= ESCALATION_THRESHOLD_MILD
        ? MILD_DIFFICULTY_BOOST
        : 0,
    queueContrastiveDrill: pairCount >= ESCALATION_THRESHOLD_MILD,
    generateDifferentiation: pairCount >= ESCALATION_THRESHOLD_SEVERE,
  };
}
```

**Integration in `drillReviewService.ts`:**
After incorrect answer processing, when `selectedMeta?.conditionId` differs from `question.conditionId`:

```typescript
// ── Confusion pair tracking (Wave 3) ──
if (!isCorrect && question.conditionId && selectedMeta?.conditionId) {
  try {
    const confusionAction = await recordAndAnalyzeConfusion(
      prisma, userId, question.conditionId, selectedMeta.conditionId
    );
    if (confusionAction.difficultyBoost > 0) {
      // Apply difficulty boost to the current card
      rawCard.difficulty = Math.min(10,
        rawCard.difficulty + confusionAction.difficultyBoost
      );
    }
    // Log action for study nudge system
    // confusionAction.queueContrastiveDrill → push to useStudyNudges
  } catch (confErr) {
    logger?.warn?.('Confusion pair tracking failed (non-fatal)', { ... });
  }
}
```

---

## Wave 3 Prisma Migration

Only Feature #10 touches the DB schema, but the `ConfusionPair` model already exists with all needed fields. The only change is ensuring the `correctConditionId` and `selectedConditionId` foreign keys are populated (they're currently nullable). If any index is missing:

```sql
-- Optional: Add index for efficient pair lookups
CREATE INDEX IF NOT EXISTS "ConfusionPair_userId_correctConditionId_selectedConditionId_idx"
ON "ConfusionPair" ("userId", "correctConditionId", "selectedConditionId");
```

---

## Testing Strategy (All Waves)

| Wave | Test Type | Files | Coverage Target |
|---|---|---|---|
| 1 | Unit tests | `lapseSeverityService.test.ts`, `rtTrajectoryService.test.ts`, `sessionAccuracySlopeService.test.ts`, `intervalDeviationService.test.ts` | 100% branch on pure functions |
| 2 | Unit + integration | `distractorChronometryService.test.ts`, `switchDirectionService.test.ts`, + update `Tracker.test.tsx` | 100% branch on services; smoke test client payload shape |
| 3 | Unit + DB integration | `explanationEngagementService.test.ts`, `sessionRegularityService.test.ts`, `relearningSpeedService.test.ts`, `confusionPairRecurrenceService.test.ts` | 100% branch on pure; DB integration for confusion pair upsert |
| All | Regression | Existing `drillReviewService.test.ts` | Ensure no existing tests break; all new multipliers default to 1.0 when data is absent |

**Critical invariant:** Every new service returns a neutral multiplier (1.0) when its input data is missing/insufficient. This ensures the pipeline degrades gracefully and no existing behavior changes for reviews without the new telemetry.

---

## Rollout Plan

| Phase | Wave | Timeline | Feature Flag | Monitoring |
|---|---|---|---|---|
| 1 | Wave 1 (server-only) | Days 1–3 | `WAVE1_BEHAVIORAL_SIGNALS=true` | Log all new `server_computed` fields; compare `modifiedStability` with/without new modifiers for 48h |
| 2 | Wave 2 (client telemetry) | Days 4–7 | `WAVE2_OPTION_INTERACTIONS=true` | Verify `option_interactions` payload arrives; monitor telemetry size increase |
| 3 | Wave 3 (post-answer + DB) | Days 8–14 | `WAVE3_ENGAGEMENT=true` | Monitor confusion pair table growth; validate explanation engagement dwell times |
| 4 | Validation | Days 15–17 | — | Run `scripts/validate-confidence-pipeline.ts` (Sprint 6); compare Brier scores pre/post; ensure stability multiplier correlation improves |

**Kill switch:** Each wave's multipliers can be disabled by setting the feature flag to false, which makes all new services return 1.0 multipliers. No data is lost — telemetry continues to be logged regardless of whether multipliers are active.

---

## File Summary

### New Files (10)

| File | Wave | Type |
|---|---|---|
| `lib/services/lapseSeverityService.ts` | 1 | Pure function |
| `lib/services/rtTrajectoryService.ts` | 1 | Pure function |
| `lib/services/sessionAccuracySlopeService.ts` | 1 | In-memory cache |
| `lib/services/intervalDeviationService.ts` | 1 | Pure function |
| `lib/services/distractorChronometryService.ts` | 2 | Pure function |
| `lib/services/switchDirectionService.ts` | 2 | Pure function |
| `lib/services/explanationEngagementService.ts` | 3 | Pure function |
| `lib/services/sessionRegularityService.ts` | 3 | DB query + cache |
| `lib/services/relearningSpeedService.ts` | 3 | Pure function |
| `lib/services/confusionPairRecurrenceService.ts` | 3 | DB query + upsert |

### Modified Files (4)

| File | Wave | Change |
|---|---|---|
| `lib/services/drillReviewService.ts` | 1, 2, 3 | Import + call new services in confidence pipeline |
| `components/quiz/Tracker.tsx` | 2 | Extend BehavioralPayload with `optionInteractions[]` |
| `types/telemetry.ts` | 2, 3 | Add `option_interactions`, `explanation_engagement` to `TelemetryData` |
| `components/session/QuizView.tsx` | 3 | Add `useExplanationEngagement` hook to ExplanationPanel |

### New Test Files (10)

One `.test.ts` per new service, plus updates to existing tracker and drillReviewService tests.
