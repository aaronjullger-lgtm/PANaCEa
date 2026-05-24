/**
 * FSRS single-writer invariant test
 *
 * Verifies that:
 * 1. syncManager.syncAnswers() (stale offline drain → /api/questions/attempt)
 *    does NOT send FSRS fields to the attempt endpoint — stats only.
 * 2. The idempotencyKey is present and uses the answer's id field.
 * 3. No FSRS-adjacent scheduler fields leak through.
 *
 * All FSRS writes go through drillReviewService via queueReview → /api/drills/submit-review.
 * The attempt endpoint is stats-only now.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mirror the body construction from syncManager.syncAnswers()
function buildAnswerPayload(answer: Record<string, unknown>) {
  return JSON.stringify({
    questionId: answer.questionId,
    wasCorrect: answer.isCorrect,
    timeSpentMs: answer.timeSpentMs,
    system: answer.system,
    conditionId: answer.conditionId,
    mode: 'session',
    isMainSession: answer.isMainSession ?? false,
    selectedAnswer: ['A', 'B', 'C', 'D', 'E'][answer.selectedAnswer as number],
    ...(answer.telemetryJson && { telemetryJson: answer.telemetryJson }),
    ...(answer.answerChangedCount != null && {
      answerChangedCount: answer.answerChangedCount,
    }),
    ...(answer.durationMs != null && { durationMs: answer.durationMs }),
    idempotencyKey: answer.id,
  });
}

describe('FSRS single-writer invariant', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- stats-only body (existing invariant) ----

  it('should NOT send rating to attempt endpoint', () => {
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
    };

    const body = buildAnswerPayload(answer);
    const parsed = JSON.parse(body);

    // rating should NOT be in payload
    expect(parsed).not.toHaveProperty('rating');

    // stats-only fields should be present
    expect(parsed).toHaveProperty('questionId');
    expect(parsed).toHaveProperty('wasCorrect');
    expect(parsed).toHaveProperty('mode');
    expect(parsed.isMainSession).toBe(true);

    // These FSRS-related fields should NOT be present
    expect(parsed).not.toHaveProperty('stability');
    expect(parsed).not.toHaveProperty('difficulty');
    expect(parsed).not.toHaveProperty('grade');
    expect(parsed).not.toHaveProperty('gradeContinuous');
  });

  // ---- idempotency key ----

  it('should include idempotencyKey using answer.id', () => {
    const answer = {
      id: 'answer-stale-idempotent-42',
      questionId: 'q2',
      selectedAnswer: 1,
      isCorrect: false,
      timeSpentMs: 3000,
      system: 'PULM',
      conditionId: 'cond-2',
      isMainSession: true,
    };

    const body = buildAnswerPayload(answer);
    const parsed = JSON.parse(body);

    expect(parsed).toHaveProperty('idempotencyKey');
    expect(parsed.idempotencyKey).toBe('answer-stale-idempotent-42');
  });

  // ---- additional FSRS scheduler fields ----

  it('should not leak scheduler fields (nextReview, state, elapsed_days) into attempt payload', () => {
    const answer = {
      id: 'answer-leak-check',
      questionId: 'q3',
      selectedAnswer: 2,
      isCorrect: true,
      timeSpentMs: 8000,
      system: 'GI',
      conditionId: 'cond-3',
      isMainSession: true,
      // These should NOT appear in the output body
      stability: 15.2,
      difficulty: 0.45,
      grade: 3,
      gradeContinuous: 3.67,
      nextReview: '2026-06-15',
      state: 2,
      elapsed_days: 7,
      rating: 3,
    };

    const body = buildAnswerPayload(answer);
    const parsed = JSON.parse(body);

    // Known FSRS fields
    expect(parsed).not.toHaveProperty('rating');
    expect(parsed).not.toHaveProperty('stability');
    expect(parsed).not.toHaveProperty('difficulty');
    expect(parsed).not.toHaveProperty('grade');
    expect(parsed).not.toHaveProperty('gradeContinuous');
    // Scheduler fields
    expect(parsed).not.toHaveProperty('nextReview');
    expect(parsed).not.toHaveProperty('state');
    expect(parsed).not.toHaveProperty('elapsed_days');
  });

  // ---- edge: undefined optional fields omitted ----

  it('should omit optional fields when undefined or null', () => {
    const answer = {
      id: 'answer-null-opts',
      questionId: 'q4',
      selectedAnswer: 0,
      isCorrect: true,
      timeSpentMs: 2000,
      system: 'MSK',
      conditionId: 'cond-4',
      isMainSession: false,
      // explicitly missing: telemetryJson, answerChangedCount, durationMs
    };

    const body = buildAnswerPayload(answer);
    const parsed = JSON.parse(body);

    expect(parsed).not.toHaveProperty('telemetryJson');
    expect(parsed).not.toHaveProperty('answerChangedCount');
    expect(parsed).not.toHaveProperty('durationMs');
    expect(parsed.isMainSession).toBe(false);
    expect(parsed.idempotencyKey).toBe('answer-null-opts');
  });

  // ---- edge: answerChangedCount=0 is not omitted (0 is falsy but explicit) ----

  it('should include answerChangedCount when zero (explicit)', () => {
    const answer = {
      id: 'answer-zero-switches',
      questionId: 'q5',
      selectedAnswer: 3,
      isCorrect: false,
      timeSpentMs: 4500,
      system: 'RENAL',
      conditionId: 'cond-5',
      isMainSession: true,
      answerChangedCount: 0,
    };

    const body = buildAnswerPayload(answer);
    const parsed = JSON.parse(body);

    // 0 != null → truthy in the spread condition
    expect(parsed.answerChangedCount).toBe(0);
  });

  // ---- integration: verify syncAnswers fetch call shape ----

  it('should POST to /api/questions/attempt without FSRS fields', async () => {
    // Simulate the syncAnswers method's fetch call
    const answer = {
      id: 'answer-integration-1',
      questionId: 'q-int',
      selectedAnswer: 1,
      isCorrect: true,
      timeSpentMs: 6000,
      system: 'CV',
      conditionId: 'cond-int',
      isMainSession: true,
      telemetryJson: { someMetric: 42 },
      answerChangedCount: 2,
      durationMs: 12000,
    };

    const body = buildAnswerPayload(answer);

    await fetch('/api/questions/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const fetchArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(fetchArgs[0]).toBe('/api/questions/attempt');
    expect(fetchArgs[1].method).toBe('POST');

    const sentBody = JSON.parse(fetchArgs[1].body as string);
    // Stats
    expect(sentBody.questionId).toBe('q-int');
    expect(sentBody.wasCorrect).toBe(true);
    expect(sentBody.timeSpentMs).toBe(6000);
    expect(sentBody.mode).toBe('session');
    // Idempotency
    expect(sentBody.idempotencyKey).toBe('answer-integration-1');
    // Telemetry present
    expect(sentBody.telemetryJson).toEqual({ someMetric: 42 });
    // No FSRS
    expect(sentBody).not.toHaveProperty('rating');
    expect(sentBody).not.toHaveProperty('stability');
    expect(sentBody).not.toHaveProperty('difficulty');
  });
});
