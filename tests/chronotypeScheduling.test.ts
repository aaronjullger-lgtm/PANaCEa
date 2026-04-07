/**
 * Chronotype Scheduling Service — Unit Tests (Tier 3)
 *
 * Tests rMEQ scoring, passive chronotype inference,
 * priority queue sorting, and combined scheduling recommendations.
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
  CHRONOTYPE_PEAK_WINDOWS,
  MIN_REVIEWS_FOR_INFERENCE,
  MIN_HOURS_WITH_DATA,
  type RmeqResponse,
  type HourlyPerformancePoint,
  type QueueCard,
} from '../lib/services/chronotypeSchedulingService';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeHourlyData(
  hour: number,
  accuracy: number,
  avgMs: number,
  count: number
): HourlyPerformancePoint {
  return { hour, accuracy, avgResponseTimeMs: avgMs, reviewCount: count };
}

function makeCard(id: string, difficulty: number, overdue = false): QueueCard {
  return { cardId: id, difficulty, stability: 10, isOverdue: overdue };
}

// ─── rMEQ Scoring ───────────────────────────────────────────────────────────

describe('scoreRmeq', () => {
  it('scores a definite morning type correctly', () => {
    const responses: RmeqResponse = { q1: 5, q2: 4, q3: 5, q4: 5, q5: 6 };
    const result = scoreRmeq(responses);
    expect(result.totalScore).toBe(25);
    expect(result.chronotype).toBe('definite_morning');
    expect(result.category).toBe('morning');
  });

  it('scores a definite evening type correctly', () => {
    const responses: RmeqResponse = { q1: 1, q2: 1, q3: 1, q4: 1, q5: 0 };
    const result = scoreRmeq(responses);
    expect(result.totalScore).toBe(4);
    expect(result.chronotype).toBe('definite_evening');
    expect(result.category).toBe('evening');
  });

  it('scores an intermediate type', () => {
    const responses: RmeqResponse = { q1: 3, q2: 2, q3: 3, q4: 3, q5: 4 };
    const result = scoreRmeq(responses);
    expect(result.totalScore).toBe(15);
    expect(result.chronotype).toBe('intermediate');
    expect(result.category).toBe('intermediate');
  });

  it('includes peak and off-peak windows', () => {
    const responses: RmeqResponse = { q1: 5, q2: 4, q3: 5, q4: 5, q5: 6 };
    const result = scoreRmeq(responses);
    expect(result.peakWindow.start).toBeLessThan(result.peakWindow.end);
    expect(result.offPeakWindow).toBeTruthy();
  });
});

describe('classifyRmeqScore', () => {
  it('classifies at all boundaries', () => {
    expect(classifyRmeqScore(4)).toBe('definite_evening');
    expect(classifyRmeqScore(7)).toBe('definite_evening');
    expect(classifyRmeqScore(8)).toBe('moderate_evening');
    expect(classifyRmeqScore(11)).toBe('moderate_evening');
    expect(classifyRmeqScore(12)).toBe('intermediate');
    expect(classifyRmeqScore(17)).toBe('intermediate');
    expect(classifyRmeqScore(18)).toBe('moderate_morning');
    expect(classifyRmeqScore(21)).toBe('moderate_morning');
    expect(classifyRmeqScore(22)).toBe('definite_morning');
    expect(classifyRmeqScore(25)).toBe('definite_morning');
  });
});

describe('chronotypeToCategory', () => {
  it('maps 5-tier to 3-tier correctly', () => {
    expect(chronotypeToCategory('definite_morning')).toBe('morning');
    expect(chronotypeToCategory('moderate_morning')).toBe('morning');
    expect(chronotypeToCategory('intermediate')).toBe('intermediate');
    expect(chronotypeToCategory('moderate_evening')).toBe('evening');
    expect(chronotypeToCategory('definite_evening')).toBe('evening');
  });
});

// ─── Passive Chronotype Inference ───────────────────────────────────────────

describe('inferChronotypeFromPerformance', () => {
  it('returns unreliable result for empty data', () => {
    const result = inferChronotypeFromPerformance([]);
    expect(result.isReliable).toBe(false);
    expect(result.inferredCategory).toBe('intermediate');
    expect(result.confidence).toBe(0);
  });

  it('returns unreliable for insufficient reviews', () => {
    const data = [
      makeHourlyData(9, 0.8, 3000, 10),
      makeHourlyData(14, 0.6, 4000, 10),
    ];
    const result = inferChronotypeFromPerformance(data);
    expect(result.isReliable).toBe(false);
  });

  it('identifies morning type from morning peak performance', () => {
    // Strong performance in morning hours, weaker in evening
    const data: HourlyPerformancePoint[] = [];
    for (let h = 7; h <= 22; h++) {
      const isMorning = h >= 8 && h < 12;
      data.push(makeHourlyData(
        h,
        isMorning ? 0.90 : 0.65,
        isMorning ? 2500 : 4500,
        isMorning ? 30 : 15
      ));
    }
    const result = inferChronotypeFromPerformance(data);
    expect(result.peakHour).toBeGreaterThanOrEqual(8);
    expect(result.peakHour).toBeLessThan(12);
    expect(result.inferredCategory).toBe('morning');
  });

  it('identifies evening type from evening peak performance', () => {
    const data: HourlyPerformancePoint[] = [];
    for (let h = 7; h <= 23; h++) {
      const isEvening = h >= 18 && h < 22;
      data.push(makeHourlyData(
        h,
        isEvening ? 0.92 : 0.60,
        isEvening ? 2200 : 4200,
        isEvening ? 25 : 10
      ));
    }
    const result = inferChronotypeFromPerformance(data);
    expect(result.peakHour).toBeGreaterThanOrEqual(16);
    expect(result.inferredCategory).toBe('evening');
  });

  it('requires minimum reviews per hour (>=3)', () => {
    // All hours with only 2 reviews should be ignored
    const data = [
      makeHourlyData(9, 0.95, 2000, 2),
      makeHourlyData(10, 0.50, 5000, 2),
    ];
    const result = inferChronotypeFromPerformance(data);
    expect(result.isReliable).toBe(false);
  });

  it('produces bounded confidence [0, 1]', () => {
    const data: HourlyPerformancePoint[] = [];
    for (let h = 6; h <= 22; h++) {
      data.push(makeHourlyData(h, 0.7 + Math.random() * 0.2, 3000, 20));
    }
    const result = inferChronotypeFromPerformance(data);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('inferCategoryFromPeakHour', () => {
  it('classifies morning peaks', () => {
    expect(inferCategoryFromPeakHour(8)).toBe('morning');
    expect(inferCategoryFromPeakHour(11)).toBe('morning');
  });

  it('classifies intermediate peaks', () => {
    expect(inferCategoryFromPeakHour(12)).toBe('intermediate');
    expect(inferCategoryFromPeakHour(15)).toBe('intermediate');
  });

  it('classifies evening peaks', () => {
    expect(inferCategoryFromPeakHour(18)).toBe('evening');
    expect(inferCategoryFromPeakHour(22)).toBe('evening');
  });

  it('classifies late night as evening', () => {
    expect(inferCategoryFromPeakHour(2)).toBe('evening');
  });
});

// ─── Priority Queue Sorting ─────────────────────────────────────────────────

describe('sortQueueByChronotype', () => {
  const cards: QueueCard[] = [
    makeCard('easy1', 2),
    makeCard('hard1', 9),
    makeCard('med1', 5),
    makeCard('hard2', 8),
    makeCard('easy2', 3),
  ];

  it('returns empty for empty queue', () => {
    const result = sortQueueByChronotype([], 10, 'morning');
    expect(result.cardIds).toEqual([]);
    expect(result.chronotypeSortApplied).toBe(false);
  });

  it('puts high-difficulty cards first during peak (morning type, 10am)', () => {
    const result = sortQueueByChronotype(cards, 10, 'morning');
    expect(result.chronotypeSortApplied).toBe(true);
    expect(result.strategy).toContain('Peak');
    // First card should be the hardest
    expect(result.cardIds[0]).toBe('hard1');
    expect(result.cardIds[1]).toBe('hard2');
  });

  it('puts low-difficulty cards first during off-peak (morning type, 21:00)', () => {
    const result = sortQueueByChronotype(cards, 21, 'morning');
    expect(result.chronotypeSortApplied).toBe(true);
    expect(result.strategy).toContain('Off-peak');
    expect(result.cardIds[0]).toBe('easy1');
  });

  it('always prioritizes overdue cards regardless of difficulty', () => {
    const withOverdue: QueueCard[] = [
      makeCard('easy-overdue', 2, true),
      makeCard('hard-not-overdue', 9, false),
      makeCard('hard-overdue', 8, true),
    ];
    const result = sortQueueByChronotype(withOverdue, 10, 'morning');
    // Both overdue cards should come before the non-overdue card
    const overdueIds = result.cardIds.slice(0, 2);
    expect(overdueIds).toContain('easy-overdue');
    expect(overdueIds).toContain('hard-overdue');
  });

  it('evening type has different peak hours', () => {
    // 18:00 is peak for evening type
    const result = sortQueueByChronotype(cards, 18, 'evening');
    expect(result.chronotypeSortApplied).toBe(true);
    expect(result.strategy).toContain('Peak');
  });
});

describe('isHourInWindow', () => {
  it('handles normal windows', () => {
    expect(isHourInWindow(10, 8, 12)).toBe(true);
    expect(isHourInWindow(7, 8, 12)).toBe(false);
    expect(isHourInWindow(12, 8, 12)).toBe(false);
  });

  it('handles midnight-crossing windows', () => {
    expect(isHourInWindow(23, 22, 6)).toBe(true);
    expect(isHourInWindow(3, 22, 6)).toBe(true);
    expect(isHourInWindow(10, 22, 6)).toBe(false);
  });
});

// ─── Combined Scheduling Recommendation ─────────────────────────────────────

describe('getSchedulingRecommendation', () => {
  const morningRmeq = scoreRmeq({ q1: 5, q2: 4, q3: 5, q4: 5, q5: 6 });
  const eveningRmeq = scoreRmeq({ q1: 1, q2: 1, q3: 1, q4: 1, q5: 0 });

  it('returns default when no data available', () => {
    const result = getSchedulingRecommendation();
    expect(result.category).toBe('intermediate');
    expect(result.source).toBe('default');
    expect(result.confidence).toBe(0);
  });

  it('uses rMEQ when only questionnaire available', () => {
    const result = getSchedulingRecommendation(morningRmeq);
    expect(result.category).toBe('morning');
    expect(result.source).toBe('rmeq');
    expect(result.confidence).toBe(0.8);
  });

  it('uses passive when only performance data available', () => {
    const passiveResult = {
      inferredCategory: 'evening' as const,
      confidence: 0.6,
      peakHour: 19,
      troughHour: 8,
      totalReviews: 200,
      isReliable: true,
      hourlyScores: new Array(24).fill(0.5),
    };
    const result = getSchedulingRecommendation(undefined, passiveResult);
    expect(result.category).toBe('evening');
    expect(result.source).toBe('passive');
  });

  it('prefers rMEQ when both agree', () => {
    const passiveResult = {
      inferredCategory: 'morning' as const,
      confidence: 0.7,
      peakHour: 9,
      troughHour: 20,
      totalReviews: 300,
      isReliable: true,
      hourlyScores: new Array(24).fill(0.5),
    };
    const result = getSchedulingRecommendation(morningRmeq, passiveResult);
    expect(result.category).toBe('morning');
    expect(result.source).toBe('combined');
    expect(result.discrepancy).toBe(false);
  });

  it('flags discrepancy when rMEQ and passive disagree', () => {
    const passiveResult = {
      inferredCategory: 'evening' as const,
      confidence: 0.8,
      peakHour: 20,
      troughHour: 8,
      totalReviews: 500,
      isReliable: true,
      hourlyScores: new Array(24).fill(0.5),
    };
    const result = getSchedulingRecommendation(morningRmeq, passiveResult);
    expect(result.discrepancy).toBe(true);
    // Still prefers rMEQ
    expect(result.category).toBe('morning');
    expect(result.message).toContain('retaking');
  });
});

// ─── Study Time Suggestion ──────────────────────────────────────────────────

describe('getStudyTimeSuggestion', () => {
  it('indicates optimal during peak window', () => {
    const result = getStudyTimeSuggestion('morning', 10);
    expect(result.isOptimal).toBe(true);
    expect(result.nextPeakIn).toBeNull();
  });

  it('calculates hours until next peak', () => {
    // Morning peak is 8-12, current hour 15
    const result = getStudyTimeSuggestion('morning', 15);
    expect(result.isOptimal).toBe(false);
    expect(result.nextPeakIn).toBe(17); // 15 → next day 8 = 17h
  });

  it('suggests saving hard cards when peak is approaching', () => {
    // Morning peak starts at 8, current is 7
    const result = getStudyTimeSuggestion('morning', 7);
    expect(result.isOptimal).toBe(false);
    expect(result.nextPeakIn).toBe(1);
    expect(result.suggestion).toContain('soon');
  });
});

// ─── Constants Validation ───────────────────────────────────────────────────

describe('Constants', () => {
  it('rMEQ boundaries cover full range 4-25', () => {
    expect(RMEQ_BOUNDARIES.definite_evening.min).toBe(4);
    expect(RMEQ_BOUNDARIES.definite_morning.max).toBe(25);
  });

  it('all chronotype categories have peak windows', () => {
    const categories: Array<'morning' | 'intermediate' | 'evening'> = ['morning', 'intermediate', 'evening'];
    for (const cat of categories) {
      expect(CHRONOTYPE_PEAK_WINDOWS[cat]).toBeTruthy();
      expect(CHRONOTYPE_PEAK_WINDOWS[cat].start).toBeGreaterThanOrEqual(0);
      expect(CHRONOTYPE_PEAK_WINDOWS[cat].end).toBeLessThanOrEqual(24);
    }
  });

  it('inference thresholds are reasonable', () => {
    expect(MIN_REVIEWS_FOR_INFERENCE).toBeGreaterThanOrEqual(50);
    expect(MIN_HOURS_WITH_DATA).toBeGreaterThanOrEqual(4);
  });
});
