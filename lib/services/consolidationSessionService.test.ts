/**
 * Unit tests for lib/services/consolidationSessionService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   selectConsolidationCards(candidates, config?)
 *   isInConsolidationWindow(currentHour, bedtimeHour, bedtimeMinute?)
 *   getConsolidationNotificationTime(bedtimeHour, bedtimeMinute?)
 *   summarizeConsolidationSession(cards, candidates, config?)
 *
 * Default config:
 *   maxCards: 16, maxMinutes: 15, secondsPerCard: 45
 *   minRetrievability: 0.40, maxRetrievability: 0.95
 *   maxDifficulty: 8.0, approachingDueDays: 3
 *
 * Window: bedtime - 120min → bedtime - 60min (60-120 min before bed)
 * Notification time: bedtime - 120min
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
  type ConsolidationCard,
} from './consolidationSessionService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCandidate(
  cardId: string,
  overrides: Partial<ConsolidationCandidate> = {}
): ConsolidationCandidate {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 5); // 5 days from now

  return {
    cardId,
    retrievability: 0.70,
    difficulty: 5.0,
    stability: 10,
    reviewedToday: false,
    failedToday: false,
    learnedToday: false,
    nextReviewDate: tomorrow,
    domain: 'Cardiology',
    ...overrides,
  };
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ─── isInConsolidationWindow ──────────────────────────────────────────────────

describe('isInConsolidationWindow', () => {
  it('returns true when currentHour is within [bedtime-2h, bedtime-1h]', () => {
    // Bedtime 22:00 → window [20:00, 21:00]
    expect(isInConsolidationWindow(20, 22)).toBe(true);
    expect(isInConsolidationWindow(20.5, 22)).toBe(true);
    expect(isInConsolidationWindow(21, 22)).toBe(true);
  });

  it('returns false when currentHour is before the window', () => {
    // Bedtime 22:00 → window [20:00, 21:00]; 19:30 is before
    expect(isInConsolidationWindow(19, 22)).toBe(false);
  });

  it('returns false when currentHour is after the window', () => {
    // 22:00 is bedtime itself — outside the window
    expect(isInConsolidationWindow(22, 22)).toBe(false);
  });

  it('handles midnight-crossing windows (bedtime 01:00)', () => {
    // Bedtime 01:00 → window [23:00, 00:00]
    expect(isInConsolidationWindow(23.5, 1)).toBe(true); // 23:30 in window
    expect(isInConsolidationWindow(23, 1)).toBe(true);   // start of window
    expect(isInConsolidationWindow(0, 1)).toBe(true);    // 00:00 = end of window
  });

  it('returns false outside midnight-crossing window', () => {
    // Bedtime 01:00 → window [23:00, 00:00]; 2:00 is not in window
    expect(isInConsolidationWindow(2, 1)).toBe(false);
    expect(isInConsolidationWindow(12, 1)).toBe(false);
  });

  it('respects bedtimeMinute parameter', () => {
    // Bedtime 22:30 → window [20:30, 21:30]
    // decimal = 22.5, windowStart = 20.5, windowEnd = 21.5
    expect(isInConsolidationWindow(21, 22, 30)).toBe(true);
    expect(isInConsolidationWindow(20, 22, 30)).toBe(false); // before window start
  });

  it('constants: window width = MAX_OFFSET - MIN_OFFSET = 60 min', () => {
    expect(MAX_BEDTIME_OFFSET_MINUTES - MIN_BEDTIME_OFFSET_MINUTES).toBe(60);
  });
});

// ─── getConsolidationNotificationTime ────────────────────────────────────────

describe('getConsolidationNotificationTime', () => {
  it('notification is MAX_BEDTIME_OFFSET_MINUTES (120 min) before bedtime', () => {
    const time = getConsolidationNotificationTime(22, 0);
    // 22:00 - 120min = 20:00
    expect(time.hour).toBe(20);
    expect(time.minute).toBe(0);
  });

  it('handles minute-offset bedtimes', () => {
    // Bedtime 22:30 - 120min = 20:30
    const time = getConsolidationNotificationTime(22, 30);
    expect(time.hour).toBe(20);
    expect(time.minute).toBe(30);
  });

  it('handles midnight crossing (bedtime 01:00)', () => {
    // 01:00 - 120min = 23:00
    const time = getConsolidationNotificationTime(1, 0);
    expect(time.hour).toBe(23);
    expect(time.minute).toBe(0);
  });

  it('handles midnight crossing with minutes (bedtime 00:30)', () => {
    // 00:30 = 30 total minutes; 30 - 120 = -90 minutes → +24h = 22h30m
    const time = getConsolidationNotificationTime(0, 30);
    expect(time.hour).toBe(22);
    expect(time.minute).toBe(30);
  });

  it('hour is always in [0, 23]', () => {
    for (let h = 0; h < 24; h++) {
      const time = getConsolidationNotificationTime(h, 0);
      expect(time.hour).toBeGreaterThanOrEqual(0);
      expect(time.hour).toBeLessThanOrEqual(23);
    }
  });

  it('minute is always in [0, 59]', () => {
    for (let m = 0; m < 60; m += 15) {
      const time = getConsolidationNotificationTime(22, m);
      expect(time.minute).toBeGreaterThanOrEqual(0);
      expect(time.minute).toBeLessThan(60);
    }
  });
});

// ─── selectConsolidationCards ─────────────────────────────────────────────────

describe('selectConsolidationCards', () => {
  it('returns empty array for empty candidates', () => {
    expect(selectConsolidationCards([])).toEqual([]);
  });

  it('filters out cards above maxRetrievability (0.95)', () => {
    const cards = [makeCandidate('q-easy', { retrievability: 0.97, failedToday: false, learnedToday: false })];
    expect(selectConsolidationCards(cards)).toHaveLength(0);
  });

  it('filters out cards below minRetrievability (0.40) unless failedToday', () => {
    const tooHard = makeCandidate('q-hard', { retrievability: 0.30, failedToday: false });
    expect(selectConsolidationCards([tooHard])).toHaveLength(0);
  });

  it('failedToday cards bypass R floor (can have R < 0.40)', () => {
    const failed = makeCandidate('q-failed', { retrievability: 0.20, failedToday: true });
    const result = selectConsolidationCards([failed]);
    expect(result).toHaveLength(1);
  });

  it('filters out cards with difficulty > maxDifficulty (8.0)', () => {
    const tooHard = makeCandidate('q-diff', { retrievability: 0.70, difficulty: 9.0 });
    expect(selectConsolidationCards([tooHard])).toHaveLength(0);
  });

  it('failedToday cards are still filtered by difficulty', () => {
    const failed = makeCandidate('q-failed-diff', { failedToday: true, difficulty: 9.0 });
    expect(selectConsolidationCards([failed])).toHaveLength(0);
  });

  it('assigns positions 0, 1, 2... in order', () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeCandidate(`q-${i}`, { domain: `Domain${i}`, retrievability: 0.70 })
    );
    const result = selectConsolidationCards(cards);
    result.forEach((card, i) => expect(card.position).toBe(i));
  });

  it('failed_today cards get highest priority (score 100)', () => {
    const failed = makeCandidate('q-failed', { failedToday: true, retrievability: 0.50, domain: 'A' });
    const regular = makeCandidate('q-reg', { retrievability: 0.80, domain: 'B' });
    const result = selectConsolidationCards([regular, failed]);
    expect(result[0]!.cardId).toBe('q-failed');
    expect(result[0]!.selectionReason).toBe('failed_today');
  });

  it('learned_today cards get second priority', () => {
    const learned = makeCandidate('q-learned', { learnedToday: true, retrievability: 0.60, domain: 'A' });
    const regular = makeCandidate('q-reg', { retrievability: 0.70, domain: 'B' });
    const result = selectConsolidationCards([regular, learned]);
    expect(result[0]!.cardId).toBe('q-learned');
    expect(result[0]!.selectionReason).toBe('learned_today');
  });

  it('approaching_due (within 3 days) gets priority over threshold_review', () => {
    const approaching = makeCandidate('q-due', {
      nextReviewDate: daysFromNow(2),
      retrievability: 0.70,
      domain: 'A',
    });
    const distant = makeCandidate('q-far', {
      nextReviewDate: daysFromNow(10),
      retrievability: 0.70,
      domain: 'B',
    });
    const result = selectConsolidationCards([distant, approaching]);
    expect(result[0]!.cardId).toBe('q-due');
    expect(result[0]!.selectionReason).toBe('approaching_due');
  });

  it('respects maxCards limit', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeCandidate(`q-${i}`, { domain: `Domain${i % 5}`, retrievability: 0.70 })
    );
    const result = selectConsolidationCards(candidates, { maxCards: 5 });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('respects session duration cap (maxMinutes × 60 / secondsPerCard)', () => {
    // maxMinutes=5, secondsPerCard=60 → max 5 cards
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeCandidate(`q-${i}`, { domain: `Dom${i}`, retrievability: 0.70 })
    );
    const result = selectConsolidationCards(candidates, {
      maxMinutes: 5,
      secondsPerCard: 60,
      maxCards: 20,
    });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('within same priority tier (both with equal priority score), sorts by retrievability ascending (harder first)', () => {
    // Both are threshold_review, both OUTSIDE the sweet spot [0.85-0.95] so neither
    // gets the +10 bonus — equal priority, so ascending R sort determines order.
    const easier = makeCandidate('q-easier', { retrievability: 0.75, domain: 'Cardiology', nextReviewDate: daysFromNow(10) });
    const harder = makeCandidate('q-harder', { retrievability: 0.50, domain: 'Neurology', nextReviewDate: daysFromNow(10) });
    const result = selectConsolidationCards([easier, harder]);
    // Harder (lower R) should come first within same priority tier
    expect(result[0]!.cardId).toBe('q-harder');
  });

  it('all selected cards have a selectionReason', () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate(`q-${i}`, { domain: `Dom${i}`, retrievability: 0.70 })
    );
    const result = selectConsolidationCards(candidates);
    for (const card of result) {
      expect(['failed_today', 'learned_today', 'approaching_due', 'threshold_review'])
        .toContain(card.selectionReason);
    }
  });
});

// ─── summarizeConsolidationSession ───────────────────────────────────────────

describe('summarizeConsolidationSession', () => {
  function makeConsolidationCard(
    cardId: string,
    reason: ConsolidationCard['selectionReason'],
    position = 0
  ): ConsolidationCard {
    return { cardId, position, selectionReason: reason, priorityScore: 50 };
  }

  it('returns totalCards = cards.length', () => {
    const cards = [
      makeConsolidationCard('q-1', 'failed_today', 0),
      makeConsolidationCard('q-2', 'learned_today', 1),
    ];
    const candidates = [makeCandidate('q-1'), makeCandidate('q-2')];
    const summary = summarizeConsolidationSession(cards, candidates);
    expect(summary.totalCards).toBe(2);
  });

  it('estimatedMinutes = ceil(totalCards × secondsPerCard / 60)', () => {
    const cards = Array.from({ length: 4 }, (_, i) =>
      makeConsolidationCard(`q-${i}`, 'threshold_review', i)
    );
    const candidates = cards.map(c => makeCandidate(c.cardId));
    const summary = summarizeConsolidationSession(cards, candidates, { secondsPerCard: 45 });
    // 4 × 45 = 180s / 60 = 3min → ceil(3) = 3
    expect(summary.estimatedMinutes).toBe(3);
  });

  it('reasonBreakdown counts each reason correctly', () => {
    const cards = [
      makeConsolidationCard('q-1', 'failed_today', 0),
      makeConsolidationCard('q-2', 'failed_today', 1),
      makeConsolidationCard('q-3', 'learned_today', 2),
    ];
    const candidates = cards.map(c => makeCandidate(c.cardId));
    const summary = summarizeConsolidationSession(cards, candidates);
    expect(summary.reasonBreakdown.failed_today).toBe(2);
    expect(summary.reasonBreakdown.learned_today).toBe(1);
    expect(summary.reasonBreakdown.approaching_due).toBe(0);
    expect(summary.reasonBreakdown.threshold_review).toBe(0);
  });

  it('averageRetrievability computed from candidates', () => {
    const cards = [
      makeConsolidationCard('q-1', 'threshold_review', 0),
      makeConsolidationCard('q-2', 'threshold_review', 1),
    ];
    const candidates = [
      makeCandidate('q-1', { retrievability: 0.60 }),
      makeCandidate('q-2', { retrievability: 0.80 }),
    ];
    const summary = summarizeConsolidationSession(cards, candidates);
    expect(summary.averageRetrievability).toBeCloseTo(0.70, 5);
  });

  it('averageRetrievability is 0 for empty session', () => {
    const summary = summarizeConsolidationSession([], []);
    expect(summary.averageRetrievability).toBe(0);
  });

  it('uniqueDomains counts distinct domains', () => {
    const cards = [
      makeConsolidationCard('q-1', 'threshold_review', 0),
      makeConsolidationCard('q-2', 'threshold_review', 1),
      makeConsolidationCard('q-3', 'threshold_review', 2),
    ];
    const candidates = [
      makeCandidate('q-1', { domain: 'Cardiology' }),
      makeCandidate('q-2', { domain: 'Cardiology' }), // duplicate
      makeCandidate('q-3', { domain: 'Neurology' }),
    ];
    const summary = summarizeConsolidationSession(cards, candidates);
    expect(summary.uniqueDomains).toBe(2);
  });

  it('isViable is true when totalCards >= 3', () => {
    const cards = Array.from({ length: 3 }, (_, i) =>
      makeConsolidationCard(`q-${i}`, 'threshold_review', i)
    );
    const candidates = cards.map(c => makeCandidate(c.cardId));
    expect(summarizeConsolidationSession(cards, candidates).isViable).toBe(true);
  });

  it('isViable is false when totalCards < 3', () => {
    const cards = [makeConsolidationCard('q-1', 'threshold_review', 0)];
    const candidates = [makeCandidate('q-1')];
    expect(summarizeConsolidationSession(cards, candidates).isViable).toBe(false);
  });
});
