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

// Mock getApiEndpoint to return absolute URLs (jsdom needs valid URLs for fetch)
vi.mock('@/lib/utils/apiConfig', () => ({
  getApiEndpoint: (path: string) => `http://localhost${path}`,
  API_ENDPOINTS: {
    USER_STABILITY_TREND: '/api/user/stability-trend',
  },
}));

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
    const mockDailyResponse = {
      dailyPerformance: [
        { date: '2025-01-01', attempts: 10, correct: 8, accuracy: 80 },
      ],
      period: '30 days',
    };
    const mockStabilityResponse = {
      data: [
        { date: '2025-01-01', avgStability: 5.2, totalReviews: 12, conditions: [] },
      ],
    };

    // Mock global fetch to return different responses based on URL
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('daily-performance')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockDailyResponse),
        });
      }
      if (url.includes('stability-trend')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockStabilityResponse),
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchLearningCurveData(mockToken, 30);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.points).toEqual([
      { date: '2025-01-01', accuracy: 80, attempts: 10, correct: 8, avgStability: 5.2, totalReviews: 12 },
    ]);
    expect(result.summary?.startDate).toBe('2025-01-01');
    expect(result.summary?.endDate).toBe('2025-01-01');
    expect(result.summary?.totalAttempts).toBe(10);
    expect(result.summary?.totalCorrect).toBe(8);
    expect(result.summary?.avgAccuracy).toBe(80);
    expect(result.summary?.avgStability).toBe(5.2);

    vi.unstubAllGlobals();
  });

  it('should handle missing stability data', async () => {
    const mockToken = 'test-token';
    const mockDailyResponse = {
      dailyPerformance: [
        { date: '2025-01-01', attempts: 5, correct: 4, accuracy: 80 },
      ],
      period: '30 days',
    };
    const mockStabilityResponse = {
      data: [],
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('daily-performance')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockDailyResponse),
        });
      }
      if (url.includes('stability-trend')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockStabilityResponse),
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchLearningCurveData(mockToken, 30);

    expect(result.points).toHaveLength(1);
    expect(result.points[0].avgStability).toBeUndefined();
    expect(result.summary?.avgStability).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
