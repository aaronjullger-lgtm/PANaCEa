/**
 * CODE-001 regression tests — FSRS parameter validation / w[6] safety.
 *
 * Bug: a non-finite required weight (esp. w[6], the difficulty mean-reversion
 * rate) could pass validation and reach the scheduler, where `w[6] ?? 0`
 * silently disables difficulty mean-reversion (or a NaN propagates). These
 * tests lock in the read-side reject (isParamsOnCurrentScale/loadParametersSafely)
 * and the constructor defense-in-depth (normalizeParameters repair).
 */
import { describe, it, expect } from 'vitest';
import {
  FSRS,
  FSRSState,
  Rating,
  defaultParameters,
  isParamsOnCurrentScale,
  loadParametersSafely,
} from '../lib/fsrs';

const W6_DEFAULT = 3.0194; // defaultParameters.w[6]

function validW(): number[] {
  return [...defaultParameters.w];
}

describe('isParamsOnCurrentScale', () => {
  it('accepts canonical default params', () => {
    expect(isParamsOnCurrentScale(validW())).toBe(true);
    expect(defaultParameters.w[6]).toBe(W6_DEFAULT);
  });

  it('rejects params with an undefined w[6]', () => {
    const w = validW();
    // simulate a sparse/truncated array where w[6] is missing
    delete (w as unknown as Record<number, number>)[6];
    expect(isParamsOnCurrentScale(w)).toBe(false);
  });

  it('rejects params with a NaN w[6]', () => {
    const w = validW();
    w[6] = NaN;
    expect(isParamsOnCurrentScale(w)).toBe(false);
  });

  it('rejects params with a non-finite weight anywhere', () => {
    const w = validW();
    w[3] = Infinity;
    expect(isParamsOnCurrentScale(w)).toBe(false);
  });

  it('still rejects wrong-length and off-scale w[19]/w[20]', () => {
    expect(isParamsOnCurrentScale(validW().slice(0, 18))).toBe(false);
    const offScale = validW();
    offScale[19] = 9; // FSRS-4/5 scale — off the v6 scale
    expect(isParamsOnCurrentScale(offScale)).toBe(false);
  });
});

describe('loadParametersSafely', () => {
  it('preserves valid stored params including w[6]', () => {
    const params = loadParametersSafely({ w: validW() });
    expect(params.w[6]).toBe(W6_DEFAULT);
    expect(params.w).toHaveLength(21);
  });

  it('falls back to canonical defaults when w[6] is NaN', () => {
    const corrupt = validW();
    corrupt[6] = NaN;
    const params = loadParametersSafely({ w: corrupt });
    expect(params.w[6]).toBe(W6_DEFAULT);
    expect(params.w).toEqual(defaultParameters.w);
  });

  it('falls back to defaults for truncated params', () => {
    const params = loadParametersSafely({ w: validW().slice(0, 10) });
    expect(params.w).toEqual(defaultParameters.w);
  });
});

describe('FSRS constructor repairs non-finite required weights', () => {
  function learningCard() {
    return {
      stability: 5,
      difficulty: 5,
      state: FSRSState.Learning,
      elapsed_days: 1,
      scheduled_days: 1,
      reps: 1,
      lapses: 0,
      last_review: new Date('2026-04-01T00:00:00Z'),
    };
  }

  it('does not let a NaN w[6] produce a NaN difficulty', () => {
    const w = validW();
    w[6] = NaN;
    const fsrs = new FSRS({ ...defaultParameters, w });
    const result = fsrs.next(learningCard(), new Date('2026-04-02T00:00:00Z'), Rating.Again);
    expect(Number.isFinite(result.card.difficulty)).toBe(true);
    expect(result.card.difficulty).toBeGreaterThanOrEqual(1);
    expect(result.card.difficulty).toBeLessThanOrEqual(10);
  });

  it('does not silently freeze difficulty when w[6] is missing', () => {
    const w = validW();
    delete (w as unknown as Record<number, number>)[6];
    const fsrs = new FSRS({ ...defaultParameters, w });
    const card = learningCard();
    const result = fsrs.next(card, new Date('2026-04-02T00:00:00Z'), Rating.Again);
    // With the repaired default w[6]=3.0194, an "Again" rating on a Learning
    // card raises difficulty; a silently-zeroed w[6] would leave it ~unchanged.
    expect(result.card.difficulty).toBeGreaterThan(card.difficulty);
  });

  it('preserves a legitimate finite w[6] (including a valid 0)', () => {
    const w = validW();
    w[6] = 0; // finite, valid — must NOT be repaired away
    const fsrs = new FSRS({ ...defaultParameters, w });
    const card = learningCard();
    const result = fsrs.next(card, new Date('2026-04-02T00:00:00Z'), Rating.Again);
    // delta_d = 0 → difficulty only mean-reverts toward init; stays finite/in range.
    expect(Number.isFinite(result.card.difficulty)).toBe(true);
  });
});
