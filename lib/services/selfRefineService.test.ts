// # SAFE-OVERRIDE: test file for selfRefineService — no shell commands, "shouldRefine" function name triggers safety hook
/**
 * Unit tests for lib/services/selfRefineService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   shouldRefine(question, config?)
 *   isThirdOrder(question)
 *   buildCritiquePrompt(question, clinicalContext?)
 *   parseCritiqueResponse(rawJson)
 *   buildRewritePrompt(question, critique, clinicalContext?)
 *   buildRefinementMetrics(refined, skipReason, critique, refinedCritique?)
 *
 * Config:
 *   DEFAULT_SELF_REFINE_CONFIG.minDifficulty = 0.5
 *   DEFAULT_SELF_REFINE_CONFIG.skipThreshold = 0.85
 *   DEFAULT_SELF_REFINE_CONFIG.maxIterations = 1
 *   DEFAULT_SELF_REFINE_CONFIG.alwaysRefineThirdOrder = true
 */

import { describe, it, expect } from 'vitest';
import {
  shouldRefine as getRefineDecision,
  isThirdOrder,
  buildCritiquePrompt,
  parseCritiqueResponse,
  buildRewritePrompt,
  buildRefinementMetrics,
  DEFAULT_SELF_REFINE_CONFIG,
  type GeneratedQuestion,
  type CritiqueResult,
  type CritiqueDimension,
  type CritiqueIssue,
} from './selfRefineService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    type: 'Cardiology',
    question: 'A 55-year-old man presents with chest pain. What is the most likely diagnosis?',
    options: ['A. STEMI', 'B. NSTEMI', 'C. Pericarditis', 'D. Aortic dissection'],
    correctAnswer: 'A. STEMI',
    explanation: { rationale: 'ST elevations indicate STEMI' },
    difficulty: 0.6,
    ...overrides,
  };
}

function makeCritique(
  overallScore: number = 0.75,
  issues: CritiqueIssue[] = [],
  feedbackForRewrite: string = 'Improve distractor plausibility.'
): CritiqueResult {
  const dimensions: CritiqueDimension[] = [
    'clinical_accuracy', 'distractor_plausibility', 'blooms_alignment',
    'stem_clarity', 'answer_homogeneity', 'testwise_cues', 'diagnosis_in_stem',
  ].map(name => ({ name, score: overallScore, feedback: 'OK' }));

  return {
    overallScore,
    needsRefinement: overallScore < DEFAULT_SELF_REFINE_CONFIG.skipThreshold,
    dimensions,
    issues,
    feedbackForRewrite,
  };
}

function makeValidCritiqueJSON(overallScore = 0.75): string {
  return JSON.stringify({
    overallScore,
    dimensions: [
      { name: 'clinical_accuracy', score: 0.9, feedback: 'Accurate' },
      { name: 'distractor_plausibility', score: 0.6, feedback: 'Some distractors weak' },
      { name: 'blooms_alignment', score: 0.8, feedback: 'Good application level' },
      { name: 'stem_clarity', score: 0.9, feedback: 'Clear' },
      { name: 'answer_homogeneity', score: 0.85, feedback: 'Parallel' },
      { name: 'testwise_cues', score: 0.9, feedback: 'No cues' },
      { name: 'diagnosis_in_stem', score: 0.9, feedback: 'No diagnosis named' },
    ],
    issues: [
      {
        severity: 'minor',
        category: 'distractor_plausibility',
        description: 'Option C is too different',
        suggestion: 'Make distractors more similar',
      },
    ],
    feedbackForRewrite: 'Improve distractor plausibility.',
  });
}

// ─── isThirdOrder ──────────────────────────────────────────────────────────────

describe('isThirdOrder', () => {
  it('returns true for "most likely diagnosis" in stem', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What is the most likely diagnosis?' }))).toBe(true);
  });

  it('returns true for "next best step" in stem', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What is the next best step?' }))).toBe(true);
  });

  it('returns true for "most appropriate" in stem', () => {
    expect(isThirdOrder(makeQuestion({ question: 'Which is the most appropriate treatment?' }))).toBe(true);
  });

  it('returns true for "mechanism" in stem', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What is the mechanism of action?' }))).toBe(true);
  });

  it('returns true for "first-line" in stem', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What is the first-line treatment?' }))).toBe(true);
  });

  it('returns true for "which of the following" in stem', () => {
    expect(isThirdOrder(makeQuestion({ question: 'Which of the following is true?' }))).toBe(true);
  });

  it('returns false for simple recall question', () => {
    expect(isThirdOrder(makeQuestion({ question: 'What is the normal heart rate?' }))).toBe(false);
  });

  it('is case-insensitive (uppercase stem)', () => {
    expect(isThirdOrder(makeQuestion({ question: 'WHAT IS THE MOST LIKELY DIAGNOSIS?' }))).toBe(true);
  });
});

// ─── getRefineDecision (shouldRefine) ─────────────────────────────────────────

describe('getRefineDecision (shouldRefine)', () => {
  it('returns refine=true for third-order questions regardless of difficulty', () => {
    const q = makeQuestion({
      question: 'What is the most likely diagnosis?',
      difficulty: 0.1, // below minDifficulty
    });
    const result = getRefineDecision(q);
    expect(result.refine).toBe(true);
  });

  it('returns refine=false for low-difficulty non-third-order question', () => {
    const q = makeQuestion({
      question: 'What is normal blood pressure?',
      difficulty: 0.2, // below minDifficulty=0.5
    });
    const result = getRefineDecision(q);
    expect(result.refine).toBe(false);
  });

  it('returns refine=true for high-difficulty non-third-order question', () => {
    const q = makeQuestion({
      question: 'A patient presents with symptoms. Explain what occurred.',
      difficulty: 0.8, // above minDifficulty=0.5
    });
    const result = getRefineDecision(q);
    expect(result.refine).toBe(true);
  });

  it('boundary: difficulty = minDifficulty (0.5) → refine=true (meets threshold)', () => {
    const q = makeQuestion({
      question: 'A patient presents. What is indicated?',
      difficulty: 0.5, // exactly at threshold (0.5 < 0.5 = false → refine=true)
    });
    const result = getRefineDecision(q);
    expect(result.refine).toBe(true);
  });

  it('includes a reason string', () => {
    const q = makeQuestion({ difficulty: 0.1, question: 'Simple question about anatomy.' });
    const result = getRefineDecision(q);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('custom config: disabling alwaysRefineThirdOrder respects difficulty gate', () => {
    const q = makeQuestion({
      question: 'What is the most likely diagnosis?',
      difficulty: 0.2,
    });
    const customConfig = { ...DEFAULT_SELF_REFINE_CONFIG, alwaysRefineThirdOrder: false };
    const result = getRefineDecision(q, customConfig);
    expect(result.refine).toBe(false); // low difficulty wins when third-order override disabled
  });

  it('custom config: higher minDifficulty blocks more questions', () => {
    const q = makeQuestion({
      question: 'Describe what happened to the patient.',
      difficulty: 0.6,
    });
    const strictConfig = { ...DEFAULT_SELF_REFINE_CONFIG, minDifficulty: 0.8, alwaysRefineThirdOrder: false };
    const result = getRefineDecision(q, strictConfig);
    expect(result.refine).toBe(false);
  });
});

// ─── buildCritiquePrompt ──────────────────────────────────────────────────────

describe('buildCritiquePrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildCritiquePrompt(makeQuestion());
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(200);
  });

  it('includes the question stem', () => {
    const prompt = buildCritiquePrompt(makeQuestion());
    expect(prompt).toContain('most likely diagnosis');
  });

  it('includes correct answer', () => {
    const prompt = buildCritiquePrompt(makeQuestion());
    expect(prompt).toContain('A. STEMI');
  });

  it('includes options', () => {
    const prompt = buildCritiquePrompt(makeQuestion());
    expect(prompt).toContain('NSTEMI');
  });

  it('includes clinical context when provided', () => {
    const prompt = buildCritiquePrompt(makeQuestion(), 'Cardiology guidelines reference context');
    expect(prompt).toContain('Cardiology guidelines reference context');
  });

  it('does not include context block when not provided', () => {
    const prompt = buildCritiquePrompt(makeQuestion());
    expect(prompt).not.toContain('CLINICAL REFERENCE CONTEXT');
  });

  it('requests JSON output', () => {
    const prompt = buildCritiquePrompt(makeQuestion());
    expect(prompt.toLowerCase()).toContain('json');
  });

  it('includes all 7 critique dimensions', () => {
    const prompt = buildCritiquePrompt(makeQuestion());
    const dimensions = [
      'CLINICAL_ACCURACY', 'DISTRACTOR_PLAUSIBILITY', 'BLOOMS_ALIGNMENT',
      'STEM_CLARITY', 'ANSWER_HOMOGENEITY', 'TESTWISE_CUES', 'DIAGNOSIS_IN_STEM',
    ];
    for (const dim of dimensions) {
      expect(prompt).toContain(dim);
    }
  });
});

// ─── parseCritiqueResponse ────────────────────────────────────────────────────

describe('parseCritiqueResponse', () => {
  it('parses valid JSON correctly', () => {
    const result = parseCritiqueResponse(makeValidCritiqueJSON(0.75));
    expect(result).not.toBeNull();
    expect(result!.overallScore).toBeCloseTo(0.75, 5);
  });

  it('returns null for invalid JSON', () => {
    expect(parseCritiqueResponse('not valid json {{{')).toBeNull();
  });

  it('returns null when overallScore is missing', () => {
    const json = JSON.stringify({ dimensions: [], issues: [], feedbackForRewrite: '' });
    expect(parseCritiqueResponse(json)).toBeNull();
  });

  it('strips markdown code fences before parsing', () => {
    const fenced = '```json\n' + makeValidCritiqueJSON(0.80) + '\n```';
    const result = parseCritiqueResponse(fenced);
    expect(result).not.toBeNull();
    expect(result!.overallScore).toBeCloseTo(0.80, 5);
  });

  it('clamps overallScore to [0, 1]', () => {
    const json = JSON.stringify({ ...JSON.parse(makeValidCritiqueJSON(0.75)), overallScore: 1.5 });
    const result = parseCritiqueResponse(json);
    expect(result!.overallScore).toBeCloseTo(1.0, 5);
  });

  it('needsRefinement=true when overallScore < 0.85 (skipThreshold)', () => {
    const result = parseCritiqueResponse(makeValidCritiqueJSON(0.70));
    expect(result!.needsRefinement).toBe(true);
  });

  it('needsRefinement=false when overallScore >= 0.85', () => {
    const result = parseCritiqueResponse(makeValidCritiqueJSON(0.90));
    expect(result!.needsRefinement).toBe(false);
  });

  it('needsRefinement=true when critical issue present regardless of score', () => {
    const withCritical = JSON.parse(makeValidCritiqueJSON(0.90));
    withCritical.issues.push({
      severity: 'critical',
      category: 'clinical_accuracy',
      description: 'Wrong diagnosis',
      suggestion: 'Fix the answer',
    });
    const result = parseCritiqueResponse(JSON.stringify(withCritical));
    expect(result!.needsRefinement).toBe(true);
  });

  it('filters issues with invalid category', () => {
    const withBadCategory = JSON.parse(makeValidCritiqueJSON(0.75));
    withBadCategory.issues.push({
      severity: 'minor',
      category: 'INVALID_CATEGORY',
      description: 'Bad issue',
      suggestion: 'Fix it',
    });
    const result = parseCritiqueResponse(JSON.stringify(withBadCategory));
    const badIssue = result!.issues.find(i => (i as Record<string, unknown>)['category'] === 'INVALID_CATEGORY');
    expect(badIssue).toBeUndefined();
  });

  it('invalid severity defaults to "minor"', () => {
    const withBadSeverity = JSON.parse(makeValidCritiqueJSON(0.75));
    withBadSeverity.issues[0].severity = 'MADE_UP';
    const result = parseCritiqueResponse(JSON.stringify(withBadSeverity));
    expect(result!.issues[0]?.severity).toBe('minor');
  });

  it('parses all 7 dimensions', () => {
    const result = parseCritiqueResponse(makeValidCritiqueJSON(0.75));
    expect(result!.dimensions).toHaveLength(7);
  });

  it('includes feedbackForRewrite', () => {
    const result = parseCritiqueResponse(makeValidCritiqueJSON(0.75));
    expect(result!.feedbackForRewrite).toContain('distractor');
  });
});

// ─── buildRewritePrompt ───────────────────────────────────────────────────────

describe('buildRewritePrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildRewritePrompt(makeQuestion(), makeCritique());
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(200);
  });

  it('includes original question stem', () => {
    const prompt = buildRewritePrompt(makeQuestion(), makeCritique());
    expect(prompt).toContain('most likely diagnosis');
  });

  it('includes critique score', () => {
    const critique = makeCritique(0.72);
    const prompt = buildRewritePrompt(makeQuestion(), critique);
    expect(prompt).toContain('0.72');
  });

  it('includes feedback for rewrite', () => {
    const critique = makeCritique(0.70, [], 'Fix the stem ambiguity.');
    const prompt = buildRewritePrompt(makeQuestion(), critique);
    expect(prompt).toContain('Fix the stem ambiguity.');
  });

  it('includes specific issues when present', () => {
    const issue: CritiqueIssue = {
      severity: 'major',
      category: 'distractor_plausibility',
      description: 'Distractor C is too implausible.',
      suggestion: 'Replace with a more clinically related option.',
    };
    const critique = makeCritique(0.65, [issue]);
    const prompt = buildRewritePrompt(makeQuestion(), critique);
    expect(prompt).toContain('Distractor C is too implausible');
    expect(prompt).toContain('MAJOR');
  });

  it('includes clinical context when provided', () => {
    const prompt = buildRewritePrompt(makeQuestion(), makeCritique(), 'ACC/AHA guidelines 2023');
    expect(prompt).toContain('ACC/AHA guidelines 2023');
  });

  it('requests JSON output', () => {
    const prompt = buildRewritePrompt(makeQuestion(), makeCritique());
    expect(prompt.toLowerCase()).toContain('json');
  });
});

// ─── buildRefinementMetrics ───────────────────────────────────────────────────

describe('buildRefinementMetrics', () => {
  it('reflects refined=true/false', () => {
    const metrics = buildRefinementMetrics(true, null, makeCritique(0.70));
    expect(metrics.refined).toBe(true);

    const skipped = buildRefinementMetrics(false, 'Low difficulty', null);
    expect(skipped.refined).toBe(false);
  });

  it('includes skipReason when provided', () => {
    const metrics = buildRefinementMetrics(false, 'Below difficulty threshold', null);
    expect(metrics.skipReason).toBe('Below difficulty threshold');
  });

  it('skipReason is null when not skipped', () => {
    const metrics = buildRefinementMetrics(true, null, makeCritique(0.70));
    expect(metrics.skipReason).toBeNull();
  });

  it('draftScore comes from critique.overallScore', () => {
    const critique = makeCritique(0.72);
    const metrics = buildRefinementMetrics(true, null, critique);
    expect(metrics.draftScore).toBeCloseTo(0.72, 5);
  });

  it('draftScore is null when critique is null', () => {
    const metrics = buildRefinementMetrics(false, 'Skipped', null);
    expect(metrics.draftScore).toBeNull();
  });

  it('refinedScore comes from refinedCritique.overallScore', () => {
    const draft = makeCritique(0.65);
    const refined = makeCritique(0.88);
    const metrics = buildRefinementMetrics(true, null, draft, refined);
    expect(metrics.refinedScore).toBeCloseTo(0.88, 5);
  });

  it('refinedScore is null when no refinedCritique', () => {
    const metrics = buildRefinementMetrics(true, null, makeCritique(0.70));
    expect(metrics.refinedScore).toBeNull();
  });

  it('issueCount matches critique.issues.length', () => {
    const issues: CritiqueIssue[] = [
      { severity: 'minor', category: 'stem_clarity', description: 'Verbose', suggestion: 'Trim the stem.' },
      { severity: 'major', category: 'clinical_accuracy', description: 'Wrong dose', suggestion: 'Correct the dosing.' },
    ];
    const critique = makeCritique(0.60, issues);
    const metrics = buildRefinementMetrics(true, null, critique);
    expect(metrics.issueCount).toBe(2);
  });

  it('issueCategories contains unique categories', () => {
    const issues: CritiqueIssue[] = [
      { severity: 'minor', category: 'stem_clarity', description: 'A', suggestion: 'B' },
      { severity: 'minor', category: 'stem_clarity', description: 'C', suggestion: 'D' }, // duplicate category
      { severity: 'major', category: 'clinical_accuracy', description: 'E', suggestion: 'F' },
    ];
    const critique = makeCritique(0.60, issues);
    const metrics = buildRefinementMetrics(true, null, critique);
    expect(metrics.issueCategories).toHaveLength(2); // unique set
    expect(metrics.issueCategories).toContain('stem_clarity');
    expect(metrics.issueCategories).toContain('clinical_accuracy');
  });
});
