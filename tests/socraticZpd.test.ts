/**
 * Socratic ZPD Service — Unit Tests (Tier 3)
 *
 * Tests ZPD zone classification, hint level escalation,
 * Paul & Elder taxonomy mapping, and system prompt generation.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyZpdZone,
  assessZpd,
  buildZpdSystemPrompt,
  getEffectiveHintLevel,
  ZPD_THRESHOLDS,
  MAX_HINT_LEVELS,
  MAX_TURNS,
  ZONE_QUESTION_TYPES,
  type FsrsLearnerState,
  type ZpdZone,
} from '../lib/services/socraticZpdService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLearnerState(overrides: Partial<FsrsLearnerState> = {}): FsrsLearnerState {
  return {
    retrievability: 0.5,
    difficulty: 5,
    stability: 10,
    reviewCount: 5,
    lapseCount: 1,
    ...overrides,
  };
}

// ─── ZPD Zone Classification ─────────────────────────────────────────────────

describe('classifyZpdZone', () => {
  it('classifies below_zpd for low retrievability', () => {
    const state = makeLearnerState({ retrievability: 0.20 });
    expect(classifyZpdZone(state)).toBe('below_zpd');
  });

  it('classifies below_zpd at the threshold boundary', () => {
    const state = makeLearnerState({ retrievability: 0.39 });
    expect(classifyZpdZone(state)).toBe('below_zpd');
  });

  it('classifies in_zpd for moderate retrievability', () => {
    const state = makeLearnerState({ retrievability: 0.50 });
    expect(classifyZpdZone(state)).toBe('in_zpd');
  });

  it('classifies in_zpd at lower boundary', () => {
    const state = makeLearnerState({ retrievability: 0.40 });
    expect(classifyZpdZone(state)).toBe('in_zpd');
  });

  it('classifies above_zpd for high retrievability', () => {
    const state = makeLearnerState({ retrievability: 0.85 });
    expect(classifyZpdZone(state)).toBe('above_zpd');
  });

  it('classifies above_zpd at the boundary', () => {
    const state = makeLearnerState({ retrievability: 0.75 });
    expect(classifyZpdZone(state)).toBe('above_zpd');
  });

  it('detects leech cards (high lapses + difficulty) as below_zpd even with moderate R', () => {
    const state = makeLearnerState({
      retrievability: 0.55, // normally in_zpd
      difficulty: 8,
      lapseCount: 6,
    });
    expect(classifyZpdZone(state)).toBe('below_zpd');
  });

  it('does not override zone for moderate lapses', () => {
    const state = makeLearnerState({
      retrievability: 0.55,
      difficulty: 8,
      lapseCount: 3, // below threshold of 5
    });
    expect(classifyZpdZone(state)).toBe('in_zpd');
  });
});

// ─── ZPD Assessment ──────────────────────────────────────────────────────────

describe('assessZpd', () => {
  it('returns correct zone and question types for below_zpd', () => {
    const state = makeLearnerState({ retrievability: 0.20 });
    const assessment = assessZpd(state);
    expect(assessment.zone).toBe('below_zpd');
    expect(assessment.recommendedQuestionTypes).toEqual(['clarification', 'assumption_probing']);
  });

  it('returns correct zone and question types for in_zpd', () => {
    const state = makeLearnerState({ retrievability: 0.55 });
    const assessment = assessZpd(state);
    expect(assessment.zone).toBe('in_zpd');
    expect(assessment.recommendedQuestionTypes).toEqual(['evidence_probing', 'perspective']);
  });

  it('returns correct zone and question types for above_zpd', () => {
    const state = makeLearnerState({ retrievability: 0.80 });
    const assessment = assessZpd(state);
    expect(assessment.zone).toBe('above_zpd');
    expect(assessment.recommendedQuestionTypes).toEqual(['implication', 'meta_question']);
  });

  it('flags prerequisite review for very low R + high D', () => {
    const state = makeLearnerState({ retrievability: 0.15, difficulty: 9, lapseCount: 0 });
    const assessment = assessZpd(state);
    expect(assessment.needsPrerequisiteReview).toBe(true);
  });

  it('does not flag prerequisite review for moderate R', () => {
    const state = makeLearnerState({ retrievability: 0.50 });
    const assessment = assessZpd(state);
    expect(assessment.needsPrerequisiteReview).toBe(false);
  });

  it('has higher confidence with more reviews', () => {
    const fewReviews = assessZpd(makeLearnerState({ reviewCount: 2 }));
    const manyReviews = assessZpd(makeLearnerState({ reviewCount: 15 }));
    expect(manyReviews.assessmentConfidence).toBeGreaterThan(fewReviews.assessmentConfidence);
  });

  it('respects provided hint level', () => {
    const assessment = assessZpd(makeLearnerState(), 3);
    expect(assessment.hintLevel).toBe(3);
  });
});

// ─── Hint Level Escalation ───────────────────────────────────────────────────

describe('getEffectiveHintLevel', () => {
  it('starts at level 1 for turn 0', () => {
    expect(getEffectiveHintLevel(0, 'in_zpd')).toBe(1);
    expect(getEffectiveHintLevel(0, 'below_zpd')).toBe(1);
    expect(getEffectiveHintLevel(0, 'above_zpd')).toBe(1);
  });

  it('escalates at standard pace for in_zpd', () => {
    expect(getEffectiveHintLevel(0, 'in_zpd')).toBe(1);
    expect(getEffectiveHintLevel(1, 'in_zpd')).toBe(2);
    expect(getEffectiveHintLevel(2, 'in_zpd')).toBe(3);
    expect(getEffectiveHintLevel(3, 'in_zpd')).toBe(4);
  });

  it('escalates at standard pace for below_zpd', () => {
    expect(getEffectiveHintLevel(1, 'below_zpd')).toBe(2);
    expect(getEffectiveHintLevel(2, 'below_zpd')).toBe(3);
  });

  it('escalates slower for above_zpd', () => {
    // Turn 1 should still be level 1 for above_zpd (one turn delayed)
    expect(getEffectiveHintLevel(1, 'above_zpd')).toBe(1);
    expect(getEffectiveHintLevel(2, 'above_zpd')).toBe(2);
    expect(getEffectiveHintLevel(3, 'above_zpd')).toBe(3);
  });

  it('never exceeds MAX_HINT_LEVELS', () => {
    expect(getEffectiveHintLevel(10, 'in_zpd')).toBe(MAX_HINT_LEVELS);
    expect(getEffectiveHintLevel(10, 'below_zpd')).toBe(MAX_HINT_LEVELS);
    expect(getEffectiveHintLevel(10, 'above_zpd')).toBe(MAX_HINT_LEVELS);
  });
});

// ─── System Prompt Generation ────────────────────────────────────────────────

describe('buildZpdSystemPrompt', () => {
  it('includes PARTS framework sections', () => {
    const zpd = assessZpd(makeLearnerState({ retrievability: 0.50 }));
    const prompt = buildZpdSystemPrompt({
      zpd,
      topic: 'Congestive Heart Failure',
      turnNumber: 0,
      maxTurns: MAX_TURNS,
    });

    expect(prompt).toContain('[PERSONA]');
    expect(prompt).toContain('[ACT]');
    expect(prompt).toContain('[RECIPIENT]');
    expect(prompt).toContain('[THEME]');
    expect(prompt).toContain('[STRUCTURE]');
  });

  it('includes topic in prompt', () => {
    const zpd = assessZpd(makeLearnerState());
    const prompt = buildZpdSystemPrompt({
      zpd,
      topic: 'Atrial Fibrillation',
      turnNumber: 0,
      maxTurns: MAX_TURNS,
    });
    expect(prompt).toContain('Atrial Fibrillation');
  });

  it('includes zone-appropriate question type instructions', () => {
    const zpdBelow = assessZpd(makeLearnerState({ retrievability: 0.20 }));
    const promptBelow = buildZpdSystemPrompt({
      zpd: zpdBelow,
      topic: 'Test',
      turnNumber: 0,
      maxTurns: MAX_TURNS,
    });
    expect(promptBelow).toContain('Clarification');

    const zpdIn = assessZpd(makeLearnerState({ retrievability: 0.55 }));
    const promptIn = buildZpdSystemPrompt({
      zpd: zpdIn,
      topic: 'Test',
      turnNumber: 0,
      maxTurns: MAX_TURNS,
    });
    expect(promptIn).toContain('Evidence-Probing');

    const zpdAbove = assessZpd(makeLearnerState({ retrievability: 0.80 }));
    const promptAbove = buildZpdSystemPrompt({
      zpd: zpdAbove,
      topic: 'Test',
      turnNumber: 0,
      maxTurns: MAX_TURNS,
    });
    expect(promptAbove).toContain('Implication');
  });

  it('includes hint level instructions', () => {
    const zpd = assessZpd(makeLearnerState());
    const prompt1 = buildZpdSystemPrompt({ zpd, topic: 'Test', turnNumber: 0, maxTurns: 4 });
    expect(prompt1).toContain('HINT LEVEL 1');

    const prompt3 = buildZpdSystemPrompt({ zpd, topic: 'Test', turnNumber: 2, maxTurns: 4 });
    expect(prompt3).toContain('HINT LEVEL 3');
  });

  it('includes prerequisite note for very low R + high D', () => {
    const zpd = assessZpd(makeLearnerState({ retrievability: 0.10, difficulty: 9 }));
    const prompt = buildZpdSystemPrompt({ zpd, topic: 'Test', turnNumber: 0, maxTurns: 4 });
    expect(prompt).toContain('prerequisite review');
  });

  it('never reveals answer in prompts for levels 1-3', () => {
    const zpd = assessZpd(makeLearnerState());
    for (let turn = 0; turn < 3; turn++) {
      const prompt = buildZpdSystemPrompt({ zpd, topic: 'Test', turnNumber: turn, maxTurns: 4 });
      expect(prompt).toContain('NEVER give the answer directly');
    }
  });
});

// ─── Constants Validation ────────────────────────────────────────────────────

describe('Constants', () => {
  it('ZPD thresholds are ordered correctly', () => {
    expect(ZPD_THRESHOLDS.belowZpd).toBeLessThan(ZPD_THRESHOLDS.aboveZpd);
  });

  it('all zones have question type mappings', () => {
    const zones: ZpdZone[] = ['below_zpd', 'in_zpd', 'above_zpd'];
    for (const zone of zones) {
      expect(ZONE_QUESTION_TYPES[zone]).toBeDefined();
      expect(ZONE_QUESTION_TYPES[zone].length).toBeGreaterThan(0);
    }
  });

  it('MAX_TURNS is at least MAX_HINT_LEVELS', () => {
    expect(MAX_TURNS).toBeGreaterThanOrEqual(MAX_HINT_LEVELS);
  });
});
