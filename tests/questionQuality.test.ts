/**
 * Sprint 9: Unit tests for question quality scoring
 */

import { describe, it, expect } from 'vitest';
import { scoreQuestion, passesQualityGate } from '../lib/questionQuality';

describe('questionQuality', () => {
  describe('scoreQuestion', () => {
    it('awards +10 for clinical vignette (≥20 chars)', () => {
      const q = {
        id: '1',
        questionData: {
          vignette: 'A 45-year-old male with fatigue. Labs: Hgb 9.2.',
          explanation: 'x'.repeat(50).split('').join(' '),
        },
      };
      expect(scoreQuestion(q)).toBeGreaterThanOrEqual(10);
    });

    it('awards +10 for explanation length ≥30 words', () => {
      const words = Array(35).fill('word').join(' ');
      const q = {
        id: '1',
        questionData: { explanation: words },
      };
      expect(scoreQuestion(q)).toBeGreaterThanOrEqual(10);
    });

    it('awards +15 for valid conditionId (contains __ or length ≥10)', () => {
      const q = {
        id: '1',
        conditionId: 'CV__cardio__heart_failure',
        questionData: {},
      };
      expect(scoreQuestion(q)).toBe(15);
    });

    it('awards +10 for accuracy in 30–80%', () => {
      const q = {
        id: '1',
        conditionAccuracy: 0.5,
        questionData: {},
      };
      expect(scoreQuestion(q)).toBe(10);
    });

    it('applies -20 penalty for flag rate > 0.1', () => {
      const q = {
        id: '1',
        conditionId: 'CV__x',
        questionData: {
          vignette: 'A 50-year-old presents with chest pain.',
          explanation: Array(35).fill('word').join(' '),
        },
        conditionAccuracy: 0.5,
        flagRate: 0.15,
      };
      const score = scoreQuestion(q);
      expect(score).toBeLessThan(55);
      expect(score).toBe(25); // 10+10+15+10-20
    });

    it('clamps score to 0–100', () => {
      expect(scoreQuestion({ id: '1', questionData: {} })).toBe(0);
      const high = {
        id: '1',
        conditionId: 'CV__cardio__chf',
        questionData: {
          vignette: 'A 50-year-old with heart failure presents with dyspnea.',
          rationale: { whyCorrect: Array(40).fill('word').join(' ') },
        },
        conditionAccuracy: 0.6,
      };
      expect(scoreQuestion(high)).toBeLessThanOrEqual(100);
    });
  });

  describe('passesQualityGate', () => {
    it('returns true when score >= threshold', () => {
      const q = {
        id: '1',
        conditionId: 'CV__x',
        questionData: {
          vignette: 'A 50-year-old with chest pain.',
          explanation: Array(35).fill('word').join(' '),
        },
        conditionAccuracy: 0.5,
      };
      expect(passesQualityGate(q, 40)).toBe(true);
    });

    it('returns false when score < threshold', () => {
      const q = { id: '1', questionData: {} };
      expect(passesQualityGate(q, 70)).toBe(false);
    });
  });
});
