import { describe, it, expect, vi } from 'vitest';
import {
  CONFUSION_PAIRS,
  initSessionTracker,
  shouldShowMetacognition,
  getSessionMetacognitionSummary,
  generatePostSessionReflection,
  type SessionMissTracker,
} from '@/lib/metacognition';

/**
 * Metacognition Trigger System tests
 *
 * Tests the 4 trigger conditions:
 * 1. Consecutive misses (≥2 in same subcategory)
 * 2. Known confusion pairs (AFib vs AFlutter, etc.)
 * 3. High-yield miss (PANACEA yield ≥ 3)
 * 4. Random sampling (10%)
 * Plus: rate limiting, deduplication, session summaries
 */

describe('initSessionTracker', () => {
  it('returns empty tracker', () => {
    const tracker = initSessionTracker();
    expect(tracker.totalAnswered).toBe(0);
    expect(tracker.metacognitionCount).toBe(0);
    expect(tracker.consecutiveMissesBySubcategory.size).toBe(0);
    expect(tracker.metacognitionShown.size).toBe(0);
  });
});

describe('shouldShowMetacognition', () => {
  function makeParams(overrides: Partial<{
    isCorrect: boolean;
    conditionId: string;
    conditionName: string;
    subcategory: string;
    system: string;
    panaceYield: number;
  }> = {}) {
    return {
      isCorrect: false,
      conditionId: 'cond-1',
      conditionName: 'Atrial Fibrillation',
      subcategory: 'cardiology-arrhythmias',
      system: 'Cardiovascular',
      panaceYield: 2,
      tracker: initSessionTracker(),
      ...overrides,
    };
  }

  // ── Correct answers never trigger ──

  it('never triggers on correct answers', () => {
    const result = shouldShowMetacognition(makeParams({ isCorrect: true }));
    expect(result.shouldShow).toBe(false);
  });

  it('resets consecutive misses on correct answer', () => {
    const tracker = initSessionTracker();
    tracker.consecutiveMissesBySubcategory.set('cardiology', 3);

    shouldShowMetacognition({
      ...makeParams(),
      isCorrect: true,
      subcategory: 'cardiology',
      tracker,
    });

    expect(tracker.consecutiveMissesBySubcategory.get('cardiology')).toBe(0);
  });

  it('increments totalAnswered on every call', () => {
    const tracker = initSessionTracker();
    shouldShowMetacognition({ ...makeParams(), tracker });
    shouldShowMetacognition({ ...makeParams(), tracker });
    shouldShowMetacognition({ ...makeParams(), isCorrect: true, tracker });
    expect(tracker.totalAnswered).toBe(3);
  });

  // ── Trigger 1: Consecutive misses ──

  it('triggers on 2+ consecutive misses in same subcategory', () => {
    // Mock Math.random to prevent random-sampling trigger (10%) from firing
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const tracker = initSessionTracker();
    const params = makeParams({ tracker, subcategory: 'cardiology-arrhythmias', conditionName: 'Unknown Condition' });

    // First miss — no trigger (only 1 consecutive)
    const r1 = shouldShowMetacognition(params);
    expect(r1.shouldShow).toBe(false);

    // Second miss — trigger!
    const r2 = shouldShowMetacognition(params);
    expect(r2.shouldShow).toBe(true);
    expect(r2.triggerReason).toBe('consecutive_misses');
    expect(r2.reflectionQuestions.length).toBeGreaterThan(0);
    randomSpy.mockRestore();
  });

  // ── Trigger 2: Confusion pairs ──

  it('triggers on known confusion pair', () => {
    const result = shouldShowMetacognition(makeParams({
      conditionName: 'Atrial Fibrillation',
      subcategory: 'unique-subcat', // ensure not consecutive
    }));
    expect(result.shouldShow).toBe(true);
    expect(result.triggerReason).toBe('confusion_pair');
    expect(result.confusionPairInfo?.pairedCondition).toBe('Atrial Flutter');
  });

  it('triggers on confusion pair from either direction', () => {
    const r1 = shouldShowMetacognition(makeParams({
      conditionName: 'Crohn\'s Disease',
      subcategory: 'subcat1',
    }));
    expect(r1.confusionPairInfo?.pairedCondition).toBe('Ulcerative Colitis');

    const r2 = shouldShowMetacognition(makeParams({
      conditionName: 'Ulcerative Colitis',
      subcategory: 'subcat2',
    }));
    expect(r2.confusionPairInfo?.pairedCondition).toBe("Crohn's Disease");
  });

  it('does not trigger confusion pair for unrelated conditions', () => {
    // Mock Math.random to return > 0.1 so random sampling trigger doesn't fire
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = shouldShowMetacognition(makeParams({
      conditionName: 'Gout',
      subcategory: 'unique-subcat',
    }));
    // Not consecutive (1st miss), not a confusion pair, yield=2 (not high), random mocked out
    expect(result.shouldShow).toBe(false);
    randomSpy.mockRestore();
  });

  // ── Trigger 3: High-yield miss ──

  it('triggers on high-yield miss (yield ≥ 3)', () => {
    const result = shouldShowMetacognition(makeParams({
      conditionName: 'Rare Condition XYZ',
      subcategory: 'unique-subcat',
      panaceYield: 3,
    }));
    expect(result.shouldShow).toBe(true);
    expect(result.triggerReason).toBe('high_yield_miss');
  });

  // ── Deduplication ──

  it('does not trigger twice for same condition', () => {
    const tracker = initSessionTracker();
    const params = makeParams({
      tracker,
      conditionId: 'cond-1',
      conditionName: 'STEMI',
      subcategory: 'cardiology',
    });

    const r1 = shouldShowMetacognition(params); // confusion pair
    expect(r1.shouldShow).toBe(true);

    // Second call — same condition
    tracker.consecutiveMissesBySubcategory.set('cardiology', 0); // reset for clean test
    const r2 = shouldShowMetacognition(params);
    expect(r2.shouldShow).toBe(false); // already shown
  });

  // ── Rate limiting ──

  it('respects 30% rate limit', () => {
    const tracker = initSessionTracker();
    tracker.totalAnswered = 10;
    tracker.metacognitionCount = 4; // 40% — above 30% limit

    const result = shouldShowMetacognition(makeParams({
      tracker,
      conditionId: 'new-cond',
      conditionName: 'STEMI',
      subcategory: 'unique',
    }));
    expect(result.shouldShow).toBe(false);
  });

  // ── Updates tracker state ──

  it('updates system miss counts on incorrect answers', () => {
    const tracker = initSessionTracker();
    shouldShowMetacognition(makeParams({ tracker, system: 'Cardiovascular' }));
    expect(tracker.totalMissesBySystem.get('Cardiovascular')).toBe(1);
  });

  it('increments metacognitionCount when triggered', () => {
    const tracker = initSessionTracker();
    shouldShowMetacognition(makeParams({
      tracker,
      conditionName: 'STEMI', // confusion pair — guaranteed trigger
    }));
    expect(tracker.metacognitionCount).toBe(1);
    expect(tracker.metacognitionShown.has('cond-1')).toBe(true);
  });
});

describe('CONFUSION_PAIRS', () => {
  it('has at least 8 pairs', () => {
    expect(CONFUSION_PAIRS.length).toBeGreaterThanOrEqual(8);
  });

  it('each pair has required fields', () => {
    for (const pair of CONFUSION_PAIRS) {
      expect(pair.condition1).toBeTruthy();
      expect(pair.condition2).toBeTruthy();
      expect(pair.distinguishingFeature).toBeTruthy();
      expect(pair.clinicalPearl).toBeTruthy();
    }
  });
});

describe('getSessionMetacognitionSummary', () => {
  it('returns empty summary for fresh tracker', () => {
    const summary = getSessionMetacognitionSummary(initSessionTracker());
    expect(summary.totalAnswered).toBe(0);
    expect(summary.metacognitionRate).toBe(0);
    expect(summary.topMissedSubcategories).toEqual([]);
    expect(summary.topMissedSystems).toEqual([]);
  });

  it('computes correct metacognition rate', () => {
    const tracker = initSessionTracker();
    tracker.totalAnswered = 20;
    tracker.metacognitionCount = 5;
    const summary = getSessionMetacognitionSummary(tracker);
    expect(summary.metacognitionRate).toBe(0.25);
  });

  it('returns top 3 missed subcategories sorted by count', () => {
    const tracker = initSessionTracker();
    tracker.consecutiveMissesBySubcategory.set('cardiology', 5);
    tracker.consecutiveMissesBySubcategory.set('pulmonary', 3);
    tracker.consecutiveMissesBySubcategory.set('gi', 7);
    tracker.consecutiveMissesBySubcategory.set('neuro', 1); // should be excluded (too low)

    const summary = getSessionMetacognitionSummary(tracker);
    expect(summary.topMissedSubcategories[0]).toBe('gi');
    expect(summary.topMissedSubcategories[1]).toBe('cardiology');
    expect(summary.topMissedSubcategories[2]).toBe('pulmonary');
    expect(summary.topMissedSubcategories.length).toBe(3);
  });

  it('excludes subcategories with 0 misses', () => {
    const tracker = initSessionTracker();
    tracker.consecutiveMissesBySubcategory.set('cardiology', 3);
    tracker.consecutiveMissesBySubcategory.set('pulmonary', 0);

    const summary = getSessionMetacognitionSummary(tracker);
    expect(summary.topMissedSubcategories).toEqual(['cardiology']);
  });
});

describe('generatePostSessionReflection', () => {
  it('returns at least 2 reflections', () => {
    const reflections = generatePostSessionReflection(initSessionTracker());
    expect(reflections.length).toBeGreaterThanOrEqual(2);
  });

  it('includes missed subcategories in reflections', () => {
    const tracker = initSessionTracker();
    tracker.consecutiveMissesBySubcategory.set('cardiology', 5);
    tracker.totalMissesBySystem.set('Cardiovascular', 5);

    const reflections = generatePostSessionReflection(tracker);
    const combined = reflections.join(' ');
    expect(combined).toContain('cardiology');
    expect(combined).toContain('Cardiovascular');
  });
});
