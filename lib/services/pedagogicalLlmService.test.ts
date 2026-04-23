// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/pedagogicalLlmService.ts
 *
 * Pure functions tested:
 *   buildPartsFramework          — PARTS framework object from feature + learner
 *   buildPedagogicalPrompt       — full prompt string from feature + learner
 *   getModelRecommendation       — lookup in MODEL_ROUTING constant
 *   estimateInteractionCost      — token cost calculation
 *   evaluatePedagogicalQuality   — heuristic pedagogical quality scorer
 *
 * Constants verified:
 *   LEARNLM_DIRECTIVES, FEATURE_PERSONAS, MODEL_ROUTING
 */

import { describe, it, expect } from 'vitest';
import {
  buildPartsFramework,
  buildPedagogicalPrompt,
  getModelRecommendation,
  estimateInteractionCost,
  evaluatePedagogicalQuality,
  LEARNLM_DIRECTIVES,
  FEATURE_PERSONAS,
  MODEL_ROUTING,
  type LearnerContext,
  type PedagogicalFeature,
} from './pedagogicalLlmService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLearner(overrides: Partial<LearnerContext> = {}): LearnerContext {
  return {
    topic: 'Hypertension',
    retrievability: 0.7,
    organSystem: 'Cardiology',
    ...overrides,
  };
}

const ALL_FEATURES: PedagogicalFeature[] = [
  'socratic_tutor',
  'mnemonic_generator',
  'confusion_explainer',
  'question_generator',
  'osce_simulator',
  'content_enrichment',
  'general_tutor',
];

// ─── LEARNLM_DIRECTIVES ───────────────────────────────────────────────────────

describe('LEARNLM_DIRECTIVES', () => {
  it('has exactly 5 principle keys', () => {
    expect(Object.keys(LEARNLM_DIRECTIVES)).toHaveLength(5);
  });

  it('every principle is a non-empty string', () => {
    for (const val of Object.values(LEARNLM_DIRECTIVES)) {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    }
  });
});

// ─── FEATURE_PERSONAS ─────────────────────────────────────────────────────────

describe('FEATURE_PERSONAS', () => {
  it('has a persona for every PedagogicalFeature', () => {
    for (const feature of ALL_FEATURES) {
      expect(typeof FEATURE_PERSONAS[feature]).toBe('string');
      expect(FEATURE_PERSONAS[feature].length).toBeGreaterThan(0);
    }
  });
});

// ─── MODEL_ROUTING ────────────────────────────────────────────────────────────

describe('MODEL_ROUTING', () => {
  it('has an entry for every PedagogicalFeature', () => {
    for (const feature of ALL_FEATURES) {
      expect(MODEL_ROUTING[feature]).toBeDefined();
    }
  });

  it('every entry has required fields', () => {
    for (const feature of ALL_FEATURES) {
      const rec = MODEL_ROUTING[feature];
      expect(typeof rec.model).toBe('string');
      expect(typeof rec.maxOutputTokens).toBe('number');
      expect(typeof rec.temperature).toBe('number');
      expect(typeof rec.estimatedCostUsd).toBe('number');
      expect(typeof rec.useExtendedThinking).toBe('boolean');
    }
  });

  it('temperature is in [0, 1] for all features', () => {
    for (const feature of ALL_FEATURES) {
      expect(MODEL_ROUTING[feature].temperature).toBeGreaterThanOrEqual(0);
      expect(MODEL_ROUTING[feature].temperature).toBeLessThanOrEqual(1);
    }
  });

  it('question_generator uses extended thinking', () => {
    expect(MODEL_ROUTING.question_generator.useExtendedThinking).toBe(true);
  });
});

// ─── buildPartsFramework ─────────────────────────────────────────────────────

describe('buildPartsFramework', () => {
  it('returns an object with all five PARTS keys', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner());
    expect(typeof parts.persona).toBe('string');
    expect(typeof parts.act).toBe('string');
    expect(typeof parts.recipient).toBe('string');
    expect(typeof parts.theme).toBe('string');
    expect(typeof parts.structure).toBe('string');
  });

  it('persona starts with [PERSONA] prefix', () => {
    const parts = buildPartsFramework('socratic_tutor', makeLearner());
    expect(parts.persona).toContain('[PERSONA]');
  });

  it('act starts with [ACT] prefix', () => {
    const parts = buildPartsFramework('socratic_tutor', makeLearner());
    expect(parts.act).toContain('[ACT]');
  });

  it('recipient starts with [RECIPIENT]', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner());
    expect(parts.recipient).toContain('[RECIPIENT]');
  });

  it('theme contains the learner topic', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner({ topic: 'Atrial Fibrillation' }));
    expect(parts.theme).toContain('Atrial Fibrillation');
  });

  it('theme includes organ system when provided', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner({ organSystem: 'Cardiology' }));
    expect(parts.theme).toContain('Cardiology');
  });

  it('theme omits organ system when not provided', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner({ organSystem: undefined }));
    // No parentheses without organSystem
    expect(parts.theme).not.toContain('(');
  });

  it('recipient mentions fatigue level when moderate or severe', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner({ fatigueLevel: 'severe' }));
    expect(parts.recipient).toContain('severe fatigue');
  });

  it('recipient mentions session stats when both sessionQuestionCount and sessionAccuracy provided', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner({
      sessionQuestionCount: 15,
      sessionAccuracy: 0.80,
    }));
    expect(parts.recipient).toContain('15 questions');
    expect(parts.recipient).toContain('80%');
  });

  it('structure starts with [STRUCTURE]', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner());
    expect(parts.structure).toContain('[STRUCTURE]');
  });

  it('produces different act for different features', () => {
    const socratic = buildPartsFramework('socratic_tutor', makeLearner()).act;
    const mnemonic = buildPartsFramework('mnemonic_generator', makeLearner()).act;
    expect(socratic).not.toBe(mnemonic);
  });
});

// ─── buildPedagogicalPrompt ───────────────────────────────────────────────────

describe('buildPedagogicalPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner());
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('contains PEDAGOGICAL PRINCIPLES section with five numbered items', () => {
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner());
    expect(prompt).toContain('PEDAGOGICAL PRINCIPLES');
    // The prompt lists 5 directives numbered 1-5
    expect(prompt).toContain('1.');
    expect(prompt).toContain('5.');
    // Check that the directive text for the first two principles appears
    expect(prompt).toContain('digestible chunks');   // manage_cognitive_load directive
    expect(prompt).toContain('DO something');         // inspire_active_learning directive
  });

  it('contains the learner topic', () => {
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner({ topic: 'COPD' }));
    expect(prompt).toContain('COPD');
  });

  it('contains CLINICAL ACCURACY section', () => {
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner());
    expect(prompt).toContain('CLINICAL ACCURACY');
  });

  it('appends additional structure when provided', () => {
    const extra = 'EXTRA: Use bullet points only.';
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner(), extra);
    expect(prompt).toContain(extra);
  });

  it('does not include additional structure section when not provided', () => {
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner());
    expect(prompt).not.toContain('EXTRA:');
  });
});

// ─── getModelRecommendation ───────────────────────────────────────────────────

describe('getModelRecommendation', () => {
  it('returns MODEL_ROUTING entry for the feature', () => {
    const rec = getModelRecommendation('socratic_tutor');
    expect(rec).toBe(MODEL_ROUTING.socratic_tutor);
  });

  it('returns correct model for question_generator (gemini-2.5-pro)', () => {
    const rec = getModelRecommendation('question_generator');
    expect(rec.model).toBe('gemini-2.5-pro');
  });

  it('returns valid recommendation for every feature', () => {
    for (const feature of ALL_FEATURES) {
      const rec = getModelRecommendation(feature);
      expect(rec).toBeDefined();
      expect(typeof rec.model).toBe('string');
    }
  });
});

// ─── estimateInteractionCost ──────────────────────────────────────────────────

describe('estimateInteractionCost', () => {
  it('returns a positive number for any feature', () => {
    for (const feature of ALL_FEATURES) {
      const cost = estimateInteractionCost(feature);
      expect(cost).toBeGreaterThan(0);
    }
  });

  it('cost increases with more input tokens', () => {
    const low = estimateInteractionCost('general_tutor', 100, 256);
    const high = estimateInteractionCost('general_tutor', 5000, 256);
    expect(high).toBeGreaterThan(low);
  });

  it('cost increases with more output tokens', () => {
    const low = estimateInteractionCost('general_tutor', 1000, 128);
    const high = estimateInteractionCost('general_tutor', 1000, 2048);
    expect(high).toBeGreaterThan(low);
  });

  it('question_generator (pro model) costs more than socratic_tutor (flash model) at same token count', () => {
    const flash = estimateInteractionCost('socratic_tutor', 1000, 256);
    const pro = estimateInteractionCost('question_generator', 1000, 256);
    expect(pro).toBeGreaterThan(flash);
  });

  it('cost is always finite and non-negative', () => {
    const cost = estimateInteractionCost('general_tutor', 0, 0);
    expect(isFinite(cost)).toBe(true);
    expect(cost).toBeGreaterThanOrEqual(0);
  });
});

// ─── evaluatePedagogicalQuality ───────────────────────────────────────────────

describe('evaluatePedagogicalQuality', () => {
  it('returns a score object with all required fields', () => {
    const score = evaluatePedagogicalQuality('A good response.', 'general_tutor');
    expect(typeof score.cognitiveLoad).toBe('number');
    expect(typeof score.activeLearning).toBe('number');
    expect(typeof score.metacognition).toBe('number');
    expect(typeof score.curiosity).toBe('number');
    expect(typeof score.adaptation).toBe('number');
    expect(typeof score.overall).toBe('number');
    expect(typeof score.solutionLeakage).toBe('boolean');
  });

  it('all dimension scores are in [0, 1]', () => {
    const score = evaluatePedagogicalQuality('Some pedagogical response text here.', 'general_tutor');
    for (const dim of ['cognitiveLoad', 'activeLearning', 'metacognition', 'curiosity', 'adaptation'] as const) {
      expect(score[dim]).toBeGreaterThanOrEqual(0);
      expect(score[dim]).toBeLessThanOrEqual(1);
    }
  });

  it('short responses get higher cognitiveLoad score than very long ones', () => {
    const shortResponse = 'Consider this.';
    const longResponse = Array(300).fill('word').join(' ');
    const shortScore = evaluatePedagogicalQuality(shortResponse, 'general_tutor');
    const longScore = evaluatePedagogicalQuality(longResponse, 'general_tutor');
    expect(shortScore.cognitiveLoad).toBeGreaterThan(longScore.cognitiveLoad);
  });

  it('response with question marks increases activeLearning score', () => {
    const withQuestions = 'What do you think? How would you approach this? Consider why?';
    const withoutQuestions = 'The patient has hypertension. The treatment is lisinopril.';
    const withQ = evaluatePedagogicalQuality(withQuestions, 'general_tutor');
    const withoutQ = evaluatePedagogicalQuality(withoutQuestions, 'general_tutor');
    expect(withQ.activeLearning).toBeGreaterThan(withoutQ.activeLearning);
  });

  it('detects metacognition phrase "what made you"', () => {
    const response = 'What made you choose that diagnosis? Think about your reasoning.';
    const score = evaluatePedagogicalQuality(response, 'general_tutor');
    expect(score.metacognition).toBeGreaterThan(0.5);
  });

  it('detects curiosity phrase "clinically"', () => {
    const response = 'Clinically, this is fascinating because the mechanism involves...';
    const score = evaluatePedagogicalQuality(response, 'general_tutor');
    expect(score.curiosity).toBeGreaterThan(0.5);
  });

  it('detects solution leakage for socratic_tutor when answer phrase present', () => {
    const response = 'The answer is lisinopril — that is the correct answer for this case.';
    const score = evaluatePedagogicalQuality(response, 'socratic_tutor');
    expect(score.solutionLeakage).toBe(true);
  });

  it('does not flag solution leakage for non-Socratic features', () => {
    const response = 'The answer is lisinopril.';
    const score = evaluatePedagogicalQuality(response, 'question_generator');
    expect(score.solutionLeakage).toBe(false);
  });

  it('overall = average of the five dimension scores', () => {
    const score = evaluatePedagogicalQuality('Test response for averaging purposes.', 'general_tutor');
    const expected = (score.cognitiveLoad + score.activeLearning + score.metacognition + score.curiosity + score.adaptation) / 5;
    expect(score.overall).toBeCloseTo(expected, 10);
  });
});
