/**
 * DrillSummaryCard — Unit tests for pure helper functions
 *
 * Tests the computation logic exported from DrillSummaryCard.tsx:
 * - computeAccuracy: percentage calculation with edge cases
 * - formatAvgTime: milliseconds → human-readable string
 * - getMotivationalMessage: accuracy-based messaging tiers
 */

import { describe, it, expect } from 'vitest';
import { computeAccuracy, formatAvgTime, getMotivationalMessage } from './DrillSummaryCard';

// ============================================================================
// computeAccuracy
// ============================================================================

describe('computeAccuracy', () => {
  it('returns 0 when total is 0', () => {
    expect(computeAccuracy(0, 0)).toBe(0);
  });

  it('returns 0 when total is negative', () => {
    expect(computeAccuracy(5, -1)).toBe(0);
  });

  it('returns 100 for perfect score', () => {
    expect(computeAccuracy(10, 10)).toBe(100);
  });

  it('returns 0 for zero correct', () => {
    expect(computeAccuracy(0, 10)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // 7/9 = 77.77... → 78
    expect(computeAccuracy(7, 9)).toBe(78);
  });

  it('handles 1/3 correctly', () => {
    // 1/3 = 33.33... → 33
    expect(computeAccuracy(1, 3)).toBe(33);
  });

  it('handles 2/3 correctly', () => {
    // 2/3 = 66.66... → 67
    expect(computeAccuracy(2, 3)).toBe(67);
  });

  it('handles single question session', () => {
    expect(computeAccuracy(1, 1)).toBe(100);
    expect(computeAccuracy(0, 1)).toBe(0);
  });
});

// ============================================================================
// formatAvgTime
// ============================================================================

describe('formatAvgTime', () => {
  it('returns "—" for undefined', () => {
    expect(formatAvgTime(undefined)).toBe('—');
  });

  it('returns "—" for 0', () => {
    expect(formatAvgTime(0)).toBe('—');
  });

  it('returns "—" for negative values', () => {
    expect(formatAvgTime(-1000)).toBe('—');
  });

  it('formats sub-minute times in seconds', () => {
    expect(formatAvgTime(12400)).toBe('12.4s');
  });

  it('formats small times correctly', () => {
    expect(formatAvgTime(1500)).toBe('1.5s');
  });

  it('formats exactly 60 seconds as 1:00', () => {
    expect(formatAvgTime(60000)).toBe('1:00');
  });

  it('formats 90 seconds as 1:30', () => {
    expect(formatAvgTime(90000)).toBe('1:30');
  });

  it('formats multi-minute times', () => {
    expect(formatAvgTime(185000)).toBe('3:05');
  });

  it('rounds seconds within minute format', () => {
    // 61.7s → 1:02 (rounds 1.7 to 2)
    expect(formatAvgTime(61700)).toBe('1:02');
  });
});

// ============================================================================
// getMotivationalMessage
// ============================================================================

describe('getMotivationalMessage', () => {
  it('returns outstanding for 90%+', () => {
    expect(getMotivationalMessage(90)).toContain('Outstanding');
    expect(getMotivationalMessage(100)).toContain('Outstanding');
  });

  it('returns solid for 75-89%', () => {
    expect(getMotivationalMessage(75)).toContain('Solid');
    expect(getMotivationalMessage(89)).toContain('Solid');
  });

  it('returns good effort for 50-74%', () => {
    expect(getMotivationalMessage(50)).toContain('Good effort');
    expect(getMotivationalMessage(74)).toContain('Good effort');
  });

  it('returns keep practicing for below 50%', () => {
    expect(getMotivationalMessage(49)).toContain('Keep practicing');
    expect(getMotivationalMessage(0)).toContain('Keep practicing');
  });
});
