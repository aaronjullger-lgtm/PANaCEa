/**
 * FSRS v5 Algorithm Comprehensive Test Suite
 * 
 * Tests the core spaced repetition algorithm to ensure:
 * - Correct state transitions
 * - Proper interval calculations
 * - Stability/difficulty bounds
 * - All rating scenarios work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FSRS,
  FSRSState,
  Rating,
  FSRSCard,
  FSRSParameters,
  defaultParameters,
  createReviewSnapshot,
} from '../lib/fsrs';

describe('FSRS v5 Algorithm', () => {
  let fsrs: FSRS;

  beforeEach(() => {
    fsrs = new FSRS();
  });

  describe('createEmptyCard', () => {
    it('should create a card with default initial values', () => {
      const card = fsrs.createEmptyCard();

      expect(card.stability).toBe(0);
      expect(card.difficulty).toBe(0);
      expect(card.state).toBe(FSRSState.New);
      expect(card.elapsed_days).toBe(0);
      expect(card.scheduled_days).toBe(0);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.last_review).toBeInstanceOf(Date);
    });

    it('should create independent card instances', () => {
      const card1 = fsrs.createEmptyCard();
      const card2 = fsrs.createEmptyCard();

      card1.stability = 5;
      expect(card2.stability).toBe(0);
    });
  });

  describe('State Transitions', () => {
    describe('New → Learning', () => {
      it('should transition New card to Learning on any rating', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
          const result = fsrs.next(fsrs.createEmptyCard(), now, rating);
          expect(result.card.state).toBe(FSRSState.Learning);
        }
      });

      it('should initialize stability based on rating', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        // Again (rating 1) should use w[0]
        const againResult = fsrs.next(card, now, Rating.Again);
        expect(againResult.card.stability).toBeCloseTo(defaultParameters.w[0], 5);

        // Hard (rating 2) should use w[1]
        const hardResult = fsrs.next(fsrs.createEmptyCard(), now, Rating.Hard);
        expect(hardResult.card.stability).toBeCloseTo(defaultParameters.w[1], 5);

        // Good (rating 3) should use w[2]
        const goodResult = fsrs.next(fsrs.createEmptyCard(), now, Rating.Good);
        expect(goodResult.card.stability).toBeCloseTo(defaultParameters.w[2], 5);

        // Easy (rating 4) should use w[3]
        const easyResult = fsrs.next(fsrs.createEmptyCard(), now, Rating.Easy);
        expect(easyResult.card.stability).toBeCloseTo(defaultParameters.w[3], 5);
      });

      it('should initialize difficulty within bounds [1, 10]', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
          const result = fsrs.next(fsrs.createEmptyCard(), now, rating);
          expect(result.card.difficulty).toBeGreaterThanOrEqual(1);
          expect(result.card.difficulty).toBeLessThanOrEqual(10);
        }
      });
    });

    describe('Learning → Review', () => {
      it('should transition to Review state on Good or Easy rating', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        // First review to get into Learning state
        let result = fsrs.next(card, now, Rating.Good);
        expect(result.card.state).toBe(FSRSState.Learning);

        // Second review with Good should go to Review
        const learningCard: FSRSCard = { ...result.card };
        const laterTime = new Date(now.getTime() + 86400000); // 1 day later
        result = fsrs.next(learningCard, laterTime, Rating.Good);
        expect(result.card.state).toBe(FSRSState.Review);
      });

      it('should stay in Learning state on Again or Hard rating', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        // First review
        let result = fsrs.next(card, now, Rating.Again);
        expect(result.card.state).toBe(FSRSState.Learning);

        // Second review with Again should stay in Learning
        const learningCard: FSRSCard = { ...result.card };
        result = fsrs.next(learningCard, now, Rating.Again);
        expect(result.card.state).toBe(FSRSState.Learning);
      });
    });

    describe('Review → Relearning', () => {
      it('should transition to Relearning on Again rating from Review state', () => {
        // Create a card in Review state
        const reviewCard: FSRSCard = {
          stability: 10,
          difficulty: 5,
          state: FSRSState.Review,
          elapsed_days: 10,
          scheduled_days: 10,
          reps: 5,
          lapses: 0,
          last_review: new Date(Date.now() - 10 * 86400000), // 10 days ago
        };

        const now = new Date();
        const result = fsrs.next(reviewCard, now, Rating.Again);

        expect(result.card.state).toBe(FSRSState.Relearning);
        expect(result.card.lapses).toBe(1); // Lapse count should increase
      });

      it('should stay in Review on Good/Easy rating', () => {
        const reviewCard: FSRSCard = {
          stability: 10,
          difficulty: 5,
          state: FSRSState.Review,
          elapsed_days: 10,
          scheduled_days: 10,
          reps: 5,
          lapses: 0,
          last_review: new Date(Date.now() - 10 * 86400000),
        };

        const now = new Date();

        for (const rating of [Rating.Good, Rating.Easy]) {
          const result = fsrs.next({ ...reviewCard }, now, rating);
          expect(result.card.state).toBe(FSRSState.Review);
        }
      });
    });
  });

  describe('Rating Scenarios', () => {
    describe('Rating.Again (1)', () => {
      it('should increment lapses on Again rating', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        const result = fsrs.next(card, now, Rating.Again);
        expect(result.card.lapses).toBe(1);

        // Multiple Again ratings should continue incrementing
        const result2 = fsrs.next(result.card, now, Rating.Again);
        expect(result2.card.lapses).toBe(2);
      });

      it('should give shortest interval for Again rating in learning', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        const result = fsrs.next(card, now, Rating.Again);
        // ~5 minutes = 0.0035 days
        expect(result.card.scheduled_days).toBeCloseTo(0.0035, 4);
      });
    });

    describe('Rating.Hard (2)', () => {
      it('should not increment lapses on Hard rating', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        const result = fsrs.next(card, now, Rating.Hard);
        expect(result.card.lapses).toBe(0);
      });

      it('should give ~10 minute interval for Hard in learning', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        const result = fsrs.next(card, now, Rating.Hard);
        // ~10 minutes = 0.007 days
        expect(result.card.scheduled_days).toBeCloseTo(0.007, 4);
      });
    });

    describe('Rating.Good (3)', () => {
      it('should give 1 day interval for Good in learning', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        const result = fsrs.next(card, now, Rating.Good);
        expect(result.card.scheduled_days).toBe(1);
      });

      it('should increase stability in Review state', () => {
        const reviewCard: FSRSCard = {
          stability: 10,
          difficulty: 5,
          state: FSRSState.Review,
          elapsed_days: 0,
          scheduled_days: 10,
          reps: 5,
          lapses: 0,
          last_review: new Date(Date.now() - 10 * 86400000),
        };

        const now = new Date();
        const result = fsrs.next(reviewCard, now, Rating.Good);

        expect(result.card.stability).toBeGreaterThan(10);
      });
    });

    describe('Rating.Easy (4)', () => {
      it('should give 4 day interval for Easy in learning', () => {
        const card = fsrs.createEmptyCard();
        const now = new Date();

        const result = fsrs.next(card, now, Rating.Easy);
        expect(result.card.scheduled_days).toBe(4);
      });

      it('should give bonus stability increase in Review state', () => {
        const reviewCard: FSRSCard = {
          stability: 10,
          difficulty: 5,
          state: FSRSState.Review,
          elapsed_days: 0,
          scheduled_days: 10,
          reps: 5,
          lapses: 0,
          last_review: new Date(Date.now() - 10 * 86400000),
        };

        const now = new Date();
        const goodResult = fsrs.next({ ...reviewCard }, now, Rating.Good);
        const easyResult = fsrs.next({ ...reviewCard }, now, Rating.Easy);

        // Easy should give higher stability than Good
        expect(easyResult.card.stability).toBeGreaterThan(goodResult.card.stability);
      });
    });
  });

  describe('Interval Calculations', () => {
    it('should respect maximum_interval parameter', () => {
      const customFsrs = new FSRS({
        ...defaultParameters,
        maximum_interval: 30, // 30 days max
      });

      // Create a card with very high stability that would normally get >30 days
      const reviewCard: FSRSCard = {
        stability: 1000,
        difficulty: 1,
        state: FSRSState.Review,
        elapsed_days: 0,
        scheduled_days: 100,
        reps: 50,
        lapses: 0,
        last_review: new Date(Date.now() - 100 * 86400000),
      };

      const now = new Date();
      const result = customFsrs.next(reviewCard, now, Rating.Good);

      expect(result.card.scheduled_days).toBeLessThanOrEqual(30);
    });

    it('should have minimum interval of 1 day in Review state', () => {
      const reviewCard: FSRSCard = {
        stability: 0.1, // Very low stability
        difficulty: 10,
        state: FSRSState.Review,
        elapsed_days: 0,
        scheduled_days: 1,
        reps: 1,
        lapses: 5,
        last_review: new Date(),
      };

      const now = new Date();
      const result = fsrs.next(reviewCard, now, Rating.Good);

      expect(result.card.scheduled_days).toBeGreaterThanOrEqual(1);
    });

    it('should calculate due date correctly', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date('2025-01-01T12:00:00Z');

      const result = fsrs.next(card, now, Rating.Good);
      // Good rating in learning = 1 day
      const expectedDue = new Date(now.getTime() + 86400000);

      expect(result.due.getTime()).toBe(expectedDue.getTime());
    });
  });

  describe('Difficulty Calculations', () => {
    it('should constrain difficulty between 1 and 10', () => {
      const now = new Date();

      // Test many consecutive reviews to try to push difficulty out of bounds
      let card = fsrs.createEmptyCard();

      // Many Again ratings to push difficulty up
      for (let i = 0; i < 20; i++) {
        const result = fsrs.next(card, now, Rating.Again);
        card = result.card;
        expect(card.difficulty).toBeGreaterThanOrEqual(1);
        expect(card.difficulty).toBeLessThanOrEqual(10);
      }

      // Reset and try Easy ratings to push difficulty down
      card = fsrs.createEmptyCard();
      for (let i = 0; i < 20; i++) {
        const result = fsrs.next(card, now, Rating.Easy);
        card = result.card;
        expect(card.difficulty).toBeGreaterThanOrEqual(1);
        expect(card.difficulty).toBeLessThanOrEqual(10);
      }
    });

    it('should increase difficulty on Again rating', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date();

      const initialResult = fsrs.next(card, now, Rating.Good);
      const initialDifficulty = initialResult.card.difficulty;

      const againResult = fsrs.next(initialResult.card, now, Rating.Again);
      expect(againResult.card.difficulty).toBeGreaterThan(initialDifficulty);
    });

    it('should decrease difficulty on Easy rating', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date();

      // Start with a Hard to get moderate difficulty
      const initialResult = fsrs.next(card, now, Rating.Hard);
      const initialDifficulty = initialResult.card.difficulty;

      const easyResult = fsrs.next(initialResult.card, now, Rating.Easy);
      expect(easyResult.card.difficulty).toBeLessThan(initialDifficulty);
    });
  });

  describe('Stability Calculations', () => {
    it('should always produce positive stability', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date();

      for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
        const result = fsrs.next(fsrs.createEmptyCard(), now, rating);
        expect(result.card.stability).toBeGreaterThan(0);
      }
    });

    it('should increase stability on successful recall in Review', () => {
      const reviewCard: FSRSCard = {
        stability: 10,
        difficulty: 5,
        state: FSRSState.Review,
        elapsed_days: 0,
        scheduled_days: 10,
        reps: 5,
        lapses: 0,
        last_review: new Date(Date.now() - 10 * 86400000),
      };

      const now = new Date();

      for (const rating of [Rating.Hard, Rating.Good, Rating.Easy]) {
        const result = fsrs.next({ ...reviewCard }, now, rating);
        expect(result.card.stability).toBeGreaterThanOrEqual(reviewCard.stability);
      }
    });

    it('should decrease stability on Again in Review (forget)', () => {
      const reviewCard: FSRSCard = {
        stability: 20,
        difficulty: 5,
        state: FSRSState.Review,
        elapsed_days: 0,
        scheduled_days: 20,
        reps: 10,
        lapses: 0,
        last_review: new Date(Date.now() - 20 * 86400000),
      };

      const now = new Date();
      const result = fsrs.next(reviewCard, now, Rating.Again);

      expect(result.card.stability).toBeLessThan(reviewCard.stability);
    });
  });

  describe('schedule() method', () => {
    it('should return scheduling info for all four ratings', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date();

      const scheduled = fsrs.schedule(card, now);

      expect(scheduled[Rating.Again]).toBeDefined();
      expect(scheduled[Rating.Hard]).toBeDefined();
      expect(scheduled[Rating.Good]).toBeDefined();
      expect(scheduled[Rating.Easy]).toBeDefined();
    });

    it('should produce increasing intervals for Again < Hard < Good < Easy in learning', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date();

      const scheduled = fsrs.schedule(card, now);

      const againInterval = scheduled[Rating.Again].card.scheduled_days;
      const hardInterval = scheduled[Rating.Hard].card.scheduled_days;
      const goodInterval = scheduled[Rating.Good].card.scheduled_days;
      const easyInterval = scheduled[Rating.Easy].card.scheduled_days;

      expect(againInterval).toBeLessThan(hardInterval);
      expect(hardInterval).toBeLessThan(goodInterval);
      expect(goodInterval).toBeLessThan(easyInterval);
    });
  });

  describe('Repetition Tracking', () => {
    it('should increment reps on each review', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date();

      expect(card.reps).toBe(0);

      const result1 = fsrs.next(card, now, Rating.Good);
      expect(result1.card.reps).toBe(1);

      const result2 = fsrs.next(result1.card, now, Rating.Good);
      expect(result2.card.reps).toBe(2);
    });

    it('should update last_review timestamp', () => {
      const card = fsrs.createEmptyCard();
      const reviewTime = new Date('2025-06-15T14:30:00Z');

      const result = fsrs.next(card, reviewTime, Rating.Good);

      expect(result.card.last_review.getTime()).toBe(reviewTime.getTime());
    });
  });

  describe('Custom Parameters', () => {
    it('should accept custom retention target', () => {
      const highRetention = new FSRS({
        ...defaultParameters,
        request_retention: 0.95, // 95% retention
      });

      const lowRetention = new FSRS({
        ...defaultParameters,
        request_retention: 0.8, // 80% retention
      });

      const reviewCard: FSRSCard = {
        stability: 10,
        difficulty: 5,
        state: FSRSState.Review,
        elapsed_days: 0,
        scheduled_days: 10,
        reps: 5,
        lapses: 0,
        last_review: new Date(Date.now() - 10 * 86400000),
      };

      const now = new Date();

      const highResult = highRetention.next({ ...reviewCard }, now, Rating.Good);
      const lowResult = lowRetention.next({ ...reviewCard }, now, Rating.Good);

      // Higher retention should give shorter intervals
      expect(highResult.card.scheduled_days).toBeLessThan(lowResult.card.scheduled_days);
    });

    it('should use custom w parameters', () => {
      const customW = Array(19).fill(1); // All weights = 1
      const customFsrs = new FSRS({
        ...defaultParameters,
        w: customW,
      });

      const card = customFsrs.createEmptyCard();
      const now = new Date();

      // With custom w[0] = 1, initial stability for Again should be 1
      const result = customFsrs.next(card, now, Rating.Again);
      expect(result.card.stability).toBe(1);
    });
  });

  describe('createReviewSnapshot', () => {
    it('should create a snapshot with all required fields', () => {
      const card: FSRSCard = {
        stability: 15.5,
        difficulty: 4.2,
        state: FSRSState.Review,
        elapsed_days: 10,
        scheduled_days: 15,
        reps: 8,
        lapses: 1,
        last_review: new Date(),
      };

      const snapshot = createReviewSnapshot(card, Rating.Good);

      expect(snapshot.stability).toBe(15.5);
      expect(snapshot.difficulty).toBe(4.2);
      expect(snapshot.rating).toBe(Rating.Good);
      expect(snapshot.state).toBe(FSRSState.Review);
      expect(snapshot.date).toBeDefined();
      expect(typeof snapshot.date).toBe('string');
    });

    it('should use provided review date', () => {
      const card: FSRSCard = {
        stability: 10,
        difficulty: 5,
        state: FSRSState.Review,
        elapsed_days: 5,
        scheduled_days: 10,
        reps: 3,
        lapses: 0,
        last_review: new Date(),
      };

      const customDate = new Date('2025-07-04T10:00:00Z');
      const snapshot = createReviewSnapshot(card, Rating.Easy, customDate);

      expect(snapshot.date).toBe(customDate.toISOString());
    });

    it('should default to current date if not provided', () => {
      const card: FSRSCard = {
        stability: 10,
        difficulty: 5,
        state: FSRSState.New,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        last_review: new Date(),
      };

      const beforeSnapshot = new Date();
      const snapshot = createReviewSnapshot(card, Rating.Good);
      const afterSnapshot = new Date();

      const snapshotDate = new Date(snapshot.date);
      expect(snapshotDate.getTime()).toBeGreaterThanOrEqual(beforeSnapshot.getTime());
      expect(snapshotDate.getTime()).toBeLessThanOrEqual(afterSnapshot.getTime());
    });
  });

  describe('Edge Cases', () => {
    it('should handle card reviewed immediately (0 elapsed days)', () => {
      const card: FSRSCard = {
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
      const result = fsrs.next(card, now, Rating.Good);

      expect(result.card.elapsed_days).toBe(0);
      expect(result.card.stability).toBeGreaterThan(0);
    });

    it('should handle very old cards (many elapsed days)', () => {
      const oneYearAgo = new Date(Date.now() - 365 * 86400000);
      const reviewCard: FSRSCard = {
        stability: 30,
        difficulty: 5,
        state: FSRSState.Review,
        elapsed_days: 30,
        scheduled_days: 30,
        reps: 10,
        lapses: 0,
        last_review: oneYearAgo,
      };

      const now = new Date();
      // This should not throw
      expect(() => fsrs.next(reviewCard, now, Rating.Good)).not.toThrow();

      const result = fsrs.next(reviewCard, now, Rating.Good);
      expect(result.card.elapsed_days).toBeCloseTo(365, 0);
    });

    it('should handle rapid succession of reviews', () => {
      let card = fsrs.createEmptyCard();
      const baseTime = new Date();

      // Simulate 10 rapid reviews (1 second apart)
      for (let i = 0; i < 10; i++) {
        const reviewTime = new Date(baseTime.getTime() + i * 1000);
        const result = fsrs.next(card, reviewTime, Rating.Good);
        card = result.card;

        expect(card.reps).toBe(i + 1);
        expect(card.stability).toBeGreaterThan(0);
        expect(card.difficulty).toBeGreaterThanOrEqual(1);
        expect(card.difficulty).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Enum Values', () => {
    it('should have correct FSRSState values', () => {
      expect(FSRSState.New).toBe(0);
      expect(FSRSState.Learning).toBe(1);
      expect(FSRSState.Review).toBe(2);
      expect(FSRSState.Relearning).toBe(3);
    });

    it('should have correct Rating values', () => {
      expect(Rating.Again).toBe(1);
      expect(Rating.Hard).toBe(2);
      expect(Rating.Good).toBe(3);
      expect(Rating.Easy).toBe(4);
    });
  });

  describe('Regression Tests', () => {
    it('should produce consistent results for known inputs', () => {
      // This test uses fixed inputs to ensure algorithm behavior doesn't change
      const card = fsrs.createEmptyCard();
      const fixedDate = new Date('2025-01-01T00:00:00Z');

      const result = fsrs.next(card, fixedDate, Rating.Good);

      // These values should remain stable across refactors
      expect(result.card.stability).toBeCloseTo(defaultParameters.w[2], 5);
      expect(result.card.state).toBe(FSRSState.Learning);
      expect(result.card.scheduled_days).toBe(1);
      expect(result.card.reps).toBe(1);
    });

    it('should maintain stability order: Again < Hard < Good < Easy for initial review', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date();

      const againStability = fsrs.next(fsrs.createEmptyCard(), now, Rating.Again).card.stability;
      const hardStability = fsrs.next(fsrs.createEmptyCard(), now, Rating.Hard).card.stability;
      const goodStability = fsrs.next(fsrs.createEmptyCard(), now, Rating.Good).card.stability;
      const easyStability = fsrs.next(fsrs.createEmptyCard(), now, Rating.Easy).card.stability;

      expect(againStability).toBeLessThan(hardStability);
      expect(hardStability).toBeLessThan(goodStability);
      expect(goodStability).toBeLessThan(easyStability);
    });
  });
});
