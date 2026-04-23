// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/speedBenchmarks.ts
 *
 * Pure functions tested:
 *   getSpeedBenchmarkStatus(avgTimeMs, targetSec?)
 *     - null/undefined/≤0 → null
 *     - sec ≤ targetSec*0.9 → 'below_target'
 *     - sec ≤ targetSec     → 'on_target'
 *     - sec > targetSec     → 'above_target'
 *
 *   getSpeedBenchmarkLabel(avgTimeMs, options?)
 *     - null/≤0 → {primary:'—', benchmark:'', status:null}
 *     - primary is rounded seconds string
 *     - showPeerAvg option adds peer comparison to benchmark
 *
 * Constants: RECALL_TARGET_SEC=60, CLINICAL_REASONING_TARGET_SEC=90, OVERALL_TARGET_SEC=60
 */

import { describe, it, expect } from 'vitest';
import {
  RECALL_TARGET_SEC,
  CLINICAL_REASONING_TARGET_SEC,
  OVERALL_TARGET_SEC,
  getSpeedBenchmarkStatus,
  getSpeedBenchmarkLabel,
} from './speedBenchmarks';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('speed benchmark constants', () => {
  it('RECALL_TARGET_SEC is 60', () => {
    expect(RECALL_TARGET_SEC).toBe(60);
  });

  it('CLINICAL_REASONING_TARGET_SEC is 90', () => {
    expect(CLINICAL_REASONING_TARGET_SEC).toBe(90);
  });

  it('OVERALL_TARGET_SEC is 60', () => {
    expect(OVERALL_TARGET_SEC).toBe(60);
  });
});

// ─── getSpeedBenchmarkStatus ──────────────────────────────────────────────────

describe('getSpeedBenchmarkStatus', () => {
  // ── Invalid/null inputs ──

  it('returns null for null avgTimeMs', () => {
    expect(getSpeedBenchmarkStatus(null)).toBeNull();
  });

  it('returns null for undefined avgTimeMs', () => {
    expect(getSpeedBenchmarkStatus(undefined)).toBeNull();
  });

  it('returns null for avgTimeMs = 0', () => {
    expect(getSpeedBenchmarkStatus(0)).toBeNull();
  });

  it('returns null for negative avgTimeMs', () => {
    expect(getSpeedBenchmarkStatus(-1000)).toBeNull();
  });

  // ── Status classification (default targetSec=60) ──

  it('returns "below_target" when sec <= targetSec * 0.9 (sec ≤ 54 for target=60)', () => {
    expect(getSpeedBenchmarkStatus(54_000)).toBe('below_target'); // exactly 54s
    expect(getSpeedBenchmarkStatus(30_000)).toBe('below_target'); // 30s
    expect(getSpeedBenchmarkStatus(1_000)).toBe('below_target');  // 1s
  });

  it('returns "on_target" when 54s < sec ≤ 60s (for target=60)', () => {
    expect(getSpeedBenchmarkStatus(57_000)).toBe('on_target');   // 57s
    expect(getSpeedBenchmarkStatus(60_000)).toBe('on_target');   // exactly 60s
    expect(getSpeedBenchmarkStatus(54_001)).toBe('on_target');   // just over 54s
  });

  it('returns "above_target" when sec > targetSec', () => {
    expect(getSpeedBenchmarkStatus(60_001)).toBe('above_target'); // just over
    expect(getSpeedBenchmarkStatus(90_000)).toBe('above_target'); // 90s
    expect(getSpeedBenchmarkStatus(120_000)).toBe('above_target');
  });

  // ── Custom targetSec ──

  it('uses provided targetSec (e.g. 90s for clinical reasoning)', () => {
    const target = 90;
    // below_target: sec ≤ 90*0.9=81
    expect(getSpeedBenchmarkStatus(81_000, target)).toBe('below_target');
    // on_target: 81 < sec ≤ 90
    expect(getSpeedBenchmarkStatus(85_000, target)).toBe('on_target');
    expect(getSpeedBenchmarkStatus(90_000, target)).toBe('on_target');
    // above_target: sec > 90
    expect(getSpeedBenchmarkStatus(95_000, target)).toBe('above_target');
  });

  it('returns consistent result for CLINICAL_REASONING_TARGET_SEC constant', () => {
    expect(getSpeedBenchmarkStatus(80_000, CLINICAL_REASONING_TARGET_SEC)).toBe('below_target');
    expect(getSpeedBenchmarkStatus(85_000, CLINICAL_REASONING_TARGET_SEC)).toBe('on_target');
    expect(getSpeedBenchmarkStatus(91_000, CLINICAL_REASONING_TARGET_SEC)).toBe('above_target');
  });
});

// ─── getSpeedBenchmarkLabel ───────────────────────────────────────────────────

describe('getSpeedBenchmarkLabel', () => {
  // ── Null/invalid ──

  it('returns {primary:"—", benchmark:"", status:null} for null', () => {
    const result = getSpeedBenchmarkLabel(null);
    expect(result.primary).toBe('—');
    expect(result.benchmark).toBe('');
    expect(result.status).toBeNull();
  });

  it('returns {primary:"—", benchmark:"", status:null} for 0', () => {
    const result = getSpeedBenchmarkLabel(0);
    expect(result.primary).toBe('—');
    expect(result.status).toBeNull();
  });

  // ── Primary field ──

  it('primary is rounded seconds string (no decimal)', () => {
    expect(getSpeedBenchmarkLabel(57_000).primary).toBe('57s');
    expect(getSpeedBenchmarkLabel(60_000).primary).toBe('60s');
    expect(getSpeedBenchmarkLabel(64_500).primary).toBe('65s'); // Math.round(64.5) = 65
  });

  // ── Status field ──

  it('status reflects the classification', () => {
    expect(getSpeedBenchmarkLabel(30_000).status).toBe('below_target');
    expect(getSpeedBenchmarkLabel(57_000).status).toBe('on_target');
    expect(getSpeedBenchmarkLabel(90_000).status).toBe('above_target');
  });

  // ── Benchmark field (without peer avg) ──

  it('benchmark mentions target seconds for all statuses', () => {
    const target = 60;
    const below = getSpeedBenchmarkLabel(30_000, { targetSec: target });
    const onTarget = getSpeedBenchmarkLabel(57_000, { targetSec: target });
    const above = getSpeedBenchmarkLabel(90_000, { targetSec: target });
    expect(below.benchmark).toContain('60');
    expect(onTarget.benchmark).toContain('60');
    expect(above.benchmark).toContain('60');
  });

  it('"below_target" benchmark mentions "faster"', () => {
    const result = getSpeedBenchmarkLabel(30_000);
    expect(result.benchmark).toContain('faster');
  });

  // ── Peer average ──

  it('peer avg: shows peer seconds in benchmark', () => {
    const result = getSpeedBenchmarkLabel(57_000, { showPeerAvg: true, peerAvgSec: 65 });
    expect(result.benchmark).toContain('65');
  });

  it('peer avg: shows positive diff when slower than peer', () => {
    // 80s avg, peer avg 65s → diff = 80-65 = +15
    const result = getSpeedBenchmarkLabel(80_000, { showPeerAvg: true, peerAvgSec: 65 });
    expect(result.benchmark).toContain('+15');
  });

  it('peer avg: no diff shown when same or faster than peer', () => {
    // 57s avg, peer avg 65s → diff = 57-65 = -8 → ≤0 → no "+" shown
    const result = getSpeedBenchmarkLabel(57_000, { showPeerAvg: true, peerAvgSec: 65 });
    expect(result.benchmark).not.toContain('+');
    expect(result.benchmark).toContain('65');
  });
});
