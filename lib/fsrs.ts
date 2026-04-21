/**
 * FSRS v6 Algorithm Implementation
 * Based on: https://github.com/open-spaced-repetition/fsrs.js
 *
 * FSRS v6 Enhancements over v5:
 * - 21 parameters (w[0]-w[20]) vs 19 in v5
 * - New short-term stability formula: S' = S * e^(w17 * (G - 3 + w18))
 * - New retrievability power curve: R = (1 + factor * t / S) ^ -w20
 * - Improved same-day review handling via short-term stability
 *
 * @version 6.0.0
 */

import { logger } from './logger';

export enum FSRSState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export enum Rating {
  Again = 1,
  /** @deprecated Hard rating (2) is no longer used in binary rating system. Treat as Again. */
  Hard = 2,
  Good = 3,
  /** @deprecated Easy rating (4) is no longer used in binary rating system. Treat as Good. */
  Easy = 4,
}

/** Normalize deprecated ratings to binary rating system */
export function normalizeRating(rating: Rating): Rating {
  switch (rating) {
    case Rating.Hard:
      return Rating.Again;
    case Rating.Easy:
      return Rating.Good;
    default:
      return rating;
  }
}

export interface FSRSCard {
  stability: number; // S - Memory stability in days
  difficulty: number; // D - Item difficulty (1-10 scale)
  state: FSRSState;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: Date;
}

export interface FSRSReviewLog {
  rating: Rating;
  scheduled_days: number;
  elapsed_days: number;
  review: Date;
  state: FSRSState;
}

/**
 * Review history snapshot for UserProgress tracking
 */
export interface ReviewSnapshot {
  date: string; // ISO 8601 date string
  stability: number;
  difficulty: number;
  rating: Rating;
  state: FSRSState;
}

/**
 * FSRS v6 Parameters
 * w[0]-w[3]: Initial stability for Again/Hard/Good/Easy
 * w[4]: Initial difficulty
 * w[5]: Difficulty change per grade deviation
 * w[6]: Difficulty mean reversion rate
 * w[7]: Mean reversion strength
 * w[8]-w[10]: Stability growth factors
 * w[11]-w[14]: Forget stability factors
 * w[15]: Hard penalty
 * w[16]: Easy bonus
 * w[17]: Short-term stability decay rate (NEW in v6)
 * w[18]: Short-term stability grade offset (NEW in v6)
 * w[19]: Retrievability factor (replaces hardcoded 9)
 * w[20]: Retrievability decay exponent (NEW in v6)
 */
export interface FSRSParameters {
  request_retention: number;
  maximum_interval: number;
  w: number[];
}

/**
 * Default FSRS v6 parameters.
 * w[0]–w[18]: PANaCEa population training run (PA student question bank, 2025).
 * w[19]–w[20]: ts-fsrs v6 published defaults from open-spaced-repetition/fsrs.js.
 *
 * Interval formula (Review state only):
 *   interval = (S / w[19]) × (request_retention^(1 / -w[20]) − 1)
 *
 * With w[19]=0.1597, w[20]=2.27 and request_retention=0.9:
 *   interval ≈ 0.298 × S  (e.g. S=3 → ~0.9 days; S=10 → ~3 days)
 *
 * IMPORTANT: w[19] has a dual role in FSRS v6 —
 *   1. Retrievability:    R = (1 + w[19] × t / S)^(-w[20])
 *   2. Short-term stability:  sinc = S^(-w[19]) × e^(w[17]×(G-3+w[18]))
 * Both are in the official FSRS v6 spec. The naming "factor" in computeDecayFactor
 * refers to role #1; the exponent in next_short_term_stability is role #2.
 */
export const defaultParameters: FSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
    0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.1597, 2.2700,
  ],
};

/**
 * FSRS v5 compatible parameters (for migration)
 * Use this if you need backward compatibility with existing v5 data
 */
export const v5CompatibleParameters: FSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [
    0.40255, 1.18385, 3.173, 15.69105, 7.19605, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925,
    1.9395, 0.41, 0.75825, 0.143, 0.96455, 0.2764, 0.5982, 0.39155,
  ],
};

/**
 * FSRS-7 reference defaults (from srs-benchmark README, April 2026)
 * NOT FOR PRODUCTION USE — FSRS-7 has no production implementation yet.
 * Stored here as a migration reference for when ts-fsrs ships v7 support.
 *
 * 29 parameters total: w[0..20] are analogous to v6 (but may be reinterpreted),
 * w[21..28] are the 8-parameter forgetting curve replacing v6's single w[20].
 */
export const FSRS7_REFERENCE_DEFAULTS = {
  w: [
    0.041, 2.4175, 4.1283, 11.9709, 5.6385, 0.4468, 3.262, 2.3054,
    0.1688, 1.3325, 0.3524, 0.0049, 0.7503, 0.0896, 0.6625, 1.15,
    0.882, 0.3072, 3.5875, 0.303, 0.0107, 0.2279, 2.6413, 0.5594,
    1.15, 2.5, 1.0, 0.0723, 0.1634,
  ],
  paramCount: 29,
  forgettingCurveParams: 8, // w[21]..w[28]
  description: 'FSRS-7 "final version" — fractional intervals, 8-param forgetting curve',
  status: 'NOT_PRODUCTION_READY' as const,
};

// Minimum stability constant
const S_MIN = 0.01;

/**
 * Ensure a value is a Date object (handles ISO strings from DB/JSON)
 */
function ensureDate(value: Date | string | null | undefined): Date {
  if (!value) {
    logger.warn('[fsrs.ensureDate] last_review is null/undefined — substituting now()', { value });
    return new Date();
  }
  return value instanceof Date ? value : new Date(value);
}

/**
 * Compute decay and factor from w[19] and w[20] for retrievability calculation
 * Official ts-fsrs formula: R = (1 + w[19] * t / S) ^ -w[20]
 */
export function computeDecayFactor(w19: number, w20: number): { decay: number; factor: number } {
  const decay = -w20;
  const factor = w19;
  return { decay, factor };
}

export class FSRS {
  private p: FSRSParameters;
  private decayFactor: { decay: number; factor: number };

  constructor(parameters: FSRSParameters = defaultParameters) {
    // Ensure we have all 21 parameters for v6
    this.p = this.normalizeParameters(parameters);
    // Precompute decay factor for retrievability calculations
    this.decayFactor = computeDecayFactor(this.p.w[19] ?? 0.1597, this.p.w[20] ?? 2.2700);
  }

  /**
   * Normalize parameters to ensure v6 compatibility
   * Adds default values for w[19] and w[20] if missing (v5 migration)
   *
   * FSRS-7 Migration Stub:
   * When FSRS-7 lands in ts-fsrs, this function will need a new branch:
   *   if (w.length === 21) { // add w[21]..w[28] defaults for v7 }
   * The 29-parameter default array is published in srs-benchmark README.
   * The first ~21 params likely map to analogous v6 functions, with w[21]-w[28]
   * constituting the 8-parameter forgetting curve. However, reoptimization
   * will be required — v6 params are NOT directly compatible with v7.
   *
   * Expected FSRS-7 default w[21..28]:
   *   0.2279, 2.6413, 0.5594, 1.15, 2.5, 1.0, 0.0723, 0.1634
   * (from srs-benchmark README, subject to change before production release)
   */
  private normalizeParameters(params: FSRSParameters): FSRSParameters {
    const w = [...params.w];

    // Add v6 parameters if missing (v5 → v6 migration).
    // Classic FSRS v5 formula: R = (1 + t/(9·S))^(-1) = (1 + (1/9)·t/S)^(-1)
    // This maps to factor=1/9≈0.111, decay=-1 (i.e. w[19]≈0.111, w[20]=1.0).
    // Using these values preserves relative scheduling behavior across the migration.
    if (w.length === 19) {
      w.push(0.111); // w[19]: retrievability factor (1/9 from classic v5 formula)
      w.push(1.0);   // w[20]: retrievability decay exponent
    } else if (w.length === 20) {
      w.push(1.0);   // w[20]: retrievability decay exponent
    }
    // Future: v6 → v7 migration (29 params, 8-parameter forgetting curve)
    // if (w.length === 21) { w.push(...FSRS7_DEFAULT_CURVE_PARAMS); }

    return {
      ...params,
      w,
    };
  }

  /**
   * Linear interpolation between a and b by t (0 <= t <= 1)
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  createEmptyCard(): FSRSCard {
    return {
      stability: 0,
      difficulty: 0,
      state: FSRSState.New,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      last_review: new Date(),
    };
  }

  schedule(card: FSRSCard, now: Date): Record<Rating, { card: FSRSCard; due: Date }> {
    const scheduled: Record<Rating, { card: FSRSCard; due: Date }> = {} as Record<
      Rating,
      { card: FSRSCard; due: Date }
    >;
    // Note: Hard (2) and Easy (4) are deprecated; binary rating uses only Again (1) and Good (3).
    for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      scheduled[rating] = this.next(card, now, rating);
    }
    return scheduled;
  }

  next(card: FSRSCard, now: Date, rating: Rating | number): { card: FSRSCard; due: Date } {
    const newCard = { ...card };

    if (card.state === FSRSState.New) {
      newCard.elapsed_days = 0;
    } else {
      const lastReviewDate = ensureDate(card.last_review);
      newCard.elapsed_days = (now.getTime() - lastReviewDate.getTime()) / 86400000;
    }

    newCard.last_review = now;
    newCard.reps += 1;

    // Lapse increment for ratings below 1.5 (Again)
    if (rating < 1.5) {
      newCard.lapses += 1;
    }

    // Algorithm logic based on current state
    if (card.state === FSRSState.New) {
      this.init_ds(newCard, rating);
      newCard.state = FSRSState.Learning;
    } else if (card.state === FSRSState.Learning || card.state === FSRSState.Relearning) {
      this.next_ds(newCard, rating);
      // Transition to Review if rating >= 2.5 (Good/Easy), otherwise stay in Learning/Relearning
      newCard.state = rating >= 2.5 ? FSRSState.Review : FSRSState.Learning;
    } else if (card.state === FSRSState.Review) {
      // Use recalculated elapsed_days, not the stale value from input card
      const interval = newCard.elapsed_days;
      const last_d = card.difficulty;
      const last_s = card.stability;

      // FSRS v6: Use power-law retrievability with w[19] and w[20]
      const retrievability = this.calculateRetrievability(interval, last_s);

      // Clamp retrievability below 1 to ensure stability still grows for fresh reviews
      const adjustedRetrievability = Math.min(retrievability, 0.99);

      this.next_ds(newCard, rating);

      if (rating < 1.5) {
        newCard.state = FSRSState.Relearning;
        newCard.stability = this.next_forget_stability(last_d, last_s, retrievability);
      } else {
        // Check for same-day review (short-term stability applies)
        if (interval < 1) {
          // FSRS v6: Short-term stability formula
          // S' = S * e^(w17 * (G - 3 + w18))
          newCard.stability = this.next_short_term_stability(last_s, rating);
        } else {
          newCard.stability = this.next_recall_stability(
            last_d,
            last_s,
            adjustedRetrievability,
            rating
          );
        }
      }
    }

    // Calculate next interval
    let next_interval = 1;
    if (newCard.state === FSRSState.Review) {
      next_interval = this.next_interval(newCard.stability);
    } else {
      // Learning steps (graduated intervals) with interpolation for float ratings
      if (Number.isInteger(rating)) {
        // Backwards compatibility: integer ratings produce same intervals as before
        switch (rating) {
          case 1:
            next_interval = 0.0035; // ~5 min
            break;
          case 2:
            next_interval = 0.007; // ~10 min
            break;
          case 3:
            next_interval = 1; // 1 day
            break;
          case 4:
            next_interval = 4; // 4 days
            break;
          default:
            // fallback to interpolation (should not happen)
            next_interval = this.lerp(0.0035, 4, (rating - 1) / 3);
        }
      } else {
        // Continuous interpolation using bucket boundaries (1.5, 2.5, 3.5)
        if (rating < 1.5) {
          next_interval = 0.0035; // ~5 min
        } else if (rating < 2.5) {
          // interpolate between 0.007 (Hard) and 1 (Good)
          next_interval = this.lerp(0.007, 1, rating - 1.5);
        } else if (rating < 3.5) {
          // interpolate between 1 (Good) and 4 (Easy)
          next_interval = this.lerp(1, 4, rating - 2.5);
        } else {
          next_interval = 4;
        }
      }
    }

    newCard.scheduled_days = next_interval;
    const due = new Date(now.getTime() + next_interval * 86400000);

    return { card: newCard, due };
  }

  /**
   * FSRS v6: Calculate retrievability using power-law decay
   * R = (1 + factor * t / S) ^ decay
   *
   * Uses precomputed decay and factor from w[20] for efficiency.
   *
   * @param elapsed_days - Days since last review
   * @param stability - Current stability value
   * @returns Retrievability (0-1)
   */
  calculateRetrievability(elapsed_days: number, stability: number): number {
    if (stability <= 0) return 0;

    const { decay, factor } = this.decayFactor;
    return Math.pow(1 + (factor * elapsed_days) / stability, decay);
  }

  /**
   * FSRS v6: Short-term stability for same-day reviews
   *
   * Formula: sinc = S^(-w19) * e^(w17 * (G - 3 + w18))
   * maskedSinc = sinc if G < Hard else max(sinc, 1.0)
   * S' = clamp(S * maskedSinc, S_MIN, 36500)
   *
   * This handles reviews that happen within the same day,
   * where the standard stability formula doesn't apply well.
   *
   * @param stability - Current stability
   * @param rating - User's rating
   * @returns Updated short-term stability
   */
  private next_short_term_stability(stability: number, rating: number): number {
    const w17Val = this.p.w[17];
    const w18Val = this.p.w[18];
    const w19Val = this.p.w[19];
    const w17 = w17Val ?? 0.5425;
    const w18 = w18Val ?? 0.0912;
    const w19 = w19Val ?? 0.0658;

    // FSRS v6 formula: sinc = S^(-w19) * e^(w17 * (G - 3 + w18))
    const sinc = Math.pow(stability, -w19) * Math.exp(w17 * (rating - 3 + w18));

    // Hard rating (2) is deprecated; binary rating uses only Again/Good.
    // For Hard or better ratings, ensure stability doesn't decrease
    const maskedSinc = rating >= Rating.Hard ? Math.max(sinc, 1.0) : sinc;

    // Apply and clamp to valid range
    return Math.min(Math.max(stability * maskedSinc, S_MIN), 36500.0);
  }

  /**
   * Initialize difficulty and stability for a new card
   * FSRS v6: Uses exponential formula for initial difficulty
   */
  private init_ds(card: FSRSCard, rating: number): void {
    // Interpolate between w[floor] and w[ceil] where floor = Math.floor(rating - 1), ceil = Math.ceil(rating - 1)
    const index = rating - 1;
    const floor = Math.floor(index);
    const ceil = Math.ceil(index);
    const t = index - floor;
    const wFloor = this.p.w[floor] ?? 1;
    const wCeil = this.p.w[ceil] ?? 1;
    card.stability = this.lerp(wFloor, wCeil, t);
    card.difficulty = this.init_difficulty(rating);
  }

  /**
   * FSRS v6: Initial difficulty using exponential formula
   * D0 = w[4] - exp((G - 1) * w[5]) + 1
   *
   * @param rating - User's rating (1-4)
   * @returns Initial difficulty value (constrained to 1-10)
   */
  private init_difficulty(rating: number): number {
    const w4 = this.p.w[4] ?? 6.4133;
    const w5 = this.p.w[5] ?? 0.8334;
    return this.constrain_difficulty(w4 - Math.exp((rating - 1) * w5) + 1);
  }

  /**
   * Update difficulty after a review
   * FSRS v6: Uses linear_damping for difficulty changes
   */
  private next_ds(card: FSRSCard, rating: number): void {
    const delta_d = -(this.p.w[6] ?? 0) * (rating - 3);
    const next_d = card.difficulty + this.linear_damping(delta_d, card.difficulty);
    // Mean reversion targets init_difficulty(Easy) per official ts-fsrs (Easy rating is deprecated)
    card.difficulty = this.constrain_difficulty(
      this.mean_reversion(this.init_difficulty(Rating.Easy), next_d)
    );
  }

  /**
   * FSRS v6: Linear damping for difficulty updates
   * Prevents difficulty from oscillating too rapidly
   *
   * Formula: delta_d * (10 - old_d) / 9
   *
   * @param delta_d - Change in difficulty
   * @param old_d - Current difficulty value
   * @returns Damped difficulty change
   */
  private linear_damping(delta_d: number, old_d: number): number {
    return (delta_d * (10 - old_d)) / 9;
  }

  /**
   * Constrain difficulty to valid range [1, 10]
   */
  private constrain_difficulty(d: number): number {
    return Math.min(Math.max(d, 1), 10);
  }

  /**
   * Apply mean reversion to difficulty
   */
  private mean_reversion(init: number, current: number): number {
    const w7 = this.p.w[7] ?? 0;
    return w7 * init + (1 - w7) * current;
  }

  /**
   * Calculate new stability after successful recall
   */
  private next_recall_stability(d: number, s: number, r: number, rating: number): number {
    const w8 = this.p.w[8] ?? 1.8722;
    const w9 = this.p.w[9] ?? 0.1666;
    const w10 = this.p.w[10] ?? 0.796;
    const w15 = this.p.w[15] ?? 0.6014;
    const w16 = this.p.w[16] ?? 1.8729;
    
    // Hard penalty interpolation between w15 (rating <= 2) and 1 (rating >= 3) (Hard rating deprecated)
    let hard_penalty = 1;
    if (rating <= 2) {
      hard_penalty = w15;
    } else if (rating < 3) {
      hard_penalty = this.lerp(w15, 1, rating - 2);
    }
    
    // Easy bonus interpolation between 1 (rating <= 3) and max(1.08, w16) (rating >= 4) (Easy rating deprecated)
    let easy_bonus = 1;
    if (rating >= 4) {
      easy_bonus = Math.max(1.08, w16);
    } else if (rating > 3) {
      easy_bonus = this.lerp(1, Math.max(1.08, w16), rating - 3);
    }

    return (
      s *
      (1 +
        Math.exp(w8) *
          (11 - d) *
          Math.pow(s, -w9) *
          (Math.exp((1 - r) * w10) - 1) *
          hard_penalty *
          easy_bonus)
    );
  }

  /**
   * Calculate new stability after a lapse (forgetting)
   */
  private next_forget_stability(d: number, s: number, r: number): number {
    const w11 = this.p.w[11] ?? 1.4835;
    const w12 = this.p.w[12] ?? 0.0614;
    const w13 = this.p.w[13] ?? 0.2629;
    const w14 = this.p.w[14] ?? 1.6483;
    return w11 * Math.pow(d, -w12) * (Math.pow(s + 1, w13) - 1) * Math.exp((1 - r) * w14);
  }

  /**
   * Calculate next review interval from stability
   * Uses the target retention to determine optimal interval.
   *
   * FSRS v6 formula: I = (S / factor) * (R^(1/decay) - 1)
   * where factor = w[19] and decay = -w[20] (from this.decayFactor).
   */
  private next_interval(s: number): number {
    const { decay, factor } = this.decayFactor; // decay = -w[20], factor = w[19]
    const new_interval = (s / factor) * (Math.pow(this.p.request_retention, 1 / decay) - 1);
    return Math.min(Math.max(new_interval, 1), this.p.maximum_interval);
  }

  /**
   * Get current algorithm version
   */
  static getVersion(): string {
    return '6.0.0';
  }

  /**
   * Check if parameters are v6 compatible
   */
  isV6Compatible(): boolean {
    return this.p.w.length >= 21;
  }

  /**
   * Get parameter summary for debugging
   */
  getParameterSummary(): {
    version: string;
    paramCount: number;
    requestRetention: number;
    maximumInterval: number;
  } {
    return {
      version: this.isV6Compatible() ? '6.0' : '5.x',
      paramCount: this.p.w.length,
      requestRetention: this.p.request_retention,
      maximumInterval: this.p.maximum_interval,
    };
  }
}

/**
 * Create a review snapshot for UserProgress.reviewHistory
 */
export function createReviewSnapshot(
  card: FSRSCard,
  rating: Rating,
  reviewDate: Date = new Date()
): ReviewSnapshot {
  return {
    date: reviewDate.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    rating,
    state: card.state,
  };
}

/**
 * Helper to convert a database record (UserTopicProgress) to an FSRSCard
 */
export function topicProgressToCard(record: {
  stability?: number;
  difficulty?: number;
  state?: number;
  reps?: number;
  lapses?: number;
  lastReviewDate?: Date | string | null;
  nextReviewDate?: Date | string | null;
}): FSRSCard {
  const lastReview = record.lastReviewDate ? new Date(record.lastReviewDate) : new Date();
  const nextReview = record.nextReviewDate ? new Date(record.nextReviewDate) : new Date();

  const now = new Date();
  const elapsedDays = record.lastReviewDate ? (now.getTime() - lastReview.getTime()) / 86400000 : 0;

  const scheduledDays =
    record.nextReviewDate && record.lastReviewDate
      ? (nextReview.getTime() - lastReview.getTime()) / 86400000
      : 0;

  return {
    stability: record.stability ?? 0,
    difficulty: record.difficulty ?? 0,
    state: (record.state as FSRSState) ?? FSRSState.New,
    reps: record.reps ?? 0,
    lapses: record.lapses ?? 0,
    last_review: lastReview,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
  };
}

/**
 * Migrate v5 parameters to v6 by adding default values for w[19] and w[20]
 *
 * @param v5Params - FSRS v5 parameters (19 weights)
 * @returns FSRS v6 parameters (21 weights)
 */
export function migrateV5ToV6(v5Params: FSRSParameters): FSRSParameters {
  if (v5Params.w.length >= 21) {
    return v5Params; // Already v6
  }

  const v6Weights = [...v5Params.w];

  // Add v6 parameters, preserving v5 scheduling semantics:
  // R_v5 = (1 + t/(9·S))^(-1) → factor=0.111, decay=-1.0
  if (v6Weights.length === 19) {
    v6Weights.push(0.111); // w[19]: retrievability factor (1/9, classic v5)
    v6Weights.push(1.0);   // w[20]: retrievability decay exponent
  } else if (v6Weights.length === 20) {
    v6Weights.push(1.0);   // w[20]: retrievability decay exponent
  }

  return {
    ...v5Params,
    w: v6Weights,
  };
}

/**
 * Calculate optimal parameters from review history
 * This is a simplified optimizer - full optimization requires ML
 *
 * @param reviewHistory - Array of review snapshots
 * @returns Suggested parameter adjustments
 */
export function suggestParameterAdjustments(
  reviewHistory: ReviewSnapshot[]
): Partial<FSRSParameters> {
  if (reviewHistory.length < 30) {
    return {}; // Not enough data
  }

  // Calculate retention rate
  const recentReviews = reviewHistory.slice(-100);
  const lapses = recentReviews.filter((r) => r.rating === Rating.Again).length;
  const retentionRate = 1 - lapses / recentReviews.length;

  // Suggest retention target adjustment based on actual performance
  if (retentionRate < 0.8) {
    return { request_retention: 0.85 }; // Increase if struggling
  } else if (retentionRate > 0.95) {
    return { request_retention: 0.92 }; // Can push harder if doing well
  }

  return {};
}
