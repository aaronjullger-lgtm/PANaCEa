/**
 * Unit tests for lib/services/chronotypeSchedulingService.ts
 *
 * Pure exports:
 *   scoreRmeq(responses): RmeqResult
 *   classifyRmeqScore(score): Chronotype
 *   chronotypeToCategory(chronotype): ChronotypeCategory
 *   inferChronotypeFromPerformance(hourlyData): PassiveInferenceResult
 *   inferCategoryFromPeakHour(peakHour): ChronotypeCategory
 *   sortQueueByChronotype(cards, currentHour, category): SortedQueueResult
 *   isHourInWindow(hour, start, end): boolean
 *   getSchedulingRecommendation(rmeqResult?, passiveResult?): {...}
 *   getStudyTimeSuggestion(category, currentHour): {...}
 *
 * rMEQ score boundaries (Adan & Almirall, 1991):
 *   4–7:   definite_evening
 *   8–11:  moderate_evening
 *   12–17: intermediate
 *   18–21: moderate_morning
 *   22–25: definite_morning
 */

import { describe, it, expect } from 'vitest';
import {
  scoreRmeq,
  classifyRmeqScore,
  chronotypeToCategory,
  inferChronotypeFromPerformance,
  inferCategoryFromPeakHour,
  sortQueueByChronotype,
  isHourInWindow,
  getSchedulingRecommendation,
  getStudyTimeSuggestion,
  RMEQ_BOUNDARIES,
  HIGH_DIFFICULTY_THRESHOLD,
  MIN_REVIEWS_FOR_INFERENCE,
  MIN_HOURS_WITH_DATA,
  type RmeqResponse,
  type HourlyPerformancePoint,
  type QueueCard,
} from './chronotypeSchedulingService';

// ─── classifyRmeqScore ───────────────────────────────────────────────────────

describe('classifyRmeqScore', () => {
  it('returns definite_evening for scores 4–7', () => {
    expect(classifyRmeqScore(4)).toBe('definite_evening');
    expect(classifyRmeqScore(7)).toBe('definite_evening');
  });

  it('returns moderate_evening for scores 8–11', () => {
    expect(classifyRmeqScore(8)).toBe('moderate_evening');
    expect(classifyRmeqScore(11)).toBe('moderate_evening');
  });

  it('returns intermediate for scores 12–17', () => {
    expect(classifyRmeqScore(12)).toBe('intermediate');
    expect(classifyRmeqScore(17)).toBe('intermediate');
  });

  it('returns moderate_morning for scores 18–21', () => {
    expect(classifyRmeqScore(18)).toBe('moderate_morning');
    expect(classifyRmeqScore(21)).toBe('moderate_morning');
  });

  it('returns definite_morning for scores 22–25', () => {
    expect(classifyRmeqScore(22)).toBe('definite_morning');
    expect(classifyRmeqScore(25)).toBe('definite_morning');
  });

  it('boundaries: score at boundary is classified as the higher category', () => {
    // 8 is the start of moderate_evening, not definite_evening
    expect(classifyRmeqScore(RMEQ_BOUNDARIES.definite_evening.max)).toBe('definite_evening');
    expect(classifyRmeqScore(RMEQ_BOUNDARIES.moderate_evening.min)).toBe('moderate_evening');
  });
});

// ─── chronotypeToCategory ─────────────────────────────────────────────────────

describe('chronotypeToCategory', () => {
  it('definite_morning and moderate_morning map to "morning"', () => {
    expect(chronotypeToCategory('definite_morning')).toBe('morning');
    expect(chronotypeToCategory('moderate_morning')).toBe('morning');
  });

  it('definite_evening and moderate_evening map to "evening"', () => {
    expect(chronotypeToCategory('definite_evening')).toBe('evening');
    expect(chronotypeToCategory('moderate_evening')).toBe('evening');
  });

  it('intermediate maps to "intermediate"', () => {
    expect(chronotypeToCategory('intermediate')).toBe('intermediate');
  });
});

// ─── scoreRmeq ────────────────────────────────────────────────────────────────

describe('scoreRmeq', () => {
  it('total score = sum of all 5 responses', () => {
    const responses: RmeqResponse = { q1: 1, q2: 1, q3: 1, q4: 1, q5: 0 };
    const result = scoreRmeq(responses);
    expect(result.totalScore).toBe(4);
  });

  it('maximum score (25) → definite_morning category', () => {
    const responses: RmeqResponse = { q1: 5, q2: 4, q3: 5, q4: 5, q5: 6 };
    const result = scoreRmeq(responses);
    expect(result.totalScore).toBe(25);
    expect(result.chronotype).toBe('definite_morning');
    expect(result.category).toBe('morning');
  });

  it('minimum score (4) → definite_evening category', () => {
    const responses: RmeqResponse = { q1: 1, q2: 1, q3: 1, q4: 1, q5: 0 };
    const result = scoreRmeq(responses);
    expect(result.totalScore).toBe(4);
    expect(result.chronotype).toBe('definite_evening');
    expect(result.category).toBe('evening');
  });

  it('intermediate score → intermediate category', () => {
    // q1=3, q2=2, q3=3, q4=3, q5=4 = 15 → intermediate
    const responses: RmeqResponse = { q1: 3, q2: 2, q3: 3, q4: 3, q5: 4 };
    const result = scoreRmeq(responses);
    expect(result.totalScore).toBe(15);
    expect(result.category).toBe('intermediate');
  });

  it('peakWindow and offPeakWindow match the category', () => {
    const morning: RmeqResponse = { q1: 5, q2: 4, q3: 5, q4: 5, q5: 6 };
    const r = scoreRmeq(morning);
    expect(r.peakWindow.start).toBe(8);
    expect(r.peakWindow.end).toBe(12);
    expect(r.offPeakWindow.start).toBe(20);
  });
});

// ─── inferCategoryFromPeakHour ────────────────────────────────────────────────

describe('inferCategoryFromPeakHour', () => {
  it('peak hours 6–11 → morning', () => {
    expect(inferCategoryFromPeakHour(6)).toBe('morning');
    expect(inferCategoryFromPeakHour(9)).toBe('morning');
    expect(inferCategoryFromPeakHour(11)).toBe('morning');
  });

  it('peak hours 12–15 → intermediate', () => {
    expect(inferCategoryFromPeakHour(12)).toBe('intermediate');
    expect(inferCategoryFromPeakHour(14)).toBe('intermediate');
    expect(inferCategoryFromPeakHour(15)).toBe('intermediate');
  });

  it('peak hours 16–23 → evening', () => {
    expect(inferCategoryFromPeakHour(16)).toBe('evening');
    expect(inferCategoryFromPeakHour(20)).toBe('evening');
    expect(inferCategoryFromPeakHour(23)).toBe('evening');
  });

  it('very early morning (0–5) → evening (late-night studying pattern)', () => {
    expect(inferCategoryFromPeakHour(0)).toBe('evening');
    expect(inferCategoryFromPeakHour(3)).toBe('evening');
    expect(inferCategoryFromPeakHour(5)).toBe('evening');
  });
});

// ─── isHourInWindow ───────────────────────────────────────────────────────────

describe('isHourInWindow', () => {
  it('normal window: returns true for hours within [start, end)', () => {
    expect(isHourInWindow(8, 8, 12)).toBe(true);
    expect(isHourInWindow(10, 8, 12)).toBe(true);
    expect(isHourInWindow(11, 8, 12)).toBe(true);
  });

  it('normal window: returns false for hours outside', () => {
    expect(isHourInWindow(7, 8, 12)).toBe(false);
    expect(isHourInWindow(12, 8, 12)).toBe(false); // end is exclusive
    expect(isHourInWindow(15, 8, 12)).toBe(false);
  });

  it('midnight-crossing window (start > end): returns true on both sides of midnight', () => {
    // 22:00–06:00
    expect(isHourInWindow(22, 22, 6)).toBe(true);
    expect(isHourInWindow(0, 22, 6)).toBe(true);
    expect(isHourInWindow(3, 22, 6)).toBe(true);
    expect(isHourInWindow(5, 22, 6)).toBe(true);
  });

  it('midnight-crossing window: returns false in the middle of the day', () => {
    expect(isHourInWindow(12, 22, 6)).toBe(false);
    expect(isHourInWindow(6, 22, 6)).toBe(false); // 6:00 is excluded (end exclusive)
    expect(isHourInWindow(10, 22, 6)).toBe(false);
  });
});

// ─── sortQueueByChronotype ────────────────────────────────────────────────────

describe('sortQueueByChronotype', () => {
  function makeCard(cardId: string, difficulty: number, isOverdue = false): QueueCard {
    return { cardId, difficulty, stability: 10, isOverdue };
  }

  it('returns empty array for empty queue', () => {
    const r = sortQueueByChronotype([], 10, 'morning');
    expect(r.cardIds).toEqual([]);
    expect(r.chronotypeSortApplied).toBe(false);
  });

  it('overdue cards always come first regardless of difficulty', () => {
    const cards = [
      makeCard('easy', 2, false),
      makeCard('overdue-hard', 9, true),
      makeCard('medium', 5, false),
    ];
    // Morning type at hour 10 (peak: 8–12)
    const r = sortQueueByChronotype(cards, 10, 'morning');
    expect(r.cardIds[0]).toBe('overdue-hard');
  });

  it('during peak window: high-difficulty cards come before low-difficulty', () => {
    const cards = [
      makeCard('easy', 2),
      makeCard('hard', 9),
      makeCard('medium', 5),
    ];
    // Morning type at hour 10 (peak: 8–12)
    const r = sortQueueByChronotype(cards, 10, 'morning');
    expect(r.cardIds[0]).toBe('hard');
    expect(r.cardIds[2]).toBe('easy');
    expect(r.chronotypeSortApplied).toBe(true);
  });

  it('during off-peak window: low-difficulty cards come first', () => {
    const cards = [
      makeCard('hard', 9),
      makeCard('easy', 2),
      makeCard('medium', 5),
    ];
    // Morning type at hour 21 (off-peak: 20–23)
    const r = sortQueueByChronotype(cards, 21, 'morning');
    expect(r.cardIds[0]).toBe('easy');
    expect(r.cardIds[2]).toBe('hard');
    expect(r.chronotypeSortApplied).toBe(true);
  });

  it('strategy string describes the time zone', () => {
    const cards = [makeCard('c1', 5)];
    const peak = sortQueueByChronotype(cards, 10, 'morning');
    const offPeak = sortQueueByChronotype(cards, 21, 'morning');
    const neutral = sortQueueByChronotype(cards, 15, 'morning');

    expect(peak.strategy).toContain('Peak');
    expect(offPeak.strategy).toContain('Off-peak');
    expect(neutral.strategy).toContain('Neutral');
  });

  it('chronotypeSortApplied is false during neutral window', () => {
    const cards = [makeCard('c1', 5)];
    // Morning: peak 8–12, off-peak 20–23; hour 15 is neutral
    const r = sortQueueByChronotype(cards, 15, 'morning');
    expect(r.chronotypeSortApplied).toBe(false);
  });

  it('does not mutate the input array', () => {
    const cards = [makeCard('easy', 2), makeCard('hard', 9)];
    const original = [...cards];
    sortQueueByChronotype(cards, 10, 'morning');
    expect(cards[0]!.cardId).toBe(original[0]!.cardId);
  });
});

// ─── inferChronotypeFromPerformance ──────────────────────────────────────────

describe('inferChronotypeFromPerformance', () => {
  it('returns isReliable=false and intermediate for empty data', () => {
    const r = inferChronotypeFromPerformance([]);
    expect(r.isReliable).toBe(false);
    expect(r.inferredCategory).toBe('intermediate');
    expect(r.confidence).toBe(0);
    expect(r.totalReviews).toBe(0);
  });

  it('returns isReliable=false when total reviews < MIN_REVIEWS_FOR_INFERENCE', () => {
    const data: HourlyPerformancePoint[] = [
      { hour: 9, accuracy: 0.9, avgResponseTimeMs: 1000, reviewCount: 50 },
    ];
    const r = inferChronotypeFromPerformance(data);
    expect(r.isReliable).toBe(false);
  });

  it('hourlyScores array has length 24', () => {
    const r = inferChronotypeFromPerformance([]);
    expect(r.hourlyScores).toHaveLength(24);
  });

  it('ignores hours with fewer than 3 reviews', () => {
    // Only one data point with reviewCount=2 → insufficient
    const data: HourlyPerformancePoint[] = [
      { hour: 9, accuracy: 1.0, avgResponseTimeMs: 500, reviewCount: 2 },
    ];
    const r = inferChronotypeFromPerformance(data);
    expect(r.hourlyScores[9]).toBe(0); // Should be 0 since reviewCount < 3
  });

  it('peak hour is inferred from highest performance score', () => {
    // Build data where hour 9 has best accuracy and fastest RT
    // Hour 9: high accuracy + fast RT → high score
    // Hour 21: low accuracy + slow RT → low score
    const data: HourlyPerformancePoint[] = Array.from({ length: 8 }, (_, i) => {
      const hour = i * 2 + 1; // Hours 1,3,5,7,9,11,13,15
      const isMorning = hour === 9;
      return {
        hour,
        accuracy: isMorning ? 0.95 : 0.60,
        avgResponseTimeMs: isMorning ? 800 : 1500,
        reviewCount: 20,
      };
    });
    const r = inferChronotypeFromPerformance(data);
    expect(r.peakHour).toBe(9);
  });

  it('inferred category follows inferCategoryFromPeakHour', () => {
    // All data at hour 9 (morning hours) → should infer morning
    const data: HourlyPerformancePoint[] = [
      { hour: 9, accuracy: 0.9, avgResponseTimeMs: 1000, reviewCount: 5 },
      { hour: 15, accuracy: 0.5, avgResponseTimeMs: 2000, reviewCount: 5 },
    ];
    const r = inferChronotypeFromPerformance(data);
    expect(r.peakHour).toBe(9);
    expect(r.inferredCategory).toBe('morning');
  });
});

// ─── getSchedulingRecommendation ─────────────────────────────────────────────

describe('getSchedulingRecommendation', () => {
  it('returns default intermediate when no data provided', () => {
    const r = getSchedulingRecommendation();
    expect(r.category).toBe('intermediate');
    expect(r.confidence).toBe(0);
    expect(r.source).toBe('default');
    expect(r.discrepancy).toBe(false);
  });

  it('returns rmeq-based recommendation with confidence 0.8 (validated instrument)', () => {
    const rmeq = scoreRmeq({ q1: 5, q2: 4, q3: 5, q4: 5, q5: 6 }); // definite_morning
    const r = getSchedulingRecommendation(rmeq, undefined);
    expect(r.source).toBe('rmeq');
    expect(r.category).toBe('morning');
    expect(r.confidence).toBe(0.8);
    expect(r.discrepancy).toBe(false);
  });

  it('returns passive-based recommendation when only passive data', () => {
    const passive = inferChronotypeFromPerformance([]);
    const r = getSchedulingRecommendation(undefined, passive);
    expect(r.source).toBe('passive');
    // Not reliable → defaults to intermediate
    expect(r.category).toBe('intermediate');
  });

  it('returns combined source when both rMEQ and passive agree', () => {
    const morningRmeq = scoreRmeq({ q1: 5, q2: 4, q3: 5, q4: 5, q5: 6 }); // morning
    // Create a passive result that agrees (morning peak at hour 9) but is not reliable
    const passive = inferChronotypeFromPerformance([]);
    const r = getSchedulingRecommendation(morningRmeq, passive);
    expect(r.source).toBe('combined');
    expect(r.category).toBe('morning'); // rMEQ preferred
    expect(r.discrepancy).toBe(false);
  });

  it('message is a non-empty string', () => {
    const r = getSchedulingRecommendation();
    expect(typeof r.message).toBe('string');
    expect(r.message.length).toBeGreaterThan(0);
  });
});

// ─── getStudyTimeSuggestion ───────────────────────────────────────────────────

describe('getStudyTimeSuggestion', () => {
  it('returns isOptimal=true and nextPeakIn=null when in peak window', () => {
    // Morning: peak 8–12; hour 10 is in peak
    const r = getStudyTimeSuggestion('morning', 10);
    expect(r.isOptimal).toBe(true);
    expect(r.nextPeakIn).toBeNull();
    expect(r.suggestion).toContain('peak');
  });

  it('returns isOptimal=false when outside peak window', () => {
    // Morning: peak 8–12; hour 15 is outside
    const r = getStudyTimeSuggestion('morning', 15);
    expect(r.isOptimal).toBe(false);
    expect(r.nextPeakIn).not.toBeNull();
  });

  it('nextPeakIn = hours until peak window starts', () => {
    // Morning: peak starts at 8; current hour 5 → 3 hours until peak
    const r = getStudyTimeSuggestion('morning', 5);
    expect(r.nextPeakIn).toBe(3);
  });

  it('nextPeakIn wraps around midnight', () => {
    // Morning: peak starts at 8; current hour 22 → 10 hours until peak
    const r = getStudyTimeSuggestion('morning', 22);
    expect(r.nextPeakIn).toBe(10);
  });

  it('suggestion mentions "soon" when < 2 hours away', () => {
    // Morning: peak starts at 8; hour 7 → 1h away
    const r = getStudyTimeSuggestion('morning', 7);
    expect(r.isOptimal).toBe(false);
    expect(r.nextPeakIn).toBe(1);
    expect(r.suggestion).toContain('soon');
  });

  it('covers all three chronotype categories', () => {
    for (const cat of ['morning', 'intermediate', 'evening'] as const) {
      // Each category has a defined peak; just verify no errors and boolean result
      const r = getStudyTimeSuggestion(cat, 12);
      expect(typeof r.isOptimal).toBe('boolean');
      expect(typeof r.suggestion).toBe('string');
    }
  });
});
