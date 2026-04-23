// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/metacognition.ts
 *
 * Pure functions tested (deterministic paths only):
 *   initSessionTracker()               — creates empty tracker
 *   shouldShowMetacognition(params)    — deterministic triggers (consecutive_misses,
 *                                        confusion_pair, high_yield_miss, correct answers)
 *   getSessionMetacognitionSummary(t)  — aggregation from tracker state
 *   generatePostSessionReflection(t)  — list of reflection strings
 *
 * Constants:
 *   CONFUSION_PAIRS — array of known condition confusion pairs
 *
 * NOTE: The 'random_sample' trigger (10% of remaining misses) uses Math.random()
 *   and is non-deterministic; those cases are excluded.
 *   Tests use high-yield miss (panaceYield >= 3) and consecutive miss (>= 2)
 *   which are deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  initSessionTracker,
  shouldShowMetacognition,
  getSessionMetacognitionSummary,
  generatePostSessionReflection,
  CONFUSION_PAIRS,
  type SessionMissTracker,
} from './metacognition';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeParams(overrides: {
  isCorrect?: boolean;
  conditionId?: string;
  conditionName?: string;
  subcategory?: string;
  system?: string;
  panaceYield?: number;
  tracker?: SessionMissTracker;
}) {
  return {
    isCorrect: overrides.isCorrect ?? false,
    conditionId: overrides.conditionId ?? 'cond-1',
    conditionName: overrides.conditionName ?? 'Hypertension',
    subcategory: overrides.subcategory ?? 'Cardiology-General',
    system: overrides.system ?? 'Cardiovascular',
    panaceYield: overrides.panaceYield ?? 2,
    tracker: overrides.tracker ?? initSessionTracker(),
  };
}

// ─── CONFUSION_PAIRS ─────────────────────────────────────────────────────────

describe('CONFUSION_PAIRS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(CONFUSION_PAIRS)).toBe(true);
    expect(CONFUSION_PAIRS.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const pair of CONFUSION_PAIRS) {
      expect(typeof pair.condition1).toBe('string');
      expect(typeof pair.condition2).toBe('string');
      expect(typeof pair.distinguishingFeature).toBe('string');
      expect(typeof pair.clinicalPearl).toBe('string');
    }
  });

  it('contains AFib / AFlutter pair', () => {
    const pair = CONFUSION_PAIRS.find(p =>
      p.condition1.includes('Fibrillation') || p.condition2.includes('Fibrillation')
    );
    expect(pair).toBeDefined();
  });

  it('all field strings are non-empty', () => {
    for (const pair of CONFUSION_PAIRS) {
      expect(pair.condition1.length).toBeGreaterThan(0);
      expect(pair.condition2.length).toBeGreaterThan(0);
      expect(pair.distinguishingFeature.length).toBeGreaterThan(0);
      expect(pair.clinicalPearl.length).toBeGreaterThan(0);
    }
  });
});

// ─── initSessionTracker ───────────────────────────────────────────────────────

describe('initSessionTracker', () => {
  it('returns a tracker with empty maps and sets', () => {
    const tracker = initSessionTracker();
    expect(tracker.consecutiveMissesBySubcategory.size).toBe(0);
    expect(tracker.totalMissesBySystem.size).toBe(0);
    expect(tracker.metacognitionShown.size).toBe(0);
  });

  it('initializes totalAnswered and metacognitionCount to 0', () => {
    const tracker = initSessionTracker();
    expect(tracker.totalAnswered).toBe(0);
    expect(tracker.metacognitionCount).toBe(0);
  });
});

// ─── shouldShowMetacognition ──────────────────────────────────────────────────

describe('shouldShowMetacognition', () => {
  // ── Correct answers ──

  it('returns shouldShow=false for a correct answer', () => {
    const tracker = initSessionTracker();
    const result = shouldShowMetacognition(makeParams({ isCorrect: true, tracker }));
    expect(result.shouldShow).toBe(false);
    expect(result.reflectionQuestions).toHaveLength(0);
  });

  it('increments totalAnswered on correct answers', () => {
    const tracker = initSessionTracker();
    shouldShowMetacognition(makeParams({ isCorrect: true, tracker }));
    expect(tracker.totalAnswered).toBe(1);
  });

  it('resets consecutive miss count for subcategory on correct answer', () => {
    const tracker = initSessionTracker();
    // Miss once first
    shouldShowMetacognition(makeParams({ isCorrect: false, subcategory: 'Cardio', conditionId: 'c1', tracker }));
    // Then get it correct
    shouldShowMetacognition(makeParams({ isCorrect: true, subcategory: 'Cardio', conditionId: 'c2', tracker }));
    expect(tracker.consecutiveMissesBySubcategory.get('Cardio')).toBe(0);
  });

  // ── Consecutive misses trigger ──

  it('triggers consecutive_misses after 2 misses in same subcategory', () => {
    const tracker = initSessionTracker();
    const sub = 'Pulmonary-General';
    // First miss — no trigger yet
    const r1 = shouldShowMetacognition(makeParams({
      subcategory: sub, conditionId: 'c1', tracker,
    }));
    expect(r1.shouldShow).toBe(false);

    // Second miss — should trigger
    const r2 = shouldShowMetacognition(makeParams({
      subcategory: sub, conditionId: 'c2', tracker,
    }));
    expect(r2.shouldShow).toBe(true);
    expect(r2.triggerReason).toBe('consecutive_misses');
    expect(r2.reflectionQuestions.length).toBeGreaterThan(0);
  });

  it('consecutive_misses narrative includes the miss count', () => {
    const tracker = initSessionTracker();
    const sub = 'Neurology-General';
    shouldShowMetacognition(makeParams({ subcategory: sub, conditionId: 'n1', tracker }));
    const result = shouldShowMetacognition(makeParams({ subcategory: sub, conditionId: 'n2', tracker }));
    // One of the questions should mention the miss count (2)
    const combined = result.reflectionQuestions.join(' ');
    expect(combined).toContain('2');
  });

  // ── High yield trigger ──

  it('triggers high_yield_miss for panaceYield >= 3', () => {
    const tracker = initSessionTracker();
    const result = shouldShowMetacognition(makeParams({
      panaceYield: 3,
      conditionId: 'hy-1',
      conditionName: 'Some Obscure Condition',  // not in confusion pairs
      subcategory: 'unique-sub-hy',
      tracker,
    }));
    expect(result.shouldShow).toBe(true);
    expect(result.triggerReason).toBe('high_yield_miss');
  });

  it('does not trigger high_yield_miss for panaceYield < 3', () => {
    const tracker = initSessionTracker();
    // Avoid random_sample by using a condition not in confusion pairs and unique subcategory
    // We can't fully prevent random_sample but we check at least it's not high_yield
    const result = shouldShowMetacognition(makeParams({
      panaceYield: 2,
      conditionId: 'ly-1',
      conditionName: 'Some Condition',
      subcategory: 'unique-sub-ly',
      tracker,
    }));
    // May or may not show (random_sample) but if it shows, it's not high_yield
    if (result.shouldShow) {
      expect(result.triggerReason).not.toBe('high_yield_miss');
    }
  });

  // ── Confusion pair trigger ──

  it('triggers confusion_pair for known confusion pair conditions', () => {
    const tracker = initSessionTracker();
    // "Atrial Fibrillation" is in CONFUSION_PAIRS
    const result = shouldShowMetacognition(makeParams({
      conditionName: 'Atrial Fibrillation',
      conditionId: 'afib-1',
      subcategory: 'Cardiology-Rhythm',
      panaceYield: 1, // Not high-yield, so confusion pair fires
      tracker,
    }));
    expect(result.shouldShow).toBe(true);
    expect(result.triggerReason).toBe('confusion_pair');
    expect(result.confusionPairInfo).toBeDefined();
    expect(result.confusionPairInfo!.pairedCondition).toContain('Flutter');
  });

  // ── Already shown gate ──

  it('does not show metacognition twice for the same conditionId', () => {
    const tracker = initSessionTracker();
    const sub = 'Repeated-Sub';
    // Trigger consecutive_misses on first two misses
    shouldShowMetacognition(makeParams({ subcategory: sub, conditionId: 'x1', tracker }));
    const r2 = shouldShowMetacognition(makeParams({ subcategory: sub, conditionId: 'x2', tracker }));
    expect(r2.shouldShow).toBe(true); // x2 should show

    // Trying x2 again → already shown → blocked
    const r3 = shouldShowMetacognition(makeParams({ subcategory: sub, conditionId: 'x2', tracker }));
    expect(r3.shouldShow).toBe(false);
  });

  // ── Rate limit ──

  it('stops showing after metacognitionRate exceeds 30%', () => {
    const tracker = initSessionTracker();
    // Force high metacognitionCount relative to totalAnswered
    tracker.metacognitionCount = 4;
    tracker.totalAnswered = 10; // 40% rate

    const result = shouldShowMetacognition(makeParams({
      panaceYield: 5, // Would normally trigger high_yield
      conditionId: 'rate-limited',
      tracker,
    }));
    expect(result.shouldShow).toBe(false);
  });
});

// ─── getSessionMetacognitionSummary ───────────────────────────────────────────

describe('getSessionMetacognitionSummary', () => {
  it('returns zero rate for fresh tracker', () => {
    const summary = getSessionMetacognitionSummary(initSessionTracker());
    expect(summary.totalAnswered).toBe(0);
    expect(summary.metacognitionRate).toBe(0);
    expect(summary.topMissedSubcategories).toHaveLength(0);
    expect(summary.topMissedSystems).toHaveLength(0);
  });

  it('metacognitionRate = metacognitionCount / totalAnswered', () => {
    const tracker = initSessionTracker();
    tracker.totalAnswered = 10;
    tracker.metacognitionCount = 3;
    const summary = getSessionMetacognitionSummary(tracker);
    expect(summary.metacognitionRate).toBeCloseTo(0.3, 5);
  });

  it('topMissedSubcategories returns up to 3 subcategories with most misses', () => {
    const tracker = initSessionTracker();
    tracker.consecutiveMissesBySubcategory.set('Cardio', 5);
    tracker.consecutiveMissesBySubcategory.set('Pulm', 3);
    tracker.consecutiveMissesBySubcategory.set('Neuro', 7);
    tracker.consecutiveMissesBySubcategory.set('GI', 2);
    tracker.totalAnswered = 20;

    const summary = getSessionMetacognitionSummary(tracker);
    expect(summary.topMissedSubcategories).toHaveLength(3);
    expect(summary.topMissedSubcategories[0]).toBe('Neuro'); // Highest miss count
  });

  it('topMissedSubcategories excludes subcategories with 0 misses', () => {
    const tracker = initSessionTracker();
    tracker.consecutiveMissesBySubcategory.set('Cardio', 0);
    tracker.consecutiveMissesBySubcategory.set('Pulm', 3);
    tracker.totalAnswered = 10;

    const summary = getSessionMetacognitionSummary(tracker);
    expect(summary.topMissedSubcategories).not.toContain('Cardio');
  });

  it('topMissedSystems returns up to 3 systems sorted by miss count', () => {
    const tracker = initSessionTracker();
    tracker.totalMissesBySystem.set('Cardiovascular', 8);
    tracker.totalMissesBySystem.set('Pulmonary', 2);
    tracker.totalMissesBySystem.set('Neurology', 5);
    tracker.totalMissesBySystem.set('GI', 1);
    tracker.totalAnswered = 20;

    const summary = getSessionMetacognitionSummary(tracker);
    expect(summary.topMissedSystems).toHaveLength(3);
    expect(summary.topMissedSystems[0]).toBe('Cardiovascular');
  });
});

// ─── generatePostSessionReflection ───────────────────────────────────────────

describe('generatePostSessionReflection', () => {
  it('always includes generic reflection questions', () => {
    const reflections = generatePostSessionReflection(initSessionTracker());
    expect(reflections.length).toBeGreaterThanOrEqual(2);
    const combined = reflections.join(' ');
    expect(combined).toContain('pattern');
  });

  it('includes missed subcategory mentions when present', () => {
    const tracker = initSessionTracker();
    tracker.consecutiveMissesBySubcategory.set('Cardio', 5);
    tracker.consecutiveMissesBySubcategory.set('Neuro', 3);
    tracker.totalAnswered = 20;

    const reflections = generatePostSessionReflection(tracker);
    const combined = reflections.join(' ');
    expect(combined).toContain('Cardio');
  });

  it('includes missed systems mentions when present', () => {
    const tracker = initSessionTracker();
    tracker.totalMissesBySystem.set('Pulmonary', 4);
    tracker.totalAnswered = 10;

    const reflections = generatePostSessionReflection(tracker);
    const combined = reflections.join(' ');
    expect(combined).toContain('Pulmonary');
  });

  it('returns an array of non-empty strings', () => {
    const reflections = generatePostSessionReflection(initSessionTracker());
    expect(Array.isArray(reflections)).toBe(true);
    for (const r of reflections) {
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(0);
    }
  });
});
