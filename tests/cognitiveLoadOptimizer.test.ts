import { describe, it, expect } from 'vitest';
import {
  calculateIntrinsicLoad,
  identifyExtraneousLoad,
  optimizeGermaneLoad,
  detectExpertiseReversal,
  calculateTotalLoad,
  optimizeContentPresentation,
  generateLoadBasedRecommendations,
  type CognitiveLoadProfile,
} from '../lib/services/cognitiveScience/cognitiveLoadOptimizer';

// ─── calculateIntrinsicLoad ─────────────────────────────────────────────────

describe('calculateIntrinsicLoad', () => {
  it('produces a load in the 0-100 range', () => {
    const result = calculateIntrinsicLoad(5, 4, 0.5);
    expect(result.intrinsicLoad).toBeGreaterThanOrEqual(0);
    expect(result.intrinsicLoad).toBeLessThanOrEqual(100);
  });

  it('increases load with complexity', () => {
    const low = calculateIntrinsicLoad(2, 4, 0.5);
    const high = calculateIntrinsicLoad(9, 4, 0.5);
    expect(high.intrinsicLoad).toBeGreaterThan(low.intrinsicLoad);
  });

  it('increases load with element count', () => {
    const few = calculateIntrinsicLoad(5, 2, 0.5);
    const many = calculateIntrinsicLoad(5, 10, 0.5);
    expect(many.intrinsicLoad).toBeGreaterThan(few.intrinsicLoad);
  });

  it('decreases load with higher expertise', () => {
    const novice = calculateIntrinsicLoad(5, 4, 0.1);
    const expert = calculateIntrinsicLoad(5, 4, 0.9);
    expect(expert.intrinsicLoad).toBeLessThan(novice.intrinsicLoad);
  });

  it('flags high interactivity when > 4 elements', () => {
    const low = calculateIntrinsicLoad(5, 3, 0.5);
    const high = calculateIntrinsicLoad(5, 6, 0.5);
    expect(low.isHighInteractivity).toBe(false);
    expect(high.isHighInteractivity).toBe(true);
  });

  it('recommends ISOLATED ELEMENTS for novices with high interactivity', () => {
    const result = calculateIntrinsicLoad(7, 8, 0.2);
    expect(result.recommendedApproach).toContain('ISOLATED ELEMENTS');
  });

  it('recommends WORKED EXAMPLES for intermediate learners with high interactivity', () => {
    const result = calculateIntrinsicLoad(7, 8, 0.5);
    expect(result.recommendedApproach).toContain('WORKED EXAMPLES');
  });

  it('recommends COMPLETION PROBLEMS for experts with high interactivity', () => {
    const result = calculateIntrinsicLoad(7, 8, 0.8);
    expect(result.recommendedApproach).toContain('COMPLETION PROBLEMS');
  });

  it('recommends STANDARD for low interactivity', () => {
    const result = calculateIntrinsicLoad(5, 2, 0.5);
    expect(result.recommendedApproach).toContain('STANDARD');
  });
});

// ─── identifyExtraneousLoad ─────────────────────────────────────────────────

describe('identifyExtraneousLoad', () => {
  const BASELINE = {
    hasRedundantText: false,
    hasSplitAttention: false,
    hasModalityMismatch: false,
    hasIrrelevantDetails: false,
    hasWeaklyGuidedSearch: false,
    hasTransientInfo: false,
  };

  it('returns 0 load and no problems when no issues present', () => {
    const result = identifyExtraneousLoad(BASELINE);
    expect(result.extraneousLoad).toBe(0);
    expect(result.problems).toHaveLength(0);
  });

  it('adds 20 for split-attention problem', () => {
    const result = identifyExtraneousLoad({ ...BASELINE, hasSplitAttention: true });
    expect(result.extraneousLoad).toBe(20);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.technique).toContain('Split-Attention');
  });

  it('adds 15 for redundant text', () => {
    const result = identifyExtraneousLoad({ ...BASELINE, hasRedundantText: true });
    expect(result.extraneousLoad).toBe(15);
    expect(result.problems[0]?.technique).toContain('Redundancy');
  });

  it('accumulates load across multiple problems', () => {
    const result = identifyExtraneousLoad({
      hasRedundantText: true,     // 15
      hasSplitAttention: true,    // 20
      hasModalityMismatch: true,  // 12
      hasIrrelevantDetails: true, // 10
      hasWeaklyGuidedSearch: true, // 18
      hasTransientInfo: true,     // 15
    });
    // 15 + 20 + 12 + 10 + 18 + 15 = 90
    expect(result.extraneousLoad).toBe(90);
    expect(result.problems).toHaveLength(6);
  });

  it('each problem includes a research basis citation', () => {
    const result = identifyExtraneousLoad({
      ...BASELINE,
      hasRedundantText: true,
    });
    expect(result.problems[0]?.researchBasis).toBeTruthy();
    expect(result.problems[0]?.researchBasis.length).toBeGreaterThan(10);
  });
});

// ─── optimizeGermaneLoad ────────────────────────────────────────────────────

describe('optimizeGermaneLoad', () => {
  it('returns at least one strategy in any scenario', () => {
    const result = optimizeGermaneLoad(0.5, 50, 'conceptual');
    expect(result.germaneLoadStrategies.length).toBeGreaterThan(0);
  });

  it('includes self-explanation when available capacity > 30', () => {
    const result = optimizeGermaneLoad(0.5, 50, 'conceptual');
    const hasSelfExplanation = result.germaneLoadStrategies.some(
      (s) => s.strategy === 'Self-Explanation'
    );
    expect(hasSelfExplanation).toBe(true);
  });

  it('excludes self-explanation when available capacity <= 30', () => {
    const result = optimizeGermaneLoad(0.5, 20, 'conceptual');
    const hasSelfExplanation = result.germaneLoadStrategies.some(
      (s) => s.strategy === 'Self-Explanation'
    );
    expect(hasSelfExplanation).toBe(false);
  });

  it('includes elaborative interrogation for conceptual/factual content', () => {
    const conceptual = optimizeGermaneLoad(0.5, 50, 'conceptual');
    const factual = optimizeGermaneLoad(0.5, 50, 'factual');
    const procedural = optimizeGermaneLoad(0.5, 50, 'procedural');

    const hasElaborative = (strategies: typeof conceptual.germaneLoadStrategies) =>
      strategies.some((s) => s.strategy === 'Elaborative Interrogation');

    expect(hasElaborative(conceptual.germaneLoadStrategies)).toBe(true);
    expect(hasElaborative(factual.germaneLoadStrategies)).toBe(true);
    expect(hasElaborative(procedural.germaneLoadStrategies)).toBe(false);
  });

  it('includes worked examples for novice procedural learners', () => {
    const result = optimizeGermaneLoad(0.3, 50, 'procedural');
    const hasWorkedExamples = result.germaneLoadStrategies.some(
      (s) => s.strategy === 'Worked Example Effect'
    );
    expect(hasWorkedExamples).toBe(true);
  });

  it('excludes worked examples for experts', () => {
    const result = optimizeGermaneLoad(0.8, 50, 'procedural');
    const hasWorkedExamples = result.germaneLoadStrategies.some(
      (s) => s.strategy === 'Worked Example Effect'
    );
    expect(hasWorkedExamples).toBe(false);
  });

  it('includes variable practice for learners with expertise > 0.4', () => {
    const result = optimizeGermaneLoad(0.5, 50, 'conceptual');
    const hasVariablePractice = result.germaneLoadStrategies.some(
      (s) => s.strategy === 'Variable Practice'
    );
    expect(hasVariablePractice).toBe(true);
  });

  it('computes higher optimalGermaneLoad for experts', () => {
    const novice = optimizeGermaneLoad(0.1, 100, 'conceptual');
    const expert = optimizeGermaneLoad(0.9, 100, 'conceptual');
    expect(expert.optimalGermaneLoad).toBeGreaterThan(novice.optimalGermaneLoad);
  });

  it('caps optimalGermaneLoad at 80% of available capacity', () => {
    const result = optimizeGermaneLoad(0.5, 100, 'conceptual');
    expect(result.optimalGermaneLoad).toBeLessThanOrEqual(80);
  });
});

// ─── detectExpertiseReversal ────────────────────────────────────────────────

describe('detectExpertiseReversal', () => {
  const FULL_SUPPORT = {
    hasDetailedExplanations: true,
    hasWorkedExamples: true,
    hasScaffolding: true,
    hasGuidedPractice: true,
    hasSelfDirectedOptions: false,
  };

  const NO_SUPPORT = {
    hasDetailedExplanations: false,
    hasWorkedExamples: false,
    hasScaffolding: false,
    hasGuidedPractice: false,
    hasSelfDirectedOptions: true,
  };

  it('flags reversal likely for experts with heavy support', () => {
    const result = detectExpertiseReversal(0.85, FULL_SUPPORT);
    expect(result.isReversalLikely).toBe(true);
  });

  it('recommends reducing support for experts', () => {
    const result = detectExpertiseReversal(0.85, FULL_SUPPORT);
    expect(result.recommendation).toContain('EXPERTISE');
    expect(result.adjustments.length).toBeGreaterThan(0);
  });

  it('recommends removing worked examples for experts', () => {
    const result = detectExpertiseReversal(0.85, FULL_SUPPORT);
    const removeWorked = result.adjustments.find((a) => a.feature === 'Worked examples');
    expect(removeWorked?.action).toBe('remove');
  });

  it('recommends more support for novices', () => {
    const result = detectExpertiseReversal(0.1, NO_SUPPORT);
    expect(result.recommendation).toContain('NOVICE');
    const increaseWorked = result.adjustments.find(
      (a) => a.feature === 'Worked examples' && a.action === 'increase'
    );
    expect(increaseWorked).toBeTruthy();
  });

  it('suggests transition for intermediate learners', () => {
    const result = detectExpertiseReversal(0.5, FULL_SUPPORT);
    expect(result.recommendation).toContain('TRANSITION');
  });

  it('does not flag reversal for novices', () => {
    const result = detectExpertiseReversal(0.1, NO_SUPPORT);
    expect(result.isReversalLikely).toBe(false);
  });
});

// ─── calculateTotalLoad ─────────────────────────────────────────────────────

describe('calculateTotalLoad', () => {
  it('sums intrinsic + extraneous + germane load', () => {
    const profile = calculateTotalLoad(30, 10, 20, 15, 10);
    expect(profile.totalLoad).toBe(60);
  });

  it('flags overload when total exceeds effective capacity', () => {
    const profile = calculateTotalLoad(50, 30, 30, 5, 5);
    expect(profile.isOverloaded).toBe(true);
  });

  it('does not flag overload when well under capacity', () => {
    const profile = calculateTotalLoad(20, 10, 15, 5, 5);
    expect(profile.isOverloaded).toBe(false);
  });

  it('increases fatigue with session duration', () => {
    const fresh = calculateTotalLoad(30, 10, 20, 5, 10);
    const tired = calculateTotalLoad(30, 10, 20, 80, 10);
    expect(tired.mentalFatigueLevel).toBeGreaterThan(fresh.mentalFatigueLevel);
  });

  it('reduces working memory capacity with fatigue', () => {
    const fresh = calculateTotalLoad(30, 10, 20, 5, 10);
    const tired = calculateTotalLoad(30, 10, 20, 120, 60);
    expect(tired.workingMemoryCapacity).toBeLessThan(fresh.workingMemoryCapacity);
  });

  it('floors working memory capacity at 2', () => {
    const veryTired = calculateTotalLoad(30, 10, 20, 500, 500);
    expect(veryTired.workingMemoryCapacity).toBeGreaterThanOrEqual(2);
  });

  it('caps fatigue level at 1.0', () => {
    const profile = calculateTotalLoad(30, 10, 20, 500, 500);
    expect(profile.mentalFatigueLevel).toBeLessThanOrEqual(1);
  });

  it('flags optimalBreakTime when lastBreak is 25-30 minutes', () => {
    const profile = calculateTotalLoad(30, 10, 20, 30, 27);
    expect(profile.optimalBreakTime).toBe(true);
  });

  it('does not flag optimalBreakTime outside the 25-30 minute window', () => {
    const tooSoon = calculateTotalLoad(30, 10, 20, 30, 10);
    const tooLate = calculateTotalLoad(30, 10, 20, 30, 45);
    expect(tooSoon.optimalBreakTime).toBe(false);
    expect(tooLate.optimalBreakTime).toBe(false);
  });

  it('returns availableCapacity >= 0', () => {
    const profile = calculateTotalLoad(100, 100, 100, 500, 500);
    expect(profile.availableCapacity).toBeGreaterThanOrEqual(0);
  });
});

// ─── optimizeContentPresentation ────────────────────────────────────────────

describe('optimizeContentPresentation', () => {
  const baseLoad: CognitiveLoadProfile = {
    workingMemoryCapacity: 4,
    intrinsicLoad: 30,
    extraneousLoad: 10,
    germaneLoad: 30,
    totalLoad: 70,
    availableCapacity: 30,
    isOverloaded: false,
    sessionDurationMinutes: 20,
    mentalFatigueLevel: 0.2,
    optimalBreakTime: false,
  };

  const TEST_CONTENT =
    'First concept. Second concept. Third concept. Fourth concept. Fifth concept. Sixth concept.';

  it('selects heavy scaffolding for novices', () => {
    const result = optimizeContentPresentation(TEST_CONTENT, 3, 0.1, baseLoad);
    expect(result.scaffoldingLevel).toBe('heavy');
  });

  it('selects no scaffolding for experts', () => {
    const result = optimizeContentPresentation(TEST_CONTENT, 3, 0.8, baseLoad);
    expect(result.scaffoldingLevel).toBe('none');
  });

  it('selects moderate scaffolding for intermediate learners', () => {
    const result = optimizeContentPresentation(TEST_CONTENT, 3, 0.4, baseLoad);
    expect(result.scaffoldingLevel).toBe('moderate');
  });

  it('chunks content according to working memory capacity', () => {
    const result = optimizeContentPresentation(TEST_CONTENT, 6, 0.5, baseLoad);
    expect(result.chunkedElements.length).toBeGreaterThan(0);
  });

  it('includes Segmenting technique when overloaded', () => {
    const overloadedProfile = { ...baseLoad, isOverloaded: true };
    const result = optimizeContentPresentation(TEST_CONTENT, 3, 0.5, overloadedProfile);
    const hasSegmenting = result.loadReductions.some((r) => r.technique === 'Segmenting');
    expect(hasSegmenting).toBe(true);
  });

  it('includes Weeding when extraneous load > 20', () => {
    const highExtraneous = { ...baseLoad, extraneousLoad: 30 };
    const result = optimizeContentPresentation(TEST_CONTENT, 3, 0.5, highExtraneous);
    const hasWeeding = result.loadReductions.some((r) => r.technique === 'Weeding');
    expect(hasWeeding).toBe(true);
  });

  it('detects expertise reversal for experts with scaffolding', () => {
    const result = optimizeContentPresentation(TEST_CONTENT, 3, 0.65, baseLoad);
    // Expertise > 0.6 and scaffolding !== 'none' (it'll be 'light' or 'moderate')
    expect(result.expertiseReversal).toBe(true);
  });

  it('does not flag expertise reversal for experts with no scaffolding', () => {
    const result = optimizeContentPresentation(TEST_CONTENT, 3, 0.9, baseLoad);
    // expertise > 0.7 → scaffolding='none' → no reversal
    expect(result.expertiseReversal).toBe(false);
  });

  it('preserves original content in result', () => {
    const result = optimizeContentPresentation(TEST_CONTENT, 3, 0.5, baseLoad);
    expect(result.originalContent).toBe(TEST_CONTENT);
  });
});

// ─── generateLoadBasedRecommendations ───────────────────────────────────────

describe('generateLoadBasedRecommendations', () => {
  const baseLoad: CognitiveLoadProfile = {
    workingMemoryCapacity: 4,
    intrinsicLoad: 30,
    extraneousLoad: 10,
    germaneLoad: 30,
    totalLoad: 70,
    availableCapacity: 30,
    isOverloaded: false,
    sessionDurationMinutes: 20,
    mentalFatigueLevel: 0.2,
    optimalBreakTime: false,
  };

  it('always returns long-term strategies', () => {
    const result = generateLoadBasedRecommendations(baseLoad);
    expect(result.longTermStrategies.length).toBeGreaterThan(0);
  });

  it('recommends break when overloaded', () => {
    const result = generateLoadBasedRecommendations({ ...baseLoad, isOverloaded: true });
    const hasBreak = result.immediateActions.some((a) =>
      a.toLowerCase().includes('break')
    );
    expect(hasBreak).toBe(true);
  });

  it('recommends break at optimalBreakTime', () => {
    const result = generateLoadBasedRecommendations({ ...baseLoad, optimalBreakTime: true });
    const hasBreak = result.immediateActions.some((a) =>
      a.toLowerCase().includes('break')
    );
    expect(hasBreak).toBe(true);
  });

  it('suggests simplification when extraneous load > 30', () => {
    const result = generateLoadBasedRecommendations({ ...baseLoad, extraneousLoad: 40 });
    const hasSimplify = result.sessionAdjustments.some((a) =>
      a.toLowerCase().includes('simplif') || a.toLowerCase().includes('distract')
    );
    expect(hasSimplify).toBe(true);
  });

  it('suggests active processing when germane load is low', () => {
    const result = generateLoadBasedRecommendations({ ...baseLoad, germaneLoad: 10 });
    const hasActive = result.sessionAdjustments.some((a) =>
      a.toLowerCase().includes('active') || a.toLowerCase().includes('explain')
    );
    expect(hasActive).toBe(true);
  });

  it('warns about fatigue when mentalFatigueLevel > 0.7', () => {
    const result = generateLoadBasedRecommendations({ ...baseLoad, mentalFatigueLevel: 0.8 });
    const hasFatigueWarning = result.immediateActions.some((a) =>
      a.toLowerCase().includes('fatigue')
    );
    expect(hasFatigueWarning).toBe(true);
  });

  it('does not warn about fatigue when level is low', () => {
    const result = generateLoadBasedRecommendations({ ...baseLoad, mentalFatigueLevel: 0.2 });
    const hasFatigueWarning = result.immediateActions.some((a) =>
      a.toLowerCase().includes('fatigue')
    );
    expect(hasFatigueWarning).toBe(false);
  });
});
