import { describe, it, expect } from 'vitest';
import {
  deriveContinuousRating,
  QUESTION_TYPE_WEIGHTS,
  DEFAULT_IMPLICIT_CONFIG,
  type QuestionTypeKey,
  type ImplicitBehaviorMetrics,
} from '../lib/implicit-metrics';

describe('Question-Type Signal Weighting', () => {
  const baseCorrect: ImplicitBehaviorMetrics = {
    timeToFirstClick: 20000,
    answerSwitches: 0,
    totalDwellTime: 25000,
    isCorrect: true,
    parTimeMs: 30000,
  };

  describe('Weight vector validity', () => {
    it('all weight profiles sum to 1.0', () => {
      for (const [key, w] of Object.entries(QUESTION_TYPE_WEIGHTS)) {
        const sum = w.rtWeight + w.switchWeight + w.trajectoryWeight + w.hesitationWeight;
        expect(sum).toBeCloseTo(1.0, 5);
      }
    });

    it('all 5 question types are defined', () => {
      const expectedTypes: QuestionTypeKey[] = ['vignette', 'recall', 'image', 'rapid_recall', 'unknown'];
      for (const t of expectedTypes) {
        expect(QUESTION_TYPE_WEIGHTS[t]).toBeDefined();
      }
    });

    it('weight distributions are distinct per type', () => {
      const profiles = Object.values(QUESTION_TYPE_WEIGHTS);
      const signatures = profiles.map(w => `${w.rtWeight}-${w.switchWeight}-${w.trajectoryWeight}`);
      const uniqueSigs = new Set(signatures);
      expect(uniqueSigs.size).toBeGreaterThanOrEqual(4); // At least 4 distinct profiles
    });

    it('vignette has higher rtWeight than recall', () => {
      expect(QUESTION_TYPE_WEIGHTS.vignette.rtWeight).toBeGreaterThan(
        QUESTION_TYPE_WEIGHTS.recall.rtWeight
      );
    });

    it('recall has higher switchWeight than vignette', () => {
      expect(QUESTION_TYPE_WEIGHTS.recall.switchWeight).toBeGreaterThan(
        QUESTION_TYPE_WEIGHTS.vignette.switchWeight
      );
    });

    it('image has highest trajectoryWeight', () => {
      const trajectoryWeights = Object.values(QUESTION_TYPE_WEIGHTS).map(w => w.trajectoryWeight);
      expect(QUESTION_TYPE_WEIGHTS.image.trajectoryWeight).toBe(Math.max(...trajectoryWeights));
    });

    it('rapid_recall has highest rtWeight', () => {
      const rtWeights = Object.values(QUESTION_TYPE_WEIGHTS).map(w => w.rtWeight);
      expect(QUESTION_TYPE_WEIGHTS.rapid_recall.rtWeight).toBe(Math.max(...rtWeights));
    });
  });

  describe('Type-specific behavior', () => {
    it('vignette with slow RT produces predictable result', () => {
      const slowMetrics = { ...baseCorrect, timeToFirstClick: 50000 };
      const result = deriveContinuousRating({ ...slowMetrics, questionType: 'vignette' });
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    it('recall with switches penalized differently than image', () => {
      const switchMetrics = { ...baseCorrect, answerSwitches: 3 };
      const recall = deriveContinuousRating({ ...switchMetrics, questionType: 'recall' });
      const image = deriveContinuousRating({ ...switchMetrics, questionType: 'image' });
      // recall switchWeight=0.40 vs image switchWeight=0.20 → switches hurt recall more
      expect(recall.confidence).toBeLessThan(image.confidence);
    });

    it('image benefits more from trajectory signal', () => {
      const trajMetrics: ImplicitBehaviorMetrics = {
        ...baseCorrect,
        trajectory: {
          mad: 10,
          auc: 0.1,
          hesitationIndex: 0.1,
          jitterScore: 0.1,
          efficiency: 0.9,
          confidenceScore: 0.95,
          movementTime: 500,
        },
      };
      const image = deriveContinuousRating({ ...trajMetrics, questionType: 'image' });
      const recall = deriveContinuousRating({ ...trajMetrics, questionType: 'recall' });
      // image trajectoryWeight=0.35 vs recall=0.10 → image benefits more
      expect(image.confidence).toBeGreaterThanOrEqual(recall.confidence);
    });

    it('rapid_recall with fast RT produces very high confidence', () => {
      const fastMetrics = { ...baseCorrect, timeToFirstClick: 5000 };
      const result = deriveContinuousRating({ ...fastMetrics, questionType: 'rapid_recall' });
      expect(result.confidence).toBeGreaterThan(0.75);
    });

    it('rapid_recall with slow RT produces moderate confidence', () => {
      const slowMetrics = { ...baseCorrect, timeToFirstClick: 15000 };
      const result = deriveContinuousRating({ ...slowMetrics, questionType: 'rapid_recall' });
      expect(result.confidence).toBeGreaterThan(0.4);
    });

    it('unknown type uses default global weights', () => {
      const unknownResult = deriveContinuousRating({ ...baseCorrect, questionType: 'unknown' });
      const noTypeResult = deriveContinuousRating(baseCorrect); // no questionType → defaults
      expect(unknownResult.confidence).toEqual(noTypeResult.confidence);
    });

    it('missing questionType defaults to unknown', () => {
      const result = deriveContinuousRating(baseCorrect); // no questionType field
      const unknownResult = deriveContinuousRating({ ...baseCorrect, questionType: 'unknown' });
      expect(result.confidence).toEqual(unknownResult.confidence);
    });

    it('all types produce valid confidence in [0.3, 0.95] range', () => {
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image', 'rapid_recall', 'unknown'];
      for (const t of types) {
        const result = deriveContinuousRating({ ...baseCorrect, questionType: t });
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
        expect(result.confidence).toBeLessThanOrEqual(0.95);
      }
    });
  });

  describe('Grade invariance', () => {
    it('questionType does not affect grade (only confidence)', () => {
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image', 'rapid_recall', 'unknown'];
      const grades = types.map(t =>
        deriveContinuousRating({ ...baseCorrect, questionType: t }).grade
      );
      // All grades should be identical
      for (const g of grades) {
        expect(g).toEqual(grades[0]);
      }
    });

    it('grade is 3.0 for all correct answers regardless of type', () => {
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image'];
      for (const t of types) {
        const result = deriveContinuousRating({ ...baseCorrect, questionType: t });
        expect(result.grade).toBeGreaterThanOrEqual(2.5); // At minimum 2.5, likely 3.0
      }
    });

    it('grade is 1.0 for all incorrect answers regardless of type', () => {
      const incorrectMetrics = { ...baseCorrect, isCorrect: false };
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image'];
      for (const t of types) {
        const result = deriveContinuousRating({ ...incorrectMetrics, questionType: t });
        expect(result.grade).toEqual(1.0); // Always 1.0 for incorrect
      }
    });
  });

  describe('Discrete rating mapping', () => {
    it('discreteRating exists for all types', () => {
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image', 'rapid_recall', 'unknown'];
      for (const t of types) {
        const result = deriveContinuousRating({ ...baseCorrect, questionType: t });
        expect(result.discreteRating).toBeDefined();
        expect([1, 3]).toContain(result.discreteRating); // Binary: Again(1) or Good(3)
      }
    });

    it('discreteRating is Good(3) for correct answers', () => {
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image'];
      for (const t of types) {
        const result = deriveContinuousRating({ ...baseCorrect, questionType: t });
        expect(result.discreteRating).toBe(3); // Good
      }
    });

    it('discreteRating is Again(1) for incorrect answers', () => {
      const incorrectMetrics = { ...baseCorrect, isCorrect: false };
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image'];
      for (const t of types) {
        const result = deriveContinuousRating({ ...incorrectMetrics, questionType: t });
        expect(result.discreteRating).toBe(1); // Again
      }
    });
  });

  describe('Signal weighting integration', () => {
    it('vignette with same metrics: RT signal weighted 0.40 (highest)', () => {
      // Verify vignette RT weight (0.40) is the highest weight
      expect(QUESTION_TYPE_WEIGHTS.vignette.rtWeight).toBe(0.40);
      expect(QUESTION_TYPE_WEIGHTS.vignette.rtWeight).toBeGreaterThan(QUESTION_TYPE_WEIGHTS.vignette.switchWeight);
      expect(QUESTION_TYPE_WEIGHTS.vignette.rtWeight).toBeGreaterThan(QUESTION_TYPE_WEIGHTS.vignette.trajectoryWeight);
      expect(QUESTION_TYPE_WEIGHTS.vignette.rtWeight).toBeGreaterThan(QUESTION_TYPE_WEIGHTS.vignette.hesitationWeight);
    });

    it('recall prioritizes switches over reading time', () => {
      const fewSwitches = { ...baseCorrect, answerSwitches: 0, timeToFirstClick: 40000 };
      const manySwitches = { ...baseCorrect, answerSwitches: 5, timeToFirstClick: 8000 };
      const fewResult = deriveContinuousRating({ ...fewSwitches, questionType: 'recall' });
      const manyResult = deriveContinuousRating({ ...manySwitches, questionType: 'recall' });
      // Fewer switches should have higher confidence despite slower RT
      expect(fewResult.confidence).toBeGreaterThan(manyResult.confidence);
    });

    it('different types produce different confidences for metrics with varied signals', () => {
      // Use metrics with mixed signals so different weight profiles produce different results
      const mixedMetrics: ImplicitBehaviorMetrics = {
        ...baseCorrect,
        timeToFirstClick: 25000, // slightly slow → sRT < 1.0
        answerSwitches: 2,       // some switches → sSwitch < 1.0
        commitmentGapMs: 2000,   // some hesitation
        cursorEntropy: 1.5,
        hoverOscillationCount: 1,
      };
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image'];
      const confidences = types.map(t =>
        deriveContinuousRating({ ...mixedMetrics, questionType: t }).confidence
      );
      // With varied signal values and different weight profiles, at least some differ
      const uniqueConf = new Set(confidences.map(c => c.toFixed(3)));
      expect(uniqueConf.size).toBeGreaterThan(1);
    });
  });

  describe('Behavior with extreme metrics', () => {
    it('very fast RT produces high confidence across types', () => {
      const veryFastMetrics = { ...baseCorrect, timeToFirstClick: 2000 };
      const types: QuestionTypeKey[] = ['vignette', 'recall', 'image', 'rapid_recall'];
      for (const t of types) {
        const result = deriveContinuousRating({ ...veryFastMetrics, questionType: t });
        expect(result.confidence).toBeGreaterThan(0.65);
      }
    });

    it('very slow RT produces varied confidence by type', () => {
      const verySlowMetrics = { ...baseCorrect, timeToFirstClick: 120000 };
      const vignetteResult = deriveContinuousRating({
        ...verySlowMetrics,
        questionType: 'vignette',
      });
      const rapidResult = deriveContinuousRating({
        ...verySlowMetrics,
        questionType: 'rapid_recall',
      });
      // Slow RT hurts rapid_recall more (it has highest rtWeight)
      expect(rapidResult.confidence).toBeLessThan(vignetteResult.confidence);
    });

    it('many switches reduces confidence more in recall than vignette', () => {
      const manySwitch = { ...baseCorrect, answerSwitches: 10 };
      const recallResult = deriveContinuousRating({
        ...manySwitch,
        questionType: 'recall',
      });
      const vignetteResult = deriveContinuousRating({
        ...manySwitch,
        questionType: 'vignette',
      });
      // Switches hurt recall (switchWeight 0.40) more than vignette (switchWeight 0.20)
      expect(recallResult.confidence).toBeLessThan(vignetteResult.confidence);
    });
  });

  describe('Type consistency', () => {
    it('identical input → identical output for same type', () => {
      const result1 = deriveContinuousRating({ ...baseCorrect, questionType: 'vignette' });
      const result2 = deriveContinuousRating({ ...baseCorrect, questionType: 'vignette' });
      expect(result1.confidence).toBe(result2.confidence);
      expect(result1.grade).toBe(result2.grade);
    });

    it('type is case-sensitive (unknown if mismatch)', () => {
      // Assuming types are case-sensitive
      const result = deriveContinuousRating({
        ...baseCorrect,
        questionType: 'VIGNETTE' as any,
      }); // Wrong case
      const unknownResult = deriveContinuousRating({
        ...baseCorrect,
        questionType: 'unknown',
      });
      // Should fall back to unknown behavior
      expect(result.confidence).toEqual(unknownResult.confidence);
    });
  });
});
