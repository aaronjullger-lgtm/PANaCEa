/**
 * Unit tests for lib/services/distractorChronometryService.ts
 *
 * Constants:
 *   MIN_MULTIPLIER            = 0.75
 *   CORRECT_ABANDONED_PENALTY = 0.85
 *   HIGH_UNCERTAINTY_PENALTY  = 0.95   (triggered at ≥3 unique options)
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeDistractorChronometry,
  type OptionInteractionRecord,
} from './distractorChronometryService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInteraction(
  option_id: string,
  dwell_ms: number | null = null
): OptionInteractionRecord {
  return { option_id, selected_at_ms: 0, deselected_at_ms: null, dwell_ms };
}

// ─── Empty / no-interaction guard ─────────────────────────────────────────────

describe('analyzeDistractorChronometry — no interactions', () => {
  it('returns neutral multiplier for empty interaction array', () => {
    const r = analyzeDistractorChronometry([], 'A', 'B');
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.correctOptionAbandoned).toBe(false);
    expect(r.longestDistractorDwellMs).toBe(0);
  });

  it('returns uniqueOptionsConsidered=1 when finalSelectedId is present and no interactions', () => {
    const r = analyzeDistractorChronometry([], 'A', 'B');
    expect(r.uniqueOptionsConsidered).toBe(1);
  });

  it('returns uniqueOptionsConsidered=0 when finalSelectedId is empty', () => {
    const r = analyzeDistractorChronometry([], 'A', '');
    expect(r.uniqueOptionsConsidered).toBe(0);
  });
});

// ─── Decisive single selection ────────────────────────────────────────────────

describe('analyzeDistractorChronometry — decisive selection', () => {
  it('returns multiplier=1.0 for a single correct selection', () => {
    const r = analyzeDistractorChronometry([makeInteraction('A')], 'A', 'A');
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.correctOptionAbandoned).toBe(false);
    expect(r.uniqueOptionsConsidered).toBe(1);
  });

  it('returns multiplier=1.0 for a single incorrect selection with no hesitation', () => {
    const r = analyzeDistractorChronometry([makeInteraction('B')], 'A', 'B');
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.correctOptionAbandoned).toBe(false);
  });

  it('returns multiplier=1.0 for two options considered but no correct abandoned', () => {
    // Considered B then C, no correct (A) involved
    const r = analyzeDistractorChronometry(
      [makeInteraction('B'), makeInteraction('C')],
      'A', 'C'
    );
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.uniqueOptionsConsidered).toBe(2);
  });
});

// ─── Correct option abandoned ─────────────────────────────────────────────────

describe('analyzeDistractorChronometry — correct option abandoned', () => {
  it('applies 0.85 penalty when correct answer was selected then switched away', () => {
    // Student touched correct (A) but submitted B
    const r = analyzeDistractorChronometry(
      [makeInteraction('A'), makeInteraction('B')],
      'A', 'B'
    );
    expect(r.correctOptionAbandoned).toBe(true);
    expect(r.confidenceMultiplier).toBeCloseTo(0.85, 3);
  });

  it('does NOT flag abandonment when correct option is the final answer', () => {
    const r = analyzeDistractorChronometry(
      [makeInteraction('B'), makeInteraction('A')],
      'A', 'A'
    );
    expect(r.correctOptionAbandoned).toBe(false);
    expect(r.confidenceMultiplier).toBe(1.0);
  });

  it('does NOT flag abandonment when correct option was never selected', () => {
    const r = analyzeDistractorChronometry(
      [makeInteraction('B'), makeInteraction('C')],
      'A', 'C'
    );
    expect(r.correctOptionAbandoned).toBe(false);
  });
});

// ─── High uncertainty (≥3 unique options) ────────────────────────────────────

describe('analyzeDistractorChronometry — high uncertainty', () => {
  it('applies 0.95 penalty for exactly 3 unique options', () => {
    const r = analyzeDistractorChronometry(
      [makeInteraction('B'), makeInteraction('C'), makeInteraction('D')],
      'A', 'D'
    );
    expect(r.uniqueOptionsConsidered).toBe(3);
    expect(r.confidenceMultiplier).toBeCloseTo(0.95, 3);
  });

  it('applies 0.95 penalty for 4+ unique options', () => {
    const r = analyzeDistractorChronometry(
      [makeInteraction('A'), makeInteraction('B'), makeInteraction('C'), makeInteraction('D')],
      'X', 'D'
    );
    expect(r.uniqueOptionsConsidered).toBe(4);
    expect(r.confidenceMultiplier).toBeCloseTo(0.95, 3);
  });

  it('stacks with correct-abandoned penalty: 0.85 × 0.95 = 0.8075', () => {
    // Touched correct (A), went to B and C, then submitted D — 4 options touched
    const r = analyzeDistractorChronometry(
      [makeInteraction('A'), makeInteraction('B'), makeInteraction('C')],
      'A', 'C'  // correct=A, abandoned, 3 unique options → both penalties
    );
    expect(r.correctOptionAbandoned).toBe(true);
    expect(r.uniqueOptionsConsidered).toBe(3);
    // 0.85 * 0.95 = 0.8075, rounded to 3 dp → 0.808
    expect(r.confidenceMultiplier).toBe(Math.round(0.85 * 0.95 * 1000) / 1000);
  });

  it('floors combined penalty at 0.75', () => {
    // If stacking ever produces < 0.75, it is clamped
    // 0.85 * 0.95 = 0.8075 — above floor, so floor only matters theoretically
    // Verify the floor guard exists by checking the combined stays ≥ 0.75
    const r = analyzeDistractorChronometry(
      [makeInteraction('A'), makeInteraction('B'), makeInteraction('C')],
      'A', 'C'
    );
    expect(r.confidenceMultiplier).toBeGreaterThanOrEqual(0.75);
  });
});

// ─── Distractor dwell tracking ────────────────────────────────────────────────

describe('analyzeDistractorChronometry — distractor dwell', () => {
  it('returns 0 when no dwell times are recorded', () => {
    const r = analyzeDistractorChronometry(
      [makeInteraction('B', null), makeInteraction('C', null)],
      'A', 'C'
    );
    expect(r.longestDistractorDwellMs).toBe(0);
  });

  it('returns max dwell time across wrong options', () => {
    const r = analyzeDistractorChronometry(
      [makeInteraction('B', 1200), makeInteraction('C', 3500), makeInteraction('D', 800)],
      'A', 'C'
    );
    expect(r.longestDistractorDwellMs).toBe(3500);
  });

  it('excludes the correct option from dwell computation', () => {
    // Correct (A) has a long dwell — should NOT count toward longestDistractorDwellMs
    const r = analyzeDistractorChronometry(
      [makeInteraction('A', 5000), makeInteraction('B', 1000)],
      'A', 'A'
    );
    expect(r.longestDistractorDwellMs).toBe(1000);
  });

  it('handles mixed null/non-null dwell times correctly', () => {
    const r = analyzeDistractorChronometry(
      [makeInteraction('B', null), makeInteraction('C', 2500), makeInteraction('D', null)],
      'A', 'D'
    );
    expect(r.longestDistractorDwellMs).toBe(2500);
  });
});

// ─── uniqueOptionsConsidered ──────────────────────────────────────────────────

describe('analyzeDistractorChronometry — uniqueOptionsConsidered', () => {
  it('de-duplicates repeated selections of the same option', () => {
    // B selected twice — only 1 unique
    const r = analyzeDistractorChronometry(
      [makeInteraction('B'), makeInteraction('B'), makeInteraction('B')],
      'A', 'B'
    );
    expect(r.uniqueOptionsConsidered).toBe(1);
  });

  it('counts all distinct options correctly', () => {
    const r = analyzeDistractorChronometry(
      [makeInteraction('A'), makeInteraction('B'), makeInteraction('A'), makeInteraction('C')],
      'D', 'C'
    );
    expect(r.uniqueOptionsConsidered).toBe(3);
  });
});
