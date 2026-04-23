// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/accuracyColorUtils.ts
 *
 * Pure functions tested:
 *   getAccuracyHex(score)              — hex color string
 *   getAccuracyTextClass(score)        — Tailwind text class
 *   getAccuracyBarClass(score)         — Tailwind bg class
 *   getAccuracyBarClassSemantic(score) — semantic Tailwind bg class
 *
 * Constants:
 *   ACCURACY_MASTERY_THRESHOLD  = 80
 *   ACCURACY_BUILDING_THRESHOLD = 60
 *   ACCURACY_COLOR_MASTERY      = '#14b8a6'
 *   ACCURACY_COLOR_BUILDING     = '#2563eb'
 *   ACCURACY_COLOR_WARNING      = '#f59e0b'
 *
 * Scale (score is 0-100):
 *   >= 80 → mastery  (teal)
 *   60-79 → building (blue)
 *   < 60  → warning  (amber)
 */

import { describe, it, expect } from 'vitest';
import {
  getAccuracyHex,
  getAccuracyTextClass,
  getAccuracyBarClass,
  getAccuracyBarClassSemantic,
  ACCURACY_MASTERY_THRESHOLD,
  ACCURACY_BUILDING_THRESHOLD,
  ACCURACY_COLOR_MASTERY,
  ACCURACY_COLOR_BUILDING,
  ACCURACY_COLOR_WARNING,
} from './accuracyColorUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('accuracy thresholds and colors', () => {
  it('ACCURACY_MASTERY_THRESHOLD is 80', () => {
    expect(ACCURACY_MASTERY_THRESHOLD).toBe(80);
  });

  it('ACCURACY_BUILDING_THRESHOLD is 60', () => {
    expect(ACCURACY_BUILDING_THRESHOLD).toBe(60);
  });

  it('ACCURACY_COLOR_MASTERY is teal hex #14b8a6', () => {
    expect(ACCURACY_COLOR_MASTERY).toBe('#14b8a6');
  });

  it('ACCURACY_COLOR_BUILDING is blue hex #2563eb', () => {
    expect(ACCURACY_COLOR_BUILDING).toBe('#2563eb');
  });

  it('ACCURACY_COLOR_WARNING is amber hex #f59e0b', () => {
    expect(ACCURACY_COLOR_WARNING).toBe('#f59e0b');
  });
});

// ─── getAccuracyHex ───────────────────────────────────────────────────────────

describe('getAccuracyHex', () => {
  it('score >= 80 → mastery color (#14b8a6)', () => {
    expect(getAccuracyHex(80)).toBe('#14b8a6');
    expect(getAccuracyHex(100)).toBe('#14b8a6');
    expect(getAccuracyHex(95)).toBe('#14b8a6');
  });

  it('score in [60, 79] → building color (#2563eb)', () => {
    expect(getAccuracyHex(60)).toBe('#2563eb');
    expect(getAccuracyHex(70)).toBe('#2563eb');
    expect(getAccuracyHex(79)).toBe('#2563eb');
  });

  it('score < 60 → warning color (#f59e0b)', () => {
    expect(getAccuracyHex(0)).toBe('#f59e0b');
    expect(getAccuracyHex(59)).toBe('#f59e0b');
    expect(getAccuracyHex(30)).toBe('#f59e0b');
  });

  it('boundary: exactly 80 → mastery', () => {
    expect(getAccuracyHex(80)).toBe(ACCURACY_COLOR_MASTERY);
  });

  it('boundary: exactly 60 → building', () => {
    expect(getAccuracyHex(60)).toBe(ACCURACY_COLOR_BUILDING);
  });

  it('boundary: 59 → warning', () => {
    expect(getAccuracyHex(59)).toBe(ACCURACY_COLOR_WARNING);
  });
});

// ─── getAccuracyTextClass ─────────────────────────────────────────────────────

describe('getAccuracyTextClass', () => {
  it('score >= 80 → data-pass text class', () => {
    const cls = getAccuracyTextClass(80);
    expect(cls).toContain('data-pass');
  });

  it('score in [60, 79] → accent text class', () => {
    const cls = getAccuracyTextClass(70);
    expect(cls).toContain('accent');
  });

  it('score < 60 → provisional text class', () => {
    const cls = getAccuracyTextClass(50);
    expect(cls).toContain('provisional');
  });

  it('returns a non-empty string for any score', () => {
    for (const score of [0, 30, 59, 60, 75, 80, 100]) {
      expect(getAccuracyTextClass(score).length).toBeGreaterThan(0);
    }
  });
});

// ─── getAccuracyBarClass ──────────────────────────────────────────────────────

describe('getAccuracyBarClass', () => {
  it('score >= 80 → data-pass bg class', () => {
    const cls = getAccuracyBarClass(80);
    expect(cls).toContain('data-pass');
  });

  it('score in [60, 79] → accent bg class', () => {
    const cls = getAccuracyBarClass(70);
    expect(cls).toContain('accent');
  });

  it('score < 60 → provisional bg class', () => {
    const cls = getAccuracyBarClass(50);
    expect(cls).toContain('provisional');
  });
});

// ─── getAccuracyBarClassSemantic ──────────────────────────────────────────────

describe('getAccuracyBarClassSemantic', () => {
  it('score >= 80 → bg-data-pass', () => {
    expect(getAccuracyBarClassSemantic(80)).toBe('bg-data-pass');
    expect(getAccuracyBarClassSemantic(100)).toBe('bg-data-pass');
  });

  it('score in [60, 79] → accent variant', () => {
    const cls = getAccuracyBarClassSemantic(70);
    expect(cls).toContain('accent');
  });

  it('score < 60 → bg-data-provisional', () => {
    expect(getAccuracyBarClassSemantic(50)).toBe('bg-data-provisional');
    expect(getAccuracyBarClassSemantic(0)).toBe('bg-data-provisional');
  });

  it('boundary: 80 → mastery, 60 → building, 59 → warning', () => {
    expect(getAccuracyBarClassSemantic(80)).toBe('bg-data-pass');
    const building = getAccuracyBarClassSemantic(60);
    expect(building).toContain('accent');
    expect(getAccuracyBarClassSemantic(59)).toBe('bg-data-provisional');
  });
});
