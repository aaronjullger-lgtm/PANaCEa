/**
 * Tests for lib/confidence/interferenceDetector.ts
 */

import { describe, it, expect } from 'vitest';
import {
  detectInterference,
  DEFAULT_INTERFERENCE_CONFIG,
  type InterferenceConfig,
  type SessionReviewEntry,
} from '@/lib/confidence/interferenceDetector';

describe('detectInterference', () => {
  it('returns no interference for empty history', () => {
    const result = detectInterference('cond-1', [], []);
    expect(result.detected).toBe(false);
    expect(result.discount).toBe(1.0);
    expect(result.details.type).toBe('none');
  });

  it('returns no interference for null/empty conditionId', () => {
    const result = detectInterference('', [], [{ conditionId: 'cond-1', position: 1 }]);
    expect(result.detected).toBe(false);
  });

  it('returns no interference when no overlapping cards', () => {
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-2', position: 1 },
      { conditionId: 'cond-3', position: 2 },
    ];
    const result = detectInterference('cond-1', ['cond-4'], history);
    expect(result.detected).toBe(false);
    expect(result.discount).toBe(1.0);
  });

  it('detects same-condition interference', () => {
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-2', position: 1 },
      { conditionId: 'cond-1', position: 2 },
      { conditionId: 'cond-3', position: 3 },
    ];
    const result = detectInterference('cond-1', [], history);
    expect(result.detected).toBe(true);
    expect(result.details.type).toBe('same_condition');
    expect(result.details.interferingCount).toBe(1);
    // currentPosition = last.position + 1 = 4; distance to cond-1 at pos 2 = 4 - 2 = 2
    expect(result.details.closestDistance).toBe(2);
    expect(result.discount).toBeLessThan(1.0);
  });

  it('detects confusion-pair interference', () => {
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-2', position: 1 },
      { conditionId: 'cond-3', position: 2 },
    ];
    const result = detectInterference('cond-1', ['cond-2'], history);
    expect(result.detected).toBe(true);
    expect(result.details.type).toBe('confusion_pair');
    expect(result.details.interferingCount).toBe(1);
    expect(result.discount).toBeLessThan(1.0);
  });

  it('same-condition takes priority over confusion-pair type', () => {
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-1', position: 1 },
      { conditionId: 'cond-2', position: 2 },
    ];
    const result = detectInterference('cond-1', ['cond-2'], history);
    expect(result.details.type).toBe('same_condition');
  });

  it('closer interference produces larger discount', () => {
    const farHistory: SessionReviewEntry[] = [
      { conditionId: 'cond-1', position: 1 },
      { conditionId: 'cond-3', position: 2 },
    ];
    const nearHistory: SessionReviewEntry[] = [
      { conditionId: 'cond-3', position: 1 },
      { conditionId: 'cond-1', position: 2 },
    ];

    const far = detectInterference('cond-1', [], farHistory);
    const near = detectInterference('cond-1', [], nearHistory);
    expect(near.discount).toBeLessThan(far.discount);
  });

  it('discount decays with distance', () => {
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-1', position: 1 },
      { conditionId: 'cond-3', position: 5 },
      { conditionId: 'cond-3', position: 9 },
    ];
    const result = detectInterference('cond-1', [], history);
    expect(result.discount).toBeGreaterThan(DEFAULT_INTERFERENCE_CONFIG.sameConditionMinDiscount);
    expect(result.discount).toBeLessThan(1.0);
  });

  it('respects lookbackWindow config', () => {
    const config: InterferenceConfig = { ...DEFAULT_INTERFERENCE_CONFIG, lookbackWindow: 2 };
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-1', position: 1 },
      { conditionId: 'cond-3', position: 2 },
      { conditionId: 'cond-1', position: 3 },
    ];
    const result = detectInterference('cond-1', [], history, config);
    expect(result.details.interferingCount).toBe(1);
  });

  it('counts multiple interfering cards', () => {
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-1', position: 1 },
      { conditionId: 'cond-2', position: 2 },
      { conditionId: 'cond-1', position: 3 },
    ];
    const result = detectInterference('cond-1', ['cond-2'], history);
    expect(result.details.interferingCount).toBeGreaterThanOrEqual(2);
  });

  it('discount is always >= sameConditionMinDiscount', () => {
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-1', position: 1 },
      { conditionId: 'cond-3', position: 2 },
    ];
    const result = detectInterference('cond-1', [], history);
    expect(result.discount).toBeGreaterThanOrEqual(DEFAULT_INTERFERENCE_CONFIG.sameConditionMinDiscount);
  });

  it('reports no interference for non-overlapping single entry', () => {
    const history: SessionReviewEntry[] = [
      { conditionId: 'cond-other', position: 1 },
    ];
    const result = detectInterference('cond-1', [], history);
    expect(result.detected).toBe(false);
  });
});
