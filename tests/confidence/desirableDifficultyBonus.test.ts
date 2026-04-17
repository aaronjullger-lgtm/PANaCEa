/**
 * Tests for lib/confidence/desirableDifficultyBonus.ts
 */

import { describe, it, expect } from 'vitest';
import {
  computeDesirableDifficultyBonus,
  DEFAULT_DD_CONFIG,
  type DesirableDifficultyConfig,
} from '@/lib/confidence/desirableDifficultyBonus';

describe('computeDesirableDifficultyBonus', () => {
  it('no bonus for incorrect answers', () => {
    const result = computeDesirableDifficultyBonus(0.3, false, 1.0);
    expect(result.activated).toBe(false);
    expect(result.multiplier).toBe(1.0);
  });

  it('no bonus for high-confidence correct', () => {
    const result = computeDesirableDifficultyBonus(0.9, true, 1.0);
    expect(result.activated).toBe(false);
    expect(result.multiplier).toBe(1.0);
  });

  it('no bonus for confidence at threshold', () => {
    const result = computeDesirableDifficultyBonus(0.55, true, 1.0);
    expect(result.activated).toBe(false);
    expect(result.multiplier).toBe(1.0);
  });

  it('activates for correct with low confidence', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, 1.0);
    expect(result.activated).toBe(true);
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('higher effort signal for lower confidence', () => {
    const low = computeDesirableDifficultyBonus(0.3, true, 1.0);
    const medium = computeDesirableDifficultyBonus(0.45, true, 1.0);
    expect(low.components.effortSignal).toBeGreaterThan(medium.components.effortSignal);
  });

  it('higher spacing signal for more elapsed days', () => {
    const recent = computeDesirableDifficultyBonus(0.3, true, 0.5);
    const spaced = computeDesirableDifficultyBonus(0.3, true, 5.0);
    expect(spaced.components.spacingSignal).toBeGreaterThan(recent.components.spacingSignal);
  });

  it('multiplier capped at maxBonus', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, 10.0);
    expect(result.multiplier).toBeLessThanOrEqual(DEFAULT_DD_CONFIG.maxBonus);
  });

  it('effort signal is 0 at threshold confidence', () => {
    const result = computeDesirableDifficultyBonus(0.55, true, 1.0);
    expect(result.components.effortSignal).toBe(0);
  });

  it('spacing signal is 0 for zero elapsed days', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, 0);
    expect(result.components.spacingSignal).toBe(0);
  });

  it('spacing signal reaches 1.0 at spacingThresholdDays', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, DEFAULT_DD_CONFIG.spacingThresholdDays);
    expect(result.components.spacingSignal).toBe(1.0);
  });

  it('effort signal reaches 1.0 at confidence 0.3', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, 1.0);
    expect(result.components.effortSignal).toBe(1.0);
  });

  it('respects custom config threshold', () => {
    const config: DesirableDifficultyConfig = {
      ...DEFAULT_DD_CONFIG,
      confidenceThreshold: 0.7,
    };
    const result = computeDesirableDifficultyBonus(0.6, true, 1.0, config);
    expect(result.activated).toBe(true);
  });

  it('returns baseBonus with zero spacing signal', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, 0);
    // effort=1.0, spacing=0, combined = 1*0.6 + 0*0.4 = 0.6
    // multiplier = baseBonus + 0.6 * (maxBonus - baseBonus)
    expect(result.multiplier).toBeGreaterThan(DEFAULT_DD_CONFIG.baseBonus);
    expect(result.multiplier).toBeLessThanOrEqual(DEFAULT_DD_CONFIG.maxBonus);
  });
});
