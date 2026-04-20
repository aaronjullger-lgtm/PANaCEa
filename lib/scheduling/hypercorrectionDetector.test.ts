// SAFE-OVERRIDE: false positive on grep-E alternation -- space+sh in TypeScript identifiers
import { describe, it, expect } from 'vitest';
import {
  detectHypercorrection,
  HYPERCORRECTION_CONFIDENCE_THRESHOLD,
} from './hypercorrectionDetector';

describe('detectHypercorrection', () => {
  it('returns true: correct now, prior wrong with high confidence', () => {
    expect(
      detectHypercorrection(true, [
        { wasCorrect: false, implicit_confidence: 0.8 },
      ])
    ).toBe(true);
  });

  it('returns true: confidence exactly at threshold', () => {
    expect(
      detectHypercorrection(true, [
        { wasCorrect: false, implicit_confidence: HYPERCORRECTION_CONFIDENCE_THRESHOLD },
      ])
    ).toBe(true);
  });

  it('returns false: correct now, prior wrong but confidence below threshold', () => {
    expect(
      detectHypercorrection(true, [
        { wasCorrect: false, implicit_confidence: 0.69 },
      ])
    ).toBe(false);
  });

  it('returns false: correct now, prior was also correct', () => {
    expect(
      detectHypercorrection(true, [
        { wasCorrect: true, implicit_confidence: 0.9 },
      ])
    ).toBe(false);
  });

  it('returns false: current answer is incorrect', () => {
    expect(
      detectHypercorrection(false, [
        { wasCorrect: false, implicit_confidence: 0.9 },
      ])
    ).toBe(false);
  });

  it('returns false: no prior reviews', () => {
    expect(detectHypercorrection(true, [])).toBe(false);
  });

  it('treats null implicit_confidence as 0 (below threshold → false)', () => {
    expect(
      detectHypercorrection(true, [
        { wasCorrect: false, implicit_confidence: null },
      ])
    ).toBe(false);
  });

  it('only examines index 0 — ignores older reviews', () => {
    // index 0 = correct (not a hypercorrection source), index 1 = wrong high-conf
    expect(
      detectHypercorrection(true, [
        { wasCorrect: true, implicit_confidence: 0.95 },
        { wasCorrect: false, implicit_confidence: 0.95 },
      ])
    ).toBe(false);
  });

  it('respects custom threshold override', () => {
    expect(
      detectHypercorrection(true, [{ wasCorrect: false, implicit_confidence: 0.5 }], 0.5)
    ).toBe(true);

    expect(
      detectHypercorrection(true, [{ wasCorrect: false, implicit_confidence: 0.49 }], 0.5)
    ).toBe(false);
  });
});
