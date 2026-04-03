import { describe, it, expect } from 'vitest';
import { computeIntervalDeviation } from '../intervalDeviationService';

describe('computeIntervalDeviation', () => {
  it('returns unknown for new cards (scheduledDays = 0)', () => {
    const result = computeIntervalDeviation(3, 0, true);
    expect(result.informationMultiplier).toBe(1.0);
    expect(result.classification).toBe('unknown');
    expect(result.deviationRatio).toBeNull();
  });

  it('returns unknown for negative elapsed days', () => {
    const result = computeIntervalDeviation(-1, 5, true);
    expect(result.informationMultiplier).toBe(1.0);
    expect(result.classification).toBe('unknown');
  });

  it('returns neutral for on-time correct review (ratio = 1.0)', () => {
    const result = computeIntervalDeviation(10, 10, true);
    expect(result.informationMultiplier).toBe(1.0);
    expect(result.classification).toBe('on_time');
    expect(result.deviationRatio).toBe(1.0);
  });

  it('dampens for very early correct (ratio = 0.3)', () => {
    const result = computeIntervalDeviation(3, 10, true);
    expect(result.informationMultiplier).toBe(0.85);
    expect(result.classification).toBe('early');
  });

  it('amplifies for late correct (ratio = 2.0)', () => {
    const result = computeIntervalDeviation(20, 10, true);
    expect(result.informationMultiplier).toBe(1.15);
    expect(result.classification).toBe('late');
  });

  it('returns neutral for late incorrect (expected failure)', () => {
    const result = computeIntervalDeviation(20, 10, false);
    expect(result.informationMultiplier).toBe(1.0);
    expect(result.classification).toBe('late');
  });

  it('slightly amplifies early incorrect (surprising interference)', () => {
    const result = computeIntervalDeviation(3, 10, false);
    expect(result.informationMultiplier).toBe(1.1);
    expect(result.classification).toBe('early');
  });

  it('interpolates in early zone for correct (ratio 0.6)', () => {
    // ratio = 0.6, between EARLY_THRESHOLD (0.5) and ON_TIME_LOW (0.7)
    const result = computeIntervalDeviation(6, 10, true);
    expect(result.informationMultiplier).toBeGreaterThan(0.85);
    expect(result.informationMultiplier).toBeLessThan(1.0);
    expect(result.classification).toBe('early');
  });

  it('interpolates in late zone for correct (ratio 1.4)', () => {
    // ratio = 1.4, between ON_TIME_HIGH (1.3) and LATE_THRESHOLD (1.5)
    const result = computeIntervalDeviation(14, 10, true);
    expect(result.informationMultiplier).toBeGreaterThan(1.0);
    expect(result.informationMultiplier).toBeLessThan(1.15);
    expect(result.classification).toBe('late');
  });

  it('treats on-time range correctly (ratio 0.8)', () => {
    const result = computeIntervalDeviation(8, 10, true);
    expect(result.informationMultiplier).toBe(1.0);
    expect(result.classification).toBe('on_time');
  });

  it('treats on-time range correctly (ratio 1.2)', () => {
    const result = computeIntervalDeviation(12, 10, true);
    expect(result.informationMultiplier).toBe(1.0);
    expect(result.classification).toBe('on_time');
  });

  it('handles zero elapsed days with positive scheduled', () => {
    // ratio = 0 → very early
    const result = computeIntervalDeviation(0, 10, true);
    expect(result.informationMultiplier).toBe(0.85);
    expect(result.classification).toBe('early');
  });

  it('rounds deviationRatio to 3 decimal places', () => {
    const result = computeIntervalDeviation(7, 3, true);
    const decimalPlaces = result.deviationRatio!.toString().split('.')[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(3);
  });

  it('does not amplify late incorrect beyond 1.0', () => {
    // Very late incorrect review — expected failure, no extra info
    const result = computeIntervalDeviation(50, 10, false);
    expect(result.informationMultiplier).toBe(1.0);
  });
});
