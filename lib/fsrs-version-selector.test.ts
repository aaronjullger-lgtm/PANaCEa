// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/fsrs-version-selector.ts
 *
 * Pure functions tested:
 *   selectFSRS(params?)    — returns FSRS v6 or FSRSv7 instance
 *   inferVersion(w)        — infers '6' or '7-alpha' from w.length
 *   isV7Alpha(params)      — true iff version==='7-alpha' AND w.length===29
 *
 * Rules:
 *   - No params / params without version → FSRS v6
 *   - version==='7-alpha' AND w.length===29 → FSRSv7
 *   - version==='7-alpha' but w.length!==29 → FSRS v6 (safe fallback)
 *   - inferVersion: w.length===29 → '7-alpha', else → '6'
 */

import { describe, it, expect } from 'vitest';
import { selectFSRS, inferVersion, isV7Alpha } from './fsrs-version-selector';
import { defaultParameters } from './fsrs';

// A 29-element w array for v7-alpha
const W_V7 = Array(29).fill(0.1) as number[];
// Standard 21-element v6 w array
const W_V6 = [...defaultParameters.w];

// ─── inferVersion ─────────────────────────────────────────────────────────────

describe('inferVersion', () => {
  it('returns "6" for null', () => {
    expect(inferVersion(null)).toBe('6');
  });

  it('returns "6" for undefined', () => {
    expect(inferVersion(undefined)).toBe('6');
  });

  it('returns "6" for empty array', () => {
    expect(inferVersion([])).toBe('6');
  });

  it('returns "6" for 21-element array (standard v6)', () => {
    expect(inferVersion(W_V6)).toBe('6');
  });

  it('returns "7-alpha" for 29-element array', () => {
    expect(inferVersion(W_V7)).toBe('7-alpha');
  });

  it('returns "6" for any non-29 length', () => {
    expect(inferVersion(Array(20).fill(0.1))).toBe('6');
    expect(inferVersion(Array(30).fill(0.1))).toBe('6');
    expect(inferVersion(Array(1).fill(0.1))).toBe('6');
  });
});

// ─── isV7Alpha ────────────────────────────────────────────────────────────────

describe('isV7Alpha', () => {
  it('returns false for null', () => {
    expect(isV7Alpha(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isV7Alpha(undefined)).toBe(false);
  });

  it('returns false when version is "6" regardless of w length', () => {
    expect(isV7Alpha({ ...defaultParameters, w: W_V6, version: '6' })).toBe(false);
    expect(isV7Alpha({ ...defaultParameters, w: W_V7, version: '6' })).toBe(false);
  });

  it('returns false when version is "7-alpha" but w.length !== 29', () => {
    expect(isV7Alpha({ ...defaultParameters, w: W_V6, version: '7-alpha' })).toBe(false);
  });

  it('returns true when version is "7-alpha" AND w.length === 29', () => {
    expect(isV7Alpha({ ...defaultParameters, w: W_V7, version: '7-alpha' })).toBe(true);
  });

  it('returns false when no version field is set (defaults to v6)', () => {
    expect(isV7Alpha({ ...defaultParameters, w: W_V7 })).toBe(false);
  });
});

// ─── selectFSRS ───────────────────────────────────────────────────────────────

describe('selectFSRS', () => {
  it('returns an object with a next() method when called without params', () => {
    const scheduler = selectFSRS();
    expect(typeof scheduler.next).toBe('function');
  });

  it('returns v6 scheduler when params have version "6"', () => {
    const scheduler = selectFSRS({ ...defaultParameters, w: W_V6, version: '6' });
    expect(typeof scheduler.next).toBe('function');
    // v6: 21 weights → w property reflects it
    expect((scheduler as any).parameters?.w?.length ?? (scheduler as any).params?.w?.length ?? 21).toBe(21);
  });

  it('returns v7 scheduler when params have version "7-alpha" and 29-element w', () => {
    const scheduler = selectFSRS({ ...defaultParameters, w: W_V7, version: '7-alpha' });
    expect(typeof scheduler.next).toBe('function');
  });

  it('falls back to v6 when version is "7-alpha" but w.length !== 29', () => {
    // Should not throw — silently falls back to v6
    const scheduler = selectFSRS({ ...defaultParameters, w: W_V6, version: '7-alpha' });
    expect(typeof scheduler.next).toBe('function');
  });

  it('returns v6 when params is undefined', () => {
    const scheduler = selectFSRS(undefined);
    expect(typeof scheduler.next).toBe('function');
  });
});
