/**
 * Unit tests for reviewLogService — sanitizeReviewLogInput
 */
import { describe, it, expect } from 'vitest';
import { sanitizeReviewLogInput, type CreateReviewLogInput } from '../lib/services/reviewLogService';

function validInput(overrides: Partial<CreateReviewLogInput> = {}): CreateReviewLogInput {
  return {
    userId: 'user-1',
    grade: 3,
    state: 2,
    stability: 10.5,
    difficulty: 0.3,
    wasCorrect: true,
    reviewedAt: new Date('2026-04-06'),
    review_type: 'real',
    sessionType: 'MAIN' as any,
    questionId: 'q-1',
    conditionId: 'c-1',
    ...overrides,
  };
}

describe('sanitizeReviewLogInput', () => {
  it('passes valid input through unchanged', () => {
    const result = sanitizeReviewLogInput(validInput());
    expect(result.grade).toBe(3);
    expect(result.state).toBe(2);
    expect(result.stability).toBe(10.5);
    expect(result.difficulty).toBe(0.3);
    expect(result.review_type).toBe('real');
  });

  it('clamps grade to [0, 4]', () => {
    expect(sanitizeReviewLogInput(validInput({ grade: -1 })).grade).toBe(0);
    expect(sanitizeReviewLogInput(validInput({ grade: 5 })).grade).toBe(4);
  });

  it('clamps state to [0, 3]', () => {
    expect(sanitizeReviewLogInput(validInput({ state: -1 })).state).toBe(0);
    expect(sanitizeReviewLogInput(validInput({ state: 5 })).state).toBe(3);
  });

  it('clamps stability to >= 0', () => {
    expect(sanitizeReviewLogInput(validInput({ stability: -5 })).stability).toBe(0);
    expect(sanitizeReviewLogInput(validInput({ stability: 100 })).stability).toBe(100);
  });

  it('clamps difficulty to [0, 1]', () => {
    expect(sanitizeReviewLogInput(validInput({ difficulty: -0.1 })).difficulty).toBe(0);
    expect(sanitizeReviewLogInput(validInput({ difficulty: 1.5 })).difficulty).toBe(1);
  });

  it('clamps grade_continuous to [1, 4]', () => {
    expect(sanitizeReviewLogInput(validInput({ grade_continuous: 0.5 })).grade_continuous).toBe(1);
    expect(sanitizeReviewLogInput(validInput({ grade_continuous: 5 })).grade_continuous).toBe(4);
    expect(sanitizeReviewLogInput(validInput({ grade_continuous: null })).grade_continuous).toBeNull();
  });

  it('clamps implicit_confidence to [0, 1]', () => {
    expect(sanitizeReviewLogInput(validInput({ implicit_confidence: -0.1 })).implicit_confidence).toBe(0);
    expect(sanitizeReviewLogInput(validInput({ implicit_confidence: 1.5 })).implicit_confidence).toBe(1);
  });

  it('clamps retrievability to [0, 1]', () => {
    expect(sanitizeReviewLogInput(validInput({ retrievability: -0.1 })).retrievability).toBe(0);
    expect(sanitizeReviewLogInput(validInput({ retrievability: 1.5 })).retrievability).toBe(1);
  });

  it('ensures responseTimeMs >= 0', () => {
    expect(sanitizeReviewLogInput(validInput({ responseTimeMs: -100 })).responseTimeMs).toBe(0);
    expect(sanitizeReviewLogInput(validInput({ responseTimeMs: 5000 })).responseTimeMs).toBe(5000);
  });

  it('ensures elapsedDays >= 0', () => {
    expect(sanitizeReviewLogInput(validInput({ elapsedDays: -2 })).elapsedDays).toBe(0);
    expect(sanitizeReviewLogInput(validInput({ elapsedDays: 30 })).elapsedDays).toBe(30);
  });

  it('throws on invalid review_type', () => {
    expect(() => sanitizeReviewLogInput(validInput({ review_type: 'invalid' as any }))).toThrow('Invalid review_type');
  });

  it('handles NaN/Infinity in numeric fields', () => {
    const result = sanitizeReviewLogInput(validInput({
      stability: NaN,
      difficulty: Infinity,
      grade: -Infinity,
      grade_continuous: NaN,
      implicit_confidence: Infinity,
    }));
    expect(result.stability).toBe(0);
    expect(result.difficulty).toBe(0); // fallback for NaN
    expect(result.grade).toBe(0); // fallback for -Infinity
    expect(result.grade_continuous).toBeNull(); // NaN → null
    expect(result.implicit_confidence).toBeNull(); // Infinity → null (not finite)
  });

  it('converts undefined nullable fields to undefined (Prisma skip)', () => {
    const result = sanitizeReviewLogInput(validInput());
    expect(result.responseTimeMs).toBeUndefined();
    expect(result.hover_oscillations).toBeUndefined();
    expect(result.telemetry).toBeUndefined();
  });

  it('preserves all valid review types', () => {
    for (const rt of ['real', 'rapid_guess', 'cram', 'practice'] as const) {
      expect(sanitizeReviewLogInput(validInput({ review_type: rt })).review_type).toBe(rt);
    }
  });
});
