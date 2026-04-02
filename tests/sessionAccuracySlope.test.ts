import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordOutcome,
  getConfidenceModifier,
  clearSessionCache,
} from '../lib/services/sessionAccuracySlopeService';

describe('sessionAccuracySlopeService', () => {
  beforeEach(() => {
    clearSessionCache();
  });

  it('returns neutral modifier with insufficient data', () => {
    const result = getConfidenceModifier('user-1');
    expect(result.confidenceMultiplier).toBe(1.0);
    expect(result.slope).toBeNull();
    expect(result.windowSize).toBe(0);
  });

  it('returns neutral modifier with fewer than 6 outcomes', () => {
    for (let i = 0; i < 5; i++) recordOutcome('user-2', true);
    const result = getConfidenceModifier('user-2');
    expect(result.confidenceMultiplier).toBe(1.0);
    expect(result.slope).toBeNull();
  });

  it('detects declining accuracy (confidence penalty)', () => {
    // Start correct, then go wrong — declining slope
    const corrects = [true, true, true, true, true, false, false, false, false, false];
    for (const c of corrects) recordOutcome('user-decline', c);
    const result = getConfidenceModifier('user-decline');
    expect(result.slope).not.toBeNull();
    expect(result.slope!).toBeLessThan(0);
    expect(result.confidenceMultiplier).toBe(0.92);
  });

  it('detects warming up accuracy (confidence bonus)', () => {
    // Start wrong, then go correct — positive slope
    const outcomes = [false, false, false, false, false, true, true, true, true, true];
    for (const c of outcomes) recordOutcome('user-warmup', c);
    const result = getConfidenceModifier('user-warmup');
    expect(result.slope).not.toBeNull();
    expect(result.slope!).toBeGreaterThan(0);
    expect(result.confidenceMultiplier).toBe(1.05);
  });

  it('returns neutral for stable accuracy', () => {
    // Alternating correct/incorrect — flat slope
    for (let i = 0; i < 10; i++) {
      recordOutcome('user-stable', i % 2 === 0);
    }
    const result = getConfidenceModifier('user-stable');
    expect(result.confidenceMultiplier).toBe(1.0);
  });

  it('computes rolling accuracy over window', () => {
    // 8 correct out of 10
    for (let i = 0; i < 8; i++) recordOutcome('user-acc', true);
    for (let i = 0; i < 2; i++) recordOutcome('user-acc', false);
    const result = getConfidenceModifier('user-acc');
    expect(result.rollingAccuracy).toBe(0.8);
    expect(result.windowSize).toBe(10);
  });

  it('isolates sessions by userId', () => {
    for (let i = 0; i < 10; i++) recordOutcome('user-a', true);
    for (let i = 0; i < 10; i++) recordOutcome('user-b', false);
    const resultA = getConfidenceModifier('user-a');
    const resultB = getConfidenceModifier('user-b');
    expect(resultA.rollingAccuracy).toBe(1.0);
    expect(resultB.rollingAccuracy).toBe(0.0);
  });

  it('clearSessionCache resets all sessions', () => {
    for (let i = 0; i < 10; i++) recordOutcome('user-clear', true);
    clearSessionCache();
    const result = getConfidenceModifier('user-clear');
    expect(result.windowSize).toBe(0);
  });
});
