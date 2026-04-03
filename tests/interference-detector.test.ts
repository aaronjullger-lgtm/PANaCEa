/**
 * Tests for Retrieval Interference Detector
 * Sprint 3 of Confidence Pipeline v3
 */
import { describe, it, expect } from 'vitest';
import {
  detectInterference,
  DEFAULT_INTERFERENCE_CONFIG,
  type SessionReviewEntry,
  type InterferenceConfig,
} from '../lib/confidence/interferenceDetector';

describe('Retrieval Interference Detector', () => {
  describe('no interference cases', () => {
    it('returns 1.0 for empty session history', () => {
      const result = detectInterference('cond-A', ['cond-B'], []);
      expect(result.discount).toBe(1.0);
      expect(result.detected).toBe(false);
    });

    it('returns 1.0 when no matching conditions in history', () => {
      const history: SessionReviewEntry[] = [
        { conditionId: 'cond-X', position: 0 },
        { conditionId: 'cond-Y', position: 1 },
      ];
      const result = detectInterference('cond-A', ['cond-B'], history);
      expect(result.discount).toBe(1.0);
      expect(result.detected).toBe(false);
      expect(result.details.type).toBe('none');
    });

    it('returns 1.0 when empty conditionId', () => {
      const history: SessionReviewEntry[] = [
        { conditionId: 'cond-A', position: 0 },
      ];
      const result = detectInterference('', ['cond-A'], history);
      expect(result.discount).toBe(1.0);
    });
  });

  describe('same-condition interference', () => {
    it('detects same condition reviewed 1 card ago', () => {
      const history: SessionReviewEntry[] = [
        { conditionId: 'cond-A', position: 0 },
      ];
      const result = detectInterference('cond-A', [], history);
      expect(result.detected).toBe(true);
      expect(result.discount).toBeLessThan(1.0);
      expect(result.details.type).toBe('same_condition');
      expect(result.details.closestDistance).toBe(1);
    });

    it('applies stronger discount for closer cards', () => {
      const close: SessionReviewEntry[] = [
        { conditionId: 'cond-A', position: 8 },
      ];
      const far: SessionReviewEntry[] = [
        { conditionId: 'cond-A', position: 0 },
        { conditionId: 'cond-X', position: 1 },
        { conditionId: 'cond-Y', position: 2 },
        { conditionId: 'cond-Z', position: 3 },
        { conditionId: 'cond-W', position: 4 },
        { conditionId: 'cond-V', position: 5 },
        { conditionId: 'cond-U', position: 6 },
        { conditionId: 'cond-T', position: 7 },
        { conditionId: 'cond-S', position: 8 },
      ];

      const closeResult = detectInterference('cond-A', [], close);
      const farResult = detectInterference('cond-A', [], far);

      expect(closeResult.discount).toBeLessThan(farResult.discount);
    });

    it('applies minimum discount for distance 1', () => {
      const history: SessionReviewEntry[] = [
        { conditionId: 'cond-A', position: 0 },
      ];
      const result = detectInterference('cond-A', [], history);
      // Distance 1, decayFactor = 1/10 = 0.1
      // discount = 0.85 + 0.15 * 0.1 = 0.865
      expect(result.discount).toBeCloseTo(0.865, 2);
    });
  });

  describe('confusion-pair interference', () => {
    it('detects confusion pair reviewed recently', () => {
      const history: SessionReviewEntry[] = [
        { conditionId: 'cond-B', position: 0 },
      ];
      const result = detectInterference('cond-A', ['cond-B', 'cond-C'], history);
      expect(result.detected).toBe(true);
      expect(result.details.type).toBe('confusion_pair');
    });

    it('confusion pair discount is weaker than same-condition', () => {
      const sameCondHistory: SessionReviewEntry[] = [
        { conditionId: 'cond-A', position: 0 },
      ];
      const confusionHistory: SessionReviewEntry[] = [
        { conditionId: 'cond-B', position: 0 },
      ];

      const sameResult = detectInterference('cond-A', [], sameCondHistory);
      const confResult = detectInterference('cond-A', ['cond-B'], confusionHistory);

      expect(confResult.discount).toBeGreaterThan(sameResult.discount);
    });
  });

  describe('multiple interference sources', () => {
    it('uses the strongest (lowest) discount', () => {
      const history: SessionReviewEntry[] = [
        { conditionId: 'cond-B', position: 3 },  // confusion pair, distance 7
        { conditionId: 'cond-A', position: 8 },  // same condition, distance 2
      ];
      const result = detectInterference('cond-A', ['cond-B'], history);
      expect(result.detected).toBe(true);
      expect(result.details.interferingCount).toBe(2);
      // Same condition at distance 2 should dominate
      expect(result.details.type).toBe('same_condition');
    });
  });

  describe('lookback window', () => {
    it('only checks last N cards (default: 10)', () => {
      const history: SessionReviewEntry[] = Array.from({ length: 15 }, (_, i) => ({
        conditionId: i === 0 ? 'cond-A' : `cond-${i}`,
        position: i,
      }));
      // cond-A is at position 0, current would be position 15
      // Only last 10 (positions 5-14) are checked — cond-A at position 0 is outside
      const result = detectInterference('cond-A', [], history);
      expect(result.detected).toBe(false);
    });

    it('respects custom lookback window', () => {
      const config: InterferenceConfig = { ...DEFAULT_INTERFERENCE_CONFIG, lookbackWindow: 5 };
      const history: SessionReviewEntry[] = Array.from({ length: 10 }, (_, i) => ({
        conditionId: i === 3 ? 'cond-A' : `cond-${i}`,
        position: i,
      }));
      // cond-A at position 3, custom window only looks at last 5 (positions 5-9)
      const result = detectInterference('cond-A', [], history, config);
      expect(result.detected).toBe(false);
    });
  });

  describe('decay behavior', () => {
    it('discount approaches 1.0 as distance approaches decayDistance', () => {
      // Place the interfering card far back so distance is close to 10
      const history: SessionReviewEntry[] = [
        { conditionId: 'cond-A', position: 0 },
        ...Array.from({ length: 8 }, (_, i) => ({
          conditionId: `filler-${i}`,
          position: i + 1,
        })),
      ];
      const result = detectInterference('cond-A', [], history);
      // Distance = 9, close to decayDistance of 10
      expect(result.discount).toBeGreaterThan(0.95);
    });
  });
});
