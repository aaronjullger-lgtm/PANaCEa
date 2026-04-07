/**
 * Leech Detection Service — Unit Tests (Tier 3)
 *
 * Tests FSRS-based leech identification and mnemonic recommendation.
 */

import { describe, it, expect } from 'vitest';
import {
  assessLeech,
  classifyLeechSeverity,
  computeLapseRate,
  computeDifficultySignal,
  computeStabilityStagnation,
  computeReviewInefficiency,
  buildMnemonicConceptPrompt,
  MIN_REVIEWS_FOR_DETECTION,
  LEECH_WEIGHTS,
  LEECH_THRESHOLDS,
  type CardFsrsState,
} from '../lib/services/leechDetectionService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CardFsrsState> = {}): CardFsrsState {
  return {
    difficulty: 5,
    stability: 15,
    reviewCount: 10,
    lapseCount: 2,
    retrievability: 0.7,
    ...overrides,
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('leech weights sum to 1.0', () => {
    const sum = Object.values(LEECH_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('thresholds are ordered', () => {
    expect(LEECH_THRESHOLDS.emerging).toBeLessThan(LEECH_THRESHOLDS.leech);
    expect(LEECH_THRESHOLDS.leech).toBeLessThan(LEECH_THRESHOLDS.severe);
  });
});

// ─── Individual Signals ──────────────────────────────────────────────────────

describe('computeLapseRate', () => {
  it('returns 0 for insufficient reviews', () => {
    expect(computeLapseRate(3, 2)).toBe(0);
  });

  it('returns 0 for no lapses', () => {
    expect(computeLapseRate(0, 10)).toBe(0);
  });

  it('returns 1.0 for 50%+ lapse rate', () => {
    expect(computeLapseRate(5, 10)).toBe(1.0);
  });

  it('returns proportional value for moderate lapse rate', () => {
    const rate = computeLapseRate(2, 10); // 20% → 0.4
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
  });
});

describe('computeDifficultySignal', () => {
  it('returns 0 for minimum difficulty', () => {
    expect(computeDifficultySignal(1)).toBe(0);
  });

  it('returns 1.0 for maximum difficulty', () => {
    expect(computeDifficultySignal(10)).toBe(1.0);
  });

  it('returns ~0.5 for middle difficulty', () => {
    const signal = computeDifficultySignal(5.5);
    expect(signal).toBeCloseTo(0.5, 1);
  });
});

describe('computeStabilityStagnation', () => {
  it('returns 0 for insufficient reviews', () => {
    expect(computeStabilityStagnation(10, 3)).toBe(0);
  });

  it('returns high signal for low stability after many reviews', () => {
    // 20 reviews, stability only 2 days (expected ~40 days)
    const signal = computeStabilityStagnation(2, 20);
    expect(signal).toBeGreaterThan(0.8);
  });

  it('returns low signal for good stability growth', () => {
    // 10 reviews, stability 30 days (expected ~20 days → overperforming)
    const signal = computeStabilityStagnation(30, 10);
    expect(signal).toBe(0);
  });
});

// ─── Composite Assessment ────────────────────────────────────────────────────

describe('assessLeech', () => {
  it('returns not-leech for insufficient reviews', () => {
    const result = assessLeech(makeCard({ reviewCount: 3 }));
    expect(result.isLeech).toBe(false);
    expect(result.severity).toBe('none');
  });

  it('returns not-leech for a healthy card', () => {
    const result = assessLeech(makeCard({
      difficulty: 4,
      stability: 30,
      reviewCount: 10,
      lapseCount: 1,
    }));
    expect(result.isLeech).toBe(false);
    expect(result.leechScore).toBeLessThan(LEECH_THRESHOLDS.emerging);
  });

  it('detects a leech card (high lapses + high difficulty + low stability)', () => {
    const result = assessLeech(makeCard({
      difficulty: 9,
      stability: 1,
      reviewCount: 15,
      lapseCount: 8,
    }));
    expect(result.isLeech).toBe(true);
    expect(result.severity).not.toBe('none');
    expect(result.mnemonicRecommended).toBe(true);
  });

  it('recommends mnemonic for emerging leeches too', () => {
    const result = assessLeech(makeCard({
      difficulty: 7,
      stability: 5,
      reviewCount: 10,
      lapseCount: 4,
    }));
    if (result.severity === 'emerging') {
      expect(result.mnemonicRecommended).toBe(true);
    }
  });

  it('has bounded score [0, 1]', () => {
    // Worst case: everything bad
    const result = assessLeech(makeCard({
      difficulty: 10,
      stability: 0.5,
      reviewCount: 20,
      lapseCount: 15,
    }));
    expect(result.leechScore).toBeGreaterThanOrEqual(0);
    expect(result.leechScore).toBeLessThanOrEqual(1);
  });

  it('provides a reason string', () => {
    const result = assessLeech(makeCard({
      difficulty: 9,
      stability: 1,
      reviewCount: 15,
      lapseCount: 8,
    }));
    expect(result.reason).toBeTruthy();
    expect(result.reason.length).toBeGreaterThan(10);
  });
});

// ─── Classification ──────────────────────────────────────────────────────────

describe('classifyLeechSeverity', () => {
  it('classifies correctly at boundaries', () => {
    expect(classifyLeechSeverity(0.0)).toBe('none');
    expect(classifyLeechSeverity(0.39)).toBe('none');
    expect(classifyLeechSeverity(0.40)).toBe('emerging');
    expect(classifyLeechSeverity(0.59)).toBe('emerging');
    expect(classifyLeechSeverity(0.60)).toBe('leech');
    expect(classifyLeechSeverity(0.79)).toBe('leech');
    expect(classifyLeechSeverity(0.80)).toBe('severe_leech');
    expect(classifyLeechSeverity(1.0)).toBe('severe_leech');
  });
});

// ─── Mnemonic Prompt ─────────────────────────────────────────────────────────

describe('buildMnemonicConceptPrompt', () => {
  it('returns system and user prompts', () => {
    const result = buildMnemonicConceptPrompt('Cushing syndrome');
    expect(result.systemPrompt).toContain('visual dual-coding');
    expect(result.userPrompt).toContain('Cushing syndrome');
  });

  it('includes context when provided', () => {
    const result = buildMnemonicConceptPrompt('Cushing syndrome', 'Student confuses with Cushing disease');
    expect(result.userPrompt).toContain('confuses with Cushing disease');
  });

  it('requests JSON output format', () => {
    const result = buildMnemonicConceptPrompt('DVT');
    expect(result.systemPrompt).toContain('image_prompt');
    expect(result.systemPrompt).toContain('mnemonic_concept');
  });
});
