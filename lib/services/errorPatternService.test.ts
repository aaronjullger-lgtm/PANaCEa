/**
 * Tests for errorPatternService — cognitive bias classification
 *
 * Pure functions operating on attempt telemetry — no Prisma, no FSRS, no mocks.
 * Covers classifyErrorPattern (single attempt) and buildPatternProfile (batch).
 */
import { describe, it, expect } from 'vitest';
import {
  classifyErrorPattern,
  buildPatternProfile,
  type IncorrectAttemptTelemetry,
  type ErrorPatternType,
} from '@/lib/services/errorPatternService';

// ─── Test Factories ──────────────────────────────────────────────────────

function makeAttempt(overrides: Partial<IncorrectAttemptTelemetry> = {}): IncorrectAttemptTelemetry {
  return {
    questionId: 'q-001',
    system: 'Cardiology',
    conditionTested: 'Heart Failure',
    selectedCondition: 'COPD',
    timeToFirstClickMs: 3000,
    totalDwellTimeMs: 15000,
    answerSwitches: 1,
    commitmentGapMs: 5000,
    hintViewed: false,
    parTimeMs: 20000,
    selectedConditionRecentlySeen: false,
    isConfusionPair: false,
    firstClickWasCorrect: false,
    vignetteLengthChars: 500,
    sessionPosition: 5,
    sessionLength: 20,
    ...overrides,
  };
}

// ─── classifyErrorPattern ────────────────────────────────────────────────

describe('classifyErrorPattern', () => {
  describe('RAPID_GUESS', () => {
    it('classifies RAPID_GUESS when dwell time < 25% of par', () => {
      const attempt = makeAttempt({
        totalDwellTimeMs: 4000, // 20% of par 20000
        parTimeMs: 20000,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBe('RAPID_GUESS');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.remediation).toContain('Slow down');
    });

    it('assigns higher confidence for faster guesses', () => {
      const fast = classifyErrorPattern(makeAttempt({
        totalDwellTimeMs: 1000,
        parTimeMs: 20000, // 5% of par
      }));
      const slow = classifyErrorPattern(makeAttempt({
        totalDwellTimeMs: 4500,
        parTimeMs: 20000, // 22.5% of par
      }));
      expect(fast.confidence).toBeGreaterThan(slow.confidence);
    });

    it('does not trigger when dwell time >= 25% of par', () => {
      const attempt = makeAttempt({
        totalDwellTimeMs: 5000,
        parTimeMs: 20000, // 25% exactly — NOT rapid guess
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('RAPID_GUESS');
    });
  });

  describe('ANCHORING', () => {
    it('classifies ANCHORING when fast first click, no switches, wrong first click', () => {
      const attempt = makeAttempt({
        timeToFirstClickMs: 2000, // 10% of par 20000
        parTimeMs: 20000,
        answerSwitches: 0,
        firstClickWasCorrect: false,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBe('ANCHORING');
      expect(result.evidence).toContainEqual('No answer switches — stuck on initial impression');
    });

    it('requires answerSwitches === 0', () => {
      const attempt = makeAttempt({
        timeToFirstClickMs: 2000,
        parTimeMs: 20000,
        answerSwitches: 1,
        firstClickWasCorrect: false,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('ANCHORING');
    });

    it('requires firstClickWasCorrect === false', () => {
      const attempt = makeAttempt({
        timeToFirstClickMs: 2000,
        parTimeMs: 20000,
        answerSwitches: 0,
        firstClickWasCorrect: true,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('ANCHORING');
    });
  });

  describe('PREMATURE_CLOSURE', () => {
    it('classifies PREMATURE_CLOSURE when correct first click then changed, short commitment gap', () => {
      const attempt = makeAttempt({
        firstClickWasCorrect: true,
        answerSwitches: 1,
        commitmentGapMs: 1500, // < 2000
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBe('PREMATURE_CLOSURE');
      expect(result.remediation).toContain('Trust your first instinct');
    });

    it('does not trigger when commitmentGap >= 2000ms', () => {
      const attempt = makeAttempt({
        firstClickWasCorrect: true,
        answerSwitches: 1,
        commitmentGapMs: 2500,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('PREMATURE_CLOSURE');
    });

    it('does not trigger when answerSwitches === 0', () => {
      const attempt = makeAttempt({
        firstClickWasCorrect: true,
        answerSwitches: 0,
        commitmentGapMs: 1000,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('PREMATURE_CLOSURE');
    });
  });

  describe('AVAILABILITY_BIAS', () => {
    it('classifies AVAILABILITY_BIAS when recently seen and different condition', () => {
      const attempt = makeAttempt({
        selectedConditionRecentlySeen: true,
        selectedCondition: 'COPD',
        conditionTested: 'Heart Failure', // different from selected
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBe('AVAILABILITY_BIAS');
      expect(result.evidence[0]).toContain('reviewed recently');
    });

    it('does not trigger when conditions match', () => {
      const attempt = makeAttempt({
        selectedConditionRecentlySeen: true,
        selectedCondition: 'Heart Failure',
        conditionTested: 'Heart Failure', // same
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('AVAILABILITY_BIAS');
    });

    it('does not trigger when not recently seen', () => {
      const attempt = makeAttempt({
        selectedConditionRecentlySeen: false,
        selectedCondition: 'COPD',
        conditionTested: 'Heart Failure',
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('AVAILABILITY_BIAS');
    });
  });

  describe('CONFIRMATION_BIAS', () => {
    it('classifies CONFIRMATION_BIAS when isConfusionPair is true', () => {
      const attempt = makeAttempt({
        isConfusionPair: true,
        conditionTested: 'Heart Failure',
        selectedCondition: 'COPD',
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBe('CONFIRMATION_BIAS');
      expect(result.remediation).toContain('comparison table');
    });

    it('adds bonus confidence when answerSwitches > 0', () => {
      const noSwitch = classifyErrorPattern(makeAttempt({
        isConfusionPair: true,
        answerSwitches: 0,
      }));
      const withSwitch = classifyErrorPattern(makeAttempt({
        isConfusionPair: true,
        answerSwitches: 1,
      }));
      expect(withSwitch.confidence).toBeGreaterThan(noSwitch.confidence);
    });
  });

  describe('FATIGUE', () => {
    it('classifies FATIGUE when late in session and fast dwell', () => {
      const attempt = makeAttempt({
        sessionPosition: 16, // 16/20 = 80% >= 75%
        sessionLength: 20,
        totalDwellTimeMs: 8000, // 40% of par 20000 < 60%
        parTimeMs: 20000,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBe('FATIGUE');
      expect(result.remediation).toContain('shorter sessions');
    });

    it('does not trigger when early in session', () => {
      const attempt = makeAttempt({
        sessionPosition: 5, // 5/20 = 25% < 75%
        sessionLength: 20,
        totalDwellTimeMs: 8000,
        parTimeMs: 20000,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('FATIGUE');
    });

    it('does not trigger when dwell time is adequate', () => {
      const attempt = makeAttempt({
        sessionPosition: 16,
        sessionLength: 20,
        totalDwellTimeMs: 13000, // 65% of par 20000 >= 60%
        parTimeMs: 20000,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).not.toBe('FATIGUE');
    });
  });

  describe('UNKNOWN (fallback)', () => {
    it('returns UNKNOWN when no pattern signals fire', () => {
      const attempt = makeAttempt({
        totalDwellTimeMs: 10000,   // 50% of par — not rapid guess
        parTimeMs: 20000,
        timeToFirstClickMs: 10000, // 50% of par — not anchoring
        answerSwitches: 0,
        firstClickWasCorrect: false,
        commitmentGapMs: 10000,
        selectedConditionRecentlySeen: false,
        isConfusionPair: false,
        sessionPosition: 5,
        sessionLength: 20,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBe('UNKNOWN');
      expect(result.confidence).toBe(0.3);
      expect(result.evidence).toContainEqual('No strong signal for a specific cognitive bias pattern');
    });
  });

  describe('multi-signal prioritization', () => {
    it('returns the highest-confidence candidate when multiple signals fire', () => {
      // Fire RAPID_GUESS (high confidence) + AVAILABILITY_BIAS (fixed 0.65)
      const attempt = makeAttempt({
        totalDwellTimeMs: 2000, // 10% of par → RAPID_GUESS fires with high confidence
        parTimeMs: 20000,
        selectedConditionRecentlySeen: true,
        selectedCondition: 'COPD',
        conditionTested: 'Heart Failure',
        firstClickWasCorrect: false,
        answerSwitches: 0,
        sessionPosition: 5,
        sessionLength: 20,
      });
      const result = classifyErrorPattern(attempt);
      // RAPID_GUESS confidence at 10% of par: 0.5 + 0.5 * ((0.25 - 0.1) / 0.25) = 0.5 + 0.3 = 0.8
      // AVAILABILITY_BIAS confidence: 0.65
      expect(result.pattern).toBe('RAPID_GUESS');
    });

    it('clamps confidence to max 1.0', () => {
      // RAPID_GUESS with very fast time + ANCHORING — confidence could theoretically exceed 1
      const attempt = makeAttempt({
        totalDwellTimeMs: 1,       // near-zero → RAPID_GUESS very high confidence
        parTimeMs: 20000,
        timeToFirstClickMs: 1,     // also fires ANCHORING
        answerSwitches: 0,
        firstClickWasCorrect: false,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('handles parTimeMs = 0 (division safety)', () => {
      const attempt = makeAttempt({
        totalDwellTimeMs: 100,
        parTimeMs: 0,
      });
      // Should not throw — Math.max(parTimeMs, 1) prevents /0
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBeDefined();
    });

    it('handles sessionLength = 0', () => {
      const attempt = makeAttempt({
        sessionPosition: 0,
        sessionLength: 0,
      });
      const result = classifyErrorPattern(attempt);
      expect(result.pattern).toBeDefined();
    });

    it('handles null selectedCondition', () => {
      const attempt = makeAttempt({
        selectedCondition: null,
        selectedConditionRecentlySeen: true,
        conditionTested: 'Heart Failure',
      });
      const result = classifyErrorPattern(attempt);
      // null !== 'Heart Failure' → AVAILABILITY_BIAS fires
      expect(result.pattern).toBe('AVAILABILITY_BIAS');
    });
  });
});

// ─── buildPatternProfile ─────────────────────────────────────────────────

describe('buildPatternProfile', () => {
  it('returns empty profile for empty input', () => {
    const profile = buildPatternProfile([]);
    expect(profile.totalAnalyzed).toBe(0);
    expect(profile.dominantPattern).toBeNull();
    expect(profile.topPatterns).toEqual([]);
    expect(profile.remediations).toEqual([]);
    expect(profile.systemPatterns).toEqual({});
  });

  it('counts patterns correctly across multiple attempts', () => {
    const rapidGuess = makeAttempt({
      totalDwellTimeMs: 2000,
      parTimeMs: 20000,
    });
    const anchoring = makeAttempt({
      timeToFirstClickMs: 2000,
      parTimeMs: 20000,
      answerSwitches: 0,
      firstClickWasCorrect: false,
    });
    const profile = buildPatternProfile([rapidGuess, anchoring]);
    expect(profile.totalAnalyzed).toBe(2);
    expect(profile.patternCounts.RAPID_GUESS).toBe(1);
    expect(profile.patternCounts.ANCHORING).toBe(1);
  });

  it('identifies dominant pattern', () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({
        totalDwellTimeMs: 2000,
        parTimeMs: 20000,
        questionId: `q-${i}`,
      })
    );
    const profile = buildPatternProfile(attempts);
    expect(profile.dominantPattern).toBe('RAPID_GUESS');
    expect(profile.patternCounts.RAPID_GUESS).toBe(5);
  });

  it('limits topPatterns to 3', () => {
    // Create attempts that trigger 4 different patterns
    const attempts: IncorrectAttemptTelemetry[] = [
      makeAttempt({ totalDwellTimeMs: 2000, parTimeMs: 20000, questionId: 'q-1' }),  // RAPID_GUESS
      makeAttempt({ timeToFirstClickMs: 2000, parTimeMs: 20000, answerSwitches: 0, firstClickWasCorrect: false, questionId: 'q-2' }),  // ANCHORING
      makeAttempt({ firstClickWasCorrect: true, answerSwitches: 1, commitmentGapMs: 1000, questionId: 'q-3' }),  // PREMATURE_CLOSURE
      makeAttempt({ isConfusionPair: true, conditionTested: 'A', selectedCondition: 'B', questionId: 'q-4' }),  // CONFIRMATION_BIAS
    ];
    const profile = buildPatternProfile(attempts);
    expect(profile.topPatterns.length).toBeLessThanOrEqual(3);
  });

  it('breaks down patterns by system', () => {
    const cardAttempts = Array.from({ length: 3 }, (_, i) =>
      makeAttempt({
        system: 'Cardiology',
        totalDwellTimeMs: 2000,
        parTimeMs: 20000,
        questionId: `q-card-${i}`,
      })
    );
    const pulmAttempt = makeAttempt({
      system: 'Pulmonary',
      timeToFirstClickMs: 2000,
      parTimeMs: 20000,
      answerSwitches: 0,
      firstClickWasCorrect: false,
      questionId: 'q-pulm-1',
    });
    const profile = buildPatternProfile([...cardAttempts, pulmAttempt]);
    expect(profile.systemPatterns['Cardiology']).toEqual(['RAPID_GUESS', 'RAPID_GUESS', 'RAPID_GUESS']);
    expect(profile.systemPatterns['Pulmonary']).toEqual(['ANCHORING']);
  });

  it('populates remediations from dominant patterns', () => {
    const attempts = Array.from({ length: 3 }, (_, i) =>
      makeAttempt({
        totalDwellTimeMs: 2000,
        parTimeMs: 20000,
        questionId: `q-${i}`,
      })
    );
    const profile = buildPatternProfile(attempts);
    expect(profile.remediations.length).toBeGreaterThan(0);
    expect(profile.remediations[0]!.pattern).toBe('RAPID_GUESS');
    expect(profile.remediations[0]!.remediation).toContain('Slow down');
    expect(profile.remediations[0]!.frequency).toBe(1); // 3/3 = 1.0
  });

  it('computes frequency as count/total', () => {
    const attempts = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({
        totalDwellTimeMs: 2000,
        parTimeMs: 20000,
        questionId: `q-${i}`,
      })
    );
    const profile = buildPatternProfile(attempts);
    expect(profile.topPatterns[0]!.frequency).toBe(1); // 10/10
  });

  it('handles all UNKNOWN patterns', () => {
    const attempts = Array.from({ length: 3 }, (_, i) =>
      makeAttempt({
        totalDwellTimeMs: 10000,
        parTimeMs: 20000,
        timeToFirstClickMs: 10000,
        answerSwitches: 0,
        firstClickWasCorrect: false,
        commitmentGapMs: 10000,
        selectedConditionRecentlySeen: false,
        isConfusionPair: false,
        sessionPosition: 5,
        sessionLength: 20,
        questionId: `q-${i}`,
      })
    );
    const profile = buildPatternProfile(attempts);
    expect(profile.dominantPattern).toBe('UNKNOWN');
    expect(profile.patternCounts.UNKNOWN).toBe(3);
  });
});
