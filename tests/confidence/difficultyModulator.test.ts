/**
 * Tests for lib/confidence/difficultyModulator.ts
 */

import { describe, it, expect } from 'vitest';
import {
  modulateDifficultyDelta,
  DEFAULT_DIFFICULTY_CONFIG,
  type DifficultyModulationConfig,
} from '@/lib/confidence/difficultyModulator';

describe('modulateDifficultyDelta', () => {
  it('returns unchanged delta for zero delta', () => {
    const result = modulateDifficultyDelta(0, 0.8, true);
    expect(result.modulatedDelta).toBe(0);
    expect(result.modulationFactor).toBe(1.0);
  });

  it('returns unchanged delta for near-zero delta', () => {
    const result = modulateDifficultyDelta(0.0005, 0.8, true);
    expect(result.modulatedDelta).toBeCloseTo(0.0005, 5);
    expect(result.modulationFactor).toBe(1.0);
  });

  it('amplifies negative delta for high confidence correct', () => {
    const result = modulateDifficultyDelta(-0.1, 0.9, true);
    expect(result.modulatedDelta).toBeLessThan(-0.1);
    expect(result.modulationFactor).toBeGreaterThan(1.0);
  });

  it('dampens negative delta for low confidence correct', () => {
    const result = modulateDifficultyDelta(-0.1, 0.35, true);
    expect(result.modulatedDelta).toBeGreaterThan(-0.1);
    expect(result.modulationFactor).toBeLessThan(1.0);
  });

  it('neutral factor at neutralConfidence', () => {
    const result = modulateDifficultyDelta(0.1, DEFAULT_DIFFICULTY_CONFIG.neutralConfidence, true);
    expect(result.modulationFactor).toBeCloseTo(1.0, 2);
  });

  it('amplifies positive delta for high confidence incorrect', () => {
    const result = modulateDifficultyDelta(0.1, 0.9, false);
    expect(result.modulatedDelta).toBeGreaterThan(0.1);
    expect(result.modulationFactor).toBeGreaterThan(1.0);
  });

  it('dampens positive delta for low confidence incorrect', () => {
    const result = modulateDifficultyDelta(0.1, 0.35, false);
    expect(result.modulatedDelta).toBeLessThan(0.1);
    expect(result.modulationFactor).toBeLessThan(1.0);
  });

  it('does not invert direction of delta', () => {
    const result = modulateDifficultyDelta(-0.1, 0.95, true);
    expect(result.modulatedDelta).toBeLessThan(0);
  });

  it('clamps confidence to [0.3, 0.95]', () => {
    const tooHigh = modulateDifficultyDelta(-0.1, 1.5, true);
    const tooLow = modulateDifficultyDelta(-0.1, -0.5, true);
    expect(tooHigh.modulationFactor).toBeLessThanOrEqual(DEFAULT_DIFFICULTY_CONFIG.maxAmplification);
    expect(tooLow.modulationFactor).toBeGreaterThanOrEqual(DEFAULT_DIFFICULTY_CONFIG.maxDampening);
  });

  it('skips incorrect modulation when modulateIncorrect is false', () => {
    const config: DifficultyModulationConfig = {
      ...DEFAULT_DIFFICULTY_CONFIG,
      modulateIncorrect: false,
    };
    const result = modulateDifficultyDelta(0.1, 0.9, false, config);
    expect(result.modulatedDelta).toBe(0.1);
    expect(result.modulationFactor).toBe(1.0);
  });

  it('factor stays within [maxDampening, maxAmplification]', () => {
    const results = [
      modulateDifficultyDelta(0.1, 0.95, true),
      modulateDifficultyDelta(0.1, 0.3, true),
      modulateDifficultyDelta(-0.1, 0.95, true),
      modulateDifficultyDelta(-0.1, 0.3, true),
    ];
    for (const r of results) {
      expect(r.modulationFactor).toBeGreaterThanOrEqual(DEFAULT_DIFFICULTY_CONFIG.maxDampening);
      expect(r.modulationFactor).toBeLessThanOrEqual(DEFAULT_DIFFICULTY_CONFIG.maxAmplification);
    }
  });

  it('preserves originalDelta in result', () => {
    const result = modulateDifficultyDelta(-0.05, 0.8, true);
    expect(result.originalDelta).toBe(-0.05);
  });
});
