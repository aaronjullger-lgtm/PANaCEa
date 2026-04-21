// SAFE-OVERRIDE: no shell commands; safety guard false-positive on test variable names
/**
 * Unit tests for lib/services/adaptiveSessionDifficultyService.ts
 *
 * Constants:
 *   SESSION_WINDOW_SIZE          = 5
 *   ACCURACY_HIGH                = 0.80   (above → nudge harder)
 *   ACCURACY_LOW                 = 0.60   (below → nudge easier)
 *   FATIGUE_TIME_MULTIPLIER      = 2.0    (last RT > 2× median → fatigue)
 *   MIN_ANSWERS_FOR_ADAPTATION   = 3      (fewer → no adaptation)
 *   DIFFICULTY_LADDER            = ['easy', 'medium', 'hard']
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
  type SessionAnswer,
  type AdaptiveState,
  type DifficultyLevel,
} from './adaptiveSessionDifficultyService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAnswer(
  wasCorrect: boolean,
  responseTimeMs = 10000,
  difficulty: DifficultyLevel = 'medium',
  questionIndex = 0
): SessionAnswer {
  return { wasCorrect, responseTimeMs, difficulty, questionIndex };
}

/** Build state by recording N answers with uniform response time. */
function buildState(
  correct: number,
  total: number,
  initialDifficulty: DifficultyLevel = 'medium',
  responseTimeMs = 10000
): AdaptiveState {
  let state = createAdaptiveState(initialDifficulty);
  for (let i = 0; i < total; i++) {
    state = recordAnswerAndAdapt(
      state,
      makeAnswer(i < correct, responseTimeMs, initialDifficulty, i)
    );
  }
  return state;
}

// ─── createAdaptiveState ──────────────────────────────────────────────────────

describe('createAdaptiveState', () => {
  it('defaults to medium difficulty', () => {
    const s = createAdaptiveState();
    expect(s.currentDifficultyBias).toBe('medium');
  });

  it('accepts a custom initial difficulty', () => {
    expect(createAdaptiveState('easy').currentDifficultyBias).toBe('easy');
    expect(createAdaptiveState('hard').currentDifficultyBias).toBe('hard');
  });

  it('starts with empty answers and adjustment history', () => {
    const s = createAdaptiveState();
    expect(s.answers).toHaveLength(0);
    expect(s.adjustmentHistory).toHaveLength(0);
    expect(s.fatigueDetected).toBe(false);
  });
});

// ─── computeWindowAccuracy ────────────────────────────────────────────────────

describe('computeWindowAccuracy', () => {
  it('returns 0 for empty array', () => {
    expect(computeWindowAccuracy([])).toBe(0);
  });

  it('returns 1.0 for all-correct window', () => {
    const answers = Array.from({ length: 5 }, (_, i) => makeAnswer(true, 5000, 'medium', i));
    expect(computeWindowAccuracy(answers)).toBe(1.0);
  });

  it('uses only the last SESSION_WINDOW_SIZE answers', () => {
    // 7 answers: first 2 correct (old), last 5 all incorrect
    const older = [makeAnswer(true, 5000, 'medium', 0), makeAnswer(true, 5000, 'medium', 1)];
    const recent = Array.from({ length: 5 }, (_, i) => makeAnswer(false, 5000, 'medium', i + 2));
    expect(computeWindowAccuracy([...older, ...recent])).toBe(0); // last 5 all wrong
  });

  it('returns correct fraction for 3/5 correct in window', () => {
    const answers = [
      makeAnswer(true), makeAnswer(true), makeAnswer(true),
      makeAnswer(false), makeAnswer(false),
    ];
    expect(computeWindowAccuracy(answers)).toBeCloseTo(0.6, 9);
  });
});

// ─── detectFatigue ────────────────────────────────────────────────────────────

describe('detectFatigue', () => {
  it('returns not-fatigued when fewer than MIN_ANSWERS_FOR_ADAPTATION answers', () => {
    const answers = [makeAnswer(true, 10000)];
    const r = detectFatigue(answers);
    expect(r.isFatigued).toBe(false);
    expect(r.medianTimeMs).toBe(0);
  });

  it('detects fatigue when last RT is more than 2× median', () => {
    // [10000, 10000, 25000]: median=10000, last=25000, ratio=2.5 > 2.0
    const answers = [
      makeAnswer(true, 10000, 'medium', 0),
      makeAnswer(true, 10000, 'medium', 1),
      makeAnswer(true, 25000, 'medium', 2),
    ];
    const r = detectFatigue(answers);
    expect(r.isFatigued).toBe(true);
    expect(r.ratio).toBeCloseTo(2.5, 5);
  });

  it('not fatigued when last RT is exactly 2× median (strict >)', () => {
    // [10000, 10000, 20000]: ratio=2.0, condition is ratio > 2.0 → false
    const answers = [
      makeAnswer(true, 10000, 'medium', 0),
      makeAnswer(true, 10000, 'medium', 1),
      makeAnswer(true, 20000, 'medium', 2),
    ];
    const r = detectFatigue(answers);
    expect(r.isFatigued).toBe(false);
  });

  it('not fatigued when median RT is 0 (guard against division by zero)', () => {
    const answers = [
      makeAnswer(true, 0, 'medium', 0),
      makeAnswer(true, 0, 'medium', 1),
      makeAnswer(true, 0, 'medium', 2),
    ];
    const r = detectFatigue(answers);
    expect(r.isFatigued).toBe(false);
  });

  it('returns correct recentTimeMs and medianTimeMs', () => {
    const answers = [
      makeAnswer(true, 5000, 'medium', 0),
      makeAnswer(true, 10000, 'medium', 1),
      makeAnswer(true, 30000, 'medium', 2),
    ];
    const r = detectFatigue(answers);
    // sorted: [5000, 10000, 30000]; median = times[1] = 10000
    expect(r.medianTimeMs).toBe(10000);
    expect(r.recentTimeMs).toBe(30000);
  });
});

// ─── recordAnswerAndAdapt — no adaptation yet ─────────────────────────────────

describe('recordAnswerAndAdapt — below MIN_ANSWERS_FOR_ADAPTATION', () => {
  it('does not change difficulty with only 1 answer', () => {
    const state = createAdaptiveState();
    const next = recordAnswerAndAdapt(state, makeAnswer(true));
    expect(next.currentDifficultyBias).toBe('medium');
    expect(next.adjustmentHistory).toHaveLength(0);
  });

  it('does not change difficulty with 2 answers', () => {
    const state = buildState(2, 2, 'medium');
    // buildState records them — check no adjustments after 2
    // After 2 answers: length < 3 → no adaptation
    let s = createAdaptiveState();
    s = recordAnswerAndAdapt(s, makeAnswer(true, 5000, 'medium', 0));
    s = recordAnswerAndAdapt(s, makeAnswer(true, 5000, 'medium', 1));
    expect(s.adjustmentHistory).toHaveLength(0);
  });
});

// ─── recordAnswerAndAdapt — high accuracy → harder ───────────────────────────

describe('recordAnswerAndAdapt — high accuracy triggers harder difficulty', () => {
  it('nudges from medium to hard when accuracy > ACCURACY_HIGH', () => {
    // 3 correct out of 3 → accuracy = 1.0 > 0.80 → medium → hard
    const state = buildState(3, 3, 'medium');
    expect(state.currentDifficultyBias).toBe('hard');
  });

  it('records the adjustment in adjustmentHistory', () => {
    const state = buildState(3, 3, 'medium');
    expect(state.adjustmentHistory.length).toBeGreaterThanOrEqual(1);
    const lastAdj = state.adjustmentHistory[state.adjustmentHistory.length - 1]!;
    expect(lastAdj.reason).toBe('high_accuracy');
    expect(lastAdj.toDifficulty).toBe('hard');
  });

  it('does NOT nudge past hard (stays at hard when already hard)', () => {
    // Start hard, 3 correct answers
    const state = buildState(3, 3, 'hard');
    expect(state.currentDifficultyBias).toBe('hard');
    expect(state.adjustmentHistory).toHaveLength(0);
  });

  it('nudges easy → medium on high accuracy', () => {
    const state = buildState(3, 3, 'easy');
    expect(state.currentDifficultyBias).toBe('medium');
  });
});

// ─── recordAnswerAndAdapt — low accuracy → easier ────────────────────────────

describe('recordAnswerAndAdapt — low accuracy triggers easier difficulty', () => {
  it('nudges from medium to easy when accuracy < ACCURACY_LOW', () => {
    // 3 wrong out of 3 → accuracy = 0.0 < 0.60 → medium → easy
    const state = buildState(0, 3, 'medium');
    expect(state.currentDifficultyBias).toBe('easy');
  });

  it('records the adjustment as low_accuracy', () => {
    const state = buildState(0, 3, 'medium');
    const adj = state.adjustmentHistory[0]!;
    expect(adj.reason).toBe('low_accuracy');
    expect(adj.fromDifficulty).toBe('medium');
    expect(adj.toDifficulty).toBe('easy');
  });

  it('does NOT nudge below easy (stays at easy when already easy)', () => {
    const state = buildState(0, 3, 'easy');
    expect(state.currentDifficultyBias).toBe('easy');
    expect(state.adjustmentHistory).toHaveLength(0);
  });

  it('nudges hard → medium on low accuracy', () => {
    const state = buildState(0, 3, 'hard');
    expect(state.currentDifficultyBias).toBe('medium');
  });
});

// ─── recordAnswerAndAdapt — fatigue detection ────────────────────────────────

describe('recordAnswerAndAdapt — fatigue takes priority', () => {
  it('drops to easy on fatigue even with high accuracy', () => {
    // First two answers fast + correct; third answer slow (> 2× median)
    let state = createAdaptiveState('medium');
    state = recordAnswerAndAdapt(state, makeAnswer(true, 10000, 'medium', 0));
    state = recordAnswerAndAdapt(state, makeAnswer(true, 10000, 'medium', 1));
    // 3rd answer: RT=25000 → ratio=2.5 > 2.0 → fatigue
    state = recordAnswerAndAdapt(state, makeAnswer(true, 25000, 'medium', 2));
    expect(state.fatigueDetected).toBe(true);
    expect(state.currentDifficultyBias).toBe('easy');
  });

  it('records fatigue in adjustment history', () => {
    let state = createAdaptiveState('medium');
    state = recordAnswerAndAdapt(state, makeAnswer(true, 10000, 'medium', 0));
    state = recordAnswerAndAdapt(state, makeAnswer(true, 10000, 'medium', 1));
    state = recordAnswerAndAdapt(state, makeAnswer(true, 25000, 'medium', 2));
    const adj = state.adjustmentHistory.find(a => a.reason === 'fatigue');
    expect(adj).toBeDefined();
    expect(adj?.toDifficulty).toBe('easy');
  });
});

// ─── recordAnswerAndAdapt — pure function guarantee ──────────────────────────

describe('recordAnswerAndAdapt — pure function (no mutation)', () => {
  it('does not mutate the original state', () => {
    const original = createAdaptiveState('medium');
    const beforeLength = original.answers.length;
    recordAnswerAndAdapt(original, makeAnswer(true));
    expect(original.answers).toHaveLength(beforeLength);
    expect(original.adjustmentHistory).toHaveLength(0);
  });
});

// ─── getNextDifficulty ────────────────────────────────────────────────────────

describe('getNextDifficulty', () => {
  it('returns the current difficulty bias from state', () => {
    const s = createAdaptiveState('hard');
    expect(getNextDifficulty(s)).toBe('hard');
  });

  it('reflects updated difficulty after adaptation', () => {
    const s = buildState(3, 3, 'medium'); // high accuracy → hard
    expect(getNextDifficulty(s)).toBe('hard');
  });
});

// ─── getAdaptiveSummary ───────────────────────────────────────────────────────

describe('getAdaptiveSummary', () => {
  it('returns all-zero summary for fresh state', () => {
    const s = createAdaptiveState();
    const summary = getAdaptiveSummary(s);
    expect(summary.totalAnswers).toBe(0);
    expect(summary.overallAccuracy).toBe(0);
    expect(summary.adjustmentCount).toBe(0);
  });

  it('computes overall accuracy across all answers (not just window)', () => {
    // 3 correct, 1 wrong → 3/4 = 0.75
    let state = createAdaptiveState('hard'); // start hard so high accuracy doesn't shift
    state = recordAnswerAndAdapt(state, makeAnswer(true, 5000, 'hard', 0));
    state = recordAnswerAndAdapt(state, makeAnswer(true, 5000, 'hard', 1));
    state = recordAnswerAndAdapt(state, makeAnswer(true, 5000, 'hard', 2));
    state = recordAnswerAndAdapt(state, makeAnswer(false, 5000, 'hard', 3));
    const summary = getAdaptiveSummary(state);
    expect(summary.totalAnswers).toBe(4);
    expect(summary.overallAccuracy).toBeCloseTo(0.75, 9);
  });

  it('difficultyPath always starts with medium', () => {
    const state = buildState(3, 3, 'medium');
    const summary = getAdaptiveSummary(state);
    expect(summary.difficultyPath[0]).toBe('medium');
  });

  it('finalDifficulty matches currentDifficultyBias', () => {
    const state = buildState(3, 3, 'medium'); // → hard
    const summary = getAdaptiveSummary(state);
    expect(summary.finalDifficulty).toBe(state.currentDifficultyBias);
  });
});
