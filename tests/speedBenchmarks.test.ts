import { describe, it, expect } from 'vitest';
import {
  getSpeedBenchmarkStatus,
  getSpeedBenchmarkLabel,
  RECALL_TARGET_SEC,
  CLINICAL_REASONING_TARGET_SEC,
  OVERALL_TARGET_SEC,
} from '../lib/speedBenchmarks';

// ─── Constants ──────────────────────────────────────────────────────────────

describe('benchmark targets', () => {
  it('recall target is 60s', () => {
    expect(RECALL_TARGET_SEC).toBe(60);
  });

  it('clinical reasoning target is 90s (vignettes take longer)', () => {
    expect(CLINICAL_REASONING_TARGET_SEC).toBe(90);
  });

  it('overall default target is 60s', () => {
    expect(OVERALL_TARGET_SEC).toBe(60);
  });
});

// ─── getSpeedBenchmarkStatus ────────────────────────────────────────────────

describe('getSpeedBenchmarkStatus', () => {
  it('returns null for null input', () => {
    expect(getSpeedBenchmarkStatus(null)).toBe(null);
  });

  it('returns null for undefined input', () => {
    expect(getSpeedBenchmarkStatus(undefined)).toBe(null);
  });

  it('returns null for 0 ms (invalid: no time recorded)', () => {
    expect(getSpeedBenchmarkStatus(0)).toBe(null);
  });

  it('returns null for negative ms', () => {
    expect(getSpeedBenchmarkStatus(-500)).toBe(null);
  });

  it('returns "below_target" (faster) when time <= 90% of target', () => {
    // target=60s, 90% = 54s → 53s is below
    expect(getSpeedBenchmarkStatus(53_000)).toBe('below_target');
  });

  it('exactly at 90% of target is still "below_target" (<=)', () => {
    // target=60s → 54s = 54000ms exactly
    expect(getSpeedBenchmarkStatus(54_000)).toBe('below_target');
  });

  it('returns "on_target" when time is between 90% and 100% of target', () => {
    // 55s is > 54s (90%) and <= 60s → on target
    expect(getSpeedBenchmarkStatus(55_000)).toBe('on_target');
    expect(getSpeedBenchmarkStatus(60_000)).toBe('on_target');
  });

  it('returns "above_target" (slower) when time exceeds target', () => {
    expect(getSpeedBenchmarkStatus(65_000)).toBe('above_target');
  });

  it('honors custom target (e.g., clinical reasoning = 90s)', () => {
    expect(getSpeedBenchmarkStatus(80_000, CLINICAL_REASONING_TARGET_SEC)).toBe('below_target'); // <81s (90%)
    expect(getSpeedBenchmarkStatus(85_000, CLINICAL_REASONING_TARGET_SEC)).toBe('on_target');
    expect(getSpeedBenchmarkStatus(100_000, CLINICAL_REASONING_TARGET_SEC)).toBe('above_target');
  });
});

// ─── getSpeedBenchmarkLabel ─────────────────────────────────────────────────

describe('getSpeedBenchmarkLabel', () => {
  it('returns em-dash primary with null status when input is null', () => {
    const label = getSpeedBenchmarkLabel(null);
    expect(label.primary).toBe('—');
    expect(label.benchmark).toBe('');
    expect(label.status).toBe(null);
  });

  it('returns em-dash primary for zero time', () => {
    const label = getSpeedBenchmarkLabel(0);
    expect(label.primary).toBe('—');
    expect(label.status).toBe(null);
  });

  it('rounds ms to nearest second in the primary label', () => {
    // 64400ms → 64s
    expect(getSpeedBenchmarkLabel(64_400).primary).toBe('64s');
    // 64700ms → 65s
    expect(getSpeedBenchmarkLabel(64_700).primary).toBe('65s');
  });

  it('produces "Target: <60s" for on-target time with default target', () => {
    const label = getSpeedBenchmarkLabel(58_000);
    expect(label.status).toBe('on_target');
    expect(label.benchmark).toBe('Target: <60s');
  });

  it('annotates "(faster)" when below target', () => {
    const label = getSpeedBenchmarkLabel(40_000);
    expect(label.status).toBe('below_target');
    expect(label.benchmark).toBe('Target: <60s (faster)');
  });

  it('shows plain target line when above target (no "slower" suffix — UI chooses color)', () => {
    const label = getSpeedBenchmarkLabel(75_000);
    expect(label.status).toBe('above_target');
    expect(label.benchmark).toBe('Target: <60s');
  });

  it('switches to peer-avg format when showPeerAvg + peerAvgSec are provided', () => {
    // sec=40, peer=50 → diff -10 → "Peer avg: 50s"
    const label = getSpeedBenchmarkLabel(40_000, { showPeerAvg: true, peerAvgSec: 50 });
    expect(label.benchmark).toBe('Peer avg: 50s');
    expect(label.status).toBe('below_target');
  });

  it('adds "+Ns" suffix when user is slower than peer avg', () => {
    // sec=70, peer=50 → diff +20 → "Peer avg: 50s (+20s)"
    const label = getSpeedBenchmarkLabel(70_000, { showPeerAvg: true, peerAvgSec: 50 });
    expect(label.benchmark).toBe('Peer avg: 50s (+20s)');
    expect(label.status).toBe('above_target');
  });

  it('treats exactly-equal user and peer times as no-diff (diff=0, falls into "no suffix")', () => {
    const label = getSpeedBenchmarkLabel(50_000, { showPeerAvg: true, peerAvgSec: 50 });
    // diff = 0 → falls to the `diff <= 0` branch → no "+Ns"
    expect(label.benchmark).toBe('Peer avg: 50s');
  });

  it('skips peer-avg branch when peerAvgSec is missing', () => {
    const label = getSpeedBenchmarkLabel(60_000, { showPeerAvg: true });
    expect(label.benchmark).toContain('Target');
    expect(label.benchmark).not.toContain('Peer');
  });

  it('respects custom target in the peer-avg branch (status still derived from target)', () => {
    // With target=90s, 80s is "below_target" (<= 81s = 90% of 90)
    const label = getSpeedBenchmarkLabel(80_000, {
      targetSec: CLINICAL_REASONING_TARGET_SEC,
      showPeerAvg: true,
      peerAvgSec: 75,
    });
    expect(label.status).toBe('below_target');
    expect(label.benchmark).toBe('Peer avg: 75s (+5s)'); // 80 - 75 = 5
  });
});
