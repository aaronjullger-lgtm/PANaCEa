/**
 * Tests for lib/services/errorPatternService.ts
 *
 * Pure-function unit tests — no mocks needed. Covers:
 *   classifyErrorPattern() — single attempt classification for all 7 patterns
 *   buildPatternProfile()  — aggregate analysis across multiple attempts
 */

import { describe, it, expect } from 'vitest';
import {
  classifyErrorPattern,
  buildPatternProfile,
  type IncorrectAttemptTelemetry,
  type ErrorPatternType,
} from '../lib/services/errorPatternService';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

/** Base attempt: a "neutral" answer that triggers UNKNOWN. */
function makeAttempt(
  overrides: Partial<IncorrectAttemptTelemetry> = {}
): IncorrectAttemptTelemetry {
  return {
    questionId: 'q-001',
    system: 'Cardiology',
    conditionTested: 'MI',
    selectedCondition: 'Pericarditis',
    // Timing: par=10 000ms, dwell=8 000ms → ratio 0.80 (well above rapid-guess threshold 0.25)
    timeToFirstClickMs: 5_000,
    totalDwellTimeMs: 8_000,
    parTimeMs: 10_000,
    answerSwitches: 0,
    commitmentGapMs: 5_000,
    hintViewed: false,
    selectedConditionRecentlySeen: false,
    isConfusionPair: false,
    firstClickWasCorrect: false,
    vignetteLengthChars: 800,
    sessionPosition: 2,
    sessionLength: 10,
    ...overrides,
  };
}

// ─── classifyErrorPattern ─────────────────────────────────────────────────────

describe('classifyErrorPattern', () => {
  describe('UNKNOWN — no signal fires', () => {
    it('returns UNKNOWN when no threshold is crossed', () => {
      const result = classifyErrorPattern(makeAttempt());
      expect(result.pattern).toBe('UNKNOWN');
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.remediation.length).toBeGreaterThan(0);
    });
  });

  describe('RAPID_GUESS — dwell time < 25% of par', () => {
    it('detects rapid guess when dwell is 10% of par', () => {
      const result = classifyErrorPattern(
        makeAttempt({ totalDwellTimeMs: 1_000, parTimeMs: 10_000 })
      );
      expect(result.pattern).toBe('RAPID_GUESS');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('does NOT fire when dwell is 50% of par', () => {
      const result = classifyErrorPattern(
        makeAttempt({ totalDwellTimeMs: 5_000, parTimeMs: 10_000 })
      );
      expect(result.pattern).not.toBe('RAPID_GUESS');
    });

    it('confidence increases as dwell ratio decreases', () => {
      const low = classifyErrorPattern(
        makeAttempt({ totalDwellTimeMs: 500, parTimeMs: 10_000 })
      );
      const high = classifyErrorPattern(
        makeAttempt({ totalDwellTimeMs: 2_000, parTimeMs: 10_000 })
      );
      // Both are RAPID_GUESS; lower dwell ratio → higher confidence
      expect(low.pattern).toBe('RAPID_GUESS');
      expect(high.pattern).toBe('RAPID_GUESS');
      expect(low.confidence).toBeGreaterThanOrEqual(high.confidence);
    });

    it('confidence is clamped to 1', () => {
      const result = classifyErrorPattern(
        makeAttempt({ totalDwellTimeMs: 1, parTimeMs: 10_000 })
      );
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('ANCHORING — early click, no switches, wrong first', () => {
    it('detects anchoring when first click is <30% of par, 0 switches, wrong', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          timeToFirstClickMs: 2_000, // 20% of par
          parTimeMs: 10_000,
          totalDwellTimeMs: 9_000, // Not rapid guess
          answerSwitches: 0,
          firstClickWasCorrect: false,
        })
      );
      expect(result.pattern).toBe('ANCHORING');
    });

    it('does NOT fire when answerSwitches > 0', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          timeToFirstClickMs: 2_000,
          parTimeMs: 10_000,
          totalDwellTimeMs: 9_000,
          answerSwitches: 1,
          firstClickWasCorrect: false,
        })
      );
      expect(result.pattern).not.toBe('ANCHORING');
    });

    it('does NOT fire when first click was correct (that is premature closure, not anchoring)', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          timeToFirstClickMs: 2_000,
          parTimeMs: 10_000,
          totalDwellTimeMs: 9_000,
          answerSwitches: 0,
          firstClickWasCorrect: true,
        })
      );
      expect(result.pattern).not.toBe('ANCHORING');
    });

    it('does NOT fire when first click is >30% of par', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          timeToFirstClickMs: 4_000, // 40% of par
          parTimeMs: 10_000,
          totalDwellTimeMs: 9_000,
          answerSwitches: 0,
          firstClickWasCorrect: false,
        })
      );
      expect(result.pattern).not.toBe('ANCHORING');
    });
  });

  describe('PREMATURE_CLOSURE — right first click then switched away', () => {
    it('detects premature closure when correct first + switched + small gap', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          firstClickWasCorrect: true,
          answerSwitches: 1,
          commitmentGapMs: 1_000, // < 2000ms threshold
        })
      );
      expect(result.pattern).toBe('PREMATURE_CLOSURE');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('does NOT fire when commitment gap is large (student reconsidered carefully)', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          firstClickWasCorrect: true,
          answerSwitches: 1,
          commitmentGapMs: 8_000, // > 2000ms threshold
        })
      );
      expect(result.pattern).not.toBe('PREMATURE_CLOSURE');
    });

    it('does NOT fire when no answer switches', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          firstClickWasCorrect: true,
          answerSwitches: 0,
          commitmentGapMs: 500,
        })
      );
      expect(result.pattern).not.toBe('PREMATURE_CLOSURE');
    });

    it('does NOT fire when first click was wrong (no correct-then-switch pattern)', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          firstClickWasCorrect: false,
          answerSwitches: 2,
          commitmentGapMs: 1_000,
        })
      );
      expect(result.pattern).not.toBe('PREMATURE_CLOSURE');
    });
  });

  describe('AVAILABILITY_BIAS — recently seen condition chosen', () => {
    it('detects availability bias when selected condition was recently seen', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          selectedConditionRecentlySeen: true,
          selectedCondition: 'Pericarditis',
          conditionTested: 'MI',
        })
      );
      expect(result.pattern).toBe('AVAILABILITY_BIAS');
      expect(result.confidence).toBeGreaterThanOrEqual(0.65);
    });

    it('does NOT fire when selected condition was not recently seen', () => {
      const result = classifyErrorPattern(
        makeAttempt({ selectedConditionRecentlySeen: false })
      );
      expect(result.pattern).not.toBe('AVAILABILITY_BIAS');
    });

    it('does NOT fire when selectedCondition equals conditionTested (impossible per definition, but guard is there)', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          selectedConditionRecentlySeen: true,
          selectedCondition: 'MI',
          conditionTested: 'MI',
        })
      );
      expect(result.pattern).not.toBe('AVAILABILITY_BIAS');
    });
  });

  describe('CONFIRMATION_BIAS — known confusion pair', () => {
    it('detects confirmation bias for confusion pairs', () => {
      const result = classifyErrorPattern(
        makeAttempt({ isConfusionPair: true, answerSwitches: 0 })
      );
      expect(result.pattern).toBe('CONFIRMATION_BIAS');
      expect(result.confidence).toBeCloseTo(0.6);
    });

    it('confidence gets a +0.1 bonus when there are answer switches', () => {
      const withSwitches = classifyErrorPattern(
        makeAttempt({ isConfusionPair: true, answerSwitches: 2 })
      );
      const noSwitches = classifyErrorPattern(
        makeAttempt({ isConfusionPair: true, answerSwitches: 0 })
      );
      expect(withSwitches.confidence).toBeGreaterThan(noSwitches.confidence);
    });

    it('does NOT fire when isConfusionPair is false', () => {
      const result = classifyErrorPattern(
        makeAttempt({ isConfusionPair: false })
      );
      expect(result.pattern).not.toBe('CONFIRMATION_BIAS');
    });
  });

  describe('FATIGUE — late in session and rushing', () => {
    it('detects fatigue when >75% through session and dwell < 60% of par', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          sessionPosition: 8,
          sessionLength: 10, // 80% → above 0.75 threshold
          totalDwellTimeMs: 5_000, // 50% of par → < 0.6
          parTimeMs: 10_000,
        })
      );
      expect(result.pattern).toBe('FATIGUE');
    });

    it('does NOT fire early in session even when rushing', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          sessionPosition: 2,
          sessionLength: 10, // 20% — well below 0.75
          totalDwellTimeMs: 3_000,
          parTimeMs: 10_000,
        })
      );
      expect(result.pattern).not.toBe('FATIGUE');
    });

    it('does NOT fire late in session when student is not rushing', () => {
      const result = classifyErrorPattern(
        makeAttempt({
          sessionPosition: 8,
          sessionLength: 10,
          totalDwellTimeMs: 9_000, // 90% of par — not rushing
          parTimeMs: 10_000,
        })
      );
      expect(result.pattern).not.toBe('FATIGUE');
    });

    it('handles sessionLength=0 without dividing by zero', () => {
      expect(() =>
        classifyErrorPattern(makeAttempt({ sessionLength: 0, sessionPosition: 0 }))
      ).not.toThrow();
    });
  });

  describe('Multi-pattern resolution — highest confidence wins', () => {
    it('RAPID_GUESS beats ANCHORING when both fire', () => {
      // Dwell = 5% of par (very rapid) → strong RAPID_GUESS signal
      // First click also early with no switches → ANCHORING signal
      const result = classifyErrorPattern(
        makeAttempt({
          totalDwellTimeMs: 500,   // 5% of par  → RAPID_GUESS fires (conf ≈ 0.9)
          timeToFirstClickMs: 500, // 5% of par  → ANCHORING fires (conf ≈ 0.72)
          parTimeMs: 10_000,
          answerSwitches: 0,
          firstClickWasCorrect: false,
        })
      );
      // RAPID_GUESS at 0.9 > ANCHORING at 0.72
      expect(result.pattern).toBe('RAPID_GUESS');
    });
  });

  describe('confidence bounds', () => {
    it('confidence is always between 0 and 1 inclusive', () => {
      const attempts: IncorrectAttemptTelemetry[] = [
        makeAttempt(),
        makeAttempt({ totalDwellTimeMs: 1, parTimeMs: 10_000 }),
        makeAttempt({ firstClickWasCorrect: true, answerSwitches: 3, commitmentGapMs: 100 }),
        makeAttempt({ selectedConditionRecentlySeen: true, selectedCondition: 'X', conditionTested: 'Y' }),
        makeAttempt({ isConfusionPair: true }),
        makeAttempt({ sessionPosition: 9, sessionLength: 10, totalDwellTimeMs: 1_000, parTimeMs: 10_000 }),
      ];
      for (const a of attempts) {
        const r = classifyErrorPattern(a);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});

// ─── buildPatternProfile ─────────────────────────────────────────────────────

describe('buildPatternProfile', () => {
  it('returns zeroed profile for empty array', () => {
    const profile = buildPatternProfile([]);
    expect(profile.totalAnalyzed).toBe(0);
    expect(profile.dominantPattern).toBeNull();
    expect(profile.topPatterns).toHaveLength(0);
    expect(profile.remediations).toHaveLength(0);
    expect(Object.values(profile.patternCounts).every((v) => v === 0)).toBe(true);
  });

  it('single attempt — dominant pattern matches that attempt', () => {
    const attempt = makeAttempt({ totalDwellTimeMs: 500, parTimeMs: 10_000 }); // RAPID_GUESS
    const profile = buildPatternProfile([attempt]);
    expect(profile.totalAnalyzed).toBe(1);
    expect(profile.dominantPattern).toBe('RAPID_GUESS');
    expect(profile.patternCounts.RAPID_GUESS).toBe(1);
    expect(profile.topPatterns[0]?.pattern).toBe('RAPID_GUESS');
    expect(profile.topPatterns[0]?.frequency).toBeCloseTo(1.0);
  });

  it('counts each pattern correctly across multiple attempts', () => {
    // 3 RAPID_GUESS + 2 CONFIRMATION_BIAS
    const attempts = [
      ...Array(3).fill(null).map(() => makeAttempt({ totalDwellTimeMs: 500, parTimeMs: 10_000 })),
      ...Array(2).fill(null).map(() => makeAttempt({ isConfusionPair: true })),
    ];
    const profile = buildPatternProfile(attempts);
    expect(profile.totalAnalyzed).toBe(5);
    expect(profile.patternCounts.RAPID_GUESS).toBe(3);
    expect(profile.patternCounts.CONFIRMATION_BIAS).toBe(2);
    expect(profile.dominantPattern).toBe('RAPID_GUESS');
  });

  it('topPatterns contains at most 3 entries sorted descending', () => {
    // 4 different patterns — only top 3 should appear
    const attempts = [
      makeAttempt({ totalDwellTimeMs: 500, parTimeMs: 10_000 }),           // RAPID_GUESS
      makeAttempt({ isConfusionPair: true }),                               // CONFIRMATION_BIAS
      makeAttempt({ firstClickWasCorrect: true, answerSwitches: 1, commitmentGapMs: 500 }), // PREMATURE_CLOSURE
      makeAttempt({ selectedConditionRecentlySeen: true, selectedCondition: 'A', conditionTested: 'B' }), // AVAILABILITY_BIAS
    ];
    const profile = buildPatternProfile(attempts);
    expect(profile.topPatterns.length).toBeLessThanOrEqual(3);
  });

  it('topPatterns frequencies sum to ≤ 1.0 each', () => {
    const attempts = Array(5).fill(null).map(() =>
      makeAttempt({ totalDwellTimeMs: 500, parTimeMs: 10_000 })
    );
    const profile = buildPatternProfile(attempts);
    for (const tp of profile.topPatterns) {
      expect(tp.frequency).toBeGreaterThan(0);
      expect(tp.frequency).toBeLessThanOrEqual(1);
    }
  });

  it('systemPatterns groups patterns by organ system', () => {
    const attempts = [
      makeAttempt({ system: 'Cardiology', totalDwellTimeMs: 500, parTimeMs: 10_000 }),
      makeAttempt({ system: 'Pulmonology', isConfusionPair: true }),
      makeAttempt({ system: 'Cardiology', isConfusionPair: true }),
    ];
    const profile = buildPatternProfile(attempts);
    expect(profile.systemPatterns['Cardiology']).toHaveLength(2);
    expect(profile.systemPatterns['Pulmonology']).toHaveLength(1);
    expect(profile.systemPatterns['Cardiology']).toContain('RAPID_GUESS');
  });

  it('remediations align with topPatterns', () => {
    const attempts = Array(4).fill(null).map(() =>
      makeAttempt({ totalDwellTimeMs: 500, parTimeMs: 10_000 }) // all RAPID_GUESS
    );
    const profile = buildPatternProfile(attempts);
    expect(profile.remediations).toHaveLength(profile.topPatterns.length);
    expect(profile.remediations[0]?.pattern).toBe('RAPID_GUESS');
    expect(profile.remediations[0]?.remediation.length).toBeGreaterThan(0);
  });

  it('handles parTimeMs=0 without crashing (divide-by-zero guard)', () => {
    expect(() =>
      buildPatternProfile([makeAttempt({ parTimeMs: 0, totalDwellTimeMs: 0 })])
    ).not.toThrow();
  });
});
