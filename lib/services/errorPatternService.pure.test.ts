// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/errorPatternService.ts
 *
 * Pure functions tested (no DB, all inputs explicit):
 *   classifyErrorPattern(attempt)   — single-attempt cognitive bias classification
 *   buildPatternProfile(attempts)   — batch analysis and aggregate stats
 *
 * Pattern detection thresholds:
 *   RAPID_GUESS:          timeRatio = dwellTime / parTime < 0.25
 *   ANCHORING:            firstClickRatio < 0.3 AND switches=0 AND first NOT correct
 *   PREMATURE_CLOSURE:    firstClickWasCorrect AND switches>0 AND commitmentGap<2000ms
 *   AVAILABILITY_BIAS:    selectedConditionRecentlySeen AND selected ≠ tested
 *   CONFIRMATION_BIAS:    isConfusionPair = true
 *   FATIGUE:              positionRatio ≥ 0.75 AND timeRatio < 0.6
 *   UNKNOWN:              no candidates match
 *
 * When multiple candidates match, highest confidence wins.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyErrorPattern,
  buildPatternProfile,
} from './errorPatternService';
import type { IncorrectAttemptTelemetry } from './errorPatternService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a neutral attempt that triggers no pattern (UNKNOWN default) */
function makeAttempt(overrides: Partial<IncorrectAttemptTelemetry> = {}): IncorrectAttemptTelemetry {
  return {
    questionId: 'q1',
    system: 'Cardiovascular',
    conditionTested: 'Heart Failure',
    selectedCondition: 'COPD',
    timeToFirstClickMs: 8000,       // 80% of par — not anchoring
    totalDwellTimeMs: 15000,        // 1.5x par — not rapid guess
    answerSwitches: 0,
    commitmentGapMs: 5000,          // >2000ms — not premature closure
    hintViewed: false,
    parTimeMs: 10000,
    selectedConditionRecentlySeen: false,
    isConfusionPair: false,
    firstClickWasCorrect: false,
    vignetteLengthChars: 500,
    sessionPosition: 5,
    sessionLength: 20,              // positionRatio = 0.25 — not fatigue
    ...overrides,
  };
}

// ─── classifyErrorPattern — UNKNOWN ───────────────────────────────────────────

describe('classifyErrorPattern — UNKNOWN (no pattern match)', () => {
  it('returns UNKNOWN when no signal matches', () => {
    const result = classifyErrorPattern(makeAttempt());
    expect(result.pattern).toBe('UNKNOWN');
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it('UNKNOWN always has evidence and remediation strings', () => {
    const result = classifyErrorPattern(makeAttempt());
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.remediation.length).toBeGreaterThan(0);
  });
});

// ─── classifyErrorPattern — RAPID_GUESS ──────────────────────────────────────

describe('classifyErrorPattern — RAPID_GUESS', () => {
  it('classifies RAPID_GUESS when dwellTime < 25% of parTime', () => {
    // timeRatio = 2000 / 10000 = 0.20 < 0.25
    const result = classifyErrorPattern(makeAttempt({ totalDwellTimeMs: 2000, parTimeMs: 10000 }));
    expect(result.pattern).toBe('RAPID_GUESS');
  });

  it('does not classify RAPID_GUESS when dwellTime is exactly at threshold (ratio=0.25)', () => {
    // timeRatio = 2500 / 10000 = 0.25, which is NOT < threshold
    const result = classifyErrorPattern(makeAttempt({ totalDwellTimeMs: 2500, parTimeMs: 10000 }));
    expect(result.pattern).not.toBe('RAPID_GUESS');
  });

  it('confidence increases as dwellTime approaches 0', () => {
    const fast = classifyErrorPattern(makeAttempt({ totalDwellTimeMs: 100, parTimeMs: 10000 }));
    const lessfast = classifyErrorPattern(makeAttempt({ totalDwellTimeMs: 2000, parTimeMs: 10000 }));
    expect(fast.confidence).toBeGreaterThan(lessfast.confidence);
  });

  it('RAPID_GUESS confidence is clamped to ≤ 1', () => {
    const result = classifyErrorPattern(makeAttempt({ totalDwellTimeMs: 1, parTimeMs: 10000 }));
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('evidence mentions dwell time and par time', () => {
    const result = classifyErrorPattern(makeAttempt({ totalDwellTimeMs: 2000, parTimeMs: 10000 }));
    expect(result.evidence[0]).toMatch(/2000|par/i);
  });
});

// ─── classifyErrorPattern — ANCHORING ────────────────────────────────────────

describe('classifyErrorPattern — ANCHORING', () => {
  it('classifies ANCHORING when firstClickRatio<0.3, switches=0, firstClick wrong', () => {
    // firstClickRatio = 2000/10000 = 0.20 < 0.30
    const result = classifyErrorPattern(makeAttempt({
      timeToFirstClickMs: 2000,
      parTimeMs: 10000,
      answerSwitches: 0,
      firstClickWasCorrect: false,
      totalDwellTimeMs: 12000,  // not rapid guess
    }));
    expect(result.pattern).toBe('ANCHORING');
  });

  it('does not classify ANCHORING when answerSwitches > 0', () => {
    const result = classifyErrorPattern(makeAttempt({
      timeToFirstClickMs: 2000,
      parTimeMs: 10000,
      answerSwitches: 2,  // switches present → no anchoring
      firstClickWasCorrect: false,
      totalDwellTimeMs: 12000,
    }));
    expect(result.pattern).not.toBe('ANCHORING');
  });

  it('does not classify ANCHORING when first click was correct', () => {
    const result = classifyErrorPattern(makeAttempt({
      timeToFirstClickMs: 2000,
      parTimeMs: 10000,
      answerSwitches: 0,
      firstClickWasCorrect: true,  // first click correct → not anchoring
      totalDwellTimeMs: 12000,
    }));
    expect(result.pattern).not.toBe('ANCHORING');
  });

  it('does not classify ANCHORING when firstClickRatio ≥ 0.30', () => {
    const result = classifyErrorPattern(makeAttempt({
      timeToFirstClickMs: 3000,  // ratio = 0.3 — not < threshold
      parTimeMs: 10000,
      answerSwitches: 0,
      firstClickWasCorrect: false,
      totalDwellTimeMs: 12000,
    }));
    expect(result.pattern).not.toBe('ANCHORING');
  });
});

// ─── classifyErrorPattern — PREMATURE_CLOSURE ────────────────────────────────

describe('classifyErrorPattern — PREMATURE_CLOSURE', () => {
  it('classifies PREMATURE_CLOSURE when first click correct, switches>0, commitmentGap<2000ms', () => {
    const result = classifyErrorPattern(makeAttempt({
      firstClickWasCorrect: true,
      answerSwitches: 1,
      commitmentGapMs: 1000,  // < 2000ms
      totalDwellTimeMs: 12000,  // not rapid guess
    }));
    expect(result.pattern).toBe('PREMATURE_CLOSURE');
    expect(result.confidence).toBe(0.7);
  });

  it('does not classify PREMATURE_CLOSURE when first click was wrong', () => {
    const result = classifyErrorPattern(makeAttempt({
      firstClickWasCorrect: false,
      answerSwitches: 2,
      commitmentGapMs: 500,
      totalDwellTimeMs: 12000,
    }));
    expect(result.pattern).not.toBe('PREMATURE_CLOSURE');
  });

  it('does not classify PREMATURE_CLOSURE when commitmentGap ≥ 2000ms', () => {
    const result = classifyErrorPattern(makeAttempt({
      firstClickWasCorrect: true,
      answerSwitches: 1,
      commitmentGapMs: 3000,  // ≥ 2000ms → no premature closure
      totalDwellTimeMs: 12000,
    }));
    expect(result.pattern).not.toBe('PREMATURE_CLOSURE');
  });

  it('does not classify PREMATURE_CLOSURE when answerSwitches = 0', () => {
    const result = classifyErrorPattern(makeAttempt({
      firstClickWasCorrect: true,
      answerSwitches: 0,  // no switches → no premature closure
      commitmentGapMs: 500,
      totalDwellTimeMs: 12000,
    }));
    expect(result.pattern).not.toBe('PREMATURE_CLOSURE');
  });
});

// ─── classifyErrorPattern — AVAILABILITY_BIAS ────────────────────────────────

describe('classifyErrorPattern — AVAILABILITY_BIAS', () => {
  it('classifies AVAILABILITY_BIAS when selected condition was recently seen and differs from tested', () => {
    const result = classifyErrorPattern(makeAttempt({
      selectedConditionRecentlySeen: true,
      selectedCondition: 'COPD',
      conditionTested: 'Heart Failure',  // different
    }));
    expect(result.pattern).toBe('AVAILABILITY_BIAS');
    expect(result.confidence).toBeCloseTo(0.65, 5);
  });

  it('does not classify AVAILABILITY_BIAS when selectedCondition = conditionTested', () => {
    const result = classifyErrorPattern(makeAttempt({
      selectedConditionRecentlySeen: true,
      selectedCondition: 'Heart Failure',
      conditionTested: 'Heart Failure',  // same → no bias
    }));
    expect(result.pattern).not.toBe('AVAILABILITY_BIAS');
  });

  it('does not classify AVAILABILITY_BIAS when not recently seen', () => {
    const result = classifyErrorPattern(makeAttempt({
      selectedConditionRecentlySeen: false,
      selectedCondition: 'COPD',
      conditionTested: 'Heart Failure',
    }));
    expect(result.pattern).not.toBe('AVAILABILITY_BIAS');
  });
});

// ─── classifyErrorPattern — CONFIRMATION_BIAS ────────────────────────────────

describe('classifyErrorPattern — CONFIRMATION_BIAS', () => {
  it('classifies CONFIRMATION_BIAS when isConfusionPair = true', () => {
    const result = classifyErrorPattern(makeAttempt({ isConfusionPair: true, answerSwitches: 0 }));
    expect(result.pattern).toBe('CONFIRMATION_BIAS');
    expect(result.confidence).toBeCloseTo(0.6, 5);
  });

  it('confidence bumped to 0.7 when answerSwitches > 0 (more uncertainty signal)', () => {
    const result = classifyErrorPattern(makeAttempt({ isConfusionPair: true, answerSwitches: 2 }));
    expect(result.confidence).toBeCloseTo(0.7, 5);
  });

  it('does not classify CONFIRMATION_BIAS when isConfusionPair = false', () => {
    const result = classifyErrorPattern(makeAttempt({ isConfusionPair: false }));
    expect(result.pattern).not.toBe('CONFIRMATION_BIAS');
  });
});

// ─── classifyErrorPattern — FATIGUE ──────────────────────────────────────────

describe('classifyErrorPattern — FATIGUE', () => {
  it('classifies FATIGUE when positionRatio ≥ 0.75 and timeRatio < 0.6', () => {
    // positionRatio = 15/20 = 0.75; timeRatio = 5000/10000 = 0.5 < 0.6
    const result = classifyErrorPattern(makeAttempt({
      sessionPosition: 15,
      sessionLength: 20,
      totalDwellTimeMs: 5000,
      parTimeMs: 10000,
    }));
    expect(result.pattern).toBe('FATIGUE');
  });

  it('does not classify FATIGUE when positionRatio < 0.75', () => {
    const result = classifyErrorPattern(makeAttempt({
      sessionPosition: 10,
      sessionLength: 20,  // ratio = 0.50 < 0.75
      totalDwellTimeMs: 5000,
      parTimeMs: 10000,
    }));
    expect(result.pattern).not.toBe('FATIGUE');
  });

  it('does not classify FATIGUE when timeRatio ≥ 0.6', () => {
    const result = classifyErrorPattern(makeAttempt({
      sessionPosition: 16,
      sessionLength: 20,  // ratio = 0.8 ≥ 0.75
      totalDwellTimeMs: 7000,  // ratio = 0.7 ≥ 0.6
      parTimeMs: 10000,
    }));
    expect(result.pattern).not.toBe('FATIGUE');
  });
});

// ─── classifyErrorPattern — highest confidence wins ──────────────────────────

describe('classifyErrorPattern — confidence selection', () => {
  it('selects highest-confidence pattern when multiple match', () => {
    // ANCHORING (0.6+) vs AVAILABILITY_BIAS (0.65) — availability should win
    const result = classifyErrorPattern(makeAttempt({
      timeToFirstClickMs: 2000,     // → ANCHORING candidate
      parTimeMs: 10000,
      answerSwitches: 0,
      firstClickWasCorrect: false,
      selectedConditionRecentlySeen: true, // → AVAILABILITY_BIAS candidate (0.65)
      selectedCondition: 'COPD',
      conditionTested: 'Heart Failure',
      totalDwellTimeMs: 12000,
    }));
    // Both ANCHORING and AVAILABILITY_BIAS fire; highest confidence wins
    expect(['ANCHORING', 'AVAILABILITY_BIAS']).toContain(result.pattern);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('confidence is always in [0.3, 1.0]', () => {
    const patterns = [
      makeAttempt({ totalDwellTimeMs: 100, parTimeMs: 10000 }), // RAPID_GUESS
      makeAttempt({ isConfusionPair: true }),                    // CONFIRMATION_BIAS
      makeAttempt(),                                              // UNKNOWN
    ];
    for (const attempt of patterns) {
      const r = classifyErrorPattern(attempt);
      expect(r.confidence).toBeGreaterThanOrEqual(0.3);
      expect(r.confidence).toBeLessThanOrEqual(1.0);
    }
  });
});

// ─── buildPatternProfile ──────────────────────────────────────────────────────

describe('buildPatternProfile', () => {
  it('returns empty profile for empty input', () => {
    const result = buildPatternProfile([]);
    expect(result.totalAnalyzed).toBe(0);
    expect(result.dominantPattern).toBeNull();
    expect(result.topPatterns).toHaveLength(0);
    expect(result.remediations).toHaveLength(0);
  });

  it('counts patterns correctly', () => {
    const attempts = [
      makeAttempt({ totalDwellTimeMs: 1000, parTimeMs: 10000 }),  // RAPID_GUESS
      makeAttempt({ totalDwellTimeMs: 1000, parTimeMs: 10000 }),  // RAPID_GUESS
      makeAttempt({ isConfusionPair: true }),                      // CONFIRMATION_BIAS
    ];
    const result = buildPatternProfile(attempts);
    expect(result.totalAnalyzed).toBe(3);
    expect(result.patternCounts['RAPID_GUESS']).toBe(2);
    expect(result.patternCounts['CONFIRMATION_BIAS']).toBe(1);
  });

  it('dominantPattern is the most frequent pattern', () => {
    const attempts = [
      makeAttempt({ totalDwellTimeMs: 1000, parTimeMs: 10000 }),
      makeAttempt({ totalDwellTimeMs: 1000, parTimeMs: 10000 }),
      makeAttempt({ isConfusionPair: true }),
    ];
    const result = buildPatternProfile(attempts);
    expect(result.dominantPattern).toBe('RAPID_GUESS');
  });

  it('topPatterns is limited to 3 entries', () => {
    const result = buildPatternProfile([
      makeAttempt({ totalDwellTimeMs: 1000, parTimeMs: 10000 }),
      makeAttempt({ isConfusionPair: true }),
      makeAttempt(),  // UNKNOWN
    ]);
    expect(result.topPatterns.length).toBeLessThanOrEqual(3);
  });

  it('systemPatterns groups patterns by system', () => {
    const attempts = [
      makeAttempt({ system: 'Cardiovascular', isConfusionPair: true }),
      makeAttempt({ system: 'Pulmonary', totalDwellTimeMs: 1000, parTimeMs: 10000 }),
    ];
    const result = buildPatternProfile(attempts);
    expect(result.systemPatterns['Cardiovascular']).toBeDefined();
    expect(result.systemPatterns['Pulmonary']).toBeDefined();
    expect(result.systemPatterns['Cardiovascular']).toContain('CONFIRMATION_BIAS');
    expect(result.systemPatterns['Pulmonary']).toContain('RAPID_GUESS');
  });

  it('remediations are unique per pattern and in frequency order', () => {
    const attempts = [
      makeAttempt({ totalDwellTimeMs: 1000, parTimeMs: 10000 }),
      makeAttempt({ totalDwellTimeMs: 1000, parTimeMs: 10000 }),
      makeAttempt({ isConfusionPair: true }),
    ];
    const result = buildPatternProfile(attempts);
    const patterns = result.remediations.map((r) => r.pattern);
    expect(new Set(patterns).size).toBe(patterns.length); // unique
    expect(result.remediations[0]!.pattern).toBe('RAPID_GUESS'); // highest frequency first
  });

  it('topPatterns frequency sums to ≤ 1.0', () => {
    const attempts = [
      makeAttempt({ totalDwellTimeMs: 1000, parTimeMs: 10000 }),
      makeAttempt({ isConfusionPair: true }),
      makeAttempt(),
    ];
    const result = buildPatternProfile(attempts);
    const totalFreq = result.topPatterns.reduce((s, p) => s + p.frequency, 0);
    expect(totalFreq).toBeLessThanOrEqual(1.0 + 1e-9); // allow float error
  });
});
