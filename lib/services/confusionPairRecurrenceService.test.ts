/**
 * Unit tests for lib/services/confusionPairRecurrenceService.ts
 *
 * Escalation tiers:
 *   count < 3  → no escalation, difficultyBoost=0
 *   count ≥ 3  → mild: escalate=true, difficultyBoost=0.5, queueContrastiveDrill=true
 *   count ≥ 5  → severe: escalate=true, difficultyBoost=1.0, queueContrastiveDrill=true,
 *                         generateDifferentiation=true
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeConfusionRecurrence,
} from './confusionPairRecurrenceService';

// ─── Guard / zero case ────────────────────────────────────────────────────────

describe('analyzeConfusionRecurrence — guard clause', () => {
  it('returns no-escalation for count = 0', () => {
    const r = analyzeConfusionRecurrence(0);
    expect(r.escalate).toBe(false);
    expect(r.difficultyBoost).toBe(0);
    expect(r.queueContrastiveDrill).toBe(false);
    expect(r.generateDifferentiation).toBe(false);
    expect(r.pairCount).toBe(0);
  });

  it('returns no-escalation for negative count', () => {
    const r = analyzeConfusionRecurrence(-1);
    expect(r.escalate).toBe(false);
    expect(r.difficultyBoost).toBe(0);
    expect(r.pairCount).toBe(0);
  });
});

// ─── Below mild threshold (count 1–2) ────────────────────────────────────────

describe('analyzeConfusionRecurrence — below mild threshold', () => {
  it('count=1 → no escalation, no boost', () => {
    const r = analyzeConfusionRecurrence(1);
    expect(r.pairCount).toBe(1);
    expect(r.escalate).toBe(false);
    expect(r.difficultyBoost).toBe(0);
    expect(r.queueContrastiveDrill).toBe(false);
    expect(r.generateDifferentiation).toBe(false);
  });

  it('count=2 → no escalation, no boost', () => {
    const r = analyzeConfusionRecurrence(2);
    expect(r.escalate).toBe(false);
    expect(r.difficultyBoost).toBe(0);
    expect(r.queueContrastiveDrill).toBe(false);
  });
});

// ─── Mild escalation (count 3–4) ─────────────────────────────────────────────

describe('analyzeConfusionRecurrence — mild escalation', () => {
  it('count=3 triggers mild escalation', () => {
    const r = analyzeConfusionRecurrence(3);
    expect(r.pairCount).toBe(3);
    expect(r.escalate).toBe(true);
    expect(r.difficultyBoost).toBe(0.5);
    expect(r.queueContrastiveDrill).toBe(true);
    expect(r.generateDifferentiation).toBe(false);
  });

  it('count=4 still mild — no differentiation generation', () => {
    const r = analyzeConfusionRecurrence(4);
    expect(r.escalate).toBe(true);
    expect(r.difficultyBoost).toBe(0.5);
    expect(r.queueContrastiveDrill).toBe(true);
    expect(r.generateDifferentiation).toBe(false);
  });
});

// ─── Severe escalation (count ≥ 5) ───────────────────────────────────────────

describe('analyzeConfusionRecurrence — severe escalation', () => {
  it('count=5 triggers severe escalation', () => {
    const r = analyzeConfusionRecurrence(5);
    expect(r.pairCount).toBe(5);
    expect(r.escalate).toBe(true);
    expect(r.difficultyBoost).toBe(1.0);
    expect(r.queueContrastiveDrill).toBe(true);
    expect(r.generateDifferentiation).toBe(true);
  });

  it('count=6 remains severe', () => {
    const r = analyzeConfusionRecurrence(6);
    expect(r.escalate).toBe(true);
    expect(r.difficultyBoost).toBe(1.0);
    expect(r.generateDifferentiation).toBe(true);
  });

  it('count=100 remains severe (no additional tiers)', () => {
    const r = analyzeConfusionRecurrence(100);
    expect(r.escalate).toBe(true);
    expect(r.difficultyBoost).toBe(1.0);
    expect(r.generateDifferentiation).toBe(true);
  });
});

// ─── pairCount passthrough ────────────────────────────────────────────────────

describe('analyzeConfusionRecurrence — pairCount echoed', () => {
  it('echoes pairCount for all valid counts', () => {
    for (const count of [1, 2, 3, 4, 5, 10]) {
      expect(analyzeConfusionRecurrence(count).pairCount).toBe(count);
    }
  });
});

// ─── Monotonicity of difficultyBoost ─────────────────────────────────────────

describe('analyzeConfusionRecurrence — difficulty boost monotonicity', () => {
  it('boost is non-decreasing as pairCount increases', () => {
    let prev = analyzeConfusionRecurrence(1).difficultyBoost;
    for (let count = 2; count <= 10; count++) {
      const curr = analyzeConfusionRecurrence(count).difficultyBoost;
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});
