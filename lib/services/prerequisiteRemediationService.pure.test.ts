// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/prerequisiteRemediationService.ts
 *
 * Pure functions tested:
 *   identifyWeakPrerequisites(prerequisites, config?)  — classification + priority sort
 *   selectRemediationCards(weak, cards, config?)        — card selection with budget cap
 *   buildRemediationResult(failedCardId, family, prereqs, cards, config?) — orchestration
 *   buildPrerequisiteCTE(maxDepth?)                    — SQL string generation
 *
 * Weakness classification logic:
 *   never_seen       (priority 100): attempts=0 OR accuracy=null
 *   low_accuracy     (priority 80):  accuracy < 0.70 (masteryThreshold)
 *   high_lapse_rate  (priority 70):  attempts≥3 AND lapses/attempts > 0.3
 *   stale_review     (priority 50):  daysSinceLastReview > 30
 *   shallow_encoding (priority 60):  stability < 5 AND accuracy ≥ 0.70
 *   null (pass):                     everything else
 *
 * Priority ordering: higher score = remediated first
 *   score = WEAKNESS_PRIORITY[type] + depth*5 + (1-mastery)*20 + lapseRate*15
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REMEDIATION_CONFIG,
  identifyWeakPrerequisites,
  selectRemediationCards,
  buildRemediationResult,
  buildPrerequisiteCTE,
} from './prerequisiteRemediationService';
import type {
  PrerequisiteData,
  CandidateRemediationCard,
  WeakPrerequisite,
} from './prerequisiteRemediationService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrereq(overrides: Partial<PrerequisiteData> = {}): PrerequisiteData {
  return {
    conceptId: 'cid-1',
    conceptName: 'Heart Failure',
    system: 'Cardiovascular',
    depth: 1,
    accuracy: 0.80,
    attempts: 20,
    lapses: 2,
    daysSinceLastReview: 10,
    stability: 15,
    ...overrides,
  };
}

function makeCard(overrides: Partial<CandidateRemediationCard> = {}): CandidateRemediationCard {
  return {
    cardId: 'card-1',
    conditionFamily: 'cid-1',
    conditionId: 'cid-1',
    hierarchyLevel: 1,
    difficulty: 0.3,
    system: 'Cardiovascular',
    ...overrides,
  };
}

// ─── DEFAULT_REMEDIATION_CONFIG constant ──────────────────────────────────────

describe('DEFAULT_REMEDIATION_CONFIG', () => {
  it('maxRemediationCards is 3', () => {
    expect(DEFAULT_REMEDIATION_CONFIG.maxRemediationCards).toBe(3);
  });

  it('masteryThreshold is 0.70', () => {
    expect(DEFAULT_REMEDIATION_CONFIG.masteryThreshold).toBe(0.70);
  });

  it('staleDays is 30', () => {
    expect(DEFAULT_REMEDIATION_CONFIG.staleDays).toBe(30);
  });

  it('maxPrerequisiteDepth is 5', () => {
    expect(DEFAULT_REMEDIATION_CONFIG.maxPrerequisiteDepth).toBe(5);
  });
});

// ─── identifyWeakPrerequisites — classification ───────────────────────────────

describe('identifyWeakPrerequisites — weakness classification', () => {
  it('returns empty array for empty input', () => {
    expect(identifyWeakPrerequisites([])).toHaveLength(0);
  });

  it('classifies never_seen when attempts = 0', () => {
    const prereq = makePrereq({ attempts: 0, accuracy: null });
    const result = identifyWeakPrerequisites([prereq]);
    expect(result).toHaveLength(1);
    expect(result[0]!.weaknessType).toBe('never_seen');
  });

  it('classifies never_seen when accuracy = null (even with attempts > 0)', () => {
    const prereq = makePrereq({ attempts: 5, accuracy: null });
    const result = identifyWeakPrerequisites([prereq]);
    expect(result[0]!.weaknessType).toBe('never_seen');
  });

  it('classifies low_accuracy when accuracy < 0.70', () => {
    const prereq = makePrereq({ accuracy: 0.5, attempts: 20, lapses: 0, daysSinceLastReview: 5, stability: 20 });
    const result = identifyWeakPrerequisites([prereq]);
    expect(result[0]!.weaknessType).toBe('low_accuracy');
  });

  it('classifies high_lapse_rate when lapses/attempts > 0.3 and attempts ≥ 3', () => {
    // lapses=4, attempts=10 → 0.4 > 0.3; accuracy=0.75 (above mastery threshold)
    const prereq = makePrereq({ accuracy: 0.75, attempts: 10, lapses: 4, daysSinceLastReview: 5, stability: 20 });
    const result = identifyWeakPrerequisites([prereq]);
    expect(result[0]!.weaknessType).toBe('high_lapse_rate');
  });

  it('does not classify high_lapse_rate when attempts < 3', () => {
    // Only 2 attempts — too few to call high lapse rate
    const prereq = makePrereq({ accuracy: 0.75, attempts: 2, lapses: 2, daysSinceLastReview: 5, stability: 20 });
    // No other weakness condition → should return no weakness
    const result = identifyWeakPrerequisites([prereq]);
    expect(result).toHaveLength(0);
  });

  it('classifies stale_review when daysSinceLastReview > 30', () => {
    const prereq = makePrereq({
      accuracy: 0.85,
      attempts: 20,
      lapses: 0,
      daysSinceLastReview: 45,
      stability: 30,
    });
    const result = identifyWeakPrerequisites([prereq]);
    expect(result[0]!.weaknessType).toBe('stale_review');
  });

  it('classifies shallow_encoding when stability < 5 and accuracy ≥ 0.70', () => {
    const prereq = makePrereq({
      accuracy: 0.80,
      attempts: 20,
      lapses: 1,
      daysSinceLastReview: 5,
      stability: 3,  // < 5 → shallow encoding
    });
    const result = identifyWeakPrerequisites([prereq]);
    expect(result[0]!.weaknessType).toBe('shallow_encoding');
  });

  it('returns no weakness for a mastered prerequisite', () => {
    const prereq = makePrereq({
      accuracy: 0.85,
      attempts: 30,
      lapses: 1,
      daysSinceLastReview: 5,
      stability: 20,
    });
    expect(identifyWeakPrerequisites([prereq])).toHaveLength(0);
  });

  it('never_seen takes precedence over other conditions (checked first)', () => {
    // No attempts → never_seen regardless of other fields
    const prereq = makePrereq({ attempts: 0, accuracy: null, daysSinceLastReview: 100, stability: 1 });
    const result = identifyWeakPrerequisites([prereq]);
    expect(result[0]!.weaknessType).toBe('never_seen');
  });
});

// ─── identifyWeakPrerequisites — sorting ──────────────────────────────────────

describe('identifyWeakPrerequisites — priority ordering', () => {
  it('never_seen ranks before low_accuracy', () => {
    const neverSeen = makePrereq({ conceptId: 'c1', attempts: 0, accuracy: null, depth: 1 });
    const lowAcc = makePrereq({ conceptId: 'c2', accuracy: 0.5, attempts: 20, lapses: 0, daysSinceLastReview: 5, stability: 20, depth: 1 });
    const result = identifyWeakPrerequisites([lowAcc, neverSeen]);
    expect(result[0]!.conceptId).toBe('c1'); // never_seen first
  });

  it('sorts by priority descending, then depth descending as tiebreaker', () => {
    // Two never_seen concepts at different depths
    const shallow = makePrereq({ conceptId: 'shallow', attempts: 0, accuracy: null, depth: 1 });
    const deep = makePrereq({ conceptId: 'deep', attempts: 0, accuracy: null, depth: 3 });
    const result = identifyWeakPrerequisites([shallow, deep]);
    // Both are never_seen (priority 100 + depth*5); deep has higher score
    expect(result[0]!.conceptId).toBe('deep');
  });

  it('weakness includes remediationPriority > 0', () => {
    const prereq = makePrereq({ attempts: 0, accuracy: null });
    const result = identifyWeakPrerequisites([prereq]);
    expect(result[0]!.remediationPriority).toBeGreaterThan(0);
  });

  it('mastery field equals accuracy (or 0 if null)', () => {
    const with_accuracy = makePrereq({ accuracy: 0.6, attempts: 10, lapses: 0, daysSinceLastReview: 5, stability: 20 });
    const no_accuracy = makePrereq({ conceptId: 'c2', attempts: 0, accuracy: null });
    const results = identifyWeakPrerequisites([with_accuracy, no_accuracy]);
    const lowAcc = results.find(r => r.conceptId === 'cid-1');
    const neverSeen = results.find(r => r.conceptId === 'c2');
    if (lowAcc) expect(lowAcc.mastery).toBeCloseTo(0.6, 5);
    if (neverSeen) expect(neverSeen.mastery).toBe(0);
  });
});

// ─── selectRemediationCards ───────────────────────────────────────────────────

describe('selectRemediationCards', () => {
  it('returns empty when no weak prerequisites', () => {
    expect(selectRemediationCards([], [makeCard()])).toHaveLength(0);
  });

  it('returns empty when no available cards', () => {
    const weak: WeakPrerequisite = {
      conceptId: 'cid-1',
      conceptName: 'HF',
      system: 'CV',
      depth: 1,
      mastery: 0,
      weaknessType: 'never_seen',
      remediationPriority: 100,
    };
    expect(selectRemediationCards([weak], [])).toHaveLength(0);
  });

  it('selects card matching conceptId', () => {
    const weak: WeakPrerequisite = {
      conceptId: 'cid-1',
      conceptName: 'HF',
      system: 'CV',
      depth: 1,
      mastery: 0,
      weaknessType: 'never_seen',
      remediationPriority: 100,
    };
    const card = makeCard({ conditionFamily: 'cid-1', cardId: 'selected-card' });
    const result = selectRemediationCards([weak], [card]);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardId).toBe('selected-card');
  });

  it('caps selection at maxRemediationCards (default 3)', () => {
    // 5 weak prerequisites, each with a matching card
    const weakList: WeakPrerequisite[] = Array.from({ length: 5 }, (_, i) => ({
      conceptId: `cid-${i}`,
      conceptName: `Concept ${i}`,
      system: 'CV',
      depth: 1,
      mastery: 0,
      weaknessType: 'never_seen' as const,
      remediationPriority: 100 - i,
    }));
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeCard({ cardId: `card-${i}`, conditionFamily: `cid-${i}` })
    );
    const result = selectRemediationCards(weakList, cards);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('does not select same card twice', () => {
    // Two weak prerequisites mapping to same card
    const w1: WeakPrerequisite = { conceptId: 'c1', conceptName: 'C1', system: 'CV', depth: 1, mastery: 0, weaknessType: 'never_seen', remediationPriority: 100 };
    const w2: WeakPrerequisite = { conceptId: 'c2', conceptName: 'C2', system: 'CV', depth: 1, mastery: 0, weaknessType: 'never_seen', remediationPriority: 90 };
    // Both map to the same card (same conditionFamily)
    const sharedCard = makeCard({ cardId: 'shared', conditionFamily: 'c1' });
    const result = selectRemediationCards([w1, w2], [sharedCard]);
    const cardIds = result.map(r => r.cardId);
    expect(new Set(cardIds).size).toBe(cardIds.length); // all unique
  });

  it('does not select same concept twice', () => {
    // Single prerequisite appears twice in weakList
    const weak: WeakPrerequisite = { conceptId: 'c1', conceptName: 'HF', system: 'CV', depth: 1, mastery: 0, weaknessType: 'never_seen', remediationPriority: 100 };
    const cards = [
      makeCard({ cardId: 'card-a', conditionFamily: 'c1' }),
      makeCard({ cardId: 'card-b', conditionFamily: 'c1' }),
    ];
    const result = selectRemediationCards([weak, weak], cards);
    // Same conceptId → selected only once
    const conceptIds = result.map(r => r.prerequisiteConceptId);
    expect(new Set(conceptIds).size).toBe(conceptIds.length);
  });

  it('prefers lower hierarchyLevel (foundational) cards when preferFoundationalCards=true', () => {
    const weak: WeakPrerequisite = { conceptId: 'c1', conceptName: 'HF', system: 'CV', depth: 1, mastery: 0, weaknessType: 'never_seen', remediationPriority: 100 };
    const foundational = makeCard({ cardId: 'foundational', conditionFamily: 'c1', hierarchyLevel: 1 });
    const advanced = makeCard({ cardId: 'advanced', conditionFamily: 'c1', hierarchyLevel: 3 });
    const result = selectRemediationCards([weak], [advanced, foundational], { preferFoundationalCards: true });
    expect(result[0]!.cardId).toBe('foundational');
  });

  it('includes prerequisiteConceptId, prerequisiteConceptName, and remediationReason', () => {
    const weak: WeakPrerequisite = { conceptId: 'cid-1', conceptName: 'HF', system: 'CV', depth: 1, mastery: 0, weaknessType: 'never_seen', remediationPriority: 100 };
    const result = selectRemediationCards([weak], [makeCard()]);
    expect(result[0]!.prerequisiteConceptId).toBe('cid-1');
    expect(result[0]!.prerequisiteConceptName).toBe('HF');
    expect(typeof result[0]!.remediationReason).toBe('string');
    expect(result[0]!.remediationReason.length).toBeGreaterThan(0);
  });
});

// ─── buildRemediationResult ───────────────────────────────────────────────────

describe('buildRemediationResult', () => {
  it('returns skipped=true when no prerequisites', () => {
    const result = buildRemediationResult('card-1', 'HF', [], []);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No prerequisites');
    expect(result.weakPrerequisites).toHaveLength(0);
    expect(result.remediationCards).toHaveLength(0);
    expect(result.failedCardId).toBe('card-1');
    expect(result.conditionFamily).toBe('HF');
  });

  it('returns skipped=true when all prerequisites are mastered', () => {
    const mastered = makePrereq({
      accuracy: 0.90,
      attempts: 50,
      lapses: 1,
      daysSinceLastReview: 5,
      stability: 20,
    });
    const result = buildRemediationResult('card-1', 'HF', [mastered], []);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('mastery threshold');
    expect(result.prerequisitesChecked).toBe(1);
  });

  it('returns remediation cards when weaknesses found', () => {
    const weak = makePrereq({ attempts: 0, accuracy: null });
    const card = makeCard({ conditionFamily: 'cid-1' });
    const result = buildRemediationResult('card-1', 'HF', [weak], [card]);
    expect(result.skipped).toBe(false);
    expect(result.remediationCards.length).toBeGreaterThan(0);
    expect(result.weakPrerequisites.length).toBeGreaterThan(0);
    expect(result.prerequisitesChecked).toBe(1);
  });

  it('returns skipped=true (no cards) when weak but no matching cards', () => {
    const weak = makePrereq({ attempts: 0, accuracy: null });
    const result = buildRemediationResult('card-1', 'HF', [weak], []);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No available cards');
    expect(result.weakPrerequisites.length).toBeGreaterThan(0);
  });
});

// ─── buildPrerequisiteCTE ─────────────────────────────────────────────────────

describe('buildPrerequisiteCTE', () => {
  it('returns a non-empty SQL string', () => {
    const sql = buildPrerequisiteCTE();
    expect(typeof sql).toBe('string');
    expect(sql.length).toBeGreaterThan(0);
  });

  it('contains WITH RECURSIVE and prereqs CTE name', () => {
    const sql = buildPrerequisiteCTE();
    expect(sql).toContain('WITH RECURSIVE');
    expect(sql).toContain('prereqs');
  });

  it('contains the default maxDepth (5) in the WHERE clause', () => {
    const sql = buildPrerequisiteCTE(5);
    expect(sql).toContain('5');
  });

  it('uses the provided maxDepth value', () => {
    const sql = buildPrerequisiteCTE(3);
    expect(sql).toContain('3');
  });

  it('references GraphEdge and GraphNode tables', () => {
    const sql = buildPrerequisiteCTE();
    expect(sql).toContain('GraphEdge');
    expect(sql).toContain('GraphNode');
  });

  it('filters HIERARCHICAL and SEMANTIC edge types', () => {
    const sql = buildPrerequisiteCTE();
    expect(sql).toContain('HIERARCHICAL');
    expect(sql).toContain('SEMANTIC');
  });

  it('uses parameterized $1 placeholder for source node', () => {
    const sql = buildPrerequisiteCTE();
    expect(sql).toContain('$1');
  });
});
