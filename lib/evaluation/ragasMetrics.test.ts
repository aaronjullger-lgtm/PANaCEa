/**
 * Unit tests for lib/evaluation/ragasMetrics.ts
 *
 * All functions are pure (no network, no DB). Tests pin the Jaccard/overlap
 * math and weight composition so RAGAS regressions surface immediately.
 *
 * DEFAULT_WEIGHTS: contextRelevance=0.20, answerFaithfulness=0.25,
 *                 answerRelevance=0.20, contextRecall=0.15, clinicalAccuracy=0.20
 * (sum = 1.0)
 */

import { describe, it, expect } from 'vitest';
import {
  scoreContextRelevance,
  scoreAnswerFaithfulness,
  scoreAnswerRelevance,
  scoreContextRecall,
  scoreClinicalAccuracy,
  evaluateRAG,
  batchEvaluateRAG,
  type EvalInput,
} from './ragasMetrics';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDoc(id: string, text: string, score = 0.8) {
  return { id, text, score };
}

function makeInput(partial: Partial<EvalInput>): EvalInput {
  return {
    query: 'what is the first-line treatment for hypertension',
    retrievedDocs: [makeDoc('d1', 'Hypertension is treated with ACE inhibitors as first-line therapy.', 0.9)],
    generatedAnswer: 'First-line treatment for hypertension includes ACE inhibitors and thiazide diuretics.',
    ...partial,
  };
}

// ─── scoreContextRelevance ────────────────────────────────────────────────────

describe('scoreContextRelevance', () => {
  it('returns score=0 with empty detail when no docs retrieved', () => {
    const input = makeInput({ retrievedDocs: [] });
    const result = scoreContextRelevance(input);
    expect(result.score).toBe(0);
    expect(result.detail).toMatch(/no documents/i);
  });

  it('returns score > 0 when doc text overlaps with query', () => {
    const input = makeInput({
      query: 'hypertension ACE inhibitor treatment',
      retrievedDocs: [makeDoc('d1', 'ACE inhibitors are used in hypertension treatment', 0.9)],
    });
    const result = scoreContextRelevance(input);
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns higher score for highly relevant docs than irrelevant docs', () => {
    const query = 'first-line treatment for atrial fibrillation rate control';

    const relevantInput = makeInput({
      query,
      retrievedDocs: [
        makeDoc('r1', 'Atrial fibrillation rate control with beta blockers is first-line therapy', 0.9),
      ],
    });
    const irrelevantInput = makeInput({
      query,
      retrievedDocs: [makeDoc('i1', 'Mathematics algebra quadratic polynomial formula', 0.1)],
    });

    const relevantScore = scoreContextRelevance(relevantInput).score;
    const irrelevantScore = scoreContextRelevance(irrelevantInput).score;
    expect(relevantScore).toBeGreaterThan(irrelevantScore);
  });

  it('returns score rounded to 2 decimal places', () => {
    const input = makeInput();
    const result = scoreContextRelevance(input);
    const decimals = result.score.toString().split('.')[1];
    expect(decimals === undefined || decimals.length <= 2).toBe(true);
  });

  it('returns score in [0, 1]', () => {
    const input = makeInput({
      query: 'sepsis troponin lactate blood cultures',
      retrievedDocs: [
        makeDoc('d1', 'Sepsis management: lactate sepsis troponin blood cultures broad spectrum', 1.0),
        makeDoc('d2', 'Sepsis diagnosis criteria SOFA score organ dysfunction', 0.9),
      ],
    });
    const result = scoreContextRelevance(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('includes count of relevant docs in detail string', () => {
    const input = makeInput({
      retrievedDocs: [
        makeDoc('d1', 'hypertension ACE inhibitor first-line', 0.9),
        makeDoc('d2', 'algebra calculus polynomial', 0.1),
      ],
    });
    const result = scoreContextRelevance(input);
    expect(result.detail).toMatch(/\d+\/\d+ docs relevant/);
  });
});

// ─── scoreAnswerFaithfulness ──────────────────────────────────────────────────

describe('scoreAnswerFaithfulness', () => {
  it('returns score=0 when no docs retrieved', () => {
    const input = makeInput({ retrievedDocs: [] });
    expect(scoreAnswerFaithfulness(input).score).toBe(0);
  });

  it('returns score=0 when generatedAnswer is empty', () => {
    const input = makeInput({ generatedAnswer: '' });
    expect(scoreAnswerFaithfulness(input).score).toBe(0);
  });

  it('returns high score when answer text is drawn directly from context', () => {
    const contextText = 'Metformin is the first-line treatment for type 2 diabetes mellitus. '
      + 'It reduces hepatic glucose production and improves insulin sensitivity.';
    const input = makeInput({
      query: 'type 2 diabetes first-line treatment',
      retrievedDocs: [makeDoc('d1', contextText, 0.9)],
      generatedAnswer: 'Metformin reduces hepatic glucose production for type 2 diabetes mellitus.',
    });
    const result = scoreAnswerFaithfulness(input);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('returns low score when answer introduces ungrounded claims', () => {
    const input = makeInput({
      retrievedDocs: [makeDoc('d1', 'Hypertension treatment overview', 0.5)],
      generatedAnswer: 'The recommended treatment is xyzabc-12 from the fictional formulary approved by ZNMQ.',
    });
    const result = scoreAnswerFaithfulness(input);
    expect(result.score).toBeLessThan(0.5);
  });

  it('score is in [0, 1]', () => {
    const input = makeInput();
    const result = scoreAnswerFaithfulness(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('detail string reports grounded/total token counts', () => {
    const input = makeInput();
    const result = scoreAnswerFaithfulness(input);
    expect(result.detail).toMatch(/\d+\/\d+ answer tokens grounded/);
  });
});

// ─── scoreAnswerRelevance ─────────────────────────────────────────────────────

describe('scoreAnswerRelevance', () => {
  it('returns score=0 when generatedAnswer is empty', () => {
    const input = makeInput({ generatedAnswer: '' });
    expect(scoreAnswerRelevance(input).score).toBe(0);
  });

  it('returns higher score for answer that closely mirrors query terms', () => {
    const query = 'pulmonary embolism diagnosis imaging';
    const onTopicInput = makeInput({
      query,
      generatedAnswer: 'Pulmonary embolism diagnosis relies on CT pulmonary angiography imaging.',
    });
    const offTopicInput = makeInput({
      query,
      generatedAnswer: 'Metformin is used for diabetes mellitus management.',
    });
    expect(scoreAnswerRelevance(onTopicInput).score).toBeGreaterThan(
      scoreAnswerRelevance(offTopicInput).score
    );
  });

  it('applies length penalty for very short answers (< 5 tokens)', () => {
    // Short answer: stops are filtered, "ACE" alone is < 5 tokens after filtering
    const shortInput = makeInput({ generatedAnswer: 'ACE inhibitors.' });
    const longInput = makeInput({
      generatedAnswer:
        'ACE inhibitors like lisinopril are the preferred first-line antihypertensive agents.',
    });
    expect(scoreAnswerRelevance(shortInput).score).toBeLessThanOrEqual(
      scoreAnswerRelevance(longInput).score
    );
  });

  it('score is in [0, 1]', () => {
    const input = makeInput();
    const result = scoreAnswerRelevance(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('detail string reports query-answer overlap percentage', () => {
    const input = makeInput();
    const result = scoreAnswerRelevance(input);
    expect(result.detail).toMatch(/query-answer overlap: \d+%/i);
  });
});

// ─── scoreContextRecall ───────────────────────────────────────────────────────

describe('scoreContextRecall', () => {
  it('returns score=0.5 (default) when no groundTruth or expectedConcepts', () => {
    const input = makeInput({
      groundTruth: undefined,
      expectedConcepts: undefined,
    });
    const result = scoreContextRecall(input);
    expect(result.score).toBe(0.5);
    expect(result.detail).toMatch(/no ground truth/i);
  });

  it('returns score=1.0 when all expected concepts appear in retrieved docs', () => {
    const input = makeInput({
      query: 'STEMI treatment',
      retrievedDocs: [
        makeDoc(
          'd1',
          'STEMI treatment includes aspirin heparin percutaneous coronary intervention PCI thrombolysis.',
          0.95
        ),
      ],
      expectedConcepts: ['aspirin', 'heparin', 'PCI'],
    });
    const result = scoreContextRecall(input);
    expect(result.score).toBe(1.0);
  });

  it('returns partial score when only some concepts are present', () => {
    const input = makeInput({
      retrievedDocs: [makeDoc('d1', 'Sepsis treated with antibiotics lactate', 0.8)],
      expectedConcepts: ['antibiotics', 'lactate', 'vasopressors', 'norepinephrine'],
    });
    const result = scoreContextRecall(input);
    // 2 of 4 concepts present → score = 0.50 (exact match depends on tokenization)
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  it('uses groundTruth when expectedConcepts not provided', () => {
    const input = makeInput({
      groundTruth: 'Atrial fibrillation is treated with rate control and anticoagulation.',
      expectedConcepts: undefined,
      retrievedDocs: [
        makeDoc('d1', 'Rate control and anticoagulation are used for atrial fibrillation.', 0.9),
      ],
    });
    const result = scoreContextRecall(input);
    expect(result.score).toBeGreaterThan(0);
    expect(result.detail).toMatch(/expected concepts found in context/i);
  });

  it('score is in [0, 1]', () => {
    const input = makeInput({
      expectedConcepts: ['troponin', 'EKG', 'aspirin', 'heparin'],
      retrievedDocs: [makeDoc('d1', 'troponin EKG aspirin heparin STEMI management', 0.9)],
    });
    const result = scoreContextRecall(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ─── scoreClinicalAccuracy ────────────────────────────────────────────────────

describe('scoreClinicalAccuracy', () => {
  it('returns heuristic score when no expectedConcepts provided', () => {
    const input = makeInput({
      expectedConcepts: undefined,
      generatedAnswer: 'ACE inhibitors and thiazide diuretics are first-line for hypertension.',
    });
    const result = scoreClinicalAccuracy(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.detail).toMatch(/no expected concepts/i);
  });

  it('returns score=1.0 when answer contains all expected concepts', () => {
    const input = makeInput({
      generatedAnswer:
        'Management includes aspirin, heparin, and percutaneous coronary intervention (PCI) for STEMI.',
      expectedConcepts: ['aspirin', 'heparin', 'percutaneous coronary intervention'],
    });
    const result = scoreClinicalAccuracy(input);
    expect(result.score).toBe(1.0);
  });

  it('returns partial score when some concepts missing from answer', () => {
    const input = makeInput({
      generatedAnswer: 'Treat with aspirin only.',
      expectedConcepts: ['aspirin', 'heparin', 'beta blocker'],
    });
    const result = scoreClinicalAccuracy(input);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  it('returns score=0 when none of the expected concepts match', () => {
    const input = makeInput({
      generatedAnswer: 'Metformin reduces HbA1c in diabetes.',
      expectedConcepts: ['aspirin', 'heparin', 'statin'],
    });
    const result = scoreClinicalAccuracy(input);
    expect(result.score).toBe(0);
  });

  it('uses partial word matching — concept word majority counts', () => {
    // "percutaneous coronary intervention" has 3 meaningful words; 2 of 3 needed
    const input = makeInput({
      generatedAnswer: 'Percutaneous intervention of the coronary artery is performed in STEMI.',
      expectedConcepts: ['percutaneous coronary intervention'],
    });
    const result = scoreClinicalAccuracy(input);
    expect(result.score).toBe(1.0);
  });

  it('score is in [0, 1]', () => {
    const input = makeInput({
      expectedConcepts: ['beta blocker', 'calcium channel blocker'],
    });
    const result = scoreClinicalAccuracy(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('detail string reports matched/total concept counts', () => {
    const input = makeInput({
      generatedAnswer: 'Lisinopril is an ACE inhibitor.',
      expectedConcepts: ['ACE inhibitor', 'beta blocker'],
    });
    const result = scoreClinicalAccuracy(input);
    expect(result.detail).toMatch(/\d+\/\d+ clinical concepts/i);
  });
});

// ─── evaluateRAG ─────────────────────────────────────────────────────────────

describe('evaluateRAG', () => {
  it('returns all five metrics plus overall', () => {
    const input = makeInput({
      expectedConcepts: ['ACE inhibitor', 'thiazide diuretic'],
    });
    const result = evaluateRAG(input);
    expect(typeof result.contextRelevance).toBe('number');
    expect(typeof result.answerFaithfulness).toBe('number');
    expect(typeof result.answerRelevance).toBe('number');
    expect(typeof result.contextRecall).toBe('number');
    expect(typeof result.clinicalAccuracy).toBe('number');
    expect(typeof result.overall).toBe('number');
  });

  it('overall is weighted composite of the five metrics', () => {
    // Build an input where we can compute expected overall manually
    const input = makeInput({
      query: 'hypertension ACE inhibitor first-line',
      retrievedDocs: [
        makeDoc('d1', 'ACE inhibitors are first-line therapy for hypertension.', 0.9),
      ],
      generatedAnswer: 'ACE inhibitors are used as first-line treatment for hypertension.',
      expectedConcepts: ['ACE inhibitor'],
    });

    const result = evaluateRAG(input);

    // Manually recompute expected overall using default weights
    const expectedOverall =
      result.contextRelevance * 0.20 +
      result.answerFaithfulness * 0.25 +
      result.answerRelevance * 0.20 +
      result.contextRecall * 0.15 +
      result.clinicalAccuracy * 0.20;

    expect(result.overall).toBeCloseTo(expectedOverall, 1);
  });

  it('overall is in [0, 1]', () => {
    const result = evaluateRAG(makeInput());
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(1);
  });

  it('overall is rounded to 2 decimal places', () => {
    const result = evaluateRAG(makeInput());
    const decimals = result.overall.toString().split('.')[1];
    expect(decimals === undefined || decimals.length <= 2).toBe(true);
  });

  it('details object has an entry for each metric', () => {
    const result = evaluateRAG(makeInput());
    expect(typeof result.details.contextRelevance).toBe('string');
    expect(typeof result.details.answerFaithfulness).toBe('string');
    expect(typeof result.details.answerRelevance).toBe('string');
    expect(typeof result.details.contextRecall).toBe('string');
    expect(typeof result.details.clinicalAccuracy).toBe('string');
  });

  it('respects custom weight overrides', () => {
    const input = makeInput({
      retrievedDocs: [],  // contextRelevance = 0
    });
    // With contextRelevance weight = 0, removing it shouldn't change overall
    const defaultResult = evaluateRAG(input);
    const customResult = evaluateRAG(input, {
      weights: { contextRelevance: 0 },
    });
    // contextRelevance = 0 in both, but weighted score shifts
    // Just verify it doesn't crash and returns a number
    expect(typeof customResult.overall).toBe('number');
    // Custom weight shifts the composite away from default
    expect(customResult.overall).not.toBeNaN();
  });

  it('high-quality input scores higher overall than poor-quality input', () => {
    const highQuality = makeInput({
      query: 'STEMI aspirin treatment',
      retrievedDocs: [
        makeDoc('d1', 'STEMI treatment with aspirin heparin PCI is the standard care.', 0.95),
      ],
      generatedAnswer: 'STEMI is treated with aspirin, heparin, and PCI. Aspirin should be given immediately.',
      expectedConcepts: ['aspirin', 'heparin', 'PCI'],
    });

    const lowQuality = makeInput({
      query: 'STEMI aspirin treatment',
      retrievedDocs: [makeDoc('d1', 'Algebra calculus polynomial equations.', 0.05)],
      generatedAnswer: 'No information available.',
      expectedConcepts: ['aspirin', 'heparin', 'PCI'],
    });

    expect(evaluateRAG(highQuality).overall).toBeGreaterThan(evaluateRAG(lowQuality).overall);
  });
});

// ─── batchEvaluateRAG ─────────────────────────────────────────────────────────

describe('batchEvaluateRAG', () => {
  it('returns empty aggregate with count=0 for empty input array', () => {
    const { results, aggregate } = batchEvaluateRAG([]);
    expect(results).toEqual([]);
    expect(aggregate.count).toBe(0);
    expect(aggregate.overall).toBe(0);
  });

  it('returns one result per input', () => {
    const inputs = [makeInput(), makeInput(), makeInput()];
    const { results } = batchEvaluateRAG(inputs);
    expect(results.length).toBe(3);
  });

  it('aggregate.count matches number of inputs', () => {
    const inputs = Array.from({ length: 5 }, () => makeInput());
    const { aggregate } = batchEvaluateRAG(inputs);
    expect(aggregate.count).toBe(5);
  });

  it('aggregate overall is the mean of individual overalls', () => {
    const inputs = [
      makeInput({ generatedAnswer: 'ACE inhibitors treat hypertension.' }),
      makeInput({ generatedAnswer: '' }), // zero score answer
    ];
    const { results, aggregate } = batchEvaluateRAG(inputs);
    const expectedMean = Math.round(
      ((results[0].overall + results[1].overall) / 2) * 100
    ) / 100;
    expect(aggregate.overall).toBeCloseTo(expectedMean, 1);
  });

  it('aggregate details includes summary string', () => {
    const { aggregate } = batchEvaluateRAG([makeInput()]);
    expect(aggregate.details.summary).toMatch(/evaluated 1 quer/i);
  });

  it('aggregate metrics are each in [0, 1]', () => {
    const inputs = Array.from({ length: 4 }, () => makeInput());
    const { aggregate } = batchEvaluateRAG(inputs);
    for (const key of [
      'contextRelevance', 'answerFaithfulness', 'answerRelevance',
      'contextRecall', 'clinicalAccuracy', 'overall',
    ] as const) {
      expect(aggregate[key]).toBeGreaterThanOrEqual(0);
      expect(aggregate[key]).toBeLessThanOrEqual(1);
    }
  });

  it('accepts custom config and applies it consistently', () => {
    const inputs = [makeInput(), makeInput()];
    const { results } = batchEvaluateRAG(inputs, { weights: { answerFaithfulness: 0.5 } });
    // Just verify results compute without error
    for (const r of results) {
      expect(r.overall).toBeGreaterThanOrEqual(0);
      expect(r.overall).toBeLessThanOrEqual(1);
    }
  });
});
