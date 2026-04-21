/**
 * Unit tests for lib/services/semanticConfusionService.ts
 *
 * Pure/deterministic functions only — DB-backed functions (if any) belong in integration tests.
 *
 * Constants (from source):
 *   SIMILARITY_THRESHOLD          = 0.85
 *   MIN_CO_FAILURES               = 3
 *   SEVERITY_THRESHOLDS           = { medium: 0.40, high: 0.60, critical: 0.80 }
 *   INTERFERENCE_MODIFIER_RANGE   = { min: 0.95, max: 0.75 }
 *   INTERLEAVING_SEPARATION       = { min: 2, max: 5 }
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  isEmbeddingConfusionPair,
  mineCoFailures,
  normalizeConceptPair,
  assessConfusionPair,
  classifyConfusionSeverity,
  computeInterferenceModifier,
  generateInterleavingSchedule,
  findKnownLasaPairs,
  SIMILARITY_THRESHOLD,
  MIN_CO_FAILURES,
  SEVERITY_THRESHOLDS,
  INTERFERENCE_MODIFIER_RANGE,
  INTERLEAVING_SEPARATION,
  type CoFailureEvent,
} from './semanticConfusionService';

// ─── cosineSimilarity ─────────────────────────────────────────────────────────
// NOTE: this implementation returns 0 for mismatched dimensions (does NOT throw)

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical non-zero vectors', () => {
    const v = [0.3, 0.4, 0.5, 0.6];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns -1.0 for exactly opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('returns 0 for zero vectors (avoids division by zero)', () => {
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  it('returns 0 for mismatched dimensions (does NOT throw)', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).not.toThrow();
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for empty arrays', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('is commutative: sim(a,b) === sim(b,a)', () => {
    const a = [0.1, 0.9, 0.4];
    const b = [0.5, 0.3, 0.7];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it('is scale-invariant (cosine is direction-only)', () => {
    const a = [1, 0];
    const b = [100, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });

  it('returns 1/√2 ≈ 0.7071 for [1,1] vs [1,0]', () => {
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(1 / Math.sqrt(2), 5);
  });
});

// ─── isEmbeddingConfusionPair ─────────────────────────────────────────────────

describe('isEmbeddingConfusionPair', () => {
  it('returns true at exactly SIMILARITY_THRESHOLD (0.85)', () => {
    expect(isEmbeddingConfusionPair(SIMILARITY_THRESHOLD)).toBe(true);
  });

  it('returns true for similarity > SIMILARITY_THRESHOLD', () => {
    expect(isEmbeddingConfusionPair(0.90)).toBe(true);
    expect(isEmbeddingConfusionPair(1.0)).toBe(true);
  });

  it('returns false for similarity < SIMILARITY_THRESHOLD', () => {
    expect(isEmbeddingConfusionPair(0.84)).toBe(false);
    expect(isEmbeddingConfusionPair(0.0)).toBe(false);
  });

  it('returns false at SIMILARITY_THRESHOLD - 0.001', () => {
    expect(isEmbeddingConfusionPair(SIMILARITY_THRESHOLD - 0.001)).toBe(false);
  });
});

// ─── normalizeConceptPair ─────────────────────────────────────────────────────

describe('normalizeConceptPair', () => {
  it('produces the same key regardless of argument order', () => {
    expect(normalizeConceptPair('B', 'A')).toBe(normalizeConceptPair('A', 'B'));
  });

  it('sorts alphabetically and joins with |||', () => {
    expect(normalizeConceptPair('beta', 'alpha')).toBe('alpha|||beta');
  });

  it('is idempotent: normalizing the result splits back to originals', () => {
    const key = normalizeConceptPair('Crohn', 'UC');
    const [a, b] = key.split('|||');
    expect([a, b].sort()).toEqual(['Crohn', 'UC'].sort());
  });

  it('handles concepts with identical names', () => {
    expect(normalizeConceptPair('A', 'A')).toBe('A|||A');
  });
});

// ─── classifyConfusionSeverity ────────────────────────────────────────────────

describe('classifyConfusionSeverity', () => {
  it('returns "critical" for score >= 0.80', () => {
    expect(classifyConfusionSeverity(SEVERITY_THRESHOLDS.critical)).toBe('critical');
    expect(classifyConfusionSeverity(1.0)).toBe('critical');
    expect(classifyConfusionSeverity(0.9)).toBe('critical');
  });

  it('returns "high" for score in [0.60, 0.80)', () => {
    expect(classifyConfusionSeverity(SEVERITY_THRESHOLDS.high)).toBe('high');
    expect(classifyConfusionSeverity(0.70)).toBe('high');
    expect(classifyConfusionSeverity(0.799)).toBe('high');
  });

  it('returns "medium" for score in [0.40, 0.60)', () => {
    expect(classifyConfusionSeverity(SEVERITY_THRESHOLDS.medium)).toBe('medium');
    expect(classifyConfusionSeverity(0.50)).toBe('medium');
    expect(classifyConfusionSeverity(0.599)).toBe('medium');
  });

  it('returns "low" for score < 0.40', () => {
    expect(classifyConfusionSeverity(0.0)).toBe('low');
    expect(classifyConfusionSeverity(0.2)).toBe('low');
    expect(classifyConfusionSeverity(0.399)).toBe('low');
  });

  it('boundary: 0.80 is critical (inclusive)', () => {
    expect(classifyConfusionSeverity(0.80)).toBe('critical');
  });

  it('boundary: 0.60 is high (inclusive)', () => {
    expect(classifyConfusionSeverity(0.60)).toBe('high');
  });

  it('boundary: 0.40 is medium (inclusive)', () => {
    expect(classifyConfusionSeverity(0.40)).toBe('medium');
  });
});

// ─── computeInterferenceModifier ──────────────────────────────────────────────

describe('computeInterferenceModifier', () => {
  it('returns 1.0 for score <= 0 (no interference)', () => {
    expect(computeInterferenceModifier(0)).toBe(1.0);
    expect(computeInterferenceModifier(-1)).toBe(1.0);
  });

  it('returns INTERFERENCE_MODIFIER_RANGE.min (0.95) for score >= 1', () => {
    expect(computeInterferenceModifier(1)).toBe(INTERFERENCE_MODIFIER_RANGE.min);
    expect(computeInterferenceModifier(2)).toBe(INTERFERENCE_MODIFIER_RANGE.min);
  });

  it('decreases linearly from 1.0 to 0.95 as score goes 0→1', () => {
    const half = computeInterferenceModifier(0.5);
    // range = 1.0 - 0.95 = 0.05; at 0.5 → 1.0 - 0.5*0.05 = 0.975
    expect(half).toBeCloseTo(0.975, 5);
  });

  it('is monotonically decreasing', () => {
    const vals = [0.1, 0.3, 0.5, 0.7, 0.9].map(computeInterferenceModifier);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]!);
    }
  });

  it('result is always in [INTERFERENCE_MODIFIER_RANGE.min, 1.0]', () => {
    for (const score of [0, 0.25, 0.5, 0.75, 1.0]) {
      const mod = computeInterferenceModifier(score);
      expect(mod).toBeGreaterThanOrEqual(INTERFERENCE_MODIFIER_RANGE.min);
      expect(mod).toBeLessThanOrEqual(1.0);
    }
  });
});

// ─── assessConfusionPair ──────────────────────────────────────────────────────

describe('assessConfusionPair', () => {
  it('returns source "both" when similarity >= threshold AND coFailures >= MIN', () => {
    const result = assessConfusionPair('A', 'B', 0.90, 5);
    expect(result.source).toBe('both');
  });

  it('returns source "embedding" when only similarity threshold is met', () => {
    const result = assessConfusionPair('A', 'B', 0.90, 0); // coFailures < MIN
    expect(result.source).toBe('embedding');
  });

  it('returns source "co_failure" when only co-failures exceed minimum', () => {
    const result = assessConfusionPair('A', 'B', 0.50, 5); // similarity < threshold
    expect(result.source).toBe('co_failure');
  });

  it('interleavingRecommended is false only when severity = "low"', () => {
    const lowResult = assessConfusionPair('A', 'B', 0.0, 0);
    expect(lowResult.interleavingRecommended).toBe(false);
  });

  it('interleavingRecommended is true for medium/high/critical severity', () => {
    // Force high combined score: similarity near 1.0 + many co-failures
    const highResult = assessConfusionPair('A', 'B', 0.99, 10);
    expect(highResult.interleavingRecommended).toBe(true);
  });

  it('contrastiveDrillRecommended is true for high/critical severity', () => {
    const result = assessConfusionPair('A', 'B', 0.99, 10);
    expect(['high', 'critical']).toContain(result.severity);
    expect(result.contrastiveDrillRecommended).toBe(true);
  });

  it('contrastiveDrillRecommended is false for low/medium severity', () => {
    const result = assessConfusionPair('A', 'B', 0.0, 0);
    expect(result.contrastiveDrillRecommended).toBe(false);
  });

  it('interferenceModifier is in [INTERFERENCE_MODIFIER_RANGE.min, 1.0]', () => {
    const result = assessConfusionPair('A', 'B', 0.90, 5);
    expect(result.interferenceModifier).toBeGreaterThanOrEqual(INTERFERENCE_MODIFIER_RANGE.min);
    expect(result.interferenceModifier).toBeLessThanOrEqual(1.0);
  });

  it('preserves conceptA and conceptB in result', () => {
    const result = assessConfusionPair('Cushing', 'Conn', 0.7, 2);
    expect(result.conceptA).toBe('Cushing');
    expect(result.conceptB).toBe('Conn');
  });

  it('returns valid severity from classifyConfusionSeverity', () => {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    for (const [sim, cf] of [[0.0, 0], [0.85, 3], [0.99, 10]] as [number, number][]) {
      expect(validSeverities).toContain(assessConfusionPair('A', 'B', sim, cf).severity);
    }
  });

  it('lift contribution boosts combined score when associationMetrics.lift > 1', () => {
    // coFailures=3 → coFailurePart = 0.4 * min(1, 3/10) = 0.12
    // withoutLift: combined = 0.12 → 'low'
    // withLift (lift=6): liftContribution = min(1,(6-1)/5) = 1.0, liftPart = 0.3
    //   combined = 0 * 0.3 + 0.12/0.4 * 0.4 + 1.0 * 0.3
    //   = 0 + 0.12 + 0.30 = 0.42 → 'medium'
    const withLift = assessConfusionPair('A', 'B', 0.0, 3, { support: 0.3, confidence: 0.9, lift: 6, count: 5 });
    const withoutLift = assessConfusionPair('A', 'B', 0.0, 3);
    expect(withoutLift.severity).toBe('low');    // 0.12 < 0.40
    expect(withLift.severity).toBe('medium');    // 0.42 ≥ 0.40
    expect(withLift.severity).not.toBe(withoutLift.severity);
  });
});

// ─── generateInterleavingSchedule ────────────────────────────────────────────

describe('generateInterleavingSchedule', () => {
  const pool = ['card1', 'card2', 'card3', 'card4', 'card5', 'card6', 'card7'];

  it('starts with first confused card and ends with second', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool);
    expect(schedule.cardSequence[0]).toBe('A');
    expect(schedule.cardSequence[schedule.cardSequence.length - 1]).toBe('B');
  });

  it('uses separationCount = 2 for critical severity', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool, 'critical');
    expect(schedule.separationCount).toBe(INTERLEAVING_SEPARATION.min); // 2
  });

  it('uses separationCount = 3 for high severity', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool, 'high');
    expect(schedule.separationCount).toBe(3);
  });

  it('uses separationCount = 4 for medium severity', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool, 'medium');
    expect(schedule.separationCount).toBe(INTERLEAVING_SEPARATION.max - 1); // 4
  });

  it('uses separationCount = 5 for low severity', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool, 'low');
    expect(schedule.separationCount).toBe(INTERLEAVING_SEPARATION.max); // 5
  });

  it('defaults to medium severity when not specified', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool);
    expect(schedule.separationCount).toBe(INTERLEAVING_SEPARATION.max - 1); // 4
  });

  it('does not include confused pair cards in the interleaved positions', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], ['A', 'B', 'C', 'D', 'E']);
    // Middle cards should not be A or B
    const middle = schedule.cardSequence.slice(1, -1);
    expect(middle).not.toContain('A');
    expect(middle).not.toContain('B');
  });

  it('returns fewer intervening items if pool is too small', () => {
    const smallPool = ['only1'];
    const schedule = generateInterleavingSchedule(['A', 'B'], smallPool, 'critical');
    // Only 1 intervening available (critical wants 2), but pool has 1
    expect(schedule.separationCount).toBe(1);
  });

  it('cardSequence length = 2 + separationCount (when pool is large enough)', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool, 'critical');
    expect(schedule.cardSequence.length).toBe(2 + schedule.separationCount);
  });

  it('returns a non-empty reason string', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool, 'high');
    expect(typeof schedule.reason).toBe('string');
    expect(schedule.reason.length).toBeGreaterThan(0);
  });
});

// ─── mineCoFailures ───────────────────────────────────────────────────────────

describe('mineCoFailures', () => {
  function makeEvent(
    conceptId: string,
    sessionId: string,
    cardId = `card_${conceptId}`
  ): CoFailureEvent {
    return { failedCardId: cardId, conceptId, sessionId, timestamp: Date.now() };
  }

  it('returns empty map for empty events array', () => {
    expect(mineCoFailures([], 10).size).toBe(0);
  });

  it('returns empty map when no pair exceeds MIN_CO_FAILURES', () => {
    // 2 co-failures (< 3 minimum)
    const events = [
      makeEvent('A', 's1'), makeEvent('B', 's1'),
      makeEvent('A', 's2'), makeEvent('B', 's2'),
    ];
    expect(mineCoFailures(events, 10).size).toBe(0);
  });

  it('returns a pair that co-fails at least MIN_CO_FAILURES times', () => {
    const events = [
      makeEvent('A', 's1'), makeEvent('B', 's1'),
      makeEvent('A', 's2'), makeEvent('B', 's2'),
      makeEvent('A', 's3'), makeEvent('B', 's3'),
    ];
    const result = mineCoFailures(events, 10);
    expect(result.size).toBe(1);
  });

  it('uses the normalized pair key (sorted)', () => {
    const events = [
      makeEvent('B', 's1'), makeEvent('A', 's1'),
      makeEvent('B', 's2'), makeEvent('A', 's2'),
      makeEvent('B', 's3'), makeEvent('A', 's3'),
    ];
    const result = mineCoFailures(events, 10);
    const key = normalizeConceptPair('A', 'B'); // 'A|||B'
    expect(result.has(key)).toBe(true);
  });

  it('computes support = count / totalSessions', () => {
    const events = [
      makeEvent('A', 's1'), makeEvent('B', 's1'),
      makeEvent('A', 's2'), makeEvent('B', 's2'),
      makeEvent('A', 's3'), makeEvent('B', 's3'),
    ];
    const result = mineCoFailures(events, 10);
    const key = normalizeConceptPair('A', 'B');
    expect(result.get(key)?.support).toBeCloseTo(3 / 10, 5);
  });

  it('computes confidence = coFailCount / failsA', () => {
    // A fails in 4 sessions, co-fails with B in 3 of them
    const events = [
      makeEvent('A', 's1'), makeEvent('B', 's1'),
      makeEvent('A', 's2'), makeEvent('B', 's2'),
      makeEvent('A', 's3'), makeEvent('B', 's3'),
      makeEvent('A', 's4'), // A alone
    ];
    const result = mineCoFailures(events, 10);
    const key = normalizeConceptPair('A', 'B');
    // confidence = 3/4 = 0.75
    expect(result.get(key)?.confidence).toBeCloseTo(3 / 4, 5);
  });

  it('counts concepts per session, not per event (duplicate same-session concept ignored)', () => {
    // A and B appear twice in same session — should only count once as a pair
    const events = [
      makeEvent('A', 's1', 'c1'), makeEvent('A', 's1', 'c2'), makeEvent('B', 's1'),
      makeEvent('A', 's2'), makeEvent('B', 's2'),
      makeEvent('A', 's3'), makeEvent('B', 's3'),
    ];
    const result = mineCoFailures(events, 10);
    const key = normalizeConceptPair('A', 'B');
    // Still 3 sessions with both A and B
    expect(result.get(key)?.count).toBe(3);
  });

  it('lift > 1 indicates positive association', () => {
    const events = [
      makeEvent('A', 's1'), makeEvent('B', 's1'),
      makeEvent('A', 's2'), makeEvent('B', 's2'),
      makeEvent('A', 's3'), makeEvent('B', 's3'),
    ];
    const result = mineCoFailures(events, 6); // 3 co-fails out of 6 sessions
    const key = normalizeConceptPair('A', 'B');
    const metrics = result.get(key);
    // support=0.5, confidence=1.0 (A always with B), pB=0.5, lift=1.0/0.5=2.0
    expect(metrics?.lift).toBeGreaterThan(1);
  });
});

// ─── findKnownLasaPairs ───────────────────────────────────────────────────────

describe('findKnownLasaPairs', () => {
  it('finds pairs for a known medication (case-insensitive)', () => {
    const pairs = findKnownLasaPairs('hydralazine');
    expect(pairs.length).toBeGreaterThan(0);
    // Should match 'hydrALAzine' or 'hydrOXYzine'
    expect(pairs.some(p =>
      p.termA.toLowerCase().includes('hydralazine') ||
      p.termB.toLowerCase().includes('hydralazine') ||
      'hydralazine'.includes(p.termA.toLowerCase()) ||
      'hydralazine'.includes(p.termB.toLowerCase())
    )).toBe(true);
  });

  it('finds pairs for "Cushing" (condition)', () => {
    const pairs = findKnownLasaPairs("Cushing's syndrome");
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('returns empty array for a completely unrelated term', () => {
    const pairs = findKnownLasaPairs('appendectomy');
    expect(pairs).toHaveLength(0);
  });

  it('returns objects with termA, termB, category, severity', () => {
    const pairs = findKnownLasaPairs('morphine');
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      expect(pair).toHaveProperty('termA');
      expect(pair).toHaveProperty('termB');
      expect(pair).toHaveProperty('category');
      expect(pair).toHaveProperty('severity');
    }
  });

  it('returns only medication-category pairs for a medication', () => {
    const pairs = findKnownLasaPairs('dobutamine');
    expect(pairs.length).toBeGreaterThan(0);
    // All matched pairs should be medication category
    expect(pairs.every(p => p.category === 'medication')).toBe(true);
  });

  it('finds nephrotic/nephritic pair via "nephrot"', () => {
    const pairs = findKnownLasaPairs('nephrotic');
    expect(pairs.some(p =>
      p.termA.toLowerCase().includes('nephrot') ||
      p.termB.toLowerCase().includes('nephrot')
    )).toBe(true);
  });
});
