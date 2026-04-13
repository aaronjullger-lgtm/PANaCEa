/**
 * Tests for errorPatternService
 * Sprint 23 — Error pattern classification
 */

import { describe, it, expect } from 'vitest';
import {
  classifyErrorPattern,
  buildPatternProfile,
  type IncorrectAttemptTelemetry,
  type ErrorPatternType,
} from '../lib/services/errorPatternService';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeAttempt(overrides: Partial<IncorrectAttemptTelemetry> = {}): IncorrectAttemptTelemetry {
  return {
    questionId: 'q-001',
    system: 'Cardiovascular',
    conditionTested: 'Heart Failure',
    selectedCondition: 'Pneumonia',
    timeToFirstClickMs: 15000,
    totalDwellTimeMs: 45000,
    answerSwitches: 0,
    commitmentGapMs: 5000,
    hintViewed: false,
    parTimeMs: 60000,
    selectedConditionRecentlySeen: false,
    isConfusionPair: false,
    firstClickWasCorrect: false,
    vignetteLengthChars: 500,
    sessionPosition: 5,
    sessionLength: 20,
    ...overrides,
  };
}

// ─── classifyErrorPattern ────────────────────────────────────────────

describe('classifyErrorPattern', () => {
  it('classifies rapid guess pattern', () => {
    const result = classifyErrorPattern(
      makeAttempt({ totalDwellTimeMs: 3000, parTimeMs: 60000 })
    );
    expect(result.pattern).toBe('RAPID_GUESS');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.remediation).toContain('Slow down');
  });

  it('classifies anchoring pattern', () => {
    const result = classifyErrorPattern(
      makeAttempt({
        timeToFirstClickMs: 5000,
        parTimeMs: 60000,
        answerSwitches: 0,
        firstClickWasCorrect: false,
        totalDwellTimeMs: 30000,
      })
    );
    expect(result.pattern).toBe('ANCHORING');
    expect(result.evidence.some((e) => e.includes('First click'))).toBe(true);
  });

  it('classifies premature closure pattern', () => {
    const result = classifyErrorPattern(
      makeAttempt({
        firstClickWasCorrect: true,
        answerSwitches: 2,
        commitmentGapMs: 1500,
        totalDwellTimeMs: 40000,
      })
    );
    expect(result.pattern).toBe('PREMATURE_CLOSURE');
    expect(result.evidence.some((e) => e.includes('First click was correct'))).toBe(true);
  });

  it('classifies availability bias pattern', () => {
    const result = classifyErrorPattern(
      makeAttempt({
        selectedConditionRecentlySeen: true,
        selectedCondition: 'Pneumonia',
        conditionTested: 'Heart Failure',
        totalDwellTimeMs: 45000,
        timeToFirstClickMs: 20000,
      })
    );
    expect(result.pattern).toBe('AVAILABILITY_BIAS');
    expect(result.evidence.some((e) => e.includes('recently'))).toBe(true);
  });

  it('classifies confirmation bias for confusion pairs', () => {
    const result = classifyErrorPattern(
      makeAttempt({
        isConfusionPair: true,
        selectedCondition: 'Aortic Stenosis',
        conditionTested: 'Hypertrophic Cardiomyopathy',
        totalDwellTimeMs: 50000,
        timeToFirstClickMs: 25000,
      })
    );
    expect(result.pattern).toBe('CONFIRMATION_BIAS');
    expect(result.evidence.some((e) => e.includes('confusion pair'))).toBe(true);
  });

  it('classifies fatigue pattern late in session', () => {
    const result = classifyErrorPattern(
      makeAttempt({
        sessionPosition: 18,
        sessionLength: 20,
        totalDwellTimeMs: 25000,
        parTimeMs: 60000,
        timeToFirstClickMs: 20000,
      })
    );
    expect(result.pattern).toBe('FATIGUE');
    expect(result.evidence.some((e) => e.includes('through session'))).toBe(true);
  });

  it('returns UNKNOWN when no strong signal', () => {
    const result = classifyErrorPattern(
      makeAttempt({
        totalDwellTimeMs: 55000,
        parTimeMs: 60000,
        timeToFirstClickMs: 30000,
        answerSwitches: 1,
        commitmentGapMs: 10000,
        firstClickWasCorrect: false,
        selectedConditionRecentlySeen: false,
        isConfusionPair: false,
        sessionPosition: 3,
        sessionLength: 20,
      })
    );
    expect(result.pattern).toBe('UNKNOWN');
  });

  it('confidence is between 0 and 1', () => {
    const patterns: ErrorPatternType[] = ['RAPID_GUESS', 'ANCHORING', 'PREMATURE_CLOSURE'];
    const attempts = [
      makeAttempt({ totalDwellTimeMs: 3000, parTimeMs: 60000 }),
      makeAttempt({ timeToFirstClickMs: 5000, parTimeMs: 60000, answerSwitches: 0, firstClickWasCorrect: false }),
      makeAttempt({ firstClickWasCorrect: true, answerSwitches: 2, commitmentGapMs: 1000 }),
    ];
    for (const a of attempts) {
      const result = classifyErrorPattern(a);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ─── buildPatternProfile ─────────────────────────────────────────────

describe('buildPatternProfile', () => {
  it('aggregates patterns from multiple attempts', () => {
    const attempts = [
      makeAttempt({ totalDwellTimeMs: 3000, parTimeMs: 60000, system: 'Cardiovascular' }),
      makeAttempt({ totalDwellTimeMs: 2000, parTimeMs: 60000, system: 'Pulmonary' }),
      makeAttempt({ isConfusionPair: true, selectedCondition: 'AS', conditionTested: 'HCM', system: 'Cardiovascular', totalDwellTimeMs: 50000, timeToFirstClickMs: 25000 }),
      makeAttempt({ selectedConditionRecentlySeen: true, conditionTested: 'COPD', selectedCondition: 'Asthma', system: 'Pulmonary', totalDwellTimeMs: 45000, timeToFirstClickMs: 20000 }),
    ];

    const profile = buildPatternProfile(attempts);

    expect(profile.totalAnalyzed).toBe(4);
    expect(profile.dominantPattern).not.toBeNull();
    expect(profile.topPatterns.length).toBeGreaterThan(0);
    expect(profile.topPatterns.length).toBeLessThanOrEqual(3);

    // Frequencies should sum to <= 1
    const totalFreq = profile.topPatterns.reduce((s, p) => s + p.frequency, 0);
    expect(totalFreq).toBeLessThanOrEqual(1.01); // float tolerance

    // System patterns should be populated
    expect(Object.keys(profile.systemPatterns).length).toBeGreaterThan(0);

    // Remediations should exist
    expect(profile.remediations.length).toBeGreaterThan(0);
  });

  it('handles empty attempts', () => {
    const profile = buildPatternProfile([]);
    expect(profile.totalAnalyzed).toBe(0);
    expect(profile.dominantPattern).toBeNull();
    expect(profile.topPatterns).toHaveLength(0);
  });

  it('handles single attempt', () => {
    const profile = buildPatternProfile([
      makeAttempt({ totalDwellTimeMs: 3000, parTimeMs: 60000 }),
    ]);
    expect(profile.totalAnalyzed).toBe(1);
    expect(profile.dominantPattern).toBe('RAPID_GUESS');
  });
});
