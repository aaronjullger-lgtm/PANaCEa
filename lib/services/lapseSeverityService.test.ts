/**
 * Unit tests for lib/services/lapseSeverityService.ts
 *
 * Formula:  severity = log2(1 + reps) × log2(1 + stability)
 * Multiplier: min(1.6,  1 + 0.15 × severity)
 *
 * Guard conditions:
 *   - preLapseState < 2  → severity 0, multiplier 1.0
 *   - preLapseReps  < 1  → severity 0, multiplier 1.0
 */

import { describe, it, expect } from 'vitest';
import { computeLapseSeverity } from './lapseSeverityService';

describe('computeLapseSeverity', () => {
  // ─── Guard clauses ────────────────────────────────────────────────────────

  it('returns zero severity for new card (state 0)', () => {
    const r = computeLapseSeverity(5, 20, 0);
    expect(r.severity).toBe(0);
    expect(r.difficultyMultiplier).toBe(1.0);
  });

  it('returns zero severity for learning card (state 1)', () => {
    const r = computeLapseSeverity(3, 10, 1);
    expect(r.severity).toBe(0);
    expect(r.difficultyMultiplier).toBe(1.0);
  });

  it('returns zero severity when reps is 0 even in review state', () => {
    const r = computeLapseSeverity(0, 15, 2);
    expect(r.severity).toBe(0);
    expect(r.difficultyMultiplier).toBe(1.0);
  });

  it('passes through preLapseReps and preLapseStability in guard result', () => {
    const r = computeLapseSeverity(3, 7, 1);
    expect(r.preLapseReps).toBe(3);
    expect(r.preLapseStability).toBe(7);
  });

  // ─── Review state (state ≥ 2) ────────────────────────────────────────────

  it('computes severity for review state (state 2)', () => {
    // reps=1, stability=1: log2(2)*log2(2) = 1*1 = 1.0; multiplier = 1+0.15 = 1.15
    const r = computeLapseSeverity(1, 1, 2);
    expect(r.severity).toBeCloseTo(1.0, 3);
    expect(r.difficultyMultiplier).toBeCloseTo(1.15, 3);
  });

  it('computes severity for relearning state (state 3)', () => {
    // Same formula applies: state 3 is also ≥ 2
    const r = computeLapseSeverity(1, 1, 3);
    expect(r.severity).toBeCloseTo(1.0, 3);
    expect(r.difficultyMultiplier).toBeCloseTo(1.15, 3);
  });

  it('severity is 0 when stability is 0 (log2(1+0)=0)', () => {
    // reps=5, stability=0: log2(6)*log2(1) = log2(6)*0 = 0
    const r = computeLapseSeverity(5, 0, 2);
    expect(r.severity).toBe(0);
    expect(r.difficultyMultiplier).toBe(1.0);
  });

  it('higher reps → higher severity', () => {
    const low = computeLapseSeverity(1, 10, 2);
    const high = computeLapseSeverity(5, 10, 2);
    expect(high.severity).toBeGreaterThan(low.severity);
    expect(high.difficultyMultiplier).toBeGreaterThanOrEqual(low.difficultyMultiplier);
  });

  it('higher stability → higher severity', () => {
    const low = computeLapseSeverity(3, 5, 2);
    const high = computeLapseSeverity(3, 30, 2);
    expect(high.severity).toBeGreaterThan(low.severity);
  });

  // ─── Known exact values ──────────────────────────────────────────────────

  it('reps=1, stability=3, state=2 → severity=2, multiplier=1.3', () => {
    // log2(2)*log2(4) = 1*2 = 2; multiplier = min(1.6, 1+0.3) = 1.3
    const r = computeLapseSeverity(1, 3, 2);
    expect(r.severity).toBeCloseTo(2.0, 3);
    expect(r.difficultyMultiplier).toBeCloseTo(1.3, 3);
  });

  it('reps=3, stability=7, state=2 → multiplier capped at 1.6', () => {
    // log2(4)*log2(8) = 2*3 = 6; multiplier = min(1.6, 1+0.9) = 1.6
    const r = computeLapseSeverity(3, 7, 2);
    expect(r.difficultyMultiplier).toBe(1.6);
  });

  it('high reps + high stability → multiplier always capped at 1.6', () => {
    const r = computeLapseSeverity(10, 50, 2);
    expect(r.difficultyMultiplier).toBe(1.6);
  });

  // ─── Precision ───────────────────────────────────────────────────────────

  it('severity is rounded to 3 decimal places', () => {
    const r = computeLapseSeverity(2, 5, 2);
    const rounded = Math.round(r.severity * 1000) / 1000;
    expect(r.severity).toBe(rounded);
  });

  it('difficultyMultiplier is rounded to 3 decimal places', () => {
    const r = computeLapseSeverity(2, 5, 2);
    const rounded = Math.round(r.difficultyMultiplier * 1000) / 1000;
    expect(r.difficultyMultiplier).toBe(rounded);
  });

  it('multiplier is always ≥ 1.0', () => {
    for (const state of [2, 3]) {
      const r = computeLapseSeverity(1, 1, state);
      expect(r.difficultyMultiplier).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('multiplier is always ≤ 1.6', () => {
    const r = computeLapseSeverity(100, 1000, 2);
    expect(r.difficultyMultiplier).toBeLessThanOrEqual(1.6);
  });
});
