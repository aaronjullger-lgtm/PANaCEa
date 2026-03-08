/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mergeLearningCurveData,
  fetchLearningCurveData,
  type DailyPerformancePoint,
  type StabilityTrendPoint,
} from './learningCurveService';

vi.mock('@/lib/utils/apiConfig', () => ({
  getApiEndpoint: vi.fn((endpoint: string) => `http://localhost${endpoint}`),
  API_ENDPOINTS: {
    USER_STABILITY_TREND: '/api/user/stability-trend',
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('mergeLearningCurveData', () => {
  it('should merge daily performance and stability points by date', () => {
    const dailyPoints: DailyPerformancePoint[] = [
      { date: '2025-01-01', attempts: 10, correct: 8, accuracy: 80 },
      { date: '2025-01-02', attempts: 5, correct: 4, accuracy: 80 },
    ];
    const stabilityPoints: StabilityTrendPoint[] = [
      { date: '2025-01-01', avgStability: 5.2, totalReviews: 12, conditions: [] },
      { date: '2025-01-03', avgStability: 6.1, totalReviews: 8, conditions: [] },
    ];

    const result = mergeLearningCurveData(dailyPoints, stabilityPoints);

    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { date: '2025-01-01', accuracy: 80, attempts: 10, correct: 8, avgStability: 5.2, totalReviews: 12 },
      { date: '2025-01-02', accuracy: 80, attempts: 5, correct: 4, avgStability: undefined, totalReviews: undefined },
      { date: '2025-01-03', accuracy: undefined, attempts: undefined, correct: undefined, avgStability: 6.1, totalReviews: 8 },
    ]);
  });

  it('should handle empty daily points', () => {
    const dailyPoints: DailyPerformancePoint[] = [];
    const stabilityPoints: StabilityTrendPoint[] = [
      { date: '2025-01-01', avgStability: 5.2, totalReviews: 12, conditions: [] },
    ];

    const result = mergeLearningCurveData(dailyPoints, stabilityPoints);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2025-01-01',
      accuracy: undefined,
      attempts: undefined,
      correct: undefined,
      avgStability: 5.2,
      totalReviews: 12,
    });
  });

  it('should handle empty stability points', () => {
    const dailyPoints: DailyPerformancePoint[] = [
      { date: '2025-01-01', attempts: 10, correct: 8, accuracy: 80 },
    ];
    const stabilityPoints: StabilityTrendPoint[] = [];

    const result = mergeLearningCurveData(dailyPoints, stabilityPoints);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2025-01-01',
      accuracy: 80,
      attempts: 10,
      correct: 8,
      avgStability: undefined,
      totalReviews: undefined,
    });
  });

  it('should sort dates ascending', () => {
    const dailyPoints: DailyPerformancePoint[] = [
      { date: '2025-01-03', attempts: 1, correct: 1, accuracy: 100 },
      { date: '2025-01-01', attempts: 2, correct: 1, accuracy: 50 },
    ];
    const stabilityPoints: StabilityTrendPoint[] = [
      { date: '2025-01-02', avgStability: 3.0, totalReviews: 5, conditions: [] },
    ];

    const result = mergeLearningCurveData(dailyPoints, stabilityPoints);

    const dates = result.map(p => p.date);
    expect(dates).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
  });
});

describe('fetchLearningCurveData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge data from both endpoints', async () => {
    const mockToken = 'test-token';
    const mockDailyResult = {
      dailyPerformance: [
        { date: '2025-01-01', attempts: 10, correct: 8, accuracy: 80 },
      ],
      period: '30 days',
    };
    const mockStabilityResult = {
      trendData: [
        { date: '2025-01-01', avgStability: 5.2, totalReviews: 12, conditions: [] },
      ],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockDailyResult,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockStabilityResult.trendData }),
      });

    const result = await fetchLearningCurveData(mockToken, 30);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost/api/user/daily-performance?days=30',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost/api/user/stability-trend?days=30',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`,
        }),
      })
    );
    expect(result).toEqual({
      points: [
        { date: '2025-01-01', accuracy: 80, attempts: 10, correct: 8, avgStability: 5.2, totalReviews: 12 },
      ],
      summary: expect.any(Object),
    });
    // summary should have startDate, endDate, totalAttempts, totalCorrect, avgAccuracy
    expect(result.summary?.startDate).toBe('2025-01-01');
    expect(result.summary?.endDate).toBe('2025-01-01');
    expect(result.summary?.totalAttempts).toBe(10);
    expect(result.summary?.totalCorrect).toBe(8);
    expect(result.summary?.avgAccuracy).toBe(80);
    expect(result.summary?.avgStability).toBe(5.2);
  });

  it('should handle missing stability data', async () => {
    const mockToken = 'test-token';
    const mockDailyResult = {
      dailyPerformance: [
        { date: '2025-01-01', attempts: 5, correct: 4, accuracy: 80 },
      ],
      period: '30 days',
    };
    const mockStabilityResult = {
      trendData: [],
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockDailyResult,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockStabilityResult.trendData }),
      });

    const result = await fetchLearningCurveData(mockToken, 30);

    expect(result.points).toHaveLength(1);
    expect(result.points[0].avgStability).toBeUndefined();
    expect(result.summary?.avgStability).toBeUndefined();
  });
});