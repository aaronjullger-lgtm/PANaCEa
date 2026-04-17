/**
 * Tests for lib/confidenceColorUtils.ts
 *
 * Verifies confidence-based color mapping:
 * - Hex interpolation (red → yellow → green)
 * - CSS class generation
 * - CSS variable references
 * - Label categorization
 * - Boundary conditions
 * - Dark mode variants
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
} from '@/lib/confidenceColorUtils';

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) throw new Error(`Invalid hex: ${hex}`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

describe('getConfidenceHex', () => {
  describe('light mode (default)', () => {
    it('returns low color at confidence 0', () => {
      expect(getConfidenceHex(0)).toBe(CONFIDENCE_COLOR_LOW);
    });

    it('returns high color at confidence 1', () => {
      expect(getConfidenceHex(1)).toBe(CONFIDENCE_COLOR_HIGH);
    });

    it('returns medium color at confidence 0.5', () => {
      expect(getConfidenceHex(0.5)).toBe(CONFIDENCE_COLOR_MEDIUM);
    });

    it('returns a valid hex for any value between 0 and 1', () => {
      for (let i = 0; i <= 10; i++) {
        const val = i / 10;
        const hex = getConfidenceHex(val);
        expect(hex).toMatch(/^#[a-f\d]{6}$/);
      }
    });

    it('clamps values above 1', () => {
      expect(getConfidenceHex(2)).toBe(CONFIDENCE_COLOR_HIGH);
    });

    it('clamps values below 0', () => {
      expect(getConfidenceHex(-0.5)).toBe(CONFIDENCE_COLOR_LOW);
    });

    it('transitions from red through yellow to green', () => {
      const [r0, g0] = hexToRgb(getConfidenceHex(0));
      const [r50, g50] = hexToRgb(getConfidenceHex(0.5));
      const [r100, g100] = hexToRgb(getConfidenceHex(1));

      // At 0: red channel should be dominant over green
      expect(r0).toBeGreaterThan(g0);
      // At 0.5: green channel should be significantly higher than at 0
      // (yellow has both R and G high, but G increases dramatically)
      expect(g50).toBeGreaterThan(g0);
      // At 1: green channel should be highest and red should be low
      expect(g100).toBeGreaterThan(r100);
    });
  });

  describe('dark mode', () => {
    it('returns dark low color at confidence 0', () => {
      expect(getConfidenceHex(0, true)).toBe(CONFIDENCE_COLOR_LOW_DARK);
    });

    it('returns dark high color at confidence 1', () => {
      expect(getConfidenceHex(1, true)).toBe(CONFIDENCE_COLOR_HIGH_DARK);
    });

    it('returns dark medium color at confidence 0.5', () => {
      expect(getConfidenceHex(0.5, true)).toBe(CONFIDENCE_COLOR_MEDIUM_DARK);
    });

    it('uses different colors than light mode', () => {
      expect(getConfidenceHex(0, true)).not.toBe(getConfidenceHex(0, false));
      expect(getConfidenceHex(1, true)).not.toBe(getConfidenceHex(1, false));
    });
  });
});

describe('getConfidenceTextClass', () => {
  it('returns error class for low confidence', () => {
    expect(getConfidenceTextClass(0)).toBe('text-[var(--color-error)]');
    expect(getConfidenceTextClass(0.1)).toBe('text-[var(--color-error)]');
    expect(getConfidenceTextClass(0.32)).toBe('text-[var(--color-error)]');
  });

  it('returns warning class for medium confidence', () => {
    expect(getConfidenceTextClass(0.33)).toBe('text-[var(--color-warning)]');
    expect(getConfidenceTextClass(0.5)).toBe('text-[var(--color-warning)]');
    expect(getConfidenceTextClass(0.65)).toBe('text-[var(--color-warning)]');
  });

  it('returns success class for high confidence', () => {
    expect(getConfidenceTextClass(0.66)).toBe('text-[var(--color-success)]');
    expect(getConfidenceTextClass(0.8)).toBe('text-[var(--color-success)]');
    expect(getConfidenceTextClass(1)).toBe('text-[var(--color-success)]');
  });
});

describe('getConfidenceBgClass', () => {
  it('returns error bg for low confidence', () => {
    expect(getConfidenceBgClass(0)).toBe('bg-[var(--color-error)]');
  });

  it('returns warning bg for medium confidence', () => {
    expect(getConfidenceBgClass(0.5)).toBe('bg-[var(--color-warning)]');
  });

  it('returns success bg for high confidence', () => {
    expect(getConfidenceBgClass(0.8)).toBe('bg-[var(--color-success)]');
  });
});

describe('getConfidenceBorderClass', () => {
  it('returns error border for low confidence', () => {
    expect(getConfidenceBorderClass(0.2)).toBe('border-[var(--color-error)]');
  });

  it('returns warning border for medium confidence', () => {
    expect(getConfidenceBorderClass(0.4)).toBe('border-[var(--color-warning)]');
  });

  it('returns success border for high confidence', () => {
    expect(getConfidenceBorderClass(0.9)).toBe('border-[var(--color-success)]');
  });
});

describe('getConfidenceCssVar', () => {
  it('returns error var for low confidence', () => {
    expect(getConfidenceCssVar(0)).toBe('var(--color-error)');
  });

  it('returns warning var for medium confidence', () => {
    expect(getConfidenceCssVar(0.5)).toBe('var(--color-warning)');
  });

  it('returns success var for high confidence', () => {
    expect(getConfidenceCssVar(0.8)).toBe('var(--color-success)');
  });
});

describe('getConfidenceLabel', () => {
  it('returns "Low" for low confidence', () => {
    expect(getConfidenceLabel(0)).toBe('Low');
    expect(getConfidenceLabel(0.32)).toBe('Low');
  });

  it('returns "Medium" for medium confidence', () => {
    expect(getConfidenceLabel(0.33)).toBe('Medium');
    expect(getConfidenceLabel(0.5)).toBe('Medium');
    expect(getConfidenceLabel(0.65)).toBe('Medium');
  });

  it('returns "High" for high confidence', () => {
    expect(getConfidenceLabel(0.66)).toBe('High');
    expect(getConfidenceLabel(1)).toBe('High');
  });

  it('handles boundary values consistently', () => {
    // All three class/label functions should agree on boundaries
    const testPoints = [0, 0.32, 0.33, 0.65, 0.66, 1];
    for (const p of testPoints) {
      const label = getConfidenceLabel(p);
      const cssVar = getConfidenceCssVar(p);
      const textClass = getConfidenceTextClass(p);

      if (label === 'Low') {
        expect(cssVar).toBe('var(--color-error)');
        expect(textClass).toBe('text-[var(--color-error)]');
      } else if (label === 'Medium') {
        expect(cssVar).toBe('var(--color-warning)');
        expect(textClass).toBe('text-[var(--color-warning)]');
      } else {
        expect(cssVar).toBe('var(--color-success)');
        expect(textClass).toBe('text-[var(--color-success)]');
      }
    }
  });
});
