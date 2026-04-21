/**
 * Unit tests for lib/services/questionQualityService.ts
 *
 * Only pure functions are tested here — assessQuestionQuality calls DB-free
 * component scorers, so it's also testable without Prisma.
 *
 * Weights (from source):
 *   DA = 0.40, DI = 0.25, DE = 0.20, CR = 0.15
 *
 * Constants:
 *   COMPONENT_APPROVE_THRESHOLD = 0.85
 *   COMPOSITE_REJECT_THRESHOLD  = 0.40
 *   INSUFFICIENT_DATA_DEFAULT   = 0.50
 *   MIN_EXPLANATION_WORDS       = 50
 */

import { describe, it, expect } from 'vitest';
import {
  scoreDifficultyAlignment,
  scoreDiscriminationIndex,
  scoreDistractorEffectiveness,
  scoreClinicalRelevance,
  assessQuestionQuality,
  calculatePerformanceScore,
  COMPONENT_APPROVE_THRESHOLD,
  COMPOSITE_REJECT_THRESHOLD,
  INSUFFICIENT_DATA_DEFAULT,
  MIN_EXPLANATION_WORDS,
  QUALITY_WEIGHTS,
} from './questionQualityService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Build a fully-passing QualityInput that results in all components = 1.0 */
function passingInput() {
  return {
    targetDifficulty: 0.5,
    empiricalDifficulty: 0.5,
    topTertileAccuracy: 1.0,
    bottomTertileAccuracy: 0.0,
    optionSelectionCounts: { A: 10, B: 10, C: 80 }, // C is correct
    correctOptionLabel: 'C',
    totalOptions: 3,
    hasVignette: true,
    hasMappedCondition: true,
    hasMappedSystem: true,
    explanationWordCount: 50,
    hasGroundingSources: true,
  };
}

// ─── scoreDifficultyAlignment ─────────────────────────────────────────────────

describe('scoreDifficultyAlignment', () => {
  it('returns INSUFFICIENT_DATA_DEFAULT when both are null', () => {
    const result = scoreDifficultyAlignment(null, null);
    expect(result.score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns INSUFFICIENT_DATA_DEFAULT when target is null', () => {
    const result = scoreDifficultyAlignment(null, 0.5);
    expect(result.score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns INSUFFICIENT_DATA_DEFAULT when empirical is null', () => {
    const result = scoreDifficultyAlignment(0.5, null);
    expect(result.score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns INSUFFICIENT_DATA_DEFAULT when target is undefined', () => {
    const result = scoreDifficultyAlignment(undefined, undefined);
    expect(result.score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns 1.0 for perfect alignment (target = empirical)', () => {
    expect(scoreDifficultyAlignment(0.5, 0.5).score).toBe(1.0);
    expect(scoreDifficultyAlignment(0.3, 0.3).score).toBe(1.0);
    expect(scoreDifficultyAlignment(0.7, 0.7).score).toBe(1.0);
  });

  it('returns 0.5 when deviation = 0.5', () => {
    expect(scoreDifficultyAlignment(0.0, 0.5).score).toBeCloseTo(0.5, 5);
    expect(scoreDifficultyAlignment(1.0, 0.5).score).toBeCloseTo(0.5, 5);
  });

  it('returns 0.0 when deviation = 1.0 (max misalignment)', () => {
    expect(scoreDifficultyAlignment(0.0, 1.0).score).toBeCloseTo(0.0, 5);
    expect(scoreDifficultyAlignment(1.0, 0.0).score).toBeCloseTo(0.0, 5);
  });

  it('never returns a score below 0', () => {
    // deviation > 1 theoretically impossible for [0,1] inputs, but max(0,…) guards it
    const result = scoreDifficultyAlignment(0.0, 1.0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('returns a reason string regardless of inputs', () => {
    expect(typeof scoreDifficultyAlignment(0.5, 0.5).reason).toBe('string');
    expect(typeof scoreDifficultyAlignment(null, null).reason).toBe('string');
  });

  it('reason mentions "well-aligned" when deviation <= 0.15', () => {
    const result = scoreDifficultyAlignment(0.5, 0.6); // deviation = 0.1
    expect(result.reason).toMatch(/well.?aligned/i);
  });

  it('reason mentions "misaligned" when deviation > 0.15', () => {
    const result = scoreDifficultyAlignment(0.3, 0.7); // deviation = 0.4
    expect(result.reason).toMatch(/misaligned/i);
  });

  it('score is symmetric: (a, b) = (b, a)', () => {
    expect(scoreDifficultyAlignment(0.2, 0.8).score).toBeCloseTo(
      scoreDifficultyAlignment(0.8, 0.2).score,
      5
    );
  });
});

// ─── scoreDiscriminationIndex ─────────────────────────────────────────────────

describe('scoreDiscriminationIndex', () => {
  it('returns INSUFFICIENT_DATA_DEFAULT when both are null', () => {
    expect(scoreDiscriminationIndex(null, null).score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns INSUFFICIENT_DATA_DEFAULT when top is null', () => {
    expect(scoreDiscriminationIndex(null, 0.3).score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns INSUFFICIENT_DATA_DEFAULT when bottom is null', () => {
    expect(scoreDiscriminationIndex(0.9, null).score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns 0 for negative rawIndex (anti-discriminating)', () => {
    expect(scoreDiscriminationIndex(0.3, 0.9).score).toBe(0);
    expect(scoreDiscriminationIndex(0.0, 0.5).score).toBe(0);
  });

  it('returns 0 when top = bottom (zero discrimination)', () => {
    expect(scoreDiscriminationIndex(0.5, 0.5).score).toBe(0);
  });

  it('maps rawIndex=0.7 → score=1.0 exactly', () => {
    expect(scoreDiscriminationIndex(0.9, 0.2).score).toBeCloseTo(1.0, 5); // raw=0.7
  });

  it('caps score at 1.0 for rawIndex > 0.7', () => {
    expect(scoreDiscriminationIndex(1.0, 0.0).score).toBe(1.0); // raw=1.0
  });

  it('maps rawIndex=0.35 → score=0.5', () => {
    expect(scoreDiscriminationIndex(0.75, 0.4).score).toBeCloseTo(0.5, 5); // raw=0.35
  });

  it('reason mentions "Anti-discriminating" for negative index', () => {
    const result = scoreDiscriminationIndex(0.2, 0.8);
    expect(result.reason).toMatch(/anti.?discriminat/i);
  });

  it('reason mentions "Good discrimination" when rawIndex >= 0.3', () => {
    const result = scoreDiscriminationIndex(1.0, 0.5); // raw=0.5
    expect(result.reason).toMatch(/good discrimination/i);
  });

  it('reason mentions "Weak discrimination" when rawIndex < 0.3', () => {
    const result = scoreDiscriminationIndex(0.5, 0.3); // raw=0.2
    expect(result.reason).toMatch(/weak discrimination/i);
  });

  it('returns a score in [0, 1] for all valid inputs', () => {
    const cases: [number, number][] = [
      [0, 0], [0.5, 0.5], [1, 0], [0.9, 0.1], [0.3, 0.9],
    ];
    for (const [top, bottom] of cases) {
      const score = scoreDiscriminationIndex(top, bottom).score;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ─── scoreDistractorEffectiveness ─────────────────────────────────────────────

describe('scoreDistractorEffectiveness', () => {
  it('returns INSUFFICIENT_DATA_DEFAULT when counts = null and totalOptions >= 4', () => {
    expect(scoreDistractorEffectiveness(null, null, 5).score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns 0.4 when counts = null and totalOptions < 4', () => {
    expect(scoreDistractorEffectiveness(null, null, 3).score).toBeCloseTo(0.4, 5);
  });

  it('returns 0.4 when counts = null and totalOptions = 2', () => {
    expect(scoreDistractorEffectiveness(null, null, 2).score).toBeCloseTo(0.4, 5);
  });

  it('returns INSUFFICIENT_DATA_DEFAULT when counts = null and no totalOptions (defaults to 5)', () => {
    expect(scoreDistractorEffectiveness(null, 'C', null).score).toBe(INSUFFICIENT_DATA_DEFAULT);
  });

  it('returns 0 when there are no distractors (only correct answer in counts)', () => {
    const result = scoreDistractorEffectiveness({ C: 100 }, 'C', 1);
    expect(result.score).toBe(0);
  });

  it('returns 0.3 when no incorrect selections recorded (all distractor counts = 0)', () => {
    const result = scoreDistractorEffectiveness({ A: 0, B: 0, C: 100 }, 'C', 3);
    expect(result.score).toBeCloseTo(0.3, 5);
  });

  it('returns 1.0 for perfectly even distractor distribution, all selected', () => {
    // 2 distractors, equal counts
    const result = scoreDistractorEffectiveness({ A: 10, B: 10, C: 80 }, 'C', 3);
    // probs = [0.5, 0.5], entropy = 1 = maxEntropy → normalizedEntropy = 1
    // unusedPenalty = 0
    // score = 0.6*1 + 0.4*1 = 1.0
    expect(result.score).toBeCloseTo(1.0, 5);
  });

  it('score degrades when distractors are never selected', () => {
    // One distractor used, two unused
    const used = scoreDistractorEffectiveness({ A: 30, B: 0, C: 0, D: 70 }, 'D', 4);
    const allUsed = scoreDistractorEffectiveness({ A: 10, B: 10, C: 10, D: 70 }, 'D', 4);
    expect(used.score).toBeLessThan(allUsed.score);
  });

  it('reason mentions "never selected" when some distractors unused', () => {
    const result = scoreDistractorEffectiveness({ A: 30, B: 0, C: 70 }, 'C', 3);
    expect(result.reason).toMatch(/never selected/i);
  });

  it('reason says "working well" when all distractors selected with good spread', () => {
    const result = scoreDistractorEffectiveness({ A: 10, B: 10, C: 80 }, 'C', 3);
    expect(result.reason).toMatch(/working well/i);
  });

  it('score is in [0, 1] for all valid inputs', () => {
    const cases = [
      [{ A: 100, B: 0 }, 'B', 2],
      [{ A: 33, B: 33, C: 34 }, 'C', 3],
      [{ A: 1, B: 1, C: 98 }, 'C', 3],
    ] as const;
    for (const [counts, label, total] of cases) {
      const score = scoreDistractorEffectiveness(
        counts as Record<string, number>,
        label,
        total
      ).score;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ─── scoreClinicalRelevance ───────────────────────────────────────────────────

describe('scoreClinicalRelevance', () => {
  it('returns 1.0 for a fully-specified, well-structured question', () => {
    const result = scoreClinicalRelevance({
      hasVignette: true,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 50,
      hasGroundingSources: true,
    });
    expect(result.score).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 when all fields are false/null/0', () => {
    const result = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 0,
      hasGroundingSources: false,
    });
    expect(result.score).toBeCloseTo(0.0, 5);
  });

  it('contributes 0.30 for vignette alone', () => {
    const result = scoreClinicalRelevance({
      hasVignette: true,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 0,
      hasGroundingSources: false,
    });
    expect(result.score).toBeCloseTo(0.30, 5);
  });

  it('contributes 0.20 for condition mapping alone', () => {
    const result = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: true,
      hasMappedSystem: false,
      explanationWordCount: 0,
      hasGroundingSources: false,
    });
    expect(result.score).toBeCloseTo(0.20, 5);
  });

  it('contributes 0.15 for system mapping alone', () => {
    const result = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: true,
      explanationWordCount: 0,
      hasGroundingSources: false,
    });
    expect(result.score).toBeCloseTo(0.15, 5);
  });

  it('contributes 0.25 for explanation at exactly MIN_EXPLANATION_WORDS', () => {
    const result = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: MIN_EXPLANATION_WORDS,
      hasGroundingSources: false,
    });
    expect(result.score).toBeCloseTo(0.25, 5);
  });

  it('scales explanation credit linearly below MIN_EXPLANATION_WORDS', () => {
    const halfWords = MIN_EXPLANATION_WORDS / 2;
    const result = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: halfWords,
      hasGroundingSources: false,
    });
    expect(result.score).toBeCloseTo(0.25 * 0.5, 5);
  });

  it('contributes 0.10 for grounding sources alone', () => {
    const result = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 0,
      hasGroundingSources: true,
    });
    expect(result.score).toBeCloseTo(0.10, 5);
  });

  it('gives full explanation credit for word count above MIN_EXPLANATION_WORDS', () => {
    const result = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 200,
      hasGroundingSources: false,
    });
    expect(result.score).toBeCloseTo(0.25, 5);
  });

  it('reason is "Clinically relevant and well-structured" when all pass', () => {
    const result = scoreClinicalRelevance({
      hasVignette: true,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 50,
      hasGroundingSources: true,
    });
    expect(result.reason).toMatch(/clinically relevant/i);
  });

  it('reason lists missing vignette when absent', () => {
    const result = scoreClinicalRelevance({
      hasVignette: false,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 50,
      hasGroundingSources: true,
    });
    expect(result.reason).toMatch(/vignette/i);
  });

  it('score never exceeds 1.0 even with extra-long explanation', () => {
    const result = scoreClinicalRelevance({
      hasVignette: true,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 9999,
      hasGroundingSources: true,
    });
    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it('handles all-undefined gracefully (all contributions = 0)', () => {
    const result = scoreClinicalRelevance({});
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ─── assessQuestionQuality ────────────────────────────────────────────────────

describe('assessQuestionQuality', () => {
  it('returns "approved" for a fully-passing question', () => {
    const result = assessQuestionQuality(passingInput());
    expect(result.recommendedStatus).toBe('approved');
    expect(result.allComponentsPass).toBe(true);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0.90);
  });

  it('composite = DA*0.40 + DI*0.25 + DE*0.20 + CR*0.15', () => {
    const result = assessQuestionQuality(passingInput());
    const expected =
      QUALITY_WEIGHTS.difficultyAlignment * result.components.difficultyAlignment +
      QUALITY_WEIGHTS.discriminationIndex * result.components.discriminationIndex +
      QUALITY_WEIGHTS.distractorEffectiveness * result.components.distractorEffectiveness +
      QUALITY_WEIGHTS.clinicalRelevance * result.components.clinicalRelevance;
    expect(result.compositeScore).toBeCloseTo(expected, 5);
  });

  it('returns "rejected" when composite < COMPOSITE_REJECT_THRESHOLD', () => {
    // All components will be very low
    const result = assessQuestionQuality({
      targetDifficulty: 0.0,
      empiricalDifficulty: 1.0, // deviation=1 → DA=0
      topTertileAccuracy: 0.0,
      bottomTertileAccuracy: 1.0, // anti-discriminating → DI=0
      optionSelectionCounts: null, // no data, totalOptions=3 < 4 → DE=0.4
      totalOptions: 3,
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 0,
      hasGroundingSources: false, // CR=0
    });
    // composite = 0*0.40 + 0*0.25 + 0.4*0.20 + 0*0.15 = 0.08
    expect(result.recommendedStatus).toBe('rejected');
    expect(result.compositeScore).toBeLessThan(COMPOSITE_REJECT_THRESHOLD);
  });

  it('returns "pending" when all components use INSUFFICIENT_DATA_DEFAULT (0.5)', () => {
    const result = assessQuestionQuality({
      // All null → each component = 0.5
      targetDifficulty: null,
      empiricalDifficulty: null,
      topTertileAccuracy: null,
      bottomTertileAccuracy: null,
      optionSelectionCounts: null,
      correctOptionLabel: null,
      totalOptions: null,
      hasVignette: false,
      hasMappedCondition: false,
      hasMappedSystem: false,
      explanationWordCount: 0,
      hasGroundingSources: false,
    });
    // DA=0.5, DI=0.5, DE=0.5 (null+null+null→default 5 options >= 4 → 0.5), CR=0
    // allComponentsPass=false (0.5 < 0.85), composite < 0.90
    expect(result.recommendedStatus).toBe('pending');
    expect(result.allComponentsPass).toBe(false);
  });

  it('returns "pending" when all components ≥ 0.85 but composite < 0.90', () => {
    // DA = 0.85 (deviation = 0.15 exactly → score = max(0, 1-0.15) = 0.85)
    // DI = min(1, 0.595/0.7) = 0.85
    // Need DE ≥ 0.85 and CR ≥ 0.85
    // CR: vignette(0.30)+condition(0.20)+system(0.15)+explanation(0.25)+sources(0.10) = 1.0
    // DE: equal 2-distractor distribution → 1.0
    // composite = 0.40*0.85 + 0.25*0.85 + 0.20*1.0 + 0.15*1.0
    //           = 0.34 + 0.2125 + 0.20 + 0.15 = 0.9025 ≥ 0.90 → would be approved
    //
    // Instead construct a case where composite is just under 0.90:
    // Use all-insufficient-data (0.5) except CR=1.0
    // composite = 0.40*0.5 + 0.25*0.5 + 0.20*0.5 + 0.15*1.0 = 0.20+0.125+0.10+0.15 = 0.575
    // allComponentsPass = false (0.5 < 0.85)
    // This should be pending (not all pass)
    // ↑ Already covered; let's test the composite=0.90 exactly path by zeroing non-CR
    // Better: the only way to get allComponentsPass=true but composite<0.90 is hard
    // with these weights since all components ≥ 0.85 gives composite ≥ 0.85
    // 0.40*0.85 + 0.25*0.85 + 0.20*0.85 + 0.15*0.85 = 0.85 = composite
    // So composite [0.85, 0.90) is reachable: all exactly 0.85
    // DA=0.85, DI=0.85, DE=0.85, CR=0.85 → composite=0.85 < 0.90 → pending
    // DA: deviation=0.15 exactly → score = max(0, 1-0.15) = 0.85
    // DI: rawIndex = 0.85 * 0.7 = 0.595 → min(1, 0.595/0.7) = 0.85
    // DE: need 0.85; hard to arrange exactly; use mock-like simple case
    // Just assert that pending is possible when !allComponentsPass
    const result = assessQuestionQuality({
      targetDifficulty: 0.50,
      empiricalDifficulty: 0.65, // deviation=0.15 → DA=0.85
      topTertileAccuracy: 0.795,
      bottomTertileAccuracy: 0.2, // rawIndex=0.595 → DI=0.85
      optionSelectionCounts: { A: 10, B: 10, C: 80 }, // DE=1.0
      correctOptionLabel: 'C',
      totalOptions: 3,
      hasVignette: true,
      hasMappedCondition: true,
      hasMappedSystem: true,
      explanationWordCount: 50,
      hasGroundingSources: false, // CR = 0.30+0.20+0.15+0.25 = 0.90 (sources worth 0.10 missing)
    });
    // CR = 0.90, DE = 1.0, DA ≈ 0.85, DI ≈ 0.85
    // composite ≈ 0.40*0.85 + 0.25*0.85 + 0.20*1.0 + 0.15*0.90
    //           ≈ 0.34 + 0.2125 + 0.20 + 0.135 = 0.8875 < 0.90
    // allComponentsPass: DA=0.85 ✓, DI=0.85 ✓, DE=1.0 ✓, CR=0.90 ✓
    expect(result.allComponentsPass).toBe(true);
    expect(result.compositeScore).toBeLessThan(0.90);
    expect(result.recommendedStatus).toBe('pending');
  });

  it('allComponentsPass is false if any component < 0.85', () => {
    const result = assessQuestionQuality({
      ...passingInput(),
      topTertileAccuracy: 0.5,
      bottomTertileAccuracy: 0.3, // DI = min(1, 0.2/0.7) ≈ 0.286 < 0.85
    });
    expect(result.allComponentsPass).toBe(false);
  });

  it('components match individual scorer outputs', () => {
    const input = passingInput();
    const result = assessQuestionQuality(input);

    const da = scoreDifficultyAlignment(input.targetDifficulty, input.empiricalDifficulty);
    const di = scoreDiscriminationIndex(input.topTertileAccuracy, input.bottomTertileAccuracy);
    const de = scoreDistractorEffectiveness(
      input.optionSelectionCounts,
      input.correctOptionLabel,
      input.totalOptions
    );
    const cr = scoreClinicalRelevance({
      hasVignette: input.hasVignette,
      hasMappedCondition: input.hasMappedCondition,
      hasMappedSystem: input.hasMappedSystem,
      explanationWordCount: input.explanationWordCount,
      hasGroundingSources: input.hasGroundingSources,
    });

    expect(result.components.difficultyAlignment).toBeCloseTo(da.score, 5);
    expect(result.components.discriminationIndex).toBeCloseTo(di.score, 5);
    expect(result.components.distractorEffectiveness).toBeCloseTo(de.score, 5);
    expect(result.components.clinicalRelevance).toBeCloseTo(cr.score, 5);
  });

  it('reasons array is populated when components fail', () => {
    const result = assessQuestionQuality({
      targetDifficulty: null, // DA = 0.5 < 0.85 → reason added
      empiricalDifficulty: null,
      hasVignette: false, // CR will be 0 < 0.85 → reason added
    });
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns valid recommendedStatus in all cases', () => {
    const validStatuses = ['approved', 'pending', 'needs_revision', 'rejected'];
    const testInputs = [
      passingInput(),
      {},
      { targetDifficulty: 0, empiricalDifficulty: 1, topTertileAccuracy: 0, bottomTertileAccuracy: 1 },
    ];
    for (const input of testInputs) {
      const result = assessQuestionQuality(input);
      expect(validStatuses).toContain(result.recommendedStatus);
    }
  });

  it('compositeScore is always in [0, 1]', () => {
    const testInputs = [passingInput(), {}, { targetDifficulty: null }];
    for (const input of testInputs) {
      const { compositeScore } = assessQuestionQuality(input);
      expect(compositeScore).toBeGreaterThanOrEqual(0);
      expect(compositeScore).toBeLessThanOrEqual(1);
    }
  });
});

// ─── calculatePerformanceScore ────────────────────────────────────────────────

describe('calculatePerformanceScore', () => {
  it('returns accuracy + confidence boost when no flags', () => {
    // accuracy=80, flags=0, attempts=50 → 80 - 0 + min(10, 10) = 90
    expect(calculatePerformanceScore(80, 0, 50)).toBe(90);
  });

  it('deducts 10 per flag, up to 30', () => {
    // accuracy=50, flags=4, attempts=5 → 50 - 30 + min(1,10) = 21
    expect(calculatePerformanceScore(50, 4, 5)).toBe(21);
  });

  it('caps flag penalty at 30 (not more, even for many flags)', () => {
    const withThreeFlags = calculatePerformanceScore(80, 3, 0);  // penalty=30
    const withTenFlags  = calculatePerformanceScore(80, 10, 0); // penalty=min(100,30)=30
    expect(withThreeFlags).toBe(withTenFlags);
  });

  it('caps confidence boost at 10', () => {
    // attempts=50 → boost=min(10,10)=10; attempts=500 → boost=min(100,10)=10
    const withFiftyAttempts = calculatePerformanceScore(80, 0, 50);
    const withFiveHundred   = calculatePerformanceScore(80, 0, 500);
    expect(withFiftyAttempts).toBe(withFiveHundred);
  });

  it('returns 0 when score would go below 0', () => {
    // accuracy=10, flags=3 → penalty=30 → 10-30+0 = -20 → max(0, ...)
    expect(calculatePerformanceScore(10, 3, 0)).toBe(0);
  });

  it('returns 100 when score would exceed 100', () => {
    // accuracy=95, flags=0, attempts=100 → 95 + 10 = 105 → min(100, ...)
    expect(calculatePerformanceScore(95, 0, 100)).toBe(100);
  });

  it('returns integer (uses Math.round)', () => {
    const score = calculatePerformanceScore(80, 0, 50);
    expect(Number.isInteger(score)).toBe(true);
  });

  it('returns 0 for all-zero inputs', () => {
    expect(calculatePerformanceScore(0, 0, 0)).toBe(0);
  });

  it('handles maximum reasonable inputs without throwing', () => {
    expect(() => calculatePerformanceScore(100, 100, 1000)).not.toThrow();
  });

  it('handles minimum inputs: accuracy=0, flags=0, attempts=0 → 0', () => {
    expect(calculatePerformanceScore(0, 0, 0)).toBe(0);
  });

  it('accuracy=100, flags=0, attempts=50 → 100 (capped)', () => {
    expect(calculatePerformanceScore(100, 0, 50)).toBe(100);
  });
});
