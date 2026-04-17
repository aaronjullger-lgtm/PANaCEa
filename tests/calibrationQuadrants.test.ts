import { describe, it, expect } from 'vitest';
import {
  classifyQuadrant,
  computeQuadrantCounts,
  getQuadrantLabel,
  CONFIDENCE_THRESHOLD,
  type CalibrationQuadrant,
} from '../lib/calibrationQuadrants';

// ─── CONFIDENCE_THRESHOLD constant ──────────────────────────────────────────

describe('CONFIDENCE_THRESHOLD', () => {
  it('defaults to 0.6 (high-confidence cutoff)', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.6);
  });
});

// ─── classifyQuadrant ───────────────────────────────────────────────────────

describe('classifyQuadrant', () => {
  it('maps high-confidence + correct to "mastered"', () => {
    expect(classifyQuadrant(0.9, true)).toBe('mastered');
  });

  it('maps high-confidence + wrong to "dangerous_misconception"', () => {
    // The critical case for PA students — confidently incorrect
    expect(classifyQuadrant(0.85, false)).toBe('dangerous_misconception');
  });

  it('maps low-confidence + correct to "lucky_guess"', () => {
    expect(classifyQuadrant(0.3, true)).toBe('lucky_guess');
  });

  it('maps low-confidence + wrong to "unconfident_wrong"', () => {
    expect(classifyQuadrant(0.2, false)).toBe('unconfident_wrong');
  });

  it('treats confidence == threshold as HIGH (inclusive >= comparison)', () => {
    // Boundary: 0.6 >= 0.6 → high
    expect(classifyQuadrant(0.6, true)).toBe('mastered');
    expect(classifyQuadrant(0.6, false)).toBe('dangerous_misconception');
  });

  it('treats confidence just below threshold as LOW', () => {
    expect(classifyQuadrant(0.599, true)).toBe('lucky_guess');
    expect(classifyQuadrant(0.599, false)).toBe('unconfident_wrong');
  });

  it('honors a custom threshold', () => {
    // Raise the bar to 0.8 → 0.7 is now LOW
    expect(classifyQuadrant(0.7, true, 0.8)).toBe('lucky_guess');
    expect(classifyQuadrant(0.9, true, 0.8)).toBe('mastered');
  });

  it('handles boundary confidence values (0 and 1)', () => {
    expect(classifyQuadrant(0, true)).toBe('lucky_guess');
    expect(classifyQuadrant(1, false)).toBe('dangerous_misconception');
  });
});

// ─── computeQuadrantCounts ──────────────────────────────────────────────────

describe('computeQuadrantCounts', () => {
  it('returns all-zero counts for empty input', () => {
    const result = computeQuadrantCounts([]);
    expect(result).toEqual({
      mastered: 0,
      dangerousMisconception: 0,
      luckyGuess: 0,
      unconfidentWrong: 0,
      total: 0,
    });
  });

  it('aggregates one of each quadrant correctly', () => {
    const result = computeQuadrantCounts([
      { confidence: 0.9, wasCorrect: true }, // mastered
      { confidence: 0.9, wasCorrect: false }, // dangerous
      { confidence: 0.3, wasCorrect: true }, // lucky
      { confidence: 0.3, wasCorrect: false }, // unconfident wrong
    ]);
    expect(result).toEqual({
      mastered: 1,
      dangerousMisconception: 1,
      luckyGuess: 1,
      unconfidentWrong: 1,
      total: 4,
    });
  });

  it('skips entries where confidence is null', () => {
    const result = computeQuadrantCounts([
      { confidence: null, wasCorrect: true },
      { confidence: 0.9, wasCorrect: true }, // counted
    ]);
    expect(result.total).toBe(1);
    expect(result.mastered).toBe(1);
  });

  it('skips entries where confidence is undefined', () => {
    const result = computeQuadrantCounts([
      { confidence: undefined, wasCorrect: false },
      { confidence: 0.2, wasCorrect: false }, // counted
    ]);
    expect(result.total).toBe(1);
    expect(result.unconfidentWrong).toBe(1);
  });

  it('skips entries where confidence is NaN', () => {
    const result = computeQuadrantCounts([
      { confidence: Number.NaN, wasCorrect: true },
      { confidence: 0.8, wasCorrect: true }, // counted
    ]);
    expect(result.total).toBe(1);
    expect(result.mastered).toBe(1);
  });

  it('clamps confidence > 1 to 1 (still classified as high)', () => {
    const result = computeQuadrantCounts([{ confidence: 1.5, wasCorrect: true }]);
    expect(result.mastered).toBe(1);
    expect(result.total).toBe(1);
  });

  it('clamps confidence < 0 to 0 (still classified as low)', () => {
    const result = computeQuadrantCounts([{ confidence: -0.5, wasCorrect: true }]);
    expect(result.luckyGuess).toBe(1);
    expect(result.total).toBe(1);
  });

  it('honors custom threshold in batch classification', () => {
    // Threshold = 0.9 → only 0.95 counts as high
    const result = computeQuadrantCounts(
      [
        { confidence: 0.95, wasCorrect: true },
        { confidence: 0.7, wasCorrect: true },
        { confidence: 0.5, wasCorrect: true },
      ],
      0.9
    );
    expect(result.mastered).toBe(1);
    expect(result.luckyGuess).toBe(2);
    expect(result.total).toBe(3);
  });

  it('total always equals the sum of the 4 quadrants', () => {
    const result = computeQuadrantCounts([
      { confidence: 0.9, wasCorrect: true },
      { confidence: 0.9, wasCorrect: true },
      { confidence: 0.9, wasCorrect: false },
      { confidence: 0.1, wasCorrect: true },
      { confidence: 0.1, wasCorrect: false },
      { confidence: 0.1, wasCorrect: false },
    ]);
    const sum =
      result.mastered +
      result.dangerousMisconception +
      result.luckyGuess +
      result.unconfidentWrong;
    expect(sum).toBe(result.total);
  });

  it('handles bulk input with mixed valid and invalid confidences', () => {
    const result = computeQuadrantCounts([
      { confidence: 0.95, wasCorrect: true },
      { confidence: null, wasCorrect: false },
      { confidence: Number.NaN, wasCorrect: true },
      { confidence: 0.1, wasCorrect: false },
      { confidence: undefined, wasCorrect: true },
      { confidence: 0.7, wasCorrect: false },
    ]);
    expect(result.total).toBe(3);
    expect(result.mastered).toBe(1);
    expect(result.unconfidentWrong).toBe(1);
    expect(result.dangerousMisconception).toBe(1);
    expect(result.luckyGuess).toBe(0);
  });
});

// ─── getQuadrantLabel ───────────────────────────────────────────────────────

describe('getQuadrantLabel', () => {
  const quadrants: CalibrationQuadrant[] = [
    'mastered',
    'dangerous_misconception',
    'lucky_guess',
    'unconfident_wrong',
  ];

  it.each(quadrants)('returns non-empty short/long/description for %s', (q) => {
    const label = getQuadrantLabel(q);
    expect(label.short).toBeTruthy();
    expect(label.long).toBeTruthy();
    expect(label.description).toBeTruthy();
  });

  it('flags the dangerous misconception case in its description', () => {
    const label = getQuadrantLabel('dangerous_misconception');
    // The description should convey urgency/criticality for PA safety
    expect(label.description.toLowerCase()).toContain('critical');
  });

  it('marks mastered as a solid retrieval state', () => {
    const label = getQuadrantLabel('mastered');
    expect(label.description.toLowerCase()).toMatch(/solid|mastered|correct/);
  });

  it('distinguishes lucky guess (correct but shaky)', () => {
    const label = getQuadrantLabel('lucky_guess');
    expect(label.description.toLowerCase()).toContain('review');
  });

  it('produces distinct short labels for all 4 quadrants', () => {
    const shorts = quadrants.map((q) => getQuadrantLabel(q).short);
    expect(new Set(shorts).size).toBe(4);
  });
});
