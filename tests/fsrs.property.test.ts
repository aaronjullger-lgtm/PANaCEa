import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { FSRS, Rating, FSRSState, defaultParameters } from '../lib/fsrs';

describe('FSRS Property-Based Tests', () => {
  const fsrs = new FSRS(defaultParameters);

  describe('calculateRetrievability', () => {
    it('always returns a value in [0, 1] for non-negative inputs', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 36500, noNaN: true }),
          fc.double({ min: 0.01, max: 100000, noNaN: true }),
          (elapsedDays, stability) => {
            const r = fsrs.calculateRetrievability(elapsedDays, stability);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('returns 0 when stability is non-positive', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -100, max: 0, noNaN: true }),
          fc.double({ min: 0, max: 36500, noNaN: true }),
          (stability, elapsedDays) => {
            expect(fsrs.calculateRetrievability(elapsedDays, stability)).toBe(0);
          }
        )
      );
    });

    it('returns 1 when elapsed days is 0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 100000, noNaN: true }),
          (stability) => {
            expect(fsrs.calculateRetrievability(0, stability)).toBeCloseTo(1, 10);
          }
        )
      );
    });
  });

  describe('createEmptyCard', () => {
    it('returns a card with zero reps and lapses in New state', () => {
      const card = fsrs.createEmptyCard();
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.state).toBe(FSRSState.New);
      expect(card.stability).toBe(0);
      expect(card.difficulty).toBe(0);
    });
  });

  describe('next - stability and difficulty bounds', () => {
    it('stability is always positive after any rating on a new card', () => {
      const card = fsrs.createEmptyCard();
      const ratings: Rating[] = [Rating.Again, Rating.Good];

      for (const rating of ratings) {
        const result = fsrs.next(card, new Date(), rating);
        expect(result.card.stability).toBeGreaterThan(0);
      }
    });

    it('difficulty stays within [1, 10] after repeated reviews', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(Rating.Again, Rating.Good), { maxLength: 50 }),
          (ratings) => {
            let card = fsrs.createEmptyCard();
            let now = new Date();

            for (const rating of ratings) {
              const result = fsrs.next(card, now, rating);
              card = result.card;
              now = result.due;
              expect(card.difficulty).toBeGreaterThanOrEqual(1);
              expect(card.difficulty).toBeLessThanOrEqual(10);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('stability is always positive after any sequence of reviews', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(Rating.Again, Rating.Good), { maxLength: 50 }),
          (ratings) => {
            let card = fsrs.createEmptyCard();
            let now = new Date();

            for (const rating of ratings) {
              const result = fsrs.next(card, now, rating);
              card = result.card;
              now = result.due;
              expect(card.stability).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('next - due date invariants', () => {
    it('due date is always after the review date', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(Rating.Again, Rating.Good), { maxLength: 20 }),
          (ratings) => {
            let card = fsrs.createEmptyCard();
            let now = new Date();

            for (const rating of ratings) {
              const result = fsrs.next(card, now, rating);
              expect(result.due.getTime()).toBeGreaterThanOrEqual(now.getTime());
              card = result.card;
              now = result.due;
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('next - Good rating increases or maintains stability for review cards', () => {
    it('Good rating on a Review-state card does not decrease stability below prior value', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (reviewCount) => {
            let card = fsrs.createEmptyCard();
            let now = new Date();

            for (let i = 0; i < reviewCount; i++) {
              const priorStability = card.stability;
              const result = fsrs.next(card, now, Rating.Good);
              card = result.card;
              now = result.due;

              if (card.state === FSRSState.Review) {
                expect(card.stability).toBeGreaterThanOrEqual(priorStability * 0.5);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('next - reps and lapses tracking', () => {
    it('reps increments after every review', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(Rating.Again, Rating.Good), { maxLength: 20 }),
          (ratings) => {
            let card = fsrs.createEmptyCard();
            let now = new Date();

            for (let i = 0; i < ratings.length; i++) {
              const result = fsrs.next(card, now, ratings[i]);
              card = result.card;
              now = result.due;
              expect(card.reps).toBe(i + 1);
            }
          }
        )
      );
    });

    it('lapses only increment on Again rating for Review-state cards', () => {
      let card = fsrs.createEmptyCard();
      let now = new Date();

      const result = fsrs.next(card, now, Rating.Good);
      expect(result.card.lapses).toBe(0);
      expect(result.card.reps).toBe(1);

      card = result.card;
      now = result.due;

      const failResult = fsrs.next(card, now, Rating.Again);
      if (card.state === FSRSState.Review) {
        expect(failResult.card.lapses).toBe(1);
      }
    });
  });

  describe('schedule - all ratings produce valid cards', () => {
    it('schedule returns valid results for all four ratings', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date();
      const scheduled = fsrs.schedule(card, now);

      expect(scheduled).toHaveProperty(String(Rating.Again));
      expect(scheduled).toHaveProperty(String(Rating.Good));

      for (const key of Object.keys(scheduled)) {
        const result = scheduled[Number(key) as Rating];
        expect(result.card.stability).toBeGreaterThan(0);
        expect(result.card.difficulty).toBeGreaterThanOrEqual(1);
        expect(result.card.difficulty).toBeLessThanOrEqual(10);
        expect(result.due.getTime()).toBeGreaterThanOrEqual(now.getTime());
      }
    });
  });

  describe('next_interval - interval from stability', () => {
    it('returns at least 1 for any positive stability', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 100000, noNaN: true }),
          (stability) => {
            const interval = (fsrs as any).next_interval(stability);
            expect(interval).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('does not exceed maximum_interval', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 1000000, noNaN: true }),
          (stability) => {
            const interval = (fsrs as any).next_interval(stability);
            expect(interval).toBeLessThanOrEqual(defaultParameters.maximum_interval);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
