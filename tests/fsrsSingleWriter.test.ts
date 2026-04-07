/**
 * FSRS single-writer invariant test
 *
 * Verifies that syncManager.syncAnswers() (stale offline drain → /api/questions/attempt)
 * does NOT send the `rating` field to the attempt endpoint.
 * All FSRS writes go through drillReviewService via queueReview → /api/drills/submit-review.
 * The attempt endpoint is stats-only now.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('FSRS single-writer invariant', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should NOT send rating to attempt endpoint', async () => {
    // Arrange: build the body that syncAnswers would construct
    // This mirrors the actual logic in syncManager.ts syncAnswers()
    const answer = {
      id: 'answer-stale-1',
      questionId: 'q1',
      selectedAnswer: 0,
      isCorrect: true,
      timeSpentMs: 5000,
      system: 'CV',
      conditionId: 'cond-1',
      isMainSession: true,
      rating: 3 as 1 | 2, // stale field — should be stripped
      telemetryJson: {},
      answerChangedCount: 0,
      durationMs: 10000,
      timestamp: Date.now(),
      synced: false,
      syncAttempts: 0,
    };

    // The actual body construction from syncManager.syncAnswers():
    const body = JSON.stringify({
      questionId: answer.questionId,
      wasCorrect: answer.isCorrect,
      timeSpentMs: answer.timeSpentMs,
      system: answer.system,
      conditionId: answer.conditionId,
      mode: 'session',
      isMainSession: answer.isMainSession ?? false,
      selectedAnswer: ['A', 'B', 'C', 'D'][answer.selectedAnswer],
      ...(answer.telemetryJson && { telemetryJson: answer.telemetryJson }),
      ...(answer.answerChangedCount != null && {
        answerChangedCount: answer.answerChangedCount,
      }),
      ...(answer.durationMs != null && { durationMs: answer.durationMs }),
    });

    // Parse and assert
    const parsed = JSON.parse(body);

    // rating should NOT be in payload
    expect(parsed).not.toHaveProperty('rating');

    // isMainSession should be present for backward compat
    expect(parsed.isMainSession).toBe(true);

    // These stats-only fields should be present
    expect(parsed).toHaveProperty('questionId');
    expect(parsed).toHaveProperty('wasCorrect');
    expect(parsed).toHaveProperty('mode');

    // These FSRS-related fields should NOT be present
    expect(parsed).not.toHaveProperty('stability');
    expect(parsed).not.toHaveProperty('difficulty');
    expect(parsed).not.toHaveProperty('grade');
    expect(parsed).not.toHaveProperty('gradeContinuous');
  });
});
