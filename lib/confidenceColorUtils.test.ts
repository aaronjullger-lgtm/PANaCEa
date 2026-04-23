// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/confidenceColorUtils.ts
 *
 * Pure functions tested:
 *   getConfidenceHex(confidence, darkMode?)   — interpolated red→yellow→green hex
 *   getConfidenceTextClass(confidence)        — CSS text class (error/warning/success)
 *   getConfidenceBgClass(confidence)          — CSS bg class
 *   getConfidenceBorderClass(confidence)      — CSS border class
 *   getConfidenceCssVar(confidence)           — CSS variable reference
 *   getConfidenceLabel(confidence)            — 'Low' | 'Medium' | 'High'
 *
 * Constants verified:
 *   CONFIDENCE_COLOR_LOW / MEDIUM / HIGH (light theme)
 *   CONFIDENCE_COLOR_LOW_DARK / MEDIUM_DARK / HIGH_DARK (dark theme)
 *
 * Thresholds (same for all class/label functions):
 *   < 0.33  → error   / Low
 *   [0.33, 0.66) → warning / Medium
 *   >= 0.66 → success / High
 */

import { describe, it, expect } from 'vitest';
import {
  CONFIDENCE_COLOR_LOW,
  CONFIDENCE_COLOR_MEDIUM,
  CONFIDENCE_COLOR_HIGH,
  CONFIDENCE_COLOR_LOW_DARK,
  CONFIDENCE_COLOR_MEDIUM_DARK,
  CONFIDENCE_COLOR_HIGH_DARK,
  getConfidenceHex,
  getConfidenceTextClass,
  getConfidenceBgClass,
  getConfidenceBorderClass,
  getConfidenceCssVar,
  getConfidenceLabel,
} from './confidenceColorUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('confidence color constants', () => {
  it('CONFIDENCE_COLOR_LOW is a valid hex string', () => {
    expect(CONFIDENCE_COLOR_LOW).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('CONFIDENCE_COLOR_MEDIUM is a valid hex string', () => {
    expect(CONFIDENCE_COLOR_MEDIUM).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('CONFIDENCE_COLOR_HIGH is a valid hex string', () => {
    expect(CONFIDENCE_COLOR_HIGH).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('dark theme constants are valid hex strings', () => {
    for (const color of [CONFIDENCE_COLOR_LOW_DARK, CONFIDENCE_COLOR_MEDIUM_DARK, CONFIDENCE_COLOR_HIGH_DARK]) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('light and dark theme constants are different from each other', () => {
    expect(CONFIDENCE_COLOR_LOW).not.toBe(CONFIDENCE_COLOR_LOW_DARK);
    expect(CONFIDENCE_COLOR_MEDIUM).not.toBe(CONFIDENCE_COLOR_MEDIUM_DARK);
    expect(CONFIDENCE_COLOR_HIGH).not.toBe(CONFIDENCE_COLOR_HIGH_DARK);
  });
});

// ─── getConfidenceHex ─────────────────────────────────────────────────────────

describe('getConfidenceHex', () => {
  it('returns CONFIDENCE_COLOR_LOW at confidence=0 (light)', () => {
    expect(getConfidenceHex(0)).toBe(CONFIDENCE_COLOR_LOW);
  });

  it('returns CONFIDENCE_COLOR_MEDIUM at confidence=0.5 (light)', () => {
    expect(getConfidenceHex(0.5)).toBe(CONFIDENCE_COLOR_MEDIUM);
  });

  it('returns CONFIDENCE_COLOR_HIGH at confidence=1 (light)', () => {
    expect(getConfidenceHex(1)).toBe(CONFIDENCE_COLOR_HIGH);
  });

  it('returns CONFIDENCE_COLOR_LOW_DARK at confidence=0 in dark mode', () => {
    expect(getConfidenceHex(0, true)).toBe(CONFIDENCE_COLOR_LOW_DARK);
  });

  it('returns CONFIDENCE_COLOR_HIGH_DARK at confidence=1 in dark mode', () => {
    expect(getConfidenceHex(1, true)).toBe(CONFIDENCE_COLOR_HIGH_DARK);
  });

  it('returns a valid hex string for any confidence in [0,1]', () => {
    const values = [0, 0.1, 0.25, 0.33, 0.5, 0.66, 0.75, 0.9, 1.0];
    for (const v of values) {
      expect(getConfidenceHex(v)).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('clamps negative confidence to 0 (same as confidence=0)', () => {
    expect(getConfidenceHex(-0.5)).toBe(getConfidenceHex(0));
  });

  it('clamps confidence > 1 to 1 (same as confidence=1)', () => {
    expect(getConfidenceHex(1.5)).toBe(getConfidenceHex(1));
  });

  it('is different at 0.25 vs 0.75 (interpolation produces distinct colors)', () => {
    expect(getConfidenceHex(0.25)).not.toBe(getConfidenceHex(0.75));
  });

  it('color at 0.25 is between red and yellow (not same as either endpoint)', () => {
    const mid = getConfidenceHex(0.25);
    expect(mid).not.toBe(CONFIDENCE_COLOR_LOW);
    expect(mid).not.toBe(CONFIDENCE_COLOR_MEDIUM);
  });

  it('darkMode=false is the default', () => {
    expect(getConfidenceHex(0.5)).toBe(getConfidenceHex(0.5, false));
  });
});

// ─── getConfidenceTextClass ───────────────────────────────────────────────────

describe('getConfidenceTextClass', () => {
  it('returns error class below threshold 0.33', () => {
    expect(getConfidenceTextClass(0)).toContain('error');
    expect(getConfidenceTextClass(0.1)).toContain('error');
    expect(getConfidenceTextClass(0.32)).toContain('error');
  });

  it('returns warning class at 0.33 and below 0.66', () => {
    expect(getConfidenceTextClass(0.33)).toContain('warning');
    expect(getConfidenceTextClass(0.5)).toContain('warning');
    expect(getConfidenceTextClass(0.65)).toContain('warning');
  });

  it('returns success class at 0.66 and above', () => {
    expect(getConfidenceTextClass(0.66)).toContain('success');
    expect(getConfidenceTextClass(0.8)).toContain('success');
    expect(getConfidenceTextClass(1.0)).toContain('success');
  });

  it('returned value starts with "text-"', () => {
    for (const v of [0, 0.5, 1]) {
      expect(getConfidenceTextClass(v)).toMatch(/^text-/);
    }
  });
});

// ─── getConfidenceBgClass ─────────────────────────────────────────────────────

describe('getConfidenceBgClass', () => {
  it('returns error bg below 0.33', () => {
    expect(getConfidenceBgClass(0.2)).toContain('error');
  });

  it('returns warning bg in [0.33, 0.66)', () => {
    expect(getConfidenceBgClass(0.5)).toContain('warning');
  });

  it('returns success bg at >= 0.66', () => {
    expect(getConfidenceBgClass(0.8)).toContain('success');
  });

  it('returned value starts with "bg-"', () => {
    expect(getConfidenceBgClass(0.5)).toMatch(/^bg-/);
  });
});

// ─── getConfidenceBorderClass ─────────────────────────────────────────────────

describe('getConfidenceBorderClass', () => {
  it('returns error border below 0.33', () => {
    expect(getConfidenceBorderClass(0)).toContain('error');
  });

  it('returns warning border in [0.33, 0.66)', () => {
    expect(getConfidenceBorderClass(0.4)).toContain('warning');
  });

  it('returns success border at >= 0.66', () => {
    expect(getConfidenceBorderClass(0.7)).toContain('success');
  });

  it('returned value starts with "border-"', () => {
    expect(getConfidenceBorderClass(0.5)).toMatch(/^border-/);
  });
});

// ─── getConfidenceCssVar ──────────────────────────────────────────────────────

describe('getConfidenceCssVar', () => {
  it('returns error var below 0.33', () => {
    expect(getConfidenceCssVar(0.1)).toContain('error');
  });

  it('returns warning var in [0.33, 0.66)', () => {
    expect(getConfidenceCssVar(0.5)).toContain('warning');
  });

  it('returns success var at >= 0.66', () => {
    expect(getConfidenceCssVar(0.9)).toContain('success');
  });

  it('returned value is a CSS var() expression', () => {
    for (const v of [0, 0.5, 1]) {
      expect(getConfidenceCssVar(v)).toMatch(/^var\(--/);
    }
  });
});

// ─── getConfidenceLabel ───────────────────────────────────────────────────────

describe('getConfidenceLabel', () => {
  it('returns "Low" for confidence < 0.33', () => {
    expect(getConfidenceLabel(0)).toBe('Low');
    expect(getConfidenceLabel(0.1)).toBe('Low');
    expect(getConfidenceLabel(0.32)).toBe('Low');
  });

  it('returns "Medium" for confidence in [0.33, 0.66)', () => {
    expect(getConfidenceLabel(0.33)).toBe('Medium');
    expect(getConfidenceLabel(0.5)).toBe('Medium');
    expect(getConfidenceLabel(0.65)).toBe('Medium');
  });

  it('returns "High" for confidence >= 0.66', () => {
    expect(getConfidenceLabel(0.66)).toBe('High');
    expect(getConfidenceLabel(0.8)).toBe('High');
    expect(getConfidenceLabel(1.0)).toBe('High');
  });

  it('is consistent with getConfidenceTextClass thresholds', () => {
    const cases: [number, 'Low' | 'Medium' | 'High'][] = [
      [0, 'Low'], [0.33, 'Medium'], [0.66, 'High'],
    ];
    for (const [v, label] of cases) {
      const textClass = getConfidenceTextClass(v);
      const expectedSegment = label === 'Low' ? 'error' : label === 'Medium' ? 'warning' : 'success';
      expect(textClass).toContain(expectedSegment);
      expect(getConfidenceLabel(v)).toBe(label);
    }
  });
});
