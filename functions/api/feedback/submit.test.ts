/**
 * Validation hardening tests for POST /api/feedback/submit.
 * All free-text fields are persisted to QuestionFlag, so they must be length-bounded
 * and unknown fields rejected. Valid feedback passes unchanged.
 */
import { describe, it, expect } from 'vitest';
import { FeedbackSubmitSchema } from './submit';

const valid = {
  body: {
    questionId: 'q-123',
    flagType: 'typo' as const,
    description: 'There is a spelling error in option B.',
    questionText: 'A 54yo man presents with...',
    topic: 'Cardiology',
    system: 'CV',
  },
};

describe('FeedbackSubmitSchema', () => {
  it('accepts valid feedback', () => {
    expect(FeedbackSubmitSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts minimal feedback (optional fields omitted)', () => {
    expect(
      FeedbackSubmitSchema.safeParse({
        body: { questionId: 'q-1', flagType: 'other', description: 'x' },
      }).success
    ).toBe(true);
  });

  it('rejects an empty or oversized questionId', () => {
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, questionId: '' } }).success
    ).toBe(false);
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, questionId: 'x'.repeat(300) } })
        .success
    ).toBe(false);
  });

  it('rejects an invalid flagType', () => {
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, flagType: 'spam' } }).success
    ).toBe(false);
  });

  it('enforces description bounds (1..2000)', () => {
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, description: '' } }).success
    ).toBe(false);
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, description: 'x'.repeat(2001) } })
        .success
    ).toBe(false);
  });

  it('rejects oversized free-text (questionText/topic/system)', () => {
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, questionText: 'x'.repeat(5001) } })
        .success
    ).toBe(false);
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, topic: 'x'.repeat(201) } }).success
    ).toBe(false);
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, system: 'x'.repeat(101) } }).success
    ).toBe(false);
  });

  it('rejects unknown fields (.strict)', () => {
    expect(
      FeedbackSubmitSchema.safeParse({ body: { ...valid.body, isAdmin: true } }).success
    ).toBe(false);
  });
});
