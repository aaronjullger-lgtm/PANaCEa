/**
 * Unit tests for lib/services/progressiveDifficultyService.ts
 *
 * Only getNextDifficultyLevel is tested — the other exports (getQuestionByDifficulty,
 * getPerformanceMetrics) require Prisma and belong in integration tests.
 *
 * Key thresholds (from source):
 *   ACCURACY_THRESHOLD_UP     = 0.9   (accuracy > 0.9 → candidate for increase)
 *   ACCURACY_THRESHOLD_DOWN   = 0.7   (accuracy < 0.7 → decrease)
 *   RESPONSE_TIME_THRESHOLD_FAST = 5000ms
 *   RESPONSE_TIME_THRESHOLD_SLOW = 20000ms
 *
 * Rules:
 *   1. accuracy > 0.9 AND responseTime < 5000  → increase difficulty
 *   2. accuracy < 0.7                           → decrease difficulty
 *   3. accuracy stable [0.7, 0.9]:
 *        responseTime > 20000  → decrease
 *        responseTime < 5000   → increase
 *        else                  → maintain
 */

import { describe, it, expect } from 'vitest';
import {
  getNextDifficultyLevel,
  type DifficultyLevel,
  type PerformanceMetrics,
} from './progressiveDifficultyService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMetrics(partial: Partial<Omit<PerformanceMetrics, 'userId'>>): PerformanceMetrics {
  return {
    userId: 'test-user',
    rollingAccuracy: partial.rollingAccuracy ?? 0.8,
    averageResponseTime: partial.averageResponseTime ?? 10000, // stable / neutral
    recentPerformance: { correct: 8, total: 10 },
    ...partial,
  };
}

// ─── Difficulty transition helpers ───────────────────────────────────────────

describe('getNextDifficultyLevel — difficulty transitions', () => {
  it('easy → medium when increasing', () => {
    const metrics = makeMetrics({ rollingAccuracy: 0.95, averageResponseTime: 3000 });
    expect(getNextDifficultyLevel(metrics, 'easy')).toBe('medium');
  });

  it('medium → hard when increasing', () => {
    const metrics = makeMetrics({ rollingAccuracy: 0.95, averageResponseTime: 3000 });
    expect(getNextDifficultyLevel(metrics, 'medium')).toBe('hard');
  });

  it('hard stays hard when increasing (max difficulty)', () => {
    const metrics = makeMetrics({ rollingAccuracy: 0.95, averageResponseTime: 3000 });
    expect(getNextDifficultyLevel(metrics, 'hard')).toBe('hard');
  });

  it('hard → medium when decreasing', () => {
    const metrics = makeMetrics({ rollingAccuracy: 0.6, averageResponseTime: 10000 });
    expect(getNextDifficultyLevel(metrics, 'hard')).toBe('medium');
  });

  it('medium → easy when decreasing', () => {
    const metrics = makeMetrics({ rollingAccuracy: 0.6, averageResponseTime: 10000 });
    expect(getNextDifficultyLevel(metrics, 'medium')).toBe('easy');
  });

  it('easy stays easy when decreasing (min difficulty)', () => {
    const metrics = makeMetrics({ rollingAccuracy: 0.6, averageResponseTime: 10000 });
    expect(getNextDifficultyLevel(metrics, 'easy')).toBe('easy');
  });
});

// ─── Accuracy-driven decisions ────────────────────────────────────────────────

describe('getNextDifficultyLevel — accuracy-driven', () => {
  it('increases when accuracy > 0.9 AND responseTime < 5000ms (fast+accurate)', () => {
    const metrics = makeMetrics({ rollingAccuracy: 0.91, averageResponseTime: 4999 });
    expect(getNextDifficultyLevel(metrics, 'easy')).toBe('medium');
  });

  it('does NOT increase when accuracy > 0.9 but responseTime >= 5000ms (accurate but slow)', () => {
    // High accuracy but slow → maintains (not increased)
    const metrics = makeMetrics({ rollingAccuracy: 0.91, averageResponseTime: 5000 });
    // RT >= 5000 and RT <= 20000 → stable accuracy branch → maintain
    expect(getNextDifficultyLevel(metrics, 'easy')).toBe('easy');
  });

  it('decreases when accuracy < 0.7 (regardless of response time)', () => {
    // Slow response time doesn't matter; accuracy triggers decrease
    const metrics = makeMetrics({ rollingAccuracy: 0.69, averageResponseTime: 3000 });
    expect(getNextDifficultyLevel(metrics, 'hard')).toBe('medium');
  });

  it('accuracy exactly at 0.9 does not trigger increase', () => {
    // Rule is accuracy > 0.9 (strict), so 0.9 falls into stable zone
    const metrics = makeMetrics({ rollingAccuracy: 0.9, averageResponseTime: 3000 });
    // Stable accuracy, fast RT → increase
    expect(getNextDifficultyLevel(metrics, 'easy')).toBe('medium');
  });

  it('accuracy exactly at 0.7 does not trigger decrease', () => {
    // Rule is accuracy < 0.7 (strict), so 0.7 falls into stable zone
    const metrics = makeMetrics({ rollingAccuracy: 0.7, averageResponseTime: 10000 });
    // Stable accuracy, neutral RT → maintain
    expect(getNextDifficultyLevel(metrics, 'medium')).toBe('medium');
  });
});

// ─── Response-time-driven decisions (stable accuracy zone) ────────────────────

describe('getNextDifficultyLevel — response-time-driven (stable accuracy)', () => {
  const stableAccuracy = 0.8; // In [0.7, 0.9] zone

  it('decreases when responseTime > 20000ms (too slow)', () => {
    const metrics = makeMetrics({ rollingAccuracy: stableAccuracy, averageResponseTime: 20001 });
    expect(getNextDifficultyLevel(metrics, 'hard')).toBe('medium');
  });

  it('increases when responseTime < 5000ms (fast response)', () => {
    const metrics = makeMetrics({ rollingAccuracy: stableAccuracy, averageResponseTime: 4999 });
    expect(getNextDifficultyLevel(metrics, 'easy')).toBe('medium');
  });

  it('maintains when responseTime is in neutral range [5000, 20000]', () => {
    for (const rt of [5000, 10000, 15000, 20000]) {
      const metrics = makeMetrics({ rollingAccuracy: stableAccuracy, averageResponseTime: rt });
      expect(getNextDifficultyLevel(metrics, 'medium'), `rt=${rt}`).toBe('medium');
    }
  });

  it('decreases exactly at responseTime = 20001ms (boundary above slow threshold)', () => {
    const metrics = makeMetrics({ rollingAccuracy: stableAccuracy, averageResponseTime: 20001 });
    expect(getNextDifficultyLevel(metrics, 'medium')).toBe('easy');
  });
});

// ─── Return type ──────────────────────────────────────────────────────────────

describe('getNextDifficultyLevel — return type', () => {
  it('always returns a valid DifficultyLevel string', () => {
    const validLevels: DifficultyLevel[] = ['easy', 'medium', 'hard'];
    const accuracies = [0.5, 0.7, 0.8, 0.9, 0.95];
    const times = [1000, 5000, 10000, 20000, 30000];
    const levels: DifficultyLevel[] = ['easy', 'medium', 'hard'];

    for (const acc of accuracies) {
      for (const rt of times) {
        for (const level of levels) {
          const result = getNextDifficultyLevel(
            makeMetrics({ rollingAccuracy: acc, averageResponseTime: rt }),
            level
          );
          expect(validLevels).toContain(result);
        }
      }
    }
  });
});
