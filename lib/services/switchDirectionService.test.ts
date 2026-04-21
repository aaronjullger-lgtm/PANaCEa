/**
 * Unit tests for lib/services/switchDirectionService.ts
 *
 * Switch direction constants:
 *   MIN_MULTIPLIER             = 0.80
 *   RIGHT_TO_WRONG_PENALTY     = 0.90
 *   FLAILING_PENALTY           = 0.95  (≥2 wrong→wrong)
 *   GOOD_METACOGNITION_BONUS   = 1.03  (wrongToRight > 0 and rightToWrong = 0)
 *
 * Grade penalty constants (first-change weighting):
 *   FIRST_SWITCH_WR_BONUS      = +0.10
 *   FIRST_SWITCH_RW_PENALTY    = -0.25
 *   FIRST_SWITCH_WW_PENALTY    = -0.10
 *   SUBSEQUENT_SWITCH_PENALTY  = -0.05 per additional switch
 */

import { describe, it, expect } from 'vitest';
import { analyzeSwitchDirections } from './switchDirectionService';

// ─── No switches ──────────────────────────────────────────────────────────────

describe('analyzeSwitchDirections — no switches', () => {
  it('returns neutral result for null/empty interactions', () => {
    const r = analyzeSwitchDirections([], 'A');
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.totalSwitches).toBe(0);
    expect(r.firstSwitchDirection).toBeNull();
    expect(r.metacognitivePrecision).toBeNull();
    expect(r.gradePenaltyRecommendation).toBe(0);
  });

  it('returns neutral result for single interaction', () => {
    const r = analyzeSwitchDirections([{ option_id: 'A' }], 'A');
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.totalSwitches).toBe(0);
    expect(r.wrongToRight).toBe(0);
    expect(r.rightToWrong).toBe(0);
    expect(r.wrongToWrong).toBe(0);
  });
});

// ─── Wrong → Right (WR) ───────────────────────────────────────────────────────

describe('analyzeSwitchDirections — wrong → right (self-correction)', () => {
  it('detects WR switch and sets firstSwitchDirection=WR', () => {
    // B (wrong) → A (correct)
    const r = analyzeSwitchDirections([{ option_id: 'B' }, { option_id: 'A' }], 'A');
    expect(r.wrongToRight).toBe(1);
    expect(r.rightToWrong).toBe(0);
    expect(r.firstSwitchDirection).toBe('WR');
  });

  it('applies GOOD_METACOGNITION_BONUS (1.03) for clean WR correction', () => {
    const r = analyzeSwitchDirections([{ option_id: 'B' }, { option_id: 'A' }], 'A');
    expect(r.confidenceMultiplier).toBeCloseTo(1.03, 3);
  });

  it('awards +0.10 grade bonus for first WR switch', () => {
    const r = analyzeSwitchDirections([{ option_id: 'B' }, { option_id: 'A' }], 'A');
    expect(r.gradePenaltyRecommendation).toBeCloseTo(0.10, 3);
  });

  it('second switch subtracts -0.05 (total=0.05 for WR+subsequent)', () => {
    // B(wrong)→A(correct)→B(wrong) — first=WR(+0.10), subsequent=1(-0.05) → +0.05
    const r = analyzeSwitchDirections(
      [{ option_id: 'B' }, { option_id: 'A' }, { option_id: 'B' }],
      'A'
    );
    expect(r.gradePenaltyRecommendation).toBeCloseTo(0.05, 3);
  });
});

// ─── Right → Wrong (RW) ───────────────────────────────────────────────────────

describe('analyzeSwitchDirections — right → wrong (second-guessing)', () => {
  it('detects RW switch', () => {
    // A (correct) → B (wrong)
    const r = analyzeSwitchDirections([{ option_id: 'A' }, { option_id: 'B' }], 'A');
    expect(r.rightToWrong).toBe(1);
    expect(r.wrongToRight).toBe(0);
    expect(r.firstSwitchDirection).toBe('RW');
  });

  it('applies RIGHT_TO_WRONG_PENALTY (0.90)', () => {
    const r = analyzeSwitchDirections([{ option_id: 'A' }, { option_id: 'B' }], 'A');
    expect(r.confidenceMultiplier).toBeCloseTo(0.90, 3);
  });

  it('applies -0.25 grade penalty for first RW switch', () => {
    const r = analyzeSwitchDirections([{ option_id: 'A' }, { option_id: 'B' }], 'A');
    expect(r.gradePenaltyRecommendation).toBeCloseTo(-0.25, 3);
  });

  it('does NOT award metacognition bonus when rightToWrong > 0', () => {
    // WR followed by RW: wrongToRight=1 but rightToWrong=1 → no bonus
    const r = analyzeSwitchDirections(
      [{ option_id: 'B' }, { option_id: 'A' }, { option_id: 'C' }],
      'A'
    );
    expect(r.wrongToRight).toBe(1);
    expect(r.rightToWrong).toBe(1);
    // Multiplier = 0.90 (RW penalty), no 1.03 bonus
    expect(r.confidenceMultiplier).toBeCloseTo(0.90, 3);
  });
});

// ─── Wrong → Wrong (WW) ───────────────────────────────────────────────────────

describe('analyzeSwitchDirections — wrong → wrong (lateral confusion)', () => {
  it('detects WW switch', () => {
    // B (wrong) → C (wrong), correct=A
    const r = analyzeSwitchDirections([{ option_id: 'B' }, { option_id: 'C' }], 'A');
    expect(r.wrongToWrong).toBe(1);
    expect(r.firstSwitchDirection).toBe('WW');
  });

  it('returns multiplier=1.0 for a single WW (no flailing yet)', () => {
    const r = analyzeSwitchDirections([{ option_id: 'B' }, { option_id: 'C' }], 'A');
    expect(r.confidenceMultiplier).toBe(1.0);
  });

  it('applies FLAILING_PENALTY (0.95) at exactly 2 wrong→wrong switches', () => {
    // B→C→D (2 WW switches)
    const r = analyzeSwitchDirections(
      [{ option_id: 'B' }, { option_id: 'C' }, { option_id: 'D' }],
      'A'
    );
    expect(r.wrongToWrong).toBe(2);
    expect(r.confidenceMultiplier).toBeCloseTo(0.95, 3);
  });

  it('applies -0.10 grade penalty for first WW switch', () => {
    const r = analyzeSwitchDirections([{ option_id: 'B' }, { option_id: 'C' }], 'A');
    expect(r.gradePenaltyRecommendation).toBeCloseTo(-0.10, 3);
  });
});

// ─── Penalty stacking & floor ─────────────────────────────────────────────────

describe('analyzeSwitchDirections — penalty stacking', () => {
  it('stacks RW penalty with flailing penalty', () => {
    // A(right)→B(wrong)→C(wrong)→D(wrong): rightToWrong=1, wrongToWrong=2
    // multiplier = 1.0 * 0.90 (RW) * 0.95 (flailing) = 0.855
    const r = analyzeSwitchDirections(
      [{ option_id: 'A' }, { option_id: 'B' }, { option_id: 'C' }, { option_id: 'D' }],
      'A'
    );
    expect(r.rightToWrong).toBe(1);
    expect(r.wrongToWrong).toBe(2);
    expect(r.confidenceMultiplier).toBeCloseTo(0.855, 3);
  });

  it('floor ensures multiplier never goes below 0.80', () => {
    // Many bad switches should be floored
    const r = analyzeSwitchDirections(
      [
        { option_id: 'A' }, { option_id: 'B' }, { option_id: 'C' },
        { option_id: 'D' }, { option_id: 'E' }, { option_id: 'A' }, { option_id: 'B' },
      ],
      'A'
    );
    expect(r.confidenceMultiplier).toBeGreaterThanOrEqual(0.80);
  });
});

// ─── Metacognitive precision ──────────────────────────────────────────────────

describe('analyzeSwitchDirections — metacognitivePrecision', () => {
  it('returns null when totalSwitches is 0', () => {
    const r = analyzeSwitchDirections([{ option_id: 'A' }], 'A');
    expect(r.metacognitivePrecision).toBeNull();
  });

  it('returns 1.0 when a single WR switch (perfect self-correction)', () => {
    // B→A = 1 switch, 1 WR, precision = 1/1 = 1.0
    const r = analyzeSwitchDirections([{ option_id: 'B' }, { option_id: 'A' }], 'A');
    expect(r.metacognitivePrecision).toBeCloseTo(1.0, 3);
  });

  it('returns 0 when all switches are RW or WW', () => {
    // A→B (RW) = 1 switch, wrongToRight=0, precision=0/1=0
    const r = analyzeSwitchDirections([{ option_id: 'A' }, { option_id: 'B' }], 'A');
    expect(r.metacognitivePrecision).toBeCloseTo(0, 3);
  });

  it('is rounded to 3 decimal places', () => {
    const r = analyzeSwitchDirections(
      [{ option_id: 'B' }, { option_id: 'A' }, { option_id: 'C' }, { option_id: 'D' }],
      'A'
    );
    if (r.metacognitivePrecision != null) {
      const rounded = Math.round(r.metacognitivePrecision * 1000) / 1000;
      expect(r.metacognitivePrecision).toBe(rounded);
    }
  });
});

// ─── netSwitchValue ───────────────────────────────────────────────────────────

describe('analyzeSwitchDirections — netSwitchValue', () => {
  it('netSwitchValue = wrongToRight - rightToWrong', () => {
    // B→A (WR=1), A→B (RW=1): net = 0
    const r = analyzeSwitchDirections(
      [{ option_id: 'B' }, { option_id: 'A' }, { option_id: 'B' }],
      'A'
    );
    expect(r.netSwitchValue).toBe(0);
  });

  it('positive netSwitchValue for net WR-RW > 0', () => {
    // B→A (WR), A→C (RW), C→A (WR): WR=2, RW=1, net=1
    const r = analyzeSwitchDirections(
      [{ option_id: 'B' }, { option_id: 'A' }, { option_id: 'C' }, { option_id: 'A' }],
      'A'
    );
    expect(r.wrongToRight).toBe(2);
    expect(r.rightToWrong).toBe(1);
    expect(r.netSwitchValue).toBe(1);
  });
});
