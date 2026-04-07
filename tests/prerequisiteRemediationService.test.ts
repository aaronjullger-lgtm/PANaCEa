/**
 * Prerequisite Remediation Service — Unit Tests (Tier 2, Feature 2)
 *
 * Tests the error-driven prerequisite remediation card selector:
 * weakness classification, priority scoring, card selection,
 * remediation budget enforcement, and result building.
 */

import { describe, it, expect } from 'vitest';
import {
  identifyWeakPrerequisites,
  selectRemediationCards,
  buildRemediationResult,
  buildPrerequisiteCTE,
  DEFAULT_REMEDIATION_CONFIG,
  type PrerequisiteData,
  type CandidateRemediationCard,
} from '../lib/services/prerequisiteRemediationService';

// ─── Helpers ────────────────────────────────────────────────────

function makePrereq(overrides: Partial<PrerequisiteData> & { conceptId: string }): PrerequisiteData {
  return {
    conceptName: overrides.conceptId,
    system: 'CV',
    depth: 1,
    accuracy: 0.80,
    attempts: 10,
    lapses: 2,
    daysSinceLastReview: 5,
    stability: 15,
    ...overrides,
  };
}

function makeCard(overrides: Partial<CandidateRemediationCard> & { cardId: string }): CandidateRemediationCard {
  return {
    conditionFamily: 'default',
    conditionId: 'cond-1',
    hierarchyLevel: 1,
    difficulty: 5,
    system: 'CV',
    ...overrides,
  };
}

// ─── identifyWeakPrerequisites ──────────────────────────────────

describe('identifyWeakPrerequisites', () => {
  it('returns empty array for empty input', () => {
    expect(identifyWeakPrerequisites([])).toEqual([]);
  });

  it('identifies never_seen prerequisites', () => {
    const prereqs = [
      makePrereq({ conceptId: 'c1', attempts: 0, accuracy: null }),
    ];
    const result = identifyWeakPrerequisites(prereqs);
    expect(result).toHaveLength(1);
    expect(result[0]!.weaknessType).toBe('never_seen');
  });

  it('identifies low_accuracy prerequisites', () => {
    const prereqs = [
      makePrereq({ conceptId: 'c1', accuracy: 0.50, attempts: 10 }),
    ];
    const result = identifyWeakPrerequisites(prereqs);
    expect(result).toHaveLength(1);
    expect(result[0]!.weaknessType).toBe('low_accuracy');
  });

  it('identifies high_lapse_rate prerequisites', () => {
    const prereqs = [
      makePrereq({ conceptId: 'c1', accuracy: 0.75, attempts: 10, lapses: 4 }),
    ];
    const result = identifyWeakPrerequisites(prereqs);
    expect(result).toHaveLength(1);
    expect(result[0]!.weaknessType).toBe('high_lapse_rate');
  });

  it('identifies stale_review prerequisites', () => {
    const prereqs = [
      makePrereq({ conceptId: 'c1', accuracy: 0.85, daysSinceLastReview: 45, lapses: 1 }),
    ];
    const result = identifyWeakPrerequisites(prereqs);
    expect(result).toHaveLength(1);
    expect(result[0]!.weaknessType).toBe('stale_review');
  });

  it('identifies shallow_encoding prerequisites', () => {
    const prereqs = [
      makePrereq({ conceptId: 'c1', accuracy: 0.80, stability: 3, lapses: 1, daysSinceLastReview: 2 }),
    ];
    const result = identifyWeakPrerequisites(prereqs);
    expect(result).toHaveLength(1);
    expect(result[0]!.weaknessType).toBe('shallow_encoding');
  });

  it('excludes prerequisites that meet mastery threshold', () => {
    const prereqs = [
      makePrereq({ conceptId: 'good', accuracy: 0.90, stability: 20, daysSinceLastReview: 5, lapses: 0 }),
    ];
    const result = identifyWeakPrerequisites(prereqs);
    expect(result).toHaveLength(0);
  });

  it('sorts by priority descending then depth descending', () => {
    const prereqs = [
      makePrereq({ conceptId: 'stale', accuracy: 0.85, daysSinceLastReview: 45, depth: 1, lapses: 1 }),
      makePrereq({ conceptId: 'never', attempts: 0, accuracy: null, depth: 2 }),
      makePrereq({ conceptId: 'low', accuracy: 0.40, attempts: 10, depth: 3 }),
    ];
    const result = identifyWeakPrerequisites(prereqs);
    expect(result).toHaveLength(3);
    // never_seen (100 base + depth bonus + mastery bonus) should be highest
    expect(result[0]!.weaknessType).toBe('never_seen');
  });
});

// ─── selectRemediationCards ─────────────────────────────────────

describe('selectRemediationCards', () => {
  it('returns empty array when no cards available', () => {
    const weakPrereqs = identifyWeakPrerequisites([
      makePrereq({ conceptId: 'c1', attempts: 0, accuracy: null }),
    ]);
    const result = selectRemediationCards(weakPrereqs, []);
    expect(result).toEqual([]);
  });

  it('selects cards matching weak prerequisites', () => {
    const weakPrereqs = identifyWeakPrerequisites([
      makePrereq({ conceptId: 'SVT', conceptName: 'SVT', attempts: 0, accuracy: null }),
    ]);
    const cards = [
      makeCard({ cardId: 'q1', conditionFamily: 'SVT', hierarchyLevel: 1 }),
    ];
    const result = selectRemediationCards(weakPrereqs, cards);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardId).toBe('q1');
    expect(result[0]!.prerequisiteConceptName).toBe('SVT');
  });

  it('respects remediation budget (max 3 by default)', () => {
    const prereqs = Array.from({ length: 5 }, (_, i) =>
      makePrereq({ conceptId: `c${i}`, conceptName: `Concept ${i}`, attempts: 0, accuracy: null })
    );
    const weakPrereqs = identifyWeakPrerequisites(prereqs);
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeCard({ cardId: `q${i}`, conditionFamily: `Concept ${i}`, hierarchyLevel: 1 })
    );
    const result = selectRemediationCards(weakPrereqs, cards);
    expect(result).toHaveLength(3);
  });

  it('does not select duplicate cards', () => {
    const weakPrereqs = identifyWeakPrerequisites([
      makePrereq({ conceptId: 'c1', conceptName: 'SVT', attempts: 0, accuracy: null }),
    ]);
    // Two cards for same concept — should only pick one
    const cards = [
      makeCard({ cardId: 'q1', conditionFamily: 'SVT', hierarchyLevel: 1 }),
      makeCard({ cardId: 'q2', conditionFamily: 'SVT', hierarchyLevel: 2 }),
    ];
    const result = selectRemediationCards(weakPrereqs, cards);
    expect(result).toHaveLength(1);
    // Should prefer level 1 (foundational)
    expect(result[0]!.hierarchyLevel).toBe(1);
  });

  it('prefers foundational (lower hierarchy level) cards', () => {
    const weakPrereqs = identifyWeakPrerequisites([
      makePrereq({ conceptId: 'c1', conceptName: 'Afib', attempts: 0, accuracy: null }),
    ]);
    const cards = [
      makeCard({ cardId: 'q3', conditionFamily: 'Afib', hierarchyLevel: 3 }),
      makeCard({ cardId: 'q1', conditionFamily: 'Afib', hierarchyLevel: 1 }),
      makeCard({ cardId: 'q2', conditionFamily: 'Afib', hierarchyLevel: 2 }),
    ];
    const result = selectRemediationCards(weakPrereqs, cards);
    expect(result[0]!.hierarchyLevel).toBe(1);
  });

  it('skips concepts without available cards', () => {
    const weakPrereqs = identifyWeakPrerequisites([
      makePrereq({ conceptId: 'c1', conceptName: 'SVT', attempts: 0, accuracy: null }),
      makePrereq({ conceptId: 'c2', conceptName: 'Afib', attempts: 0, accuracy: null }),
    ]);
    // Only have cards for Afib
    const cards = [
      makeCard({ cardId: 'q1', conditionFamily: 'Afib', hierarchyLevel: 1 }),
    ];
    const result = selectRemediationCards(weakPrereqs, cards);
    expect(result).toHaveLength(1);
    expect(result[0]!.prerequisiteConceptName).toBe('Afib');
  });
});

// ─── buildRemediationResult ─────────────────────────────────────

describe('buildRemediationResult', () => {
  it('returns skipped result for empty prerequisites', () => {
    const result = buildRemediationResult('failed-1', 'VT', [], []);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No prerequisites found');
    expect(result.remediationCards).toEqual([]);
  });

  it('returns skipped result when all prerequisites meet mastery', () => {
    const prereqs = [
      makePrereq({ conceptId: 'c1', accuracy: 0.90, stability: 20, daysSinceLastReview: 5, lapses: 0 }),
    ];
    const result = buildRemediationResult('failed-1', 'VT', prereqs, []);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('mastery threshold');
  });

  it('builds complete result with remediation cards', () => {
    const prereqs = [
      makePrereq({ conceptId: 'c1', conceptName: 'SVT', attempts: 0, accuracy: null }),
    ];
    const cards = [
      makeCard({ cardId: 'q1', conditionFamily: 'SVT', hierarchyLevel: 1 }),
    ];
    const result = buildRemediationResult('failed-1', 'VT', prereqs, cards);
    expect(result.skipped).toBe(false);
    expect(result.failedCardId).toBe('failed-1');
    expect(result.conditionFamily).toBe('VT');
    expect(result.remediationCards).toHaveLength(1);
    expect(result.weakPrerequisites).toHaveLength(1);
    expect(result.prerequisitesChecked).toBe(1);
  });

  it('returns skipped when cards exist but none match weak prereqs', () => {
    const prereqs = [
      makePrereq({ conceptId: 'c1', conceptName: 'SVT', attempts: 0, accuracy: null }),
    ];
    const cards = [
      makeCard({ cardId: 'q1', conditionFamily: 'Afib', hierarchyLevel: 1 }), // Wrong concept
    ];
    const result = buildRemediationResult('failed-1', 'VT', prereqs, cards);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No available cards');
  });
});

// ─── buildPrerequisiteCTE ───────────────────────────────────────

describe('buildPrerequisiteCTE', () => {
  it('generates valid SQL with default depth', () => {
    const sql = buildPrerequisiteCTE();
    expect(sql).toContain('WITH RECURSIVE prereqs');
    expect(sql).toContain('HIERARCHICAL');
    expect(sql).toContain('SEMANTIC');
    expect(sql).toContain('p.depth < 5');
  });

  it('respects custom max depth', () => {
    const sql = buildPrerequisiteCTE(3);
    expect(sql).toContain('p.depth < 3');
  });

  it('selects distinct on conceptId', () => {
    const sql = buildPrerequisiteCTE();
    expect(sql).toContain('DISTINCT ON ("conceptId")');
  });
});

// ─── Configuration defaults ─────────────────────────────────────

describe('configuration defaults', () => {
  it('has sensible default config', () => {
    expect(DEFAULT_REMEDIATION_CONFIG.maxRemediationCards).toBe(3);
    expect(DEFAULT_REMEDIATION_CONFIG.maxPrerequisiteDepth).toBe(5);
    expect(DEFAULT_REMEDIATION_CONFIG.masteryThreshold).toBe(0.70);
    expect(DEFAULT_REMEDIATION_CONFIG.staleDays).toBe(30);
  });
});
