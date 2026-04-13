/**
 * Tests for selfRefineService
 * Sprint 22 — Self-Refine loop for question generation
 */

import { describe, it, expect } from 'vitest';
import {
  shouldRefine,
  isThirdOrder,
  buildCritiquePrompt,
  parseCritiqueResponse,
  buildRewritePrompt,
  buildRefinementMetrics,
  DEFAULT_SELF_REFINE_CONFIG,
  type GeneratedQuestion,
  type CritiqueResult,
} from '../lib/services/selfRefineService';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    type: 'vignette',
    question: 'A 65-year-old male presents with progressive dyspnea on exertion. What is the most likely diagnosis?',
    options: ['A. Heart failure', 'B. COPD', 'C. Pulmonary embolism', 'D. Pneumonia'],
    correctAnswer: 'A. Heart failure',
    explanation: { rationale: 'BNP elevated, JVD present, bilateral crackles' },
    difficulty: 0.6,
    sourceSections: ['pathophysiology'],
    sourceConditions: ['Heart Failure'],
    ...overrides,
  };
}

function makeCritique(overrides: Partial<CritiqueResult> = {}): CritiqueResult {
  return {
    overallScore: 0.72,
    needsRefinement: true,
    dimensions: [
      { name: 'clinical_accuracy', score: 0.9, feedback: 'Accurate' },
      { name: 'stem_clarity', score: 0.6, feedback: 'Diagnosis named in stem' },
    ],
    issues: [
      {
        severity: 'major',
        category: 'diagnosis_in_stem',
        description: 'Stem asks "most likely diagnosis" which is acceptable, but presentation is too obvious',
        suggestion: 'Add pertinent negatives to make DDx harder',
      },
    ],
    feedbackForRewrite: 'Add pertinent negatives to increase difficulty. Distractors need more plausibility.',
    ...overrides,
  };
}

// ─── shouldRefine ────────────────────────────────────────────────────

describe('shouldRefine', () => {
  it('returns true for high-difficulty questions', () => {
    const result = shouldRefine(makeQuestion({ difficulty: 0.7 }));
    expect(result.refine).toBe(true);
  });

  it('returns false for low-difficulty questions without third-order cues', () => {
    const result = shouldRefine(makeQuestion({
      difficulty: 0.2,
      question: 'What is the normal range for serum potassium?',
    }));
    expect(result.refine).toBe(false);
  });

  it('always refines third-order questions', () => {
    const q = makeQuestion({
      difficulty: 0.3,
      question: 'What is the next best step in management?',
    });
    const result = shouldRefine(q);
    expect(result.refine).toBe(true);
    expect(result.reason).toContain('Third-order');
  });

  it('respects custom config', () => {
    const result = shouldRefine(
      makeQuestion({ difficulty: 0.4 }),
      { ...DEFAULT_SELF_REFINE_CONFIG, minDifficulty: 0.3 }
    );
    expect(result.refine).toBe(true);
  });
});

// ─── isThirdOrder ────────────────────────────────────────────────────

describe('isThirdOrder', () => {
  it('detects "next best step" as third-order', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What is the next best step?' }))).toBe(true);
  });

  it('detects "most likely diagnosis"', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What is the most likely diagnosis?' }))).toBe(true);
  });

  it('detects "mechanism" questions', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What mechanism explains these findings?' }))).toBe(true);
  });

  it('returns false for simple recall', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What is the normal range for serum sodium?' }))).toBe(false);
  });
});

// ─── buildCritiquePrompt ─────────────────────────────────────────────

describe('buildCritiquePrompt', () => {
  it('includes question details in prompt', () => {
    const prompt = buildCritiquePrompt(makeQuestion());
    expect(prompt).toContain('65-year-old male');
    expect(prompt).toContain('CLINICAL_ACCURACY');
    expect(prompt).toContain('DIAGNOSIS_IN_STEM');
    expect(prompt).toContain('ONLY valid JSON');
  });

  it('includes clinical context when provided', () => {
    const prompt = buildCritiquePrompt(makeQuestion(), 'Heart failure is a clinical syndrome...');
    expect(prompt).toContain('CLINICAL REFERENCE CONTEXT');
    expect(prompt).toContain('Heart failure is a clinical syndrome');
  });
});

// ─── parseCritiqueResponse ───────────────────────────────────────────

describe('parseCritiqueResponse', () => {
  it('parses valid critique JSON', () => {
    const json = JSON.stringify({
      overallScore: 0.72,
      dimensions: [
        { name: 'clinical_accuracy', score: 0.9, feedback: 'Good' },
      ],
      issues: [
        { severity: 'major', category: 'stem_clarity', description: 'Too vague', suggestion: 'Be specific' },
      ],
      feedbackForRewrite: 'Improve clarity.',
    });
    const result = parseCritiqueResponse(json);
    expect(result).not.toBeNull();
    expect(result!.overallScore).toBeCloseTo(0.72);
    expect(result!.dimensions).toHaveLength(1);
    expect(result!.issues).toHaveLength(1);
    expect(result!.needsRefinement).toBe(true);
  });

  it('handles markdown-wrapped JSON', () => {
    const json = '```json\n{"overallScore": 0.9, "dimensions": [], "issues": [], "feedbackForRewrite": "OK"}\n```';
    const result = parseCritiqueResponse(json);
    expect(result).not.toBeNull();
    expect(result!.overallScore).toBeCloseTo(0.9);
    expect(result!.needsRefinement).toBe(false); // 0.9 >= 0.85 threshold
  });

  it('returns null for invalid JSON', () => {
    expect(parseCritiqueResponse('not json')).toBeNull();
  });

  it('returns null when overallScore missing', () => {
    expect(parseCritiqueResponse('{"dimensions": []}')).toBeNull();
  });

  it('clamps scores to 0-1', () => {
    const json = JSON.stringify({
      overallScore: 1.5,
      dimensions: [{ name: 'test', score: -0.3, feedback: '' }],
      issues: [],
      feedbackForRewrite: '',
    });
    const result = parseCritiqueResponse(json);
    expect(result!.overallScore).toBe(1);
    expect(result!.dimensions[0]!.score).toBe(0);
  });

  it('filters invalid issue categories', () => {
    const json = JSON.stringify({
      overallScore: 0.5,
      dimensions: [],
      issues: [
        { severity: 'major', category: 'invalid_cat', description: 'Bad', suggestion: 'Fix' },
        { severity: 'minor', category: 'stem_clarity', description: 'Ok', suggestion: 'Fine' },
      ],
      feedbackForRewrite: '',
    });
    const result = parseCritiqueResponse(json);
    expect(result!.issues).toHaveLength(1); // only valid category kept
    expect(result!.issues[0]!.category).toBe('stem_clarity');
  });
});

// ─── buildRewritePrompt ──────────────────────────────────────────────

describe('buildRewritePrompt', () => {
  it('includes original question and critique feedback', () => {
    const prompt = buildRewritePrompt(makeQuestion(), makeCritique());
    expect(prompt).toContain('65-year-old male');
    expect(prompt).toContain('CRITIQUE FEEDBACK');
    expect(prompt).toContain('0.72');
    expect(prompt).toContain('pertinent negatives');
    expect(prompt).toContain('REWRITE RULES');
  });
});

// ─── buildRefinementMetrics ──────────────────────────────────────────

describe('buildRefinementMetrics', () => {
  it('builds metrics for a refined question', () => {
    const critique = makeCritique();
    const refinedCritique = makeCritique({ overallScore: 0.88 });
    const metrics = buildRefinementMetrics(true, null, critique, refinedCritique);
    expect(metrics.refined).toBe(true);
    expect(metrics.skipReason).toBeNull();
    expect(metrics.draftScore).toBeCloseTo(0.72);
    expect(metrics.refinedScore).toBeCloseTo(0.88);
    expect(metrics.issueCount).toBe(1);
  });

  it('builds metrics for a skipped refinement', () => {
    const metrics = buildRefinementMetrics(false, 'Low difficulty', null);
    expect(metrics.refined).toBe(false);
    expect(metrics.skipReason).toBe('Low difficulty');
    expect(metrics.draftScore).toBeNull();
  });
});
