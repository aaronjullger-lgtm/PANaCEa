import { describe, it, expect, beforeEach } from 'vitest';
import { recordOutcome, getConfidenceModifier, clearSessionCache } from '../sessionAccuracySlopeService';

describe('sessionAccuracySlopeService', () => {
  beforeEach(() => {
    clearSessionCache();
  });

  it('returns neutral when no outcomes recorded', () => {
    const result = getConfidenceModifier('user1');
    expect(result.confidenceMultiplier).toBe(1.0);
    expect(result.slope).toBeNull();
    expect(result.windowSize).toBe(0);
  });

  it('returns neutral with fewer than 6 outcomes', () => {
    for (let i = 0; i < 5; i++) {
      recordOutcome('user1', true);
    }
    const result = getConfidenceModifier('user1');
    expect(result.confidenceMultiplier).toBe(1.0);
    expect(result.slope).toBeNull();
  });

  it('returns neutral for steady accuracy (all correct)', () => {
    for (let i = 0; i < 10; i++) {
      recordOutcome('user1', true);
    }
    const result = getConfidenceModifier('user1');
    // All 1s → slope ≈ 0
    expect(result.confidenceMultiplier).toBe(1.0);
    expect(result.slope).toBe(0);
    expect(result.rollingAccuracy).toBe(1.0);
  });

  it('detects declining accuracy and applies penalty', () => {
    // First 7 correct, then 3 wrong → declining slope
    for (let i = 0; i < 7; i++) recordOutcome('user1', true);
    for (let i = 0; i < 3; i++) recordOutcome('user1', false);

    const result = getConfidenceModifier('user1');
    expect(result.slope).not.toBeNull();
    expect(result.slope!).toBeLessThan(0);
    expect(result.confidenceMultiplier).toBe(0.92);
  });

  it('detects improving accuracy and applies bonus', () => {
    // First 3 wrong, then 7 correct → improving slope
    for (let i = 0; i < 3; i++) recordOutcome('user1', false);
    for (let i = 0; i < 7; i++) recordOutcome('user1', true);

    const result = getConfidenceModifier('user1');
    expect(result.slope).not.toBeNull();
    expect(result.slope!).toBeGreaterThan(0);
    expect(result.confidenceMultiplier).toBe(1.05);
  });

  it('uses only the last 10 outcomes for the window', () => {
    // 20 correct, then 10 items: first 7 correct, last 3 wrong
    for (let i = 0; i < 20; i++) recordOutcome('user1', true);
    for (let i = 0; i < 3; i++) recordOutcome('user1', false);

    const result = getConfidenceModifier('user1');
    // Window is last 10: 7 correct + 3 wrong → declining
    expect(result.windowSize).toBe(10);
    expect(result.slope!).toBeLessThan(0);
  });

  it('tracks users independently', () => {
    for (let i = 0; i < 10; i++) recordOutcome('user1', true);
    for (let i = 0; i < 3; i++) recordOutcome('user2', false);
    for (let i = 0; i < 7; i++) recordOutcome('user2', true);

    const r1 = getConfidenceModifier('user1');
    const r2 = getConfidenceModifier('user2');

    expect(r1.confidenceMultiplier).toBe(1.0); // steady
    expect(r2.confidenceMultiplier).toBe(1.05); // improving
  });

  it('returns rolling accuracy', () => {
    for (let i = 0; i < 7; i++) recordOutcome('user1', true);
    for (let i = 0; i < 3; i++) recordOutcome('user1', false);

    const result = getConfidenceModifier('user1');
    expect(result.rollingAccuracy).toBe(0.7);
  });

  it('handles all incorrect', () => {
    for (let i = 0; i < 10; i++) recordOutcome('user1', false);

    const result = getConfidenceModifier('user1');
    expect(result.slope).toBe(0);
    expect(result.rollingAccuracy).toBe(0);
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  it('clearSessionCache resets state', () => {
    for (let i = 0; i < 10; i++) recordOutcome('user1', true);
    clearSessionCache();
    const result = getConfidenceModifier('user1');
    expect(result.windowSize).toBe(0);
  });
});
