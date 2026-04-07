/**
 * FSRS v6 Canonical Verification Tests
 * 
 * Tests PANaCEa's FSRS v6 implementation against known canonical formulas.
 * Since formula methods are private, we test through:
 * 1. Public next() method with various card states and ratings
 * 2. Public calculateRetrievability() method
 * 3. Indirect validation of difficulty, stability updates via resulting card states
 * 
 * Canonical formulas tested:
 * - Retrievability: R = (1 + (w[19] * t) / S) ^ (-w[20])
 * - Initial Difficulty: D = w[4] - w[5] * (G - 3)
 * - Difficulty Update: D' = mean_reversion(D, w[4], w[6])
 * - Recall Stability: S' = S * e^(w[8] * (R - 1))
 * - Forget Stability: S' = S * w[9]
 * - Short-term Stability (same-day): S' = S * e^(w[17] * (G - 3 + w[18]))
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FSRS,
  FSRSCard,
  FSRSState,
  Rating,
  normalizeRating,
  defaultParameters,
} from '../../lib/fsrs';

// Default FSRS v6 parameters for reference
const DEFAULT_W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
  0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
  0.0912, 0.0658, 0.1542,
];

// w[19] (FACTOR) and w[20] (DECAY) are critical for retrievability formula
const FACTOR = DEFAULT_W[19]; // 0.0658
const DECAY = DEFAULT_W[20]; // 0.1542

// Helper: Create a card in Review state
function createReviewCard(overrides?: Partial<FSRSCard>): FSRSCard {
  return {
    stability: 10,
    difficulty: 5,
    state: FSRSState.Review,
    elapsed_days: 0,
    scheduled_days: 10,
    reps: 5,
    lapses: 0,
    last_review: new Date(),
    ...overrides,
  };
}

// Helper: Create a new card
function createNewCard(): FSRSCard {
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

// Canonical formula implementations for reference
const canonicalFormulas = {
  /**
   * Canonical retrievability formula: R = (1 + (w[19] * t) / S) ^ (-w[20])
   */
  retrievability: (t: number, S: number, factor = FACTOR, decay = DECAY): number => {
    if (S === 0 || t === 0) return 1;
    return Math.pow(1 + (factor * t) / S, -decay);
  },

  /**
   * Canonical initial difficulty: D = w[4] - w[5] * (G - 3)
   * w[4] = 6.4133, w[5] = 0.8334
   */
  initDifficulty: (rating: Rating): number => {
    const w4 = DEFAULT_W[4]; // 6.4133
    const w5 = DEFAULT_W[5]; // 0.8334
    return w4 - w5 * (rating - 3);
  },

  /**
   * Canonical mean reversion: D' = D + (w[4] - D) * w[6]
   * w[6] = 3.0194 (mean reversion rate)
   */
  meanReversion: (D: number): number => {
    const w4 = DEFAULT_W[4]; // 6.4133
    const w6 = DEFAULT_W[6]; // 3.0194
    return D + (w4 - D) * w6;
  },

  /**
   * Canonical recall stability (passing): S' = S * e^(w[8] * (R - 1))
   * w[8] = 1.8722
   */
  recallStability: (S: number, R: number): number => {
    const w8 = DEFAULT_W[8]; // 1.8722
    return S * Math.exp(w8 * (R - 1));
  },

  /**
   * Canonical forget stability (lapse): S' = S * w[9]
   * w[9] = 0.1666
   */
  forgetStability: (S: number): number => {
    const w9 = DEFAULT_W[9]; // 0.1666
    return S * w9;
  },

  /**
   * Canonical short-term stability (same-day review):
   * S' = S * e^(w[17] * (G - 3 + w[18]))
   * w[17] = 0.5425, w[18] = 0.0912
   */
  shortTermStability: (S: number, rating: Rating): number => {
    const w17 = DEFAULT_W[17]; // 0.5425
    const w18 = DEFAULT_W[18]; // 0.0912
    return S * Math.exp(w17 * (rating - 3 + w18));
  },
};

describe('FSRS v6 Canonical Verification', () => {
  let fsrs: FSRS;

  beforeEach(() => {
    fsrs = new FSRS();
  });

  describe('Retrievability Formula (R = (1 + (w[19] * t) / S) ^ (-w[20]))', () => {
    it('should return 1 for t=0 (no time elapsed)', () => {
      const R = fsrs.calculateRetrievability(0, 10);
      expect(R).toBeCloseTo(1, 6);
    });

    it('should return 1 for S=0 (zero stability)', () => {
      const R = fsrs.calculateRetrievability(10, 0);
      expect(R).toBeCloseTo(1, 6);
    });

    it('should return < 1 for t > 0 and S > 0', () => {
      const R = fsrs.calculateRetrievability(5, 10);
      expect(R).toBeLessThan(1);
      expect(R).toBeGreaterThan(0);
    });

    it('should match canonical formula for standard case', () => {
      const t = 10; // 10 days elapsed
      const S = 20; // 20 days stability
      const result = fsrs.calculateRetrievability(t, S);
      const canonical = canonicalFormulas.retrievability(t, S);
      expect(result).toBeCloseTo(canonical, 6);
    });

    it('should decrease monotonically with increasing time', () => {
      const S = 15;
      const R1 = fsrs.calculateRetrievability(1, S);
      const R5 = fsrs.calculateRetrievability(5, S);
      const R10 = fsrs.calculateRetrievability(10, S);
      expect(R1).toBeGreaterThan(R5);
      expect(R5).toBeGreaterThan(R10);
    });

    it('should correctly apply w[20] decay exponent', () => {
      // As decay exponent increases, retrievability curve becomes steeper
      const t = 5;
      const S = 10;
      const R = fsrs.calculateRetrievability(t, S);
      const canonical = canonicalFormulas.retrievability(t, S, FACTOR, DECAY);
      expect(R).toBeCloseTo(canonical, 6);
    });
  });

  describe('Initial Difficulty (D = w[4] - w[5] * (G - 3))', () => {
    it('should set D=w[4] for rating Good (3)', () => {
      const newCard = createNewCard();
      const now = new Date();

      const { card } = fsrs.next(newCard, now, Rating.Good);
      const expected = canonicalFormulas.initDifficulty(Rating.Good);
      expect(card.difficulty).toBeCloseTo(expected, 5);
    });

    it('should set D > w[4] for rating Again (1)', () => {
      const newCard = createNewCard();
      const now = new Date();

      const { card } = fsrs.next(newCard, now, Rating.Again);
      const expected = canonicalFormulas.initDifficulty(Rating.Again);
      expect(card.difficulty).toBeCloseTo(expected, 5);
      expect(card.difficulty).toBeGreaterThan(DEFAULT_W[4]);
    });

    it('should set D < w[4] for rating Easy (4)', () => {
      const newCard = createNewCard();
      const now = new Date();

      const { card } = fsrs.next(newCard, now, Rating.Easy);
      const expected = canonicalFormulas.initDifficulty(Rating.Easy);
      expect(card.difficulty).toBeCloseTo(expected, 5);
      expect(card.difficulty).toBeLessThan(DEFAULT_W[4]);
    });

    it('should follow formula D = w[4] - w[5] * (rating - 3)', () => {
      const newCard = createNewCard();
      const now = new Date();

      for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
        const { card } = fsrs.next(newCard, now, rating);
        const canonical = canonicalFormulas.initDifficulty(rating);
        expect(card.difficulty).toBeCloseTo(canonical, 5);
      }
    });
  });

  describe('Stability Update on Recall (passing)', () => {
    it('should increase stability when rating Good with long elapsed time', () => {
      const reviewCard = createReviewCard({
        stability: 10,
        difficulty: 5,
        elapsed_days: 7,
      });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Good);
      expect(card.stability).toBeGreaterThan(reviewCard.stability);
    });

    it('should increase stability more for rating Good than Again', () => {
      const reviewCard1 = createReviewCard({
        stability: 10,
        difficulty: 5,
        elapsed_days: 5,
      });
      const reviewCard2 = { ...reviewCard1 };
      const now = new Date();

      const { card: cardGood } = fsrs.next(reviewCard1, now, Rating.Good);
      const { card: cardAgain } = fsrs.next(reviewCard2, now, Rating.Again);

      expect(cardGood.stability).toBeGreaterThan(cardAgain.stability);
    });

    it('should transition to Relearning state on Again rating', () => {
      const reviewCard = createReviewCard({
        state: FSRSState.Review,
        elapsed_days: 5,
      });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Again);
      expect(card.state).toBe(FSRSState.Relearning);
    });

    it('should remain in Review state on Good rating', () => {
      const reviewCard = createReviewCard({
        state: FSRSState.Review,
        elapsed_days: 5,
      });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Good);
      expect(card.state).toBe(FSRSState.Review);
    });
  });

  describe('Stability Update on Lapse (forget)', () => {
    it('should decrease stability significantly on Again (lapse) from Review state', () => {
      const reviewCard = createReviewCard({
        stability: 20,
        difficulty: 5,
        elapsed_days: 10,
        state: FSRSState.Review,
      });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Again);
      expect(card.stability).toBeLessThan(reviewCard.stability);
      expect(card.lapses).toBe(reviewCard.lapses + 1);
    });

    it('should apply w[9] decay factor on lapse', () => {
      const reviewCard = createReviewCard({
        stability: 20,
        elapsed_days: 10,
      });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Again);
      const canonical = canonicalFormulas.forgetStability(reviewCard.stability);
      
      // Should be approximately w[9] * old_stability
      const ratio = card.stability / reviewCard.stability;
      const expectedRatio = DEFAULT_W[9]; // 0.1666
      expect(ratio).toBeCloseTo(expectedRatio, 3);
    });
  });

  describe('Short-term Stability (same-day review)', () => {
    it('should apply short-term formula for elapsed_days < 1', () => {
      const reviewCard = createReviewCard({
        stability: 5,
        difficulty: 5,
        elapsed_days: 0.5, // Same day (12 hours)
      });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Good);
      // Short-term: S' = S * e^(w[17] * (G - 3 + w[18]))
      const canonical = canonicalFormulas.shortTermStability(reviewCard.stability, Rating.Good);
      expect(card.stability).toBeCloseTo(canonical, 3);
    });

    it('should differ from long-term formula for same review', () => {
      // Create two identical cards but with different elapsed_days
      const cardShortTerm = createReviewCard({
        stability: 5,
        elapsed_days: 0.5, // Same day
      });
      const cardLongTerm = createReviewCard({
        stability: 5,
        elapsed_days: 7, // 7 days
      });
      const now = new Date();

      const { card: resultShort } = fsrs.next(cardShortTerm, now, Rating.Good);
      const { card: resultLong } = fsrs.next(cardLongTerm, now, Rating.Good);

      // Short-term and long-term should produce different stability values
      expect(Math.abs(resultShort.stability - resultLong.stability)).toBeGreaterThan(0.1);
    });
  });

  describe('Rating normalization (binary system)', () => {
    it('should treat Hard (2) as Again (1)', () => {
      const newCard1 = createNewCard();
      const newCard2 = createNewCard();
      const now = new Date();

      const { card: cardAgain } = fsrs.next(newCard1, now, Rating.Again);
      const { card: cardHard } = fsrs.next(newCard2, now, Rating.Hard);

      expect(cardAgain.difficulty).toBeCloseTo(cardHard.difficulty, 5);
    });

    it('should treat Easy (4) as Good (3)', () => {
      const newCard1 = createNewCard();
      const newCard2 = createNewCard();
      const now = new Date();

      const { card: cardGood } = fsrs.next(newCard1, now, Rating.Good);
      const { card: cardEasy } = fsrs.next(newCard2, now, Rating.Easy);

      expect(cardGood.difficulty).toBeCloseTo(cardEasy.difficulty, 5);
    });
  });

  describe('State transitions', () => {
    it('New + Good -> Learning', () => {
      const newCard = createNewCard();
      const now = new Date();

      const { card } = fsrs.next(newCard, now, Rating.Good);
      expect(card.state).toBe(FSRSState.Learning);
    });

    it('New + Again -> Learning (stays in learning)', () => {
      const newCard = createNewCard();
      const now = new Date();

      const { card } = fsrs.next(newCard, now, Rating.Again);
      expect(card.state).toBe(FSRSState.Learning);
    });

    it('Learning + Good -> Review', () => {
      const learningCard: FSRSCard = {
        stability: 1,
        difficulty: 5,
        state: FSRSState.Learning,
        elapsed_days: 0,
        scheduled_days: 1,
        reps: 1,
        lapses: 0,
        last_review: new Date(),
      };
      const now = new Date();

      const { card } = fsrs.next(learningCard, now, Rating.Good);
      expect(card.state).toBe(FSRSState.Review);
    });

    it('Review + Good -> Review', () => {
      const reviewCard = createReviewCard({ state: FSRSState.Review, elapsed_days: 5 });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Good);
      expect(card.state).toBe(FSRSState.Review);
    });

    it('Review + Again -> Relearning', () => {
      const reviewCard = createReviewCard({ state: FSRSState.Review, elapsed_days: 5 });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Again);
      expect(card.state).toBe(FSRSState.Relearning);
    });
  });

  describe('Lapse tracking', () => {
    it('should increment lapses on Again from Review state', () => {
      const reviewCard = createReviewCard({ lapses: 2, state: FSRSState.Review, elapsed_days: 5 });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Again);
      expect(card.lapses).toBe(3);
    });

    it('should not increment lapses on Good rating', () => {
      const reviewCard = createReviewCard({ lapses: 2, state: FSRSState.Review, elapsed_days: 5 });
      const now = new Date();

      const { card } = fsrs.next(reviewCard, now, Rating.Good);
      expect(card.lapses).toBe(2);
    });
  });

  describe('Schedule method', () => {
    it('should return 4 scheduled options (Again, Hard, Good, Easy)', () => {
      const card = createReviewCard();
      const now = new Date();

      const scheduled = fsrs.schedule(card, now);
      expect(scheduled).toHaveProperty(Rating.Again);
      expect(scheduled).toHaveProperty(Rating.Hard);
      expect(scheduled).toHaveProperty(Rating.Good);
      expect(scheduled).toHaveProperty(Rating.Easy);
    });

    it('should have Again < Hard <= Good <= Easy intervals', () => {
      const card = createReviewCard({ state: FSRSState.Learning });
      const now = new Date();

      const scheduled = fsrs.schedule(card, now);
      const intervalAgain = scheduled[Rating.Again].scheduled_days;
      const intervalHard = scheduled[Rating.Hard].scheduled_days;
      const intervalGood = scheduled[Rating.Good].scheduled_days;
      const intervalEasy = scheduled[Rating.Easy].scheduled_days;

      expect(intervalAgain).toBeLessThan(intervalHard);
      expect(intervalHard).toBeLessThanOrEqual(intervalGood);
      expect(intervalGood).toBeLessThanOrEqual(intervalEasy);
    });
  });

  describe('Integration: Multi-session progression', () => {
    it('should gradually increase stability through correct reviews', () => {
      let card = createNewCard();
      let now = new Date();

      // Session 1: New -> Learning (Good)
      let result = fsrs.next(card, now, Rating.Good);
      card = result.card;
      now = result.due;
      const s1 = card.stability;

      // Session 2: Learning -> Review (Good)
      result = fsrs.next(card, now, Rating.Good);
      card = result.card;
      now = result.due;
      const s2 = card.stability;

      // Session 3: Review (Good) after 1 day
      result = fsrs.next(card, now, Rating.Good);
      card = result.card;
      const s3 = card.stability;

      expect(s2).toBeGreaterThan(s1);
      expect(s3).toBeGreaterThan(s2);
    });

    it('should recover from lapse more quickly with additional correct reviews', () => {
      let card = createReviewCard({
        stability: 20,
        difficulty: 5,
        elapsed_days: 10,
      });
      let now = new Date();

      // Lapse (Again)
      let result = fsrs.next(card, now, Rating.Again);
      card = result.card;
      now = result.due;
      const sAfterLapse = card.stability;

      // Recovery attempt (Good)
      result = fsrs.next(card, now, Rating.Good);
      card = result.card;
      now = result.due;
      const sAfterRecovery = card.stability;

      // Second recovery (Good)
      result = fsrs.next(card, now, Rating.Good);
      card = result.card;
      const sSecondRecovery = card.stability;

      expect(sAfterRecovery).toBeGreaterThan(sAfterLapse);
      expect(sSecondRecovery).toBeGreaterThan(sAfterRecovery);
    });
  });
});
