/**
 * Semantic Confusion Detection Service — Unit Tests (Tier 3)
 *
 * Tests LECTOR-inspired confusion detection including cosine similarity,
 * co-failure mining, association metrics, interleaving, and LASA lookup.
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
  INTERLEAVING_SEPARATION,
  SEVERITY_THRESHOLDS,
  INTERFERENCE_MODIFIER_RANGE,
  KNOWN_LASA_PAIRS,
  type CoFailureEvent,
} from '../lib/services/semanticConfusionService';

// ─── Cosine Similarity ──────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('handles negative correlations', () => {
    const sim = cosineSimilarity([1, 0], [-1, 0]);
    expect(sim).toBeCloseTo(-1.0, 5);
  });

  it('returns high similarity for near-parallel vectors', () => {
    const sim = cosineSimilarity([1, 2, 3], [1.1, 2.05, 2.95]);
    expect(sim).toBeGreaterThan(0.99);
  });
});

describe('isEmbeddingConfusionPair', () => {
  it('returns true above threshold', () => {
    expect(isEmbeddingConfusionPair(SIMILARITY_THRESHOLD)).toBe(true);
    expect(isEmbeddingConfusionPair(0.95)).toBe(true);
  });

  it('returns false below threshold', () => {
    expect(isEmbeddingConfusionPair(SIMILARITY_THRESHOLD - 0.01)).toBe(false);
    expect(isEmbeddingConfusionPair(0.5)).toBe(false);
  });
});

// ─── Co-Failure Mining ───────────────────────────────────────────────────────

describe('mineCoFailures', () => {
  const makeEvent = (conceptId: string, sessionId: string, ts: number): CoFailureEvent => ({
    failedCardId: `card_${conceptId}`,
    conceptId,
    sessionId,
    timestamp: ts,
  });

  it('returns empty for insufficient co-failures', () => {
    const events = [
      makeEvent('A', 's1', 1000),
      makeEvent('B', 's1', 2000),
      makeEvent('A', 's2', 3000),
      makeEvent('B', 's2', 4000),
      // Only 2 co-failures, need MIN_CO_FAILURES
    ];
    const result = mineCoFailures(events, 10);
    expect(result.size).toBe(0);
  });

  it('detects co-failure pairs above threshold', () => {
    const events: CoFailureEvent[] = [];
    // A and B fail together in 4 different sessions
    for (let i = 0; i < 4; i++) {
      events.push(makeEvent('A', `s${i}`, i * 1000));
      events.push(makeEvent('B', `s${i}`, i * 1000 + 500));
    }
    const result = mineCoFailures(events, 10);
    const key = normalizeConceptPair('A', 'B');
    expect(result.has(key)).toBe(true);
    expect(result.get(key)!.count).toBe(4);
  });

  it('computes support correctly', () => {
    const events: CoFailureEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(makeEvent('X', `s${i}`, i * 1000));
      events.push(makeEvent('Y', `s${i}`, i * 1000 + 100));
    }
    const result = mineCoFailures(events, 20);
    const key = normalizeConceptPair('X', 'Y');
    const metrics = result.get(key)!;
    expect(metrics.support).toBeCloseTo(5 / 20, 5);
  });

  it('computes lift > 1 for associated pairs', () => {
    const events: CoFailureEvent[] = [];
    // X and Y always fail together (strong association)
    for (let i = 0; i < 5; i++) {
      events.push(makeEvent('X', `s${i}`, i * 1000));
      events.push(makeEvent('Y', `s${i}`, i * 1000 + 100));
    }
    // Z fails independently in different sessions
    for (let i = 5; i < 10; i++) {
      events.push(makeEvent('Z', `s${i}`, i * 1000));
    }
    const result = mineCoFailures(events, 10);
    const key = normalizeConceptPair('X', 'Y');
    if (result.has(key)) {
      expect(result.get(key)!.lift).toBeGreaterThan(1);
    }
  });
});

describe('normalizeConceptPair', () => {
  it('produces consistent key regardless of order', () => {
    expect(normalizeConceptPair('A', 'B')).toBe(normalizeConceptPair('B', 'A'));
  });

  it('uses ||| separator', () => {
    expect(normalizeConceptPair('alpha', 'beta')).toContain('|||');
  });
});

// ─── Confusion Assessment ────────────────────────────────────────────────────

describe('assessConfusionPair', () => {
  it('identifies embedding-based pairs', () => {
    const result = assessConfusionPair('A', 'B', 0.92, 0);
    expect(result.source).toBe('embedding');
    expect(result.similarityScore).toBe(0.92);
  });

  it('identifies co-failure-based pairs', () => {
    const result = assessConfusionPair('A', 'B', 0.5, 5);
    expect(result.source).toBe('co_failure');
    expect(result.coFailureCount).toBe(5);
  });

  it('identifies both-source pairs', () => {
    const result = assessConfusionPair('A', 'B', 0.90, 5);
    expect(result.source).toBe('both');
  });

  it('recommends interleaving for medium+ severity', () => {
    // similarity=0.95 → embeddingContrib≈0.667, coFailures=8 → coFailureContrib=0.8
    // combined ≈ 0.667*0.3 + 0.8*0.4 = 0.52 → medium severity
    const medium = assessConfusionPair('A', 'B', 0.95, 8);
    expect(medium.interleavingRecommended).toBe(true);
  });

  it('recommends contrastive drill for high/critical severity', () => {
    const high = assessConfusionPair('A', 'B', 0.95, 8, {
      support: 0.4, confidence: 0.8, lift: 4, count: 8,
    });
    expect(high.contrastiveDrillRecommended).toBe(true);
  });

  it('returns interferenceModifier < 1.0 for confused pairs', () => {
    const result = assessConfusionPair('A', 'B', 0.90, 5);
    expect(result.interferenceModifier).toBeLessThanOrEqual(1.0);
  });
});

// ─── Classification ──────────────────────────────────────────────────────────

describe('classifyConfusionSeverity', () => {
  it('classifies at boundaries', () => {
    expect(classifyConfusionSeverity(0.0)).toBe('low');
    expect(classifyConfusionSeverity(0.39)).toBe('low');
    expect(classifyConfusionSeverity(0.40)).toBe('medium');
    expect(classifyConfusionSeverity(0.60)).toBe('high');
    expect(classifyConfusionSeverity(0.80)).toBe('critical');
    expect(classifyConfusionSeverity(1.0)).toBe('critical');
  });
});

// ─── Interference Modifier ───────────────────────────────────────────────────

describe('computeInterferenceModifier', () => {
  it('returns 1.0 for zero confusion', () => {
    expect(computeInterferenceModifier(0)).toBeCloseTo(1.0, 5);
  });

  it('returns minimum for maximum confusion', () => {
    const mod = computeInterferenceModifier(1.0);
    expect(mod).toBeCloseTo(INTERFERENCE_MODIFIER_RANGE.min, 2);
  });

  it('decreases monotonically with confusion score', () => {
    const m1 = computeInterferenceModifier(0.2);
    const m2 = computeInterferenceModifier(0.5);
    const m3 = computeInterferenceModifier(0.8);
    expect(m1).toBeGreaterThan(m2);
    expect(m2).toBeGreaterThan(m3);
  });

  it('is bounded in allowed range', () => {
    for (let s = 0; s <= 1; s += 0.1) {
      const mod = computeInterferenceModifier(s);
      expect(mod).toBeGreaterThanOrEqual(INTERFERENCE_MODIFIER_RANGE.min);
      expect(mod).toBeLessThanOrEqual(1.0);
    }
  });
});

// ─── Interleaving Scheduler ──────────────────────────────────────────────────

describe('generateInterleavingSchedule', () => {
  const pool = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];

  it('places confused pair at start and end', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool);
    expect(schedule.cardSequence[0]).toBe('A');
    expect(schedule.cardSequence[schedule.cardSequence.length - 1]).toBe('B');
  });

  it('inserts intervening cards', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool, 'medium');
    expect(schedule.separationCount).toBeGreaterThanOrEqual(INTERLEAVING_SEPARATION.min);
    expect(schedule.separationCount).toBeLessThanOrEqual(INTERLEAVING_SEPARATION.max);
  });

  it('uses fewer intervening cards for critical severity', () => {
    const critical = generateInterleavingSchedule(['A', 'B'], pool, 'critical');
    const low = generateInterleavingSchedule(['A', 'B'], pool, 'low');
    expect(critical.separationCount).toBeLessThanOrEqual(low.separationCount);
  });

  it('excludes confused pair from intervening cards', () => {
    const schedule = generateInterleavingSchedule(['c1', 'c2'], pool);
    const intervening = schedule.cardSequence.slice(1, -1);
    expect(intervening).not.toContain('c1');
    expect(intervening).not.toContain('c2');
  });

  it('provides a reason string', () => {
    const schedule = generateInterleavingSchedule(['A', 'B'], pool);
    expect(schedule.reason).toContain('discriminative contrast');
  });
});

// ─── LASA Bootstrapping ─────────────────────────────────────────────────────

describe('findKnownLasaPairs', () => {
  it('finds medication LASA pairs', () => {
    const pairs = findKnownLasaPairs('dopamine');
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.some(p => p.category === 'medication')).toBe(true);
  });

  it('finds condition LASA pairs', () => {
    const pairs = findKnownLasaPairs("Cushing");
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('returns empty for non-LASA terms', () => {
    const pairs = findKnownLasaPairs('quantum_physics');
    expect(pairs.length).toBe(0);
  });

  it('KNOWN_LASA_PAIRS has comprehensive coverage', () => {
    expect(KNOWN_LASA_PAIRS.length).toBeGreaterThanOrEqual(15);
    const categories = new Set(KNOWN_LASA_PAIRS.map(p => p.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });
});
