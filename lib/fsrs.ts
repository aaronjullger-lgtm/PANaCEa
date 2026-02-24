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

export enum FSRSState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
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
 * Default FSRS v6 parameters
 * Calibrated from large-scale Anki dataset analysis
 */
export const defaultParameters: FSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [
    0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
    0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
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

// Minimum stability constant
const S_MIN = 0.01;

/**
 * Ensure a value is a Date object (handles ISO strings from DB/JSON)
 */
function ensureDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date();
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
  private readonly DECAY = -0.5; // Fixed decay constant for interval calculation
  private decayFactor: { decay: number; factor: number };

  constructor(parameters: FSRSParameters = defaultParameters) {
    // Ensure we have all 21 parameters for v6
    this.p = this.normalizeParameters(parameters);
    // Precompute decay factor for retrievability calculations
    this.decayFactor = computeDecayFactor(this.p.w[19] ?? 9.0, this.p.w[20] ?? 0.1542);
  }

  /**
   * Normalize parameters to ensure v6 compatibility
   * Adds default values for w[19] and w[20] if missing (v5 migration)
   */
  private normalizeParameters(params: FSRSParameters): FSRSParameters {
    const w = [...params.w];

    // Add v6 parameters if missing (v5 � v6 migration)
    if (w.length === 19) {
      w.push(9.0); // w[19]: retrievability factor
      w.push(1.0); // w[20]: retrievability decay exponent
    } else if (w.length === 20) {
      w.push(1.0); // w[20]: retrievability decay exponent
    }

    return {
      ...params,
      w,
    };
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
    for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      scheduled[rating] = this.next(card, now, rating);
    }
    return scheduled;
  }

  next(card: FSRSCard, now: Date, rating: Rating): { card: FSRSCard; due: Date } {
    const newCard = { ...card };

    if (card.state === FSRSState.New) {
      newCard.elapsed_days = 0;
    } else {
      const lastReviewDate = ensureDate(card.last_review);
      newCard.elapsed_days = (now.getTime() - lastReviewDate.getTime()) / 86400000;
    }

    newCard.last_review = now;
    newCard.reps += 1;

    if (rating === Rating.Again) {
      newCard.lapses += 1;
    }

    // Algorithm logic based on current state
    if (card.state === FSRSState.New) {
      this.init_ds(newCard, rating);
      newCard.state = FSRSState.Learning;
    } else if (card.state === FSRSState.Learning || card.state === FSRSState.Relearning) {
      this.next_ds(newCard, rating);
      newCard.state =
        rating === Rating.Good || rating === Rating.Easy ? FSRSState.Review : FSRSState.Learning;
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

      if (rating === Rating.Again) {
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
      // Learning steps (graduated intervals)
      // Again: ~5min, Hard: ~10min, Good: 1day, Easy: 4days
      if (rating === Rating.Again)
        next_interval = 0.0035; // ~5 min
      else if (rating === Rating.Hard)
        next_interval = 0.007; // ~10 min
      else if (rating === Rating.Good) next_interval = 1;
      else if (rating === Rating.Easy) next_interval = 4;
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
  private next_short_term_stability(stability: number, rating: Rating): number {
    const w17Val = this.p.w[17];
    const w18Val = this.p.w[18];
    const w19Val = this.p.w[19];
    const w17 = w17Val ?? 0.5425;
    const w18 = w18Val ?? 0.0912;
    const w19 = w19Val ?? 0.0658;

    // FSRS v6 formula: sinc = S^(-w19) * e^(w17 * (G - 3 + w18))
    const sinc = Math.pow(stability, -w19) * Math.exp(w17 * (rating - 3 + w18));

    // For Hard or better ratings, ensure stability doesn't decrease
    const maskedSinc = rating >= Rating.Hard ? Math.max(sinc, 1.0) : sinc;

    // Apply and clamp to valid range
    return Math.min(Math.max(stability * maskedSinc, S_MIN), 36500.0);
  }

  /**
   * Initialize difficulty and stability for a new card
   * FSRS v6: Uses exponential formula for initial difficulty
   */
  private init_ds(card: FSRSCard, rating: Rating): void {
    card.stability = this.p.w[rating - 1] ?? 1;
    card.difficulty = this.init_difficulty(rating);
  }

  /**
   * FSRS v6: Initial difficulty using exponential formula
   * D0 = w[4] - exp((G - 1) * w[5]) + 1
   *
   * @param rating - User's rating (1-4)
   * @returns Initial difficulty value (constrained to 1-10)
   */
  private init_difficulty(rating: Rating): number {
    const w4 = this.p.w[4] ?? 6.4133;
    const w5 = this.p.w[5] ?? 0.8334;
    return this.constrain_difficulty(w4 - Math.exp((rating - 1) * w5) + 1);
  }

  /**
   * Update difficulty after a review
   * FSRS v6: Uses linear_damping for difficulty changes
   */
  private next_ds(card: FSRSCard, rating: Rating): void {
    const delta_d = -(this.p.w[6] ?? 0) * (rating - 3);
    const next_d = card.difficulty + this.linear_damping(delta_d, card.difficulty);
    // Mean reversion targets init_difficulty(Easy) per official ts-fsrs
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
  private next_recall_stability(d: number, s: number, r: number, rating: Rating): number {
    const w8 = this.p.w[8] ?? 1.8722;
    const w9 = this.p.w[9] ?? 0.1666;
    const w10 = this.p.w[10] ?? 0.796;
    const w15 = this.p.w[15] ?? 0.6014;
    const w16 = this.p.w[16] ?? 1.8729;
    const hard_penalty = rating === Rating.Hard ? w15 : 1;
    const easy_bonus = rating === Rating.Easy ? Math.max(1.08, w16) : 1;

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
   * Uses the target retention to determine optimal interval
   */
  private next_interval(s: number): number {
    // FSRS v6: Use w[19] instead of hardcoded 9
    const factor = this.p.w[19] ?? 9;
    const new_interval = (s / factor) * (Math.pow(this.p.request_retention, 1 / this.DECAY) - 1);
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

  // Add v6 parameters
  if (v6Weights.length === 19) {
    v6Weights.push(9.0); // w[19]: retrievability factor
    v6Weights.push(1.0); // w[20]: retrievability decay exponent
  } else if (v6Weights.length === 20) {
    v6Weights.push(1.0); // w[20]: retrievability decay exponent
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
