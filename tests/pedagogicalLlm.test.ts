/**
 * Pedagogical LLM Service — Unit Tests (Tier 3)
 *
 * Tests LearnLM PARTS framework prompt construction, model routing,
 * cost estimation, and pedagogical quality evaluation.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPedagogicalPrompt,
  buildPartsFramework,
  getModelRecommendation,
  estimateInteractionCost,
  evaluatePedagogicalQuality,
  LEARNLM_DIRECTIVES,
  FEATURE_PERSONAS,
  MODEL_ROUTING,
  type PedagogicalFeature,
  type LearnerContext,
} from '../lib/services/pedagogicalLlmService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLearner(overrides: Partial<LearnerContext> = {}): LearnerContext {
  return {
    topic: 'Atrial Fibrillation',
    retrievability: 0.55,
    difficulty: 5,
    ...overrides,
  };
}

const ALL_FEATURES: PedagogicalFeature[] = [
  'socratic_tutor', 'mnemonic_generator', 'confusion_explainer',
  'question_generator', 'osce_simulator', 'content_enrichment', 'general_tutor',
];

// ─── PARTS Framework ─────────────────────────────────────────────────────────

describe('buildPartsFramework', () => {
  it('includes all PARTS sections', () => {
    const parts = buildPartsFramework('socratic_tutor', makeLearner());
    expect(parts.persona).toContain('[PERSONA]');
    expect(parts.act).toContain('[ACT]');
    expect(parts.recipient).toContain('[RECIPIENT]');
    expect(parts.theme).toContain('[THEME]');
    expect(parts.structure).toContain('[STRUCTURE]');
  });

  it('includes topic in theme', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner({ topic: 'Pneumonia' }));
    expect(parts.theme).toContain('Pneumonia');
  });

  it('includes organ system when provided', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner({ organSystem: 'Cardiovascular' }));
    expect(parts.theme).toContain('Cardiovascular');
  });

  it('adapts recipient description based on retrievability', () => {
    const low = buildPartsFramework('general_tutor', makeLearner({ retrievability: 0.2 }));
    expect(low.recipient).toContain('struggling');

    const mid = buildPartsFramework('general_tutor', makeLearner({ retrievability: 0.55 }));
    expect(mid.recipient).toContain('developing');

    const high = buildPartsFramework('general_tutor', makeLearner({ retrievability: 0.85 }));
    expect(high.recipient).toContain('strong');
  });

  it('includes fatigue note when present', () => {
    const parts = buildPartsFramework('general_tutor', makeLearner({ fatigueLevel: 'moderate' }));
    expect(parts.recipient).toContain('moderate fatigue');
  });
});

// ─── Full Prompt ─────────────────────────────────────────────────────────────

describe('buildPedagogicalPrompt', () => {
  it('includes all five LearnLM principles', () => {
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner());
    // Each directive text appears in the prompt
    expect(prompt).toContain('digestible chunks'); // manage_cognitive_load
    expect(prompt).toContain('predict, explain'); // inspire_active_learning
    expect(prompt).toContain('reflect on their thinking'); // deepen_metacognition
    expect(prompt).toContain('WANT to know more'); // stimulate_curiosity
    expect(prompt).toContain('Adjust difficulty'); // adapt_to_learner
  });

  it('includes clinical accuracy directive', () => {
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner());
    expect(prompt).toContain('CLINICAL ACCURACY');
  });

  it('works for all feature types', () => {
    for (const feature of ALL_FEATURES) {
      const prompt = buildPedagogicalPrompt(feature, makeLearner());
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain('[PERSONA]');
    }
  });

  it('includes additional structure when provided', () => {
    const prompt = buildPedagogicalPrompt('general_tutor', makeLearner(), 'CUSTOM INSTRUCTION: Do XYZ');
    expect(prompt).toContain('CUSTOM INSTRUCTION: Do XYZ');
  });
});

// ─── Model Routing ───────────────────────────────────────────────────────────

describe('getModelRecommendation', () => {
  it('returns valid recommendation for all features', () => {
    for (const feature of ALL_FEATURES) {
      const rec = getModelRecommendation(feature);
      expect(rec.model).toBeTruthy();
      expect(rec.maxOutputTokens).toBeGreaterThan(0);
      expect(rec.temperature).toBeGreaterThanOrEqual(0);
      expect(rec.temperature).toBeLessThanOrEqual(1);
      expect(rec.estimatedCostUsd).toBeGreaterThan(0);
    }
  });

  it('uses flash for low-cost features', () => {
    expect(getModelRecommendation('socratic_tutor').model).toContain('flash');
    expect(getModelRecommendation('mnemonic_generator').model).toContain('flash');
  });

  it('uses pro for complex features', () => {
    expect(getModelRecommendation('question_generator').model).toContain('pro');
  });

  it('uses higher temperature for creative features', () => {
    const mnemonic = getModelRecommendation('mnemonic_generator');
    const confusion = getModelRecommendation('confusion_explainer');
    expect(mnemonic.temperature).toBeGreaterThan(confusion.temperature);
  });
});

// ─── Cost Estimation ─────────────────────────────────────────────────────────

describe('estimateInteractionCost', () => {
  it('returns positive cost', () => {
    const cost = estimateInteractionCost('socratic_tutor', 500, 200);
    expect(cost).toBeGreaterThan(0);
  });

  it('flash is cheaper than pro', () => {
    const flashCost = estimateInteractionCost('socratic_tutor', 1000, 256);
    const proCost = estimateInteractionCost('question_generator', 1000, 256);
    expect(flashCost).toBeLessThan(proCost);
  });

  it('cost scales with token count', () => {
    const small = estimateInteractionCost('general_tutor', 100, 50);
    const large = estimateInteractionCost('general_tutor', 5000, 1000);
    expect(large).toBeGreaterThan(small);
  });
});

// ─── Pedagogical Quality Evaluation ──────────────────────────────────────────

describe('evaluatePedagogicalQuality', () => {
  it('scores higher for responses with questions', () => {
    const withQ = evaluatePedagogicalQuality(
      'What do you think would happen if the patient also had diabetes? How would that change your approach?',
      'socratic_tutor'
    );
    const withoutQ = evaluatePedagogicalQuality(
      'The answer involves the renin-angiotensin system.',
      'socratic_tutor'
    );
    expect(withQ.activeLearning).toBeGreaterThan(withoutQ.activeLearning);
  });

  it('detects solution leakage in socratic mode', () => {
    const leaky = evaluatePedagogicalQuality(
      'The correct answer is hypertension because the labs show elevated BUN.',
      'socratic_tutor'
    );
    expect(leaky.solutionLeakage).toBe(true);
  });

  it('does not flag leakage for non-socratic features', () => {
    const explanation = evaluatePedagogicalQuality(
      'The correct answer is hypertension because the labs show elevated BUN.',
      'confusion_explainer'
    );
    expect(explanation.solutionLeakage).toBe(false);
  });

  it('overall score is bounded [0, 1]', () => {
    const score = evaluatePedagogicalQuality(
      'Consider what you know about the pathophysiology. What made you think it was option B?',
      'general_tutor'
    );
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(1);
  });

  it('penalizes very long responses on cognitive load', () => {
    const longResponse = 'word '.repeat(400);
    const shortResponse = 'What do you think about the symptoms described?';
    const longScore = evaluatePedagogicalQuality(longResponse, 'general_tutor');
    const shortScore = evaluatePedagogicalQuality(shortResponse, 'general_tutor');
    expect(shortScore.cognitiveLoad).toBeGreaterThan(longScore.cognitiveLoad);
  });
});

// ─── Constants Validation ────────────────────────────────────────────────────

describe('Constants', () => {
  it('all features have personas', () => {
    for (const feature of ALL_FEATURES) {
      expect(FEATURE_PERSONAS[feature]).toBeTruthy();
    }
  });

  it('all features have model routing', () => {
    for (const feature of ALL_FEATURES) {
      expect(MODEL_ROUTING[feature]).toBeTruthy();
    }
  });

  it('all five LearnLM principles have directives', () => {
    const principles: Array<keyof typeof LEARNLM_DIRECTIVES> = [
      'manage_cognitive_load', 'inspire_active_learning', 'deepen_metacognition',
      'stimulate_curiosity', 'adapt_to_learner',
    ];
    for (const p of principles) {
      expect(LEARNLM_DIRECTIVES[p]).toBeTruthy();
      expect(LEARNLM_DIRECTIVES[p].length).toBeGreaterThan(20);
    }
  });
});
