/**
 * Chronotype Scheduling Service — Tier 3 Experimental Feature
 *
 * Extends PANaCEa's existing circadian system (lib/circadian.ts) with:
 *
 *   1. rMEQ scoring: The reduced Morningness-Eveningness Questionnaire
 *      (5 items, validated against actigraphy, Cronbach's α > 0.80).
 *      Classifies users into morning/intermediate/evening chronotypes.
 *
 *   2. Passive chronotype inference: Analyzes timestamped review
 *      performance (accuracy × response time by hour) to infer peak
 *      cognitive windows from 2–4 weeks of accumulated data.
 *
 *   3. Priority queue sorting: Sorts daily review queues so
 *      high-difficulty cards appear during estimated peak windows
 *      and easier cards during off-peak times. Operates WITHIN
 *      daily queues — does NOT modify FSRS parameters.
 *
 * Research basis:
 *   - Horne & Östberg (1976): MEQ gold standard for chronotype
 *   - rMEQ: 5-item reduced version, practical for in-app use
 *   - 70–80% intermediate chronotype; pure types ~10–15% each
 *   - Medical students (22–30) tend toward evening chronotype
 *   - Synchrony effect: ~45% of young-adult studies find memory benefit
 *   - Italian study (N=104,552 exams): passing rates peak 11 AM–1 PM
 *   - Practical value: "nice-to-have comfort feature" per tier3.md
 *
 * Privacy note:
 *   Chronotype/sleep data may be health data under GDPR Article 9.
 *   The rMEQ approach minimizes sensitivity vs. continuous monitoring.
 *   Consent should be obtained before collecting circadian preferences.
 *
 * @module lib/services/chronotypeSchedulingService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Chronotype = 'definite_morning' | 'moderate_morning' | 'intermediate' | 'moderate_evening' | 'definite_evening';

/** Simplified 3-tier classification for scheduling decisions */
export type ChronotypeCategory = 'morning' | 'intermediate' | 'evening';

/** A single rMEQ question response (1-indexed scores per original questionnaire) */
export interface RmeqResponse {
  /** Q1: What time would you get up if entirely free to plan your day? */
  q1: 1 | 2 | 3 | 4 | 5;
  /** Q2: During the first half hour after waking, how tired do you feel? */
  q2: 1 | 2 | 3 | 4;
  /** Q3: At approximately what time in the evening do you feel tired? */
  q3: 1 | 2 | 3 | 4 | 5;
  /** Q4: At what time of day do you feel your best? */
  q4: 1 | 2 | 3 | 4 | 5;
  /** Q5: Which type do you consider yourself to be? */
  q5: 0 | 2 | 4 | 6;
}

/** rMEQ scoring result */
export interface RmeqResult {
  /** Raw score (4–25 scale) */
  totalScore: number;
  /** 5-tier classification */
  chronotype: Chronotype;
  /** Simplified 3-tier for scheduling */
  category: ChronotypeCategory;
  /** Estimated peak cognitive window (hours, 24h format) */
  peakWindow: { start: number; end: number };
  /** Estimated off-peak window */
  offPeakWindow: { start: number; end: number };
}

/** Timestamped performance data point for passive inference */
export interface HourlyPerformancePoint {
  /** Hour of day (0–23) */
  hour: number;
  /** Average accuracy for reviews in this hour [0, 1] */
  accuracy: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
  /** Number of reviews in this hour (weight for averaging) */
  reviewCount: number;
}

/** Passive chronotype inference result */
export interface PassiveInferenceResult {
  /** Inferred chronotype category */
  inferredCategory: ChronotypeCategory;
  /** Confidence in inference [0, 1] */
  confidence: number;
  /** Peak performance hour (0–23) */
  peakHour: number;
  /** Trough performance hour (0–23) */
  troughHour: number;
  /** Total reviews analyzed */
  totalReviews: number;
  /** Whether enough data exists for reliable inference */
  isReliable: boolean;
  /** Performance-weighted score by hour [0–23] → score */
  hourlyScores: number[];
}

/** Card with difficulty metadata for queue sorting */
export interface QueueCard {
  /** Card identifier */
  cardId: string;
  /** FSRS difficulty (1–10) */
  difficulty: number;
  /** FSRS stability in days */
  stability: number;
  /** Whether card is overdue */
  isOverdue: boolean;
}

/** Queue sorting result */
export interface SortedQueueResult {
  /** Reordered card IDs */
  cardIds: string[];
  /** Whether chronotype-based sorting was applied */
  chronotypeSortApplied: boolean;
  /** Explanation of sorting strategy */
  strategy: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** rMEQ score boundaries (Adan & Almirall, 1991) */
export const RMEQ_BOUNDARIES = {
  definite_evening: { min: 4, max: 7 },
  moderate_evening: { min: 8, max: 11 },
  intermediate: { min: 12, max: 17 },
  moderate_morning: { min: 18, max: 21 },
  definite_morning: { min: 22, max: 25 },
} as const;

/** Peak cognitive windows by chronotype (approximate, in 24h format) */
export const CHRONOTYPE_PEAK_WINDOWS: Record<ChronotypeCategory, { start: number; end: number }> = {
  morning: { start: 8, end: 12 },
  intermediate: { start: 10, end: 14 },
  evening: { start: 14, end: 20 },
};

/** Off-peak windows by chronotype */
export const CHRONOTYPE_OFFPEAK_WINDOWS: Record<ChronotypeCategory, { start: number; end: number }> = {
  morning: { start: 20, end: 23 },
  intermediate: { start: 22, end: 6 },
  evening: { start: 6, end: 10 },
};

/** Minimum reviews needed for reliable passive inference */
export const MIN_REVIEWS_FOR_INFERENCE = 100;

/** Minimum hours with data for reliable inference */
export const MIN_HOURS_WITH_DATA = 6;

/** Difficulty threshold: cards above this get priority during peak */
export const HIGH_DIFFICULTY_THRESHOLD = 6;

// ─── rMEQ Scoring ──────────────────────────────────────────────────────────

/**
 * Score the reduced Morningness-Eveningness Questionnaire (rMEQ).
 *
 * The rMEQ uses 5 items from the full 19-item MEQ. Total score
 * ranges from 4 to 25 (Q5 scoring: definitely evening=0, definitely
 * morning=6, with intermediate values of 2 and 4).
 *
 * Validated by Adan & Almirall (1991), test-retest r=0.89.
 *
 * @param responses - The 5 rMEQ item responses
 * @returns Scoring result with chronotype classification
 */
export function scoreRmeq(responses: RmeqResponse): RmeqResult {
  const totalScore = responses.q1 + responses.q2 + responses.q3 + responses.q4 + responses.q5;

  const chronotype = classifyRmeqScore(totalScore);
  const category = chronotypeToCategory(chronotype);
  const peakWindow = CHRONOTYPE_PEAK_WINDOWS[category];
  const offPeakWindow = CHRONOTYPE_OFFPEAK_WINDOWS[category];

  return {
    totalScore,
    chronotype,
    category,
    peakWindow,
    offPeakWindow,
  };
}

/**
 * Classify raw rMEQ score into 5-tier chronotype.
 */
export function classifyRmeqScore(score: number): Chronotype {
  if (score <= RMEQ_BOUNDARIES.definite_evening.max) return 'definite_evening';
  if (score <= RMEQ_BOUNDARIES.moderate_evening.max) return 'moderate_evening';
  if (score <= RMEQ_BOUNDARIES.intermediate.max) return 'intermediate';
  if (score <= RMEQ_BOUNDARIES.moderate_morning.max) return 'moderate_morning';
  return 'definite_morning';
}

/**
 * Simplify 5-tier chronotype to 3-tier category for scheduling.
 */
export function chronotypeToCategory(chronotype: Chronotype): ChronotypeCategory {
  switch (chronotype) {
    case 'definite_morning':
    case 'moderate_morning':
      return 'morning';
    case 'definite_evening':
    case 'moderate_evening':
      return 'evening';
    default:
      return 'intermediate';
  }
}

// ─── Passive Chronotype Inference ───────────────────────────────────────────

/**
 * Infer chronotype from accumulated timestamped performance data.
 *
 * Computes a performance score for each hour of the day:
 *   score(h) = accuracy(h) × (medianRT / avgRT(h))
 *
 * Higher accuracy + faster response time = higher score.
 * The hour with the highest weighted score is the inferred peak.
 *
 * Requires ≥100 total reviews across ≥6 distinct hours for reliability.
 *
 * @param hourlyData - Performance data grouped by hour of day
 * @returns Inference result with confidence and peak/trough hours
 */
export function inferChronotypeFromPerformance(
  hourlyData: HourlyPerformancePoint[]
): PassiveInferenceResult {
  const totalReviews = hourlyData.reduce((sum, d) => sum + d.reviewCount, 0);
  const hoursWithData = hourlyData.filter(d => d.reviewCount >= 3).length;
  const isReliable = totalReviews >= MIN_REVIEWS_FOR_INFERENCE && hoursWithData >= MIN_HOURS_WITH_DATA;

  // Initialize 24-hour score array
  const hourlyScores = new Array(24).fill(0);

  if (hourlyData.length === 0) {
    return {
      inferredCategory: 'intermediate',
      confidence: 0,
      peakHour: 10,
      troughHour: 15,
      totalReviews: 0,
      isReliable: false,
      hourlyScores,
    };
  }

  // Compute median response time as baseline
  const allRts = hourlyData
    .filter(d => d.reviewCount >= 3)
    .map(d => d.avgResponseTimeMs);

  if (allRts.length === 0) {
    return {
      inferredCategory: 'intermediate',
      confidence: 0,
      peakHour: 10,
      troughHour: 15,
      totalReviews,
      isReliable: false,
      hourlyScores,
    };
  }

  const sortedRts = [...allRts].sort((a, b) => a - b);
  const medianRT = sortedRts[Math.floor(sortedRts.length / 2)]!;

  // Compute performance score per hour
  for (const dataPoint of hourlyData) {
    if (dataPoint.reviewCount < 3) continue;
    // score = accuracy × (medianRT / avgRT)
    // Faster + more accurate = higher score
    const rtRatio = dataPoint.avgResponseTimeMs > 0
      ? medianRT / dataPoint.avgResponseTimeMs
      : 1;
    hourlyScores[dataPoint.hour] = dataPoint.accuracy * rtRatio;
  }

  // Find peak and trough hours (only among hours with data)
  let peakHour = 10;
  let troughHour = 15;
  let maxScore = -1;
  let minScore = Infinity;

  for (const dataPoint of hourlyData) {
    if (dataPoint.reviewCount < 3) continue;
    const score = hourlyScores[dataPoint.hour]!;
    if (score > maxScore) {
      maxScore = score;
      peakHour = dataPoint.hour;
    }
    if (score < minScore) {
      minScore = score;
      troughHour = dataPoint.hour;
    }
  }

  // Infer category from peak hour
  const inferredCategory = inferCategoryFromPeakHour(peakHour);

  // Confidence based on data volume and score spread
  const scoreRange = maxScore > 0 ? (maxScore - minScore) / maxScore : 0;
  const dataConfidence = Math.min(1, totalReviews / (MIN_REVIEWS_FOR_INFERENCE * 3));
  const spreadConfidence = Math.min(1, scoreRange * 2);
  const confidence = isReliable
    ? Math.min(1, dataConfidence * 0.5 + spreadConfidence * 0.5)
    : Math.min(0.3, dataConfidence * 0.3);

  return {
    inferredCategory,
    confidence,
    peakHour,
    troughHour,
    totalReviews,
    isReliable,
    hourlyScores,
  };
}

/**
 * Infer chronotype category from the peak performance hour.
 */
export function inferCategoryFromPeakHour(peakHour: number): ChronotypeCategory {
  // Morning: peak before noon
  if (peakHour >= 6 && peakHour < 12) return 'morning';
  // Intermediate: peak around midday
  if (peakHour >= 12 && peakHour < 16) return 'intermediate';
  // Evening: peak in afternoon/evening
  if (peakHour >= 16 && peakHour < 24) return 'evening';
  // Very early morning (0–5) — likely evening type studying late
  return 'evening';
}

// ─── Priority Queue Sorting ─────────────────────────────────────────────────

/**
 * Sort a daily review queue by chronotype-aware priority.
 *
 * Strategy per tier3.md: present high-difficulty cards during
 * estimated peak cognitive windows and easier cards during
 * off-peak times. Does NOT modify FSRS parameters.
 *
 * Priority rules:
 *   1. Overdue cards always come first (regardless of chronotype)
 *   2. During peak window: high-difficulty cards before low-difficulty
 *   3. During off-peak: low-difficulty cards before high-difficulty
 *   4. During neutral: standard order (overdue → difficulty desc)
 *
 * @param cards - Daily review queue with difficulty metadata
 * @param currentHour - Current hour of day (0–23)
 * @param category - User's chronotype category
 * @returns Sorted card IDs with strategy explanation
 */
export function sortQueueByChronotype(
  cards: QueueCard[],
  currentHour: number,
  category: ChronotypeCategory
): SortedQueueResult {
  if (cards.length === 0) {
    return { cardIds: [], chronotypeSortApplied: false, strategy: 'Empty queue' };
  }

  const peakWindow = CHRONOTYPE_PEAK_WINDOWS[category];
  const isInPeak = isHourInWindow(currentHour, peakWindow.start, peakWindow.end);
  const offPeakWindow = CHRONOTYPE_OFFPEAK_WINDOWS[category];
  const isInOffPeak = isHourInWindow(currentHour, offPeakWindow.start, offPeakWindow.end);

  // Clone to avoid mutating input
  const sorted = [...cards];

  // Always: overdue first, then sort by difficulty based on time-of-day
  sorted.sort((a, b) => {
    // Overdue cards always come first
    if (a.isOverdue !== b.isOverdue) {
      return a.isOverdue ? -1 : 1;
    }

    if (isInPeak) {
      // Peak: high difficulty first (tackle hard stuff when sharp)
      return b.difficulty - a.difficulty;
    }

    if (isInOffPeak) {
      // Off-peak: low difficulty first (save cognitive resources)
      return a.difficulty - b.difficulty;
    }

    // Neutral: standard difficulty-descending order
    return b.difficulty - a.difficulty;
  });

  const timeZone = isInPeak ? 'peak' : isInOffPeak ? 'off-peak' : 'neutral';
  const strategy = isInPeak
    ? `Peak window (${category} type, ${peakWindow.start}:00–${peakWindow.end}:00): high-difficulty cards prioritized`
    : isInOffPeak
    ? `Off-peak window (${category} type): easier cards first to conserve cognitive resources`
    : `Neutral window: standard difficulty-based ordering`;

  return {
    cardIds: sorted.map(c => c.cardId),
    chronotypeSortApplied: isInPeak || isInOffPeak,
    strategy,
  };
}

/**
 * Check if a given hour falls within a time window.
 * Handles windows that cross midnight (e.g., 22:00–06:00).
 */
export function isHourInWindow(hour: number, start: number, end: number): boolean {
  if (start <= end) {
    // Normal window (e.g., 8–12)
    return hour >= start && hour < end;
  }
  // Window crosses midnight (e.g., 22–6)
  return hour >= start || hour < end;
}

// ─── Combined Scheduling Recommendation ─────────────────────────────────────

/**
 * Get a scheduling recommendation combining rMEQ and passive inference.
 *
 * If both rMEQ and passive data exist, prefer rMEQ (validated instrument)
 * unless passive inference has high confidence AND disagrees, in which
 * case note the discrepancy.
 *
 * @param rmeqResult - Optional rMEQ questionnaire result
 * @param passiveResult - Optional passive inference result
 * @returns Best-available chronotype category and confidence
 */
export function getSchedulingRecommendation(
  rmeqResult?: RmeqResult,
  passiveResult?: PassiveInferenceResult
): {
  category: ChronotypeCategory;
  confidence: number;
  source: 'rmeq' | 'passive' | 'combined' | 'default';
  discrepancy: boolean;
  message: string;
} {
  // Neither available → default to intermediate
  if (!rmeqResult && !passiveResult) {
    return {
      category: 'intermediate',
      confidence: 0,
      source: 'default',
      discrepancy: false,
      message: 'No chronotype data available. Using default intermediate scheduling.',
    };
  }

  // Only rMEQ
  if (rmeqResult && !passiveResult) {
    return {
      category: rmeqResult.category,
      confidence: 0.8, // Validated instrument
      source: 'rmeq',
      discrepancy: false,
      message: `Scheduling based on rMEQ result: ${rmeqResult.chronotype} type (score ${rmeqResult.totalScore}).`,
    };
  }

  // Only passive
  if (!rmeqResult && passiveResult) {
    return {
      category: passiveResult.isReliable ? passiveResult.inferredCategory : 'intermediate',
      confidence: passiveResult.confidence,
      source: 'passive',
      discrepancy: false,
      message: passiveResult.isReliable
        ? `Scheduling inferred from your study patterns: peak performance at ${passiveResult.peakHour}:00.`
        : `Still collecting study pattern data (${passiveResult.totalReviews} reviews so far). Using default scheduling.`,
    };
  }

  // Both available — check for discrepancy
  const rmeqCat = rmeqResult!.category;
  const passiveCat = passiveResult!.inferredCategory;
  const discrepancy = rmeqCat !== passiveCat && passiveResult!.isReliable;

  if (discrepancy && passiveResult!.confidence > 0.7) {
    // High-confidence passive disagrees with rMEQ — note it
    return {
      category: rmeqCat, // Still prefer rMEQ
      confidence: 0.7,
      source: 'combined',
      discrepancy: true,
      message: `Your rMEQ indicates ${rmeqCat} type, but your actual study performance peaks at ${passiveResult!.peakHour}:00 (${passiveCat} pattern). Consider retaking the questionnaire or adjusting your schedule.`,
    };
  }

  // Agreement or low-confidence passive
  return {
    category: rmeqCat,
    confidence: 0.85,
    source: 'combined',
    discrepancy: false,
    message: `Chronotype confirmed: ${rmeqCat} type (rMEQ + study pattern data agree).`,
  };
}

// ─── Study Time Suggestion ──────────────────────────────────────────────────

/**
 * Generate a study time suggestion based on chronotype.
 *
 * Framed as a gentle suggestion, not a directive — per tier3.md,
 * the synchrony effect evidence is moderate at best.
 *
 * @param category - User's chronotype category
 * @param currentHour - Current hour (0–23)
 * @returns Human-readable suggestion
 */
export function getStudyTimeSuggestion(
  category: ChronotypeCategory,
  currentHour: number
): {
  isOptimal: boolean;
  suggestion: string;
  nextPeakIn: number | null; // hours until next peak, or null if in peak
} {
  const peakWindow = CHRONOTYPE_PEAK_WINDOWS[category];
  const isInPeak = isHourInWindow(currentHour, peakWindow.start, peakWindow.end);

  if (isInPeak) {
    return {
      isOptimal: true,
      suggestion: 'This is your peak cognitive window — great time for challenging material.',
      nextPeakIn: null,
    };
  }

  // Calculate hours until next peak
  let hoursUntilPeak = peakWindow.start - currentHour;
  if (hoursUntilPeak <= 0) hoursUntilPeak += 24;

  const peakLabel = `${peakWindow.start}:00–${peakWindow.end}:00`;

  if (hoursUntilPeak <= 2) {
    return {
      isOptimal: false,
      suggestion: `Your peak window starts soon (${peakLabel}). Save your hardest cards for then if you can.`,
      nextPeakIn: hoursUntilPeak,
    };
  }

  return {
    isOptimal: false,
    suggestion: `Your peak cognitive window is ${peakLabel}. Easier review material works well at this time of day.`,
    nextPeakIn: hoursUntilPeak,
  };
}
