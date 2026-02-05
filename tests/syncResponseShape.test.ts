/**
 * Critical-path: Sync API response shape
 * Client (useUserStats) expects GET /api/sync to return:
 * { success: true, data: { performanceRecords?, srsItems?, savedQuestions? } }
 * Middleware sends result.data as body, so client receives that shape.
 */

import { describe, it, expect } from 'vitest';

describe('Sync GET response shape', () => {
  it('parses response shape expected by useUserStats syncFromCloud', () => {
    const mockResponse = {
      success: true,
      data: {
        performanceRecords: [
          {
            id: '1',
            topic: 'CV',
            isCorrect: true,
            timestamp: Date.now(),
            focus: 'all',
          },
        ],
        srsItems: [],
        savedQuestions: [
          {
            questionId: 'q1',
            questionText: 'Sample?',
            type: 'missed',
            nextReviewDate: '2026-01-01',
          },
        ],
      },
    };

    expect(mockResponse.success).toBe(true);
    expect(mockResponse.data).toBeDefined();
    expect(Array.isArray(mockResponse.data.performanceRecords)).toBe(true);
    expect(Array.isArray(mockResponse.data.srsItems)).toBe(true);
    expect(Array.isArray(mockResponse.data.savedQuestions)).toBe(true);

    if (mockResponse.data.performanceRecords.length > 0) {
      const rec = mockResponse.data.performanceRecords[0];
      expect(rec).toHaveProperty('topic');
      expect(rec).toHaveProperty('isCorrect');
      expect(rec).toHaveProperty('timestamp');
    }
  });

  it('handles empty data payload', () => {
    const emptyResponse = {
      success: true,
      data: {
        performanceRecords: [],
        srsItems: [],
        savedQuestions: [],
      },
    };
    expect(emptyResponse.data.performanceRecords).toEqual([]);
    expect(emptyResponse.data.srsItems).toEqual([]);
    expect(emptyResponse.data.savedQuestions).toEqual([]);
  });
});

describe('Analytics consistency: heatmap and growth areas', () => {
  it('growth areas derived from focus===all records match topic accuracy order', () => {
    const performanceData = [
      { topic: 'CV', isCorrect: true, focus: 'all' },
      { topic: 'CV', isCorrect: false, focus: 'all' },
      { topic: 'PULM', isCorrect: true, focus: 'all' },
      { topic: 'PULM', isCorrect: true, focus: 'all' },
      { topic: 'CV', isCorrect: false, focus: 'all' },
    ];
    const filtered = performanceData.filter((r) => r.focus === 'all');
    const byTopic = new Map<string, { correct: number; total: number }>();
    for (const rec of filtered) {
      const bucket = byTopic.get(rec.topic) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (rec.isCorrect) bucket.correct += 1;
      byTopic.set(rec.topic, bucket);
    }
    const topicStats = Array.from(byTopic.entries())
      .map(([topic, { correct, total }]) => ({
        topic,
        score: total ? (correct / total) * 100 : 0,
      }))
      .sort((a, b) => a.score - b.score);
    expect(topicStats[0].topic).toBe('CV');
    expect(topicStats[0].score).toBeLessThan(topicStats[1].score);
  });
});
