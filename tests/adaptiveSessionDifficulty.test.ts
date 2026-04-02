/**
 * Tests for adaptiveSessionDifficultyService — Sprint 2E
 *
 * All functions are pure (no DB) — fully testable.
 */

import { describe, it, expect } from 'vitest';
import {
  createAdaptiveState,
  recordAnswerAndAdapt,
  detectFatigue,
  computeWindowAccuracy,
  getNextDifficulty,
  getAdaptiveSummary,
  SESSION_WINDOW_SIZE,
  ACCURACY_HIGH,
  ACCURACY_LOW,
  FATIGUE_TIME_MULTIPLIER,
  MIN_ANSWERS_FOR_ADAPTATION,
  type SessionAnswer,
  type DifficultyLevel,
} from '../lib/services/adaptiveSessionDifficultyService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAnswer(
  index: number,
  correct: boolean,
  difficulty: DifficultyLevel = 'medium',
  timeMs: number = 30000
): SessionAnswer {
  return { wasCorrect: correct, responseTimeMs: timeMs, difficulty, questionIndex: index };
}
// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Adaptive Session Difficulty — State Management', () => {
  it('creates initial state with medium bias', () => {
    const state = createAdaptiveState();
    expect(state.currentDifficultyBias).toBe('medium');
    expect(state.answers).toHaveLength(0);
    expect(state.fatigueDetected).toBe(false);
    expect(state.adjustmentHistory).toHaveLength(0);
  });

  it('creates initial state with custom difficulty', () => {
    const state = createAdaptiveState('easy');
    expect(state.currentDifficultyBias).toBe('easy');
  });
});

describe('Adaptive Session Difficulty — No Adaptation Before Minimum', () => {
  it('does not adjust before MIN_ANSWERS_FOR_ADAPTATION', () => {
    let state = createAdaptiveState();
    // Add answers below threshold — all correct, should NOT trigger adjustment
    for (let i = 0; i < MIN_ANSWERS_FOR_ADAPTATION - 1; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, true));
    }
    expect(state.currentDifficultyBias).toBe('medium');
    expect(state.adjustmentHistory).toHaveLength(0);
  });
});
describe('Adaptive Session Difficulty — Difficulty Adjustment', () => {
  it('nudges harder when accuracy > 80%', () => {
    let state = createAdaptiveState();
    // 5 correct answers in a row → accuracy = 100% > 80%
    for (let i = 0; i < SESSION_WINDOW_SIZE; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, true));
    }
    expect(state.currentDifficultyBias).toBe('hard');
    expect(state.adjustmentHistory.length).toBeGreaterThan(0);
    expect(state.adjustmentHistory[0]!.reason).toBe('high_accuracy');
  });

  it('nudges easier when accuracy < 60%', () => {
    let state = createAdaptiveState();
    // 5 wrong answers → accuracy = 0% < 60%
    for (let i = 0; i < SESSION_WINDOW_SIZE; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, false));
    }
    expect(state.currentDifficultyBias).toBe('easy');
    expect(state.adjustmentHistory.some(a => a.reason === 'low_accuracy')).toBe(true);
  });

  it('stays at medium when accuracy is in the optimal zone', () => {
    let state = createAdaptiveState();
    // 3 correct, 2 wrong → 60% (at boundary, not < 60%)
    const pattern = [true, true, false, true, false];
    for (let i = 0; i < pattern.length; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, pattern[i]!));
    }
    // 60% is not > 80% and not < 60%, so should stay medium
    expect(state.currentDifficultyBias).toBe('medium');
  });
  it('does not go above hard or below easy', () => {
    // Already hard + still doing well
    let state = createAdaptiveState('hard');
    for (let i = 0; i < SESSION_WINDOW_SIZE; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, true));
    }
    expect(state.currentDifficultyBias).toBe('hard'); // Stays, no crash

    // Already easy + still struggling
    state = createAdaptiveState('easy');
    for (let i = 0; i < SESSION_WINDOW_SIZE; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, false));
    }
    expect(state.currentDifficultyBias).toBe('easy'); // Stays, no crash
  });
});

describe('Adaptive Session Difficulty — Fatigue Detection', () => {
  it('detects fatigue when response time > 2x median', () => {
    // 4 normal answers at 30s, then 1 at 90s
    const answers: SessionAnswer[] = [
      makeAnswer(0, true, 'medium', 30000),
      makeAnswer(1, true, 'medium', 28000),
      makeAnswer(2, false, 'medium', 32000),
      makeAnswer(3, true, 'medium', 30000),
      makeAnswer(4, false, 'medium', 90000), // 3x median
    ];
    const signal = detectFatigue(answers);
    expect(signal.isFatigued).toBe(true);
    // median of [28000,30000,30000,32000,90000] = 30000
    expect(signal.ratio).toBeGreaterThan(FATIGUE_TIME_MULTIPLIER);
  });
  it('does not flag fatigue for normal response times', () => {
    const answers: SessionAnswer[] = [
      makeAnswer(0, true, 'medium', 30000),
      makeAnswer(1, true, 'medium', 35000),
      makeAnswer(2, false, 'medium', 28000),
      makeAnswer(3, true, 'medium', 33000),
      makeAnswer(4, false, 'medium', 32000),
    ];
    const signal = detectFatigue(answers);
    expect(signal.isFatigued).toBe(false);
  });

  it('drops to easy on fatigue even if accuracy is high', () => {
    let state = createAdaptiveState('hard');
    // Good answers but last one is super slow
    for (let i = 0; i < 4; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, true, 'hard', 25000));
    }
    // Fatigued answer
    state = recordAnswerAndAdapt(state, makeAnswer(4, true, 'hard', 80000));
    expect(state.fatigueDetected).toBe(true);
    expect(state.currentDifficultyBias).toBe('easy');
    expect(state.adjustmentHistory.some(a => a.reason === 'fatigue')).toBe(true);
  });
});

describe('Adaptive Session Difficulty — Window Accuracy', () => {
  it('computes accuracy over last N answers', () => {
    // 3 correct out of 5 = 60%
    const answers: SessionAnswer[] = [
      makeAnswer(0, true), makeAnswer(1, false), makeAnswer(2, true),
      makeAnswer(3, false), makeAnswer(4, true),
    ];
    expect(computeWindowAccuracy(answers)).toBeCloseTo(0.6);
  });

  it('returns 0 for empty answers', () => {
    expect(computeWindowAccuracy([])).toBe(0);
  });
});
describe('Adaptive Session Difficulty — Summary', () => {
  it('produces a valid summary after a session', () => {
    let state = createAdaptiveState();
    // Simulate a short session: 3 correct then 2 wrong
    for (let i = 0; i < 3; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, true));
    }
    for (let i = 3; i < 5; i++) {
      state = recordAnswerAndAdapt(state, makeAnswer(i, false));
    }

    const summary = getAdaptiveSummary(state);
    expect(summary.totalAnswers).toBe(5);
    expect(summary.overallAccuracy).toBeCloseTo(0.6); // 3/5
    expect(summary.difficultyPath[0]).toBe('medium'); // always starts medium
    expect(summary.fatigueDetected).toBe(false);
  });
});

describe('Adaptive Session Difficulty — Cold-Start Constants', () => {
  it('calibration constants are sensible', () => {
    expect(SESSION_WINDOW_SIZE).toBeGreaterThanOrEqual(3);
    expect(ACCURACY_HIGH).toBeGreaterThan(ACCURACY_LOW);
    expect(FATIGUE_TIME_MULTIPLIER).toBeGreaterThan(1);
    expect(MIN_ANSWERS_FOR_ADAPTATION).toBeGreaterThanOrEqual(3);
  });
});
