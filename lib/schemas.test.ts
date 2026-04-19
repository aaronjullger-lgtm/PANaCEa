/**
 * Sprint 3.6 — Zod Schema Unit Tests
 *
 * Focus: FSRSRatingSchema — the legacy-input normalizer that guards the
 * scheduler's binary-grade contract.
 *
 * PANaCEa accepts 1/2/3/4 on the wire (old clients may still send 2 or 4) and
 * collapses them to {1, 3} at the schema boundary so the downstream scheduler
 * never sees Hard/Easy. These tests lock that contract down.
 */

import { describe, it, expect } from 'vitest';
import { FSRSRatingSchema, ReviewSubmissionSchema } from './schemas';

describe('FSRSRatingSchema', () => {
  it('passes 1 (Again) through unchanged', () => {
    expect(FSRSRatingSchema.parse(1)).toBe(1);
  });

  it('passes 3 (Good) through unchanged', () => {
    expect(FSRSRatingSchema.parse(3)).toBe(3);
  });

  it('normalizes 2 (Hard, deprecated) to 1 (Again)', () => {
    expect(FSRSRatingSchema.parse(2)).toBe(1);
  });

  it('normalizes 4 (Easy, deprecated) to 3 (Good)', () => {
    expect(FSRSRatingSchema.parse(4)).toBe(3);
  });

  it('rejects 0 (not a valid FSRS rating)', () => {
    expect(() => FSRSRatingSchema.parse(0)).toThrow();
  });

  it('rejects 5 (out of range)', () => {
    expect(() => FSRSRatingSchema.parse(5)).toThrow();
  });

  it('rejects string "3" (no coercion — must be literal number)', () => {
    expect(() => FSRSRatingSchema.parse('3')).toThrow();
  });

  it('rejects null and undefined', () => {
    expect(() => FSRSRatingSchema.parse(null)).toThrow();
    expect(() => FSRSRatingSchema.parse(undefined)).toThrow();
  });

  it('output type is narrowed to 1 | 3 at runtime for all accepted inputs', () => {
    // Sanity: every accepted input normalizes to {1, 3}
    for (const input of [1, 2, 3, 4]) {
      const out = FSRSRatingSchema.parse(input);
      expect(out === 1 || out === 3).toBe(true);
    }
  });
});

describe('ReviewSubmissionSchema (integrates FSRSRatingSchema)', () => {
  it('accepts a legacy 4-rating and normalizes before handing to the scheduler', () => {
    const parsed = ReviewSubmissionSchema.parse({
      questionId: 'ddddd4ec-8b0e-4b1d-9f12-000000000000',
      userAnswer: 'option A',
      rating: 4, // legacy "Easy"
      timeSpentMs: 12000,
    });
    expect(parsed.rating).toBe(3); // normalized at the boundary
  });

  it('accepts a legacy 2-rating and normalizes to 1', () => {
    const parsed = ReviewSubmissionSchema.parse({
      questionId: 'ddddd4ec-8b0e-4b1d-9f12-000000000000',
      userAnswer: 'option A',
      rating: 2,
      timeSpentMs: 12000,
    });
    expect(parsed.rating).toBe(1);
  });

  it('rejects rating=0 even in the composite schema', () => {
    expect(() =>
      ReviewSubmissionSchema.parse({
        questionId: 'ddddd4ec-8b0e-4b1d-9f12-000000000000',
        userAnswer: 'option A',
        rating: 0,
        timeSpentMs: 12000,
      })
    ).toThrow();
  });
});
