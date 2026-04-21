/**
 * Unit tests for lib/services/socraticZpdService.ts
 *
 * Pure exports:
 *   classifyZpdZone(state): ZpdZone
 *   assessZpd(state, currentHintLevel?): ZpdAssessment
 *   buildZpdSystemPrompt(params): string
 *   getEffectiveHintLevel(turnNumber, zone): HintLevel
 *
 * ZPD thresholds:
 *   R < 0.40  → below_zpd
 *   0.40 ≤ R < 0.75 → in_zpd
 *   R ≥ 0.75  → above_zpd
 *   Exception: lapseCount >= 5 && difficulty >= 7 && R < 0.60 → below_zpd
 *
 * Effective hint escalation:
 *   below_zpd and in_zpd: min(4, turn+1)   — standard pace
 *   above_zpd: min(4, max(1, turn))         — 1 turn delayed
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
} from './socraticZpdService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<FsrsLearnerState> = {}): FsrsLearnerState {
  return {
    retrievability: 0.60,
    difficulty: 5,
    stability: 10,
    reviewCount: 5,
    lapseCount: 0,
    ...overrides,
  };
}

// ─── classifyZpdZone ─────────────────────────────────────────────────────────

describe('classifyZpdZone', () => {
  it('returns below_zpd for R < 0.40', () => {
    expect(classifyZpdZone(makeState({ retrievability: 0 }))).toBe('below_zpd');
    expect(classifyZpdZone(makeState({ retrievability: 0.20 }))).toBe('below_zpd');
    expect(classifyZpdZone(makeState({ retrievability: 0.399 }))).toBe('below_zpd');
  });

  it('returns in_zpd for 0.40 ≤ R < 0.75', () => {
    expect(classifyZpdZone(makeState({ retrievability: 0.40 }))).toBe('in_zpd');
    expect(classifyZpdZone(makeState({ retrievability: 0.60 }))).toBe('in_zpd');
    expect(classifyZpdZone(makeState({ retrievability: 0.749 }))).toBe('in_zpd');
  });

  it('returns above_zpd for R >= 0.75', () => {
    expect(classifyZpdZone(makeState({ retrievability: 0.75 }))).toBe('above_zpd');
    expect(classifyZpdZone(makeState({ retrievability: 0.90 }))).toBe('above_zpd');
    expect(classifyZpdZone(makeState({ retrievability: 1.0 }))).toBe('above_zpd');
  });

  it('overrides to below_zpd for high lapses + high difficulty + moderate R', () => {
    // lapseCount >= 5 AND difficulty >= 7 AND R < 0.60 → below_zpd
    const struggling = makeState({ retrievability: 0.55, difficulty: 8, lapseCount: 5 });
    expect(classifyZpdZone(struggling)).toBe('below_zpd');
  });

  it('does NOT override to below_zpd when lapse condition partially unmet', () => {
    // lapseCount < 5: no override
    const notEnoughLapses = makeState({ retrievability: 0.55, difficulty: 8, lapseCount: 4 });
    expect(classifyZpdZone(notEnoughLapses)).toBe('in_zpd'); // R=0.55 → in_zpd normally

    // difficulty < 7: no override
    const notHardEnough = makeState({ retrievability: 0.55, difficulty: 6, lapseCount: 5 });
    expect(classifyZpdZone(notHardEnough)).toBe('in_zpd');

    // R >= 0.60: no override
    const notLowEnoughR = makeState({ retrievability: 0.60, difficulty: 8, lapseCount: 5 });
    expect(classifyZpdZone(notLowEnoughR)).toBe('in_zpd');
  });

  it('boundary: R = ZPD_THRESHOLDS.belowZpd (0.40) is in_zpd not below_zpd', () => {
    expect(classifyZpdZone(makeState({ retrievability: ZPD_THRESHOLDS.belowZpd }))).toBe('in_zpd');
  });

  it('boundary: R = ZPD_THRESHOLDS.aboveZpd (0.75) is above_zpd not in_zpd', () => {
    expect(classifyZpdZone(makeState({ retrievability: ZPD_THRESHOLDS.aboveZpd }))).toBe('above_zpd');
  });
});

// ─── assessZpd ───────────────────────────────────────────────────────────────

describe('assessZpd', () => {
  it('zone matches classifyZpdZone', () => {
    const belowState = makeState({ retrievability: 0.20 });
    const inState = makeState({ retrievability: 0.60 });
    const aboveState = makeState({ retrievability: 0.90 });

    expect(assessZpd(belowState).zone).toBe('below_zpd');
    expect(assessZpd(inState).zone).toBe('in_zpd');
    expect(assessZpd(aboveState).zone).toBe('above_zpd');
  });

  it('recommendedQuestionTypes matches ZONE_QUESTION_TYPES', () => {
    for (const zone of ['below_zpd', 'in_zpd', 'above_zpd'] as const) {
      const retriev = zone === 'below_zpd' ? 0.20 : zone === 'in_zpd' ? 0.60 : 0.90;
      const result = assessZpd(makeState({ retrievability: retriev }));
      expect(result.recommendedQuestionTypes).toEqual(ZONE_QUESTION_TYPES[zone]);
    }
  });

  it('hintLevel defaults to 1 when not provided', () => {
    const result = assessZpd(makeState());
    expect(result.hintLevel).toBe(1);
  });

  it('hintLevel reflects the provided currentHintLevel', () => {
    expect(assessZpd(makeState(), 2).hintLevel).toBe(2);
    expect(assessZpd(makeState(), 4).hintLevel).toBe(4);
  });

  it('needsPrerequisiteReview is true when below ZPD + R < 0.20 + difficulty >= 8', () => {
    const hardState = makeState({ retrievability: 0.15, difficulty: 9, lapseCount: 0 });
    expect(assessZpd(hardState).needsPrerequisiteReview).toBe(true);
  });

  it('needsPrerequisiteReview is false when R >= 0.20 (even if hard + below ZPD)', () => {
    const state = makeState({ retrievability: 0.25, difficulty: 9, lapseCount: 0 });
    expect(assessZpd(state).needsPrerequisiteReview).toBe(false);
  });

  it('needsPrerequisiteReview is false when difficulty < 8', () => {
    const state = makeState({ retrievability: 0.10, difficulty: 7, lapseCount: 0 });
    expect(assessZpd(state).needsPrerequisiteReview).toBe(false);
  });

  it('needsPrerequisiteReview is false when not below_zpd', () => {
    const inZpd = makeState({ retrievability: 0.50, difficulty: 9 });
    expect(assessZpd(inZpd).needsPrerequisiteReview).toBe(false);
  });

  it('assessmentConfidence is 0 when reviewCount is 0', () => {
    // min(1, 0/10) * 0.9 = 0
    const state = makeState({ reviewCount: 0, retrievability: 0.60 });
    const result = assessZpd(state);
    expect(result.assessmentConfidence).toBe(0);
  });

  it('assessmentConfidence increases with reviewCount', () => {
    const few = assessZpd(makeState({ reviewCount: 2, retrievability: 0.60 }));
    const many = assessZpd(makeState({ reviewCount: 10, retrievability: 0.60 }));
    expect(many.assessmentConfidence).toBeGreaterThan(few.assessmentConfidence);
  });

  it('assessmentConfidence is capped at 0.9 (reviewCount>=10, R in (0,1))', () => {
    // min(1, 10/10) * 0.9 = 1.0 * 0.9 = 0.9
    const result = assessZpd(makeState({ reviewCount: 10, retrievability: 0.60 }));
    expect(result.assessmentConfidence).toBeCloseTo(0.9, 5);
  });

  it('zoneLabel is a non-empty string', () => {
    const result = assessZpd(makeState());
    expect(typeof result.zoneLabel).toBe('string');
    expect(result.zoneLabel.length).toBeGreaterThan(0);
  });

  it('returns correct zoneLabel for each zone', () => {
    expect(assessZpd(makeState({ retrievability: 0.20 })).zoneLabel).toBe('Building foundations');
    expect(assessZpd(makeState({ retrievability: 0.60 })).zoneLabel).toBe('Strengthening connections');
    expect(assessZpd(makeState({ retrievability: 0.90 })).zoneLabel).toBe('Deepening understanding');
  });
});

// ─── getEffectiveHintLevel ────────────────────────────────────────────────────

describe('getEffectiveHintLevel', () => {
  it('below_zpd and in_zpd: escalates at standard pace (turn+1)', () => {
    for (const zone of ['below_zpd', 'in_zpd'] as const) {
      expect(getEffectiveHintLevel(0, zone)).toBe(1);
      expect(getEffectiveHintLevel(1, zone)).toBe(2);
      expect(getEffectiveHintLevel(2, zone)).toBe(3);
      expect(getEffectiveHintLevel(3, zone)).toBe(4);
      expect(getEffectiveHintLevel(10, zone)).toBe(4); // capped at MAX_HINT_LEVELS
    }
  });

  it('above_zpd: escalates 1 turn slower (turn 0 and 1 both give hint 1)', () => {
    expect(getEffectiveHintLevel(0, 'above_zpd')).toBe(1);
    expect(getEffectiveHintLevel(1, 'above_zpd')).toBe(1); // delayed
    expect(getEffectiveHintLevel(2, 'above_zpd')).toBe(2);
    expect(getEffectiveHintLevel(3, 'above_zpd')).toBe(3);
    expect(getEffectiveHintLevel(4, 'above_zpd')).toBe(4);
    expect(getEffectiveHintLevel(10, 'above_zpd')).toBe(4); // capped
  });

  it('result is always in [1, MAX_HINT_LEVELS]', () => {
    for (const zone of ['below_zpd', 'in_zpd', 'above_zpd'] as const) {
      for (let t = 0; t <= 10; t++) {
        const level = getEffectiveHintLevel(t, zone);
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(MAX_HINT_LEVELS);
      }
    }
  });

  it('above_zpd always gets at least 1 turn of open Socratic questioning', () => {
    // Turn 0 is always hint level 1 for all zones
    expect(getEffectiveHintLevel(0, 'above_zpd')).toBe(1);
  });
});

// ─── buildZpdSystemPrompt ─────────────────────────────────────────────────────

describe('buildZpdSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const zpd = assessZpd(makeState({ retrievability: 0.60 }));
    const prompt = buildZpdSystemPrompt({ zpd, topic: 'Nephrotic Syndrome', turnNumber: 0, maxTurns: MAX_TURNS });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('includes the topic in the prompt', () => {
    const zpd = assessZpd(makeState());
    const topic = 'hydrALAzine vs hydrOXYzine';
    const prompt = buildZpdSystemPrompt({ zpd, topic, turnNumber: 0, maxTurns: MAX_TURNS });
    expect(prompt).toContain(topic);
  });

  it('includes the zone label', () => {
    const belowZpd = assessZpd(makeState({ retrievability: 0.20 }));
    const prompt = buildZpdSystemPrompt({ zpd: belowZpd, topic: 'Test', turnNumber: 0, maxTurns: 4 });
    expect(prompt).toContain('Building foundations');
  });

  it('includes prerequisite note when needsPrerequisiteReview is true', () => {
    const zpd = assessZpd(makeState({ retrievability: 0.10, difficulty: 9 }));
    if (zpd.needsPrerequisiteReview) {
      const prompt = buildZpdSystemPrompt({ zpd, topic: 'Test', turnNumber: 0, maxTurns: 4 });
      expect(prompt).toContain('prerequisite review');
    }
  });

  it('generates different prompts for different ZPD zones', () => {
    const belowZpd = assessZpd(makeState({ retrievability: 0.20 }));
    const aboveZpd = assessZpd(makeState({ retrievability: 0.90 }));
    const topic = 'Cushing Syndrome';

    const promptBelow = buildZpdSystemPrompt({ zpd: belowZpd, topic, turnNumber: 0, maxTurns: 4 });
    const promptAbove = buildZpdSystemPrompt({ zpd: aboveZpd, topic, turnNumber: 0, maxTurns: 4 });

    expect(promptBelow).not.toBe(promptAbove);
  });

  it('hint level escalates in prompt based on turnNumber', () => {
    const zpd = assessZpd(makeState({ retrievability: 0.60 }));
    const prompt1 = buildZpdSystemPrompt({ zpd, topic: 'Test', turnNumber: 0, maxTurns: 4 });
    const prompt4 = buildZpdSystemPrompt({ zpd, topic: 'Test', turnNumber: 3, maxTurns: 4 });
    // Turn 0 → hint 1, Turn 3 → hint 4; prompt should differ
    expect(prompt1).not.toBe(prompt4);
  });
});
