// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/confidence/desirableDifficultyBonus.ts
 *
 * Pure function tested:
 *   computeDesirableDifficultyBonus(confidence, isCorrect, elapsedDays, config?)
 *
 * Key constants (DEFAULT_DD_CONFIG):
 *   confidenceThreshold = 0.55  (bonus activates only BELOW this)
 *   maxBonus = 1.25
 *   spacingThresholdDays = 3.0
 *   baseBonus = 1.05
 *
 * Activation gate: isCorrect=true AND confidence < 0.55
 */

import { describe, it, expect } from 'vitest';
import {
  computeDesirableDifficultyBonus,
  DEFAULT_DD_CONFIG,
} from './desirableDifficultyBonus';

describe('computeDesirableDifficultyBonus', () => {
  // ── Non-activation cases ──

  it('returns multiplier=1.0 and activated=false for incorrect answers', () => {
    const result = computeDesirableDifficultyBonus(0.3, false, 5);
    expect(result.multiplier).toBe(1.0);
    expect(result.activated).toBe(false);
  });

  it('returns multiplier=1.0 for confidence at or above threshold (0.55)', () => {
    const atThreshold = computeDesirableDifficultyBonus(0.55, true, 5);
    expect(atThreshold.multiplier).toBe(1.0);
    expect(atThreshold.activated).toBe(false);

    const aboveThreshold = computeDesirableDifficultyBonus(0.8, true, 5);
    expect(aboveThreshold.multiplier).toBe(1.0);
    expect(aboveThreshold.activated).toBe(false);
  });

  it('returns activated=false for high-confidence correct answer', () => {
    const result = computeDesirableDifficultyBonus(0.9, true, 10);
    expect(result.activated).toBe(false);
    expect(result.components.effortSignal).toBe(0);
    expect(result.components.spacingSignal).toBe(0);
  });

  // ── Activation cases ──

  it('activates for correct answer with confidence below threshold', () => {
    const result = computeDesirableDifficultyBonus(0.40, true, 5);
    expect(result.activated).toBe(true);
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  it('multiplier is always <= maxBonus (1.25) when activated', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, 10);
    expect(result.multiplier).toBeLessThanOrEqual(DEFAULT_DD_CONFIG.maxBonus);
  });

  it('multiplier is always >= baseBonus (1.05) when activated', () => {
    // Min case: confidence just below threshold (0.549), minimal spacing (0 days)
    const result = computeDesirableDifficultyBonus(0.549, true, 0);
    expect(result.multiplier).toBeGreaterThanOrEqual(DEFAULT_DD_CONFIG.baseBonus);
  });

  // ── Spacing effect ──

  it('longer spacing produces higher multiplier for same low confidence', () => {
    const shortSpacing = computeDesirableDifficultyBonus(0.4, true, 0);
    const longSpacing = computeDesirableDifficultyBonus(0.4, true, 5);
    expect(longSpacing.multiplier).toBeGreaterThan(shortSpacing.multiplier);
  });

  it('spacing >= spacingThresholdDays (3) gives full spacing signal (1.0)', () => {
    const at3 = computeDesirableDifficultyBonus(0.3, true, 3);
    const at10 = computeDesirableDifficultyBonus(0.3, true, 10);
    // Both should give full spacing → same multiplier
    expect(at3.multiplier).toBeCloseTo(at10.multiplier, 5);
    expect(at3.components.spacingSignal).toBeCloseTo(1.0, 5);
  });

  it('zero elapsed days gives spacingSignal = 0', () => {
    const result = computeDesirableDifficultyBonus(0.4, true, 0);
    expect(result.components.spacingSignal).toBeCloseTo(0, 5);
  });

  // ── Effort effect ──

  it('lower confidence (more effort) produces higher effortSignal', () => {
    const lowEffort = computeDesirableDifficultyBonus(0.54, true, 5); // Just below threshold
    const highEffort = computeDesirableDifficultyBonus(0.30, true, 5); // Minimum confidence
    expect(highEffort.components.effortSignal).toBeGreaterThan(lowEffort.components.effortSignal);
  });

  it('minimum confidence (0.3) gives effortSignal = 1.0', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, 5);
    expect(result.components.effortSignal).toBeCloseTo(1.0, 5);
  });

  // ── Output shape ──

  it('returns all required fields', () => {
    const result = computeDesirableDifficultyBonus(0.4, true, 3);
    expect(typeof result.multiplier).toBe('number');
    expect(typeof result.activated).toBe('boolean');
    expect(typeof result.components.effortSignal).toBe('number');
    expect(typeof result.components.spacingSignal).toBe('number');
  });

  it('component signals are in [0, 1]', () => {
    const result = computeDesirableDifficultyBonus(0.3, true, 5);
    expect(result.components.effortSignal).toBeGreaterThanOrEqual(0);
    expect(result.components.effortSignal).toBeLessThanOrEqual(1);
    expect(result.components.spacingSignal).toBeGreaterThanOrEqual(0);
    expect(result.components.spacingSignal).toBeLessThanOrEqual(1);
  });

  // ── Config override ──

  it('respects custom confidenceThreshold', () => {
    const config = { ...DEFAULT_DD_CONFIG, confidenceThreshold: 0.7 };
    // confidence=0.65 is above default (0.55) but below custom (0.7) → should activate
    const defaultResult = computeDesirableDifficultyBonus(0.65, true, 5);
    const customResult = computeDesirableDifficultyBonus(0.65, true, 5, config);
    expect(defaultResult.activated).toBe(false);
    expect(customResult.activated).toBe(true);
  });

  it('respects custom maxBonus', () => {
    const config = { ...DEFAULT_DD_CONFIG, maxBonus: 1.10 };
    const result = computeDesirableDifficultyBonus(0.3, true, 10, config);
    expect(result.multiplier).toBeLessThanOrEqual(1.10);
  });
});
