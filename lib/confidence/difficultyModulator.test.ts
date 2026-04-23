// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/confidence/difficultyModulator.ts
 *
 * Pure function tested:
 *   modulateDifficultyDelta(baseDelta, confidence, isCorrect, config?)
 *
 * Key constants (DEFAULT_DIFFICULTY_CONFIG):
 *   neutralConfidence = 0.6
 *   maxAmplification = 1.5
 *   maxDampening = 0.5
 *   modulateIncorrect = true
 *
 * Formula:
 *   confidence >= 0.6: factor = 1.0 + (c-0.6)/(0.95-0.6)*0.5 → [1.0, 1.5]
 *   confidence < 0.6:  factor = 0.5 + (c-0.3)/(0.6-0.3)*0.5  → [0.5, 1.0]
 *   modulatedDelta = baseDelta * factor
 */

import { describe, it, expect } from 'vitest';
import {
  modulateDifficultyDelta,
  DEFAULT_DIFFICULTY_CONFIG,
} from './difficultyModulator';

describe('modulateDifficultyDelta', () => {
  // ── Zero-delta guard ──

  it('returns unmodulated result when baseDelta is 0', () => {
    const result = modulateDifficultyDelta(0, 0.8, true);
    expect(result.modulatedDelta).toBe(0);
    expect(result.modulationFactor).toBe(1.0);
  });

  it('returns unmodulated result when baseDelta is near-zero (< 0.001)', () => {
    const result = modulateDifficultyDelta(0.0005, 0.9, true);
    expect(result.modulationFactor).toBe(1.0);
  });

  // ── modulateIncorrect=false ──

  it('does not modulate incorrect answer when modulateIncorrect=false', () => {
    const config = { ...DEFAULT_DIFFICULTY_CONFIG, modulateIncorrect: false };
    const result = modulateDifficultyDelta(0.5, 0.3, false, config);
    expect(result.modulationFactor).toBe(1.0);
    expect(result.modulatedDelta).toBe(result.originalDelta);
  });

  // ── Neutral confidence (0.6) → factor = 1.0 ──

  it('returns factor ≈ 1.0 at neutral confidence (0.6)', () => {
    const result = modulateDifficultyDelta(0.5, 0.6, true);
    expect(result.modulationFactor).toBeCloseTo(1.0, 2);
  });

  // ── Above neutral → amplification ──

  it('factor at max confidence (0.95) ≈ maxAmplification (1.5)', () => {
    const result = modulateDifficultyDelta(0.5, 0.95, true);
    expect(result.modulationFactor).toBeCloseTo(1.5, 2);
  });

  it('factor > 1.0 for confidence above 0.6', () => {
    const result = modulateDifficultyDelta(0.5, 0.8, true);
    expect(result.modulationFactor).toBeGreaterThan(1.0);
    expect(result.modulationFactor).toBeLessThanOrEqual(1.5);
  });

  it('higher confidence → higher factor (monotonic in [0.6, 0.95])', () => {
    const f06 = modulateDifficultyDelta(1.0, 0.6, true).modulationFactor;
    const f08 = modulateDifficultyDelta(1.0, 0.8, true).modulationFactor;
    const f095 = modulateDifficultyDelta(1.0, 0.95, true).modulationFactor;
    expect(f06).toBeLessThan(f08);
    expect(f08).toBeLessThan(f095);
  });

  // ── Below neutral → dampening ──

  it('factor at minimum confidence (0.3) ≈ maxDampening (0.5)', () => {
    const result = modulateDifficultyDelta(0.5, 0.3, true);
    expect(result.modulationFactor).toBeCloseTo(0.5, 2);
  });

  it('factor < 1.0 for confidence below 0.6', () => {
    const result = modulateDifficultyDelta(0.5, 0.4, true);
    expect(result.modulationFactor).toBeGreaterThanOrEqual(0.5);
    expect(result.modulationFactor).toBeLessThan(1.0);
  });

  it('lower confidence → lower factor (monotonic in [0.3, 0.6])', () => {
    const f03 = modulateDifficultyDelta(1.0, 0.3, true).modulationFactor;
    const f045 = modulateDifficultyDelta(1.0, 0.45, true).modulationFactor;
    const f06 = modulateDifficultyDelta(1.0, 0.6, true).modulationFactor;
    expect(f03).toBeLessThan(f045);
    expect(f045).toBeLessThan(f06);
  });

  // ── Direction preservation ──

  it('modulatedDelta has same sign as baseDelta (negative stays negative)', () => {
    const result = modulateDifficultyDelta(-0.3, 0.9, true);
    expect(result.modulatedDelta).toBeLessThan(0);
  });

  it('modulatedDelta has same sign as baseDelta (positive stays positive)', () => {
    const result = modulateDifficultyDelta(0.3, 0.3, false);
    expect(result.modulatedDelta).toBeGreaterThan(0);
  });

  // ── Output fields ──

  it('returns originalDelta matching input', () => {
    const result = modulateDifficultyDelta(0.42, 0.7, true);
    expect(result.originalDelta).toBe(0.42);
  });

  it('modulatedDelta = originalDelta * modulationFactor (approximately)', () => {
    const result = modulateDifficultyDelta(0.5, 0.8, true);
    expect(result.modulatedDelta).toBeCloseTo(
      result.originalDelta * result.modulationFactor, 3
    );
  });

  // ── Clamp bounds ──

  it('factor never exceeds maxAmplification (1.5) even with out-of-range confidence', () => {
    const result = modulateDifficultyDelta(0.5, 1.0, true); // clamped to 0.95 internally
    expect(result.modulationFactor).toBeLessThanOrEqual(1.5);
  });

  it('factor never goes below maxDampening (0.5)', () => {
    const result = modulateDifficultyDelta(0.5, 0.0, true); // clamped to 0.3 internally
    expect(result.modulationFactor).toBeGreaterThanOrEqual(0.5);
  });

  // ── Config override ──

  it('respects custom neutralConfidence', () => {
    const config = { ...DEFAULT_DIFFICULTY_CONFIG, neutralConfidence: 0.5 };
    // confidence=0.5 → should be neutral with custom config
    const result = modulateDifficultyDelta(0.5, 0.5, true, config);
    expect(result.modulationFactor).toBeCloseTo(1.0, 1);
  });
});
