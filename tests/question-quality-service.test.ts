/**
 * Tests for lib/services/questionQualityService.ts — Phase 3 (Behavioral Analysis Audit)
 *
 * Verifies the 4-component quality score formula, auto-approve gate,
 * and separated performance score.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreDifficultyAlignment,
  scoreDiscriminationIndex,
  scoreDistractorEffectiveness,
  scoreClinicalRelevance,
  assessQuestionQuality,
  calculatePerformanceScore,
  QUALITY_WEIGHTS,
  COMPONENT_APPROVE_THRESHOLD,
  COMPOSITE_REJECT_THRESHOLD,
  INSUFFICIENT_DATA_DEFAULT,
  MIN_EXPLANATION_WORDS,
  type QualityInput,
} from '../lib/services/questionQualityService';
import { determineStatusFromComponents } from '../lib/services/questionReviewGate';

// ─── DifficultyAlignment ────────────────────────────────────────

describe('scoreDifficultyAlignment', () => {
  it('returns 1.0 for perfect alignment', () => {
    const { score } = scoreDifficultyAlignment(0.5, 0.5);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 for maximum misalignment', () => {
    const { score } = scoreDifficultyAlignment(0.0, 1.0);
    expect(score).toBeCloseTo(0.0, 5);
  });

  it('returns 0.85 for 15% deviation', () => {
    const { score } = scoreDifficultyAlignment(0.5, 0.65);
    expect(score).toBeCloseTo(0.85, 5);
  });

  it('returns default when target is null', () => {
    const { score } = scoreDifficultyAlignment(null, 0.5);
    expect(score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns default when empirical is null', () => {
    const { score } = scoreDifficultyAlignment(0.5, null);
    expect(score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns default when both are null', () => {
    const { score } = scoreDifficultyAlignment(null, null);
    expect(score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });
});

// ─── DiscriminationIndex ────────────────────────────────────────

describe('scoreDiscriminationIndex', () => {
  it('scores excellent discrimination (index=0.5)', () => {
    const { score } = scoreDiscriminationIndex(0.9, 0.4);
    // 0.5 / 0.7 = 0.714
    expect(score).toBeCloseTo(0.714, 2);
  });

  it('scores perfect discrimination (index=0.7+)', () => {
    const { score } = scoreDiscriminationIndex(1.0, 0.2);
    // 0.8 / 0.7 = 1.14 → capped at 1.0
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for anti-discriminating items', () => {
    const { score } = scoreDiscriminationIndex(0.3, 0.6);
    expect(score).toBe(0);
  });

  it('returns default when data is missing', () => {
    const { score } = scoreDiscriminationIndex(null, null);
    expect(score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('scores weak discrimination (index=0.1)', () => {
    const { score } = scoreDiscriminationIndex(0.6, 0.5);
    // 0.1 / 0.7 = 0.143
    expect(score).toBeCloseTo(0.143, 2);
  });

  it('handles zero discrimination', () => {
    const { score } = scoreDiscriminationIndex(0.5, 0.5);
    expect(score).toBeCloseTo(0, 5);
  });
});

// ─── DistractorEffectiveness ────────────────────────────────────

describe('scoreDistractorEffectiveness', () => {
  it('scores perfect distribution across 4 distractors', () => {
    // Perfectly even: each distractor gets 25 selections
    const { score } = scoreDistractorEffectiveness(
      { A: 100, B: 25, C: 25, D: 25, E: 25 },
      'A',
      5
    );
    // Entropy = log2(4) / log2(4) = 1.0, no unused penalty
    // 0.6 * 1.0 + 0.4 * 1.0 = 1.0
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('penalizes unused distractors', () => {
    const { score } = scoreDistractorEffectiveness(
      { A: 100, B: 50, C: 0, D: 0, E: 50 },
      'A',
      5
    );
    // 2 of 4 distractors unused → unusedPenalty = 0.5
    expect(score).toBeLessThan(0.7);
  });

  it('penalizes heavily skewed distribution', () => {
    const { score } = scoreDistractorEffectiveness(
      { A: 100, B: 95, C: 1, D: 2, E: 2 },
      'A',
      5
    );
    // Nearly all wrong answers go to B → low entropy
    expect(score).toBeLessThan(0.6);
  });

  it('returns default when no selection data', () => {
    const { score } = scoreDistractorEffectiveness(null, null, 5);
    expect(score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('penalizes fewer than 4 options', () => {
    const { score } = scoreDistractorEffectiveness(null, null, 3);
    expect(score).toBe(0.4);
  });

  it('handles no incorrect selections yet', () => {
    const { score } = scoreDistractorEffectiveness(
      { A: 10, B: 0, C: 0, D: 0, E: 0 },
      'A',
      5
    );
    expect(score).toBe(0.3);
  });
});

// ─── ClinicalRelevance ──────────────────────────────────────────

describe('scoreClinicalRelevance', () => {
  it('returns 1.0 for fully complete question', () => {
    const { score } = scoreClinicalRelevance({
      hasVignette: true,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 100,
      hasGroundingSources: true,
    });
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for completely empty question', () => {
    const { score } = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 0,
      hasGroundingSources: false,
    });
    expect(score).toBeCloseTo(0.0, 5);
  });

  it('gives partial credit for short explanation', () => {
    const { score } = scoreClinicalRelevance({
      hasVignette: true,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 25, // half of MIN_EXPLANATION_WORDS
      hasGroundingSources: true,
    });
    // 0.30 + 0.20 + 0.15 + 0.25*(25/50) + 0.10 = 0.875
    expect(score).toBeCloseTo(0.875, 2);
  });

  it('penalizes missing vignette most heavily', () => {
    const noVignette = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 100,
      hasGroundingSources: true,
    });
    const noSystem = scoreClinicalRelevance({
      hasVignette: true,
      hasMappedCondition: true,
      hasMappedSystem: false,
      explanationWordCount: 100,
      hasGroundingSources: true,
    });
    // Missing vignette costs 0.30, missing system costs 0.15
    expect(noVignette.score).toBeLessThan(noSystem.score);
  });
});

// ─── Composite Assessment ───────────────────────────────────────

describe('assessQuestionQuality', () => {
  it('auto-approves when all components are excellent', () => {
    const result = assessQuestionQuality({
      targetDifficulty: 0.5,
      empiricalDifficulty: 0.5,
      topTertileAccuracy: 1.0,
      bottomTertileAccuracy: 0.2,
      optionSelectionCounts: { A: 80, B: 5, C: 5, D: 5, E: 5 },
      correctOptionLabel: 'A',
      totalOptions: 5,
      hasVignette: true,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 100,
      hasGroundingSources: true,
    });
    expect(result.allComponentsPass).toBe(true);
    expect(result.recommendedStatus).toBe('approved');
    expect(result.compositeScore).toBeGreaterThanOrEqual(0.90);
  });

  it('does NOT auto-approve when one component is weak', () => {
    const result = assessQuestionQuality({
      targetDifficulty: 0.5,
      empiricalDifficulty: 0.5,
      topTertileAccuracy: 1.0,
      bottomTertileAccuracy: 0.2,
      optionSelectionCounts: { A: 80, B: 5, C: 5, D: 5, E: 5 },
      correctOptionLabel: 'A',
      totalOptions: 5,
      // Weak clinical relevance:
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 10,
      hasGroundingSources: false,
    });
    expect(result.allComponentsPass).toBe(false);
    expect(result.recommendedStatus).not.toBe('approved');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('rejects when composite is below threshold', () => {
    const result = assessQuestionQuality({
      targetDifficulty: 0.0,
      empiricalDifficulty: 1.0, // max misalignment → DA = 0
      topTertileAccuracy: 0.3,
      bottomTertileAccuracy: 0.5, // anti-discriminating → DI = 0
      optionSelectionCounts: { A: 100, B: 0, C: 0, D: 0, E: 0 },
      correctOptionLabel: 'A',
      totalOptions: 5,
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 0,
      hasGroundingSources: false,
    });
    expect(result.compositeScore).toBeLessThan(COMPOSITE_REJECT_THRESHOLD);
    expect(result.recommendedStatus).toBe('rejected');
  });

  it('returns pending for questions with insufficient data', () => {
    // DA=0.50, DI=0.50, DE=0.50 (defaults), CR=0.0 (no structural signals)
    // Composite = 0.40*0.50 + 0.25*0.50 + 0.20*0.50 + 0.15*0.0 = 0.425
    const result = assessQuestionQuality({});
    expect(result.compositeScore).toBeCloseTo(0.425, 2);
    expect(result.allComponentsPass).toBe(false);
    expect(result.recommendedStatus).toBe('pending');
  });

  it('composite weights sum to 1.0', () => {
    const sum =
      QUALITY_WEIGHTS.difficultyAlignment +
      QUALITY_WEIGHTS.discriminationIndex +
      QUALITY_WEIGHTS.distractorEffectiveness +
      QUALITY_WEIGHTS.clinicalRelevance;
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

// ─── Review Gate (4-Component) ──────────────────────────────────

describe('determineStatusFromComponents', () => {
  it('approves when all components pass and composite >= 0.9', () => {
    const status = determineStatusFromComponents(
      {
        difficultyAlignment: 0.90,
        discriminationIndex: 0.90,
        distractorEffectiveness: 0.90,
        clinicalRelevance: 0.90,
      },
      0.92
    );
    expect(status).toBe('approved');
  });

  it('returns pending when one component fails even if composite is high', () => {
    const status = determineStatusFromComponents(
      {
        difficultyAlignment: 0.90,
        discriminationIndex: 0.90,
        distractorEffectiveness: 0.80, // below 0.85
        clinicalRelevance: 0.95,
      },
      0.91
    );
    expect(status).toBe('pending');
  });

  it('rejects community-flagged questions regardless of quality', () => {
    const status = determineStatusFromComponents(
      {
        difficultyAlignment: 1.0,
        discriminationIndex: 1.0,
        distractorEffectiveness: 1.0,
        clinicalRelevance: 1.0,
      },
      1.0,
      3 // flagCount >= MAX_FLAG_COUNT
    );
    expect(status).toBe('rejected');
  });

  it('returns needs_revision for very low composite', () => {
    const status = determineStatusFromComponents(
      {
        difficultyAlignment: 0.10,
        discriminationIndex: 0.10,
        distractorEffectiveness: 0.10,
        clinicalRelevance: 0.10,
      },
      0.10
    );
    expect(status).toBe('needs_revision');
  });
});

// ─── Performance Score (Separated Concern) ──────────────────────

describe('calculatePerformanceScore', () => {
  it('returns accuracy when no flags and few attempts', () => {
    // accuracy=80, flags=0, attempts=5 → 80 + 0 + 1 = 81
    const score = calculatePerformanceScore(80, 0, 5);
    expect(score).toBe(81);
  });

  it('penalizes flags', () => {
    // accuracy=80, flags=2, attempts=10 → 80 - 20 + 2 = 62
    const score = calculatePerformanceScore(80, 2, 10);
    expect(score).toBe(62);
  });

  it('caps flag penalty at 30', () => {
    // accuracy=80, flags=5, attempts=10 → 80 - 30 + 2 = 52
    const score = calculatePerformanceScore(80, 5, 10);
    expect(score).toBe(52);
  });

  it('caps confidence boost at 10', () => {
    // accuracy=50, flags=0, attempts=100 → 50 + 0 + 10 = 60
    const score = calculatePerformanceScore(50, 0, 100);
    expect(score).toBe(60);
  });

  it('clamps to [0, 100]', () => {
    expect(calculatePerformanceScore(0, 3, 0)).toBe(0);
    expect(calculatePerformanceScore(100, 0, 100)).toBe(100);
  });
});
