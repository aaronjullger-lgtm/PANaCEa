/**
 * Consolidation Session Service — Unit Tests (Tier 2, Feature 5)
 *
 * Tests the pre-sleep consolidation card selector: eligibility filtering,
 * priority scoring, domain interleaving, bedtime window detection, and
 * session summary computation.
 */

import { describe, it, expect } from 'vitest';
import {
  selectConsolidationCards,
  isInConsolidationWindow,
  getConsolidationNotificationTime,
  summarizeConsolidationSession,
  DEFAULT_CONSOLIDATION_CONFIG,
  MIN_BEDTIME_OFFSET_MINUTES,
  MAX_BEDTIME_OFFSET_MINUTES,
  type ConsolidationCandidate,
  type ConsolidationConfig,
} from '../lib/services/consolidationSessionService';

// ─── Helpers ────────────────────────────────────────────────────

/** Create a candidate with sensible defaults */
function makeCandidate(
  overrides: Partial<ConsolidationCandidate> & { cardId: string }
): ConsolidationCandidate {
  return {
    retrievability: 0.85,
    difficulty: 5,
    stability: 10,
    reviewedToday: false,
    failedToday: false,
    learnedToday: false,
    nextReviewDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    ...overrides,
  };
}

/** Create a "failed today" candidate */
function failedCandidate(id: string, domain?: string): ConsolidationCandidate {
  return makeCandidate({
    cardId: id,
    retrievability: 0.60,
    failedToday: true,
    reviewedToday: true,
    domain,
  });
}

/** Create a "learned today" candidate */
function learnedCandidate(id: string, domain?: string): ConsolidationCandidate {
  return makeCandidate({
    cardId: id,
    retrievability: 0.90,
    learnedToday: true,
    reviewedToday: true,
    stability: 1,
    domain,
  });
}

/** Create an "approaching due" candidate */
function approachingCandidate(id: string, domain?: string): ConsolidationCandidate {
  return makeCandidate({
    cardId: id,
    retrievability: 0.88,
    nextReviewDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // tomorrow
    domain,
  });
}

// ─── selectConsolidationCards ───────────────────────────────────

describe('selectConsolidationCards', () => {
  it('returns empty array for empty input', () => {
    expect(selectConsolidationCards([])).toEqual([]);
  });

  it('returns empty array when no candidates pass eligibility', () => {
    const candidates = [
      // Too easy (R > 0.95)
      makeCandidate({ cardId: 'easy', retrievability: 0.99 }),
      // Too hard (R < 0.40)
      makeCandidate({ cardId: 'hard', retrievability: 0.20 }),
      // Too difficult (D > 8)
      makeCandidate({ cardId: 'tough', difficulty: 9.5 }),
    ];
    expect(selectConsolidationCards(candidates)).toEqual([]);
  });

  it('selects eligible cards', () => {
    const candidates = [
      makeCandidate({ cardId: 'a', retrievability: 0.85 }),
      makeCandidate({ cardId: 'b', retrievability: 0.90 }),
    ];
    const result = selectConsolidationCards(candidates);
    expect(result).toHaveLength(2);
  });

  it('assigns sequential positions', () => {
    const candidates = [
      makeCandidate({ cardId: 'a' }),
      makeCandidate({ cardId: 'b' }),
      makeCandidate({ cardId: 'c' }),
    ];
    const result = selectConsolidationCards(candidates);
    expect(result.map(c => c.position)).toEqual([0, 1, 2]);
  });

  it('respects maxCards limit', () => {
    const candidates = Array.from({ length: 30 }, (_, i) =>
      makeCandidate({ cardId: `c${i}`, retrievability: 0.85 })
    );
    const result = selectConsolidationCards(candidates, { maxCards: 5 });
    expect(result).toHaveLength(5);
  });

  it('respects maxMinutes duration limit', () => {
    const candidates = Array.from({ length: 30 }, (_, i) =>
      makeCandidate({ cardId: `c${i}`, retrievability: 0.85 })
    );
    // 5 min * 60s / 45s per card = 6.67 → 6 cards max
    const result = selectConsolidationCards(candidates, { maxMinutes: 5 });
    expect(result.length).toBeLessThanOrEqual(6);
  });
});

// ─── Priority ordering ──────────────────────────────────────────

describe('priority ordering', () => {
  it('prioritizes failed-today over learned-today', () => {
    const candidates = [
      learnedCandidate('learned'),
      failedCandidate('failed'),
    ];
    const result = selectConsolidationCards(candidates);
    expect(result[0]!.cardId).toBe('failed');
    expect(result[0]!.selectionReason).toBe('failed_today');
  });

  it('prioritizes learned-today over approaching-due', () => {
    const candidates = [
      approachingCandidate('approaching'),
      learnedCandidate('learned'),
    ];
    const result = selectConsolidationCards(candidates);
    expect(result[0]!.cardId).toBe('learned');
    expect(result[0]!.selectionReason).toBe('learned_today');
  });

  it('prioritizes approaching-due over threshold-review', () => {
    const candidates = [
      makeCandidate({ cardId: 'threshold', retrievability: 0.88 }),
      approachingCandidate('approaching'),
    ];
    const result = selectConsolidationCards(candidates);
    expect(result[0]!.cardId).toBe('approaching');
    expect(result[0]!.selectionReason).toBe('approaching_due');
  });

  it('assigns correct selection reasons', () => {
    const candidates = [
      failedCandidate('f1'),
      learnedCandidate('l1'),
      approachingCandidate('a1'),
      makeCandidate({ cardId: 't1', retrievability: 0.88, nextReviewDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) }),
    ];
    const result = selectConsolidationCards(candidates);
    const reasons = new Map(result.map(c => [c.cardId, c.selectionReason]));
    expect(reasons.get('f1')).toBe('failed_today');
    expect(reasons.get('l1')).toBe('learned_today');
    expect(reasons.get('a1')).toBe('approaching_due');
    expect(reasons.get('t1')).toBe('threshold_review');
  });
});

// ─── Eligibility filtering ──────────────────────────────────────

describe('eligibility filtering', () => {
  it('excludes cards with R > maxRetrievability (too easy)', () => {
    const candidates = [
      makeCandidate({ cardId: 'easy', retrievability: 0.98 }),
    ];
    expect(selectConsolidationCards(candidates)).toEqual([]);
  });

  it('excludes cards with R < minRetrievability (too hard)', () => {
    const candidates = [
      makeCandidate({ cardId: 'hard', retrievability: 0.30 }),
    ];
    expect(selectConsolidationCards(candidates)).toEqual([]);
  });

  it('excludes cards with D > maxDifficulty (arousal concern)', () => {
    const candidates = [
      makeCandidate({ cardId: 'tough', retrievability: 0.85, difficulty: 9.0 }),
    ];
    expect(selectConsolidationCards(candidates)).toEqual([]);
  });

  it('failed-today cards bypass R floor', () => {
    const candidates = [
      makeCandidate({ cardId: 'failed-low-r', retrievability: 0.25, failedToday: true }),
    ];
    const result = selectConsolidationCards(candidates);
    expect(result).toHaveLength(1);
    expect(result[0]!.selectionReason).toBe('failed_today');
  });

  it('failed-today cards still respect D ceiling', () => {
    const candidates = [
      makeCandidate({ cardId: 'failed-hard', retrievability: 0.25, failedToday: true, difficulty: 9.5 }),
    ];
    expect(selectConsolidationCards(candidates)).toEqual([]);
  });

  it('learned-today cards respect R floor but not R ceiling', () => {
    // R = 0.97 > maxR but learnedToday → should be included (fresh learning can be high R)
    const candidates = [
      makeCandidate({ cardId: 'fresh', retrievability: 0.97, learnedToday: true }),
    ];
    const result = selectConsolidationCards(candidates);
    expect(result).toHaveLength(1);
  });
});

// ─── Domain interleaving ────────────────────────────────────────

describe('domain interleaving', () => {
  it('interleaves cards from different domains', () => {
    const candidates = [
      failedCandidate('cv1', 'CV'),
      failedCandidate('cv2', 'CV'),
      failedCandidate('cv3', 'CV'),
      learnedCandidate('pulm1', 'PULM'),
      learnedCandidate('pulm2', 'PULM'),
      learnedCandidate('pulm3', 'PULM'),
    ];
    const result = selectConsolidationCards(candidates);

    // Check that we don't have 3+ consecutive same-domain cards
    let maxConsecutive = 1;
    let current = 1;
    for (let i = 1; i < result.length; i++) {
      if (result[i]!.domain === result[i - 1]!.domain) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 1;
      }
    }
    expect(maxConsecutive).toBeLessThanOrEqual(2);
  });

  it('handles cards without domains gracefully', () => {
    const candidates = [
      makeCandidate({ cardId: 'a', retrievability: 0.85 }),
      makeCandidate({ cardId: 'b', retrievability: 0.90 }),
    ];
    const result = selectConsolidationCards(candidates);
    expect(result).toHaveLength(2);
  });
});

// ─── isInConsolidationWindow ────────────────────────────────────

describe('isInConsolidationWindow', () => {
  it('returns true within the window (bedtime 22:00, check at 20:30)', () => {
    // Window: 22:00 - 2h = 20:00 to 22:00 - 1h = 21:00
    expect(isInConsolidationWindow(20.5, 22, 0)).toBe(true);
  });

  it('returns false before the window (bedtime 22:00, check at 19:00)', () => {
    expect(isInConsolidationWindow(19.0, 22, 0)).toBe(false);
  });

  it('returns false after the window (bedtime 22:00, check at 21:30)', () => {
    // 21:30 is past 21:00 (bedtime - 60min)
    expect(isInConsolidationWindow(21.5, 22, 0)).toBe(false);
  });

  it('handles midnight-crossing bedtime (bedtime 00:30)', () => {
    // Window: 00:30 - 2h = 22:30 to 00:30 - 1h = 23:30
    expect(isInConsolidationWindow(23.0, 0, 30)).toBe(true);
  });

  it('handles early bedtime (bedtime 21:00)', () => {
    // Window: 21:00 - 2h = 19:00 to 21:00 - 1h = 20:00
    expect(isInConsolidationWindow(19.5, 21, 0)).toBe(true);
    expect(isInConsolidationWindow(18.5, 21, 0)).toBe(false);
  });

  it('uses bedtimeMinute for precision', () => {
    // Bedtime 22:30 → window 20:30 to 21:30
    expect(isInConsolidationWindow(21.0, 22, 30)).toBe(true);
    expect(isInConsolidationWindow(20.0, 22, 30)).toBe(false);
  });
});

// ─── getConsolidationNotificationTime ───────────────────────────

describe('getConsolidationNotificationTime', () => {
  it('returns correct time for standard bedtime (22:00)', () => {
    // 22:00 - 120min = 20:00
    const { hour, minute } = getConsolidationNotificationTime(22, 0);
    expect(hour).toBe(20);
    expect(minute).toBe(0);
  });

  it('returns correct time for bedtime with minutes (22:30)', () => {
    // 22:30 - 120min = 20:30
    const { hour, minute } = getConsolidationNotificationTime(22, 30);
    expect(hour).toBe(20);
    expect(minute).toBe(30);
  });

  it('handles midnight crossing (bedtime 00:30)', () => {
    // 00:30 - 120min = 22:30
    const { hour, minute } = getConsolidationNotificationTime(0, 30);
    expect(hour).toBe(22);
    expect(minute).toBe(30);
  });

  it('handles early bedtime (bedtime 01:00)', () => {
    // 01:00 - 120min = 23:00
    const { hour, minute } = getConsolidationNotificationTime(1, 0);
    expect(hour).toBe(23);
    expect(minute).toBe(0);
  });
});

// ─── summarizeConsolidationSession ──────────────────────────────

describe('summarizeConsolidationSession', () => {
  it('computes correct summary for mixed session', () => {
    const candidates = [
      failedCandidate('f1', 'CV'),
      learnedCandidate('l1', 'PULM'),
      approachingCandidate('a1', 'NEURO'),
    ];
    const cards = selectConsolidationCards(candidates);
    const summary = summarizeConsolidationSession(cards, candidates);

    expect(summary.totalCards).toBe(3);
    expect(summary.isViable).toBe(true);
    expect(summary.uniqueDomains).toBe(3);
    expect(summary.reasonBreakdown.failed_today).toBe(1);
    expect(summary.reasonBreakdown.learned_today).toBe(1);
    expect(summary.reasonBreakdown.approaching_due).toBe(1);
    expect(summary.estimatedMinutes).toBeGreaterThan(0);
    expect(summary.averageRetrievability).toBeGreaterThan(0);
  });

  it('reports non-viable for fewer than 3 cards', () => {
    const candidates = [makeCandidate({ cardId: 'a' })];
    const cards = selectConsolidationCards(candidates);
    const summary = summarizeConsolidationSession(cards, candidates);
    expect(summary.isViable).toBe(false);
  });

  it('handles empty session', () => {
    const summary = summarizeConsolidationSession([], []);
    expect(summary.totalCards).toBe(0);
    expect(summary.averageRetrievability).toBe(0);
    expect(summary.isViable).toBe(false);
  });
});

// ─── Constants validation ────────────────────────────────────────

describe('configuration defaults', () => {
  it('has sensible default config', () => {
    expect(DEFAULT_CONSOLIDATION_CONFIG.maxCards).toBe(16);
    expect(DEFAULT_CONSOLIDATION_CONFIG.maxMinutes).toBe(15);
    expect(DEFAULT_CONSOLIDATION_CONFIG.maxDifficulty).toBe(8.0);
    expect(DEFAULT_CONSOLIDATION_CONFIG.minRetrievability).toBeLessThan(
      DEFAULT_CONSOLIDATION_CONFIG.maxRetrievability
    );
  });

  it('bedtime offset constants are valid', () => {
    expect(MIN_BEDTIME_OFFSET_MINUTES).toBe(60);
    expect(MAX_BEDTIME_OFFSET_MINUTES).toBe(120);
    expect(MIN_BEDTIME_OFFSET_MINUTES).toBeLessThan(MAX_BEDTIME_OFFSET_MINUTES);
  });
});
