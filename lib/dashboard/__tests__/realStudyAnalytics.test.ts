import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDashboardAnalyticsModel,
  type DashboardStatsPayload,
  type StudyHistoryPayload,
} from '@/lib/dashboard/realStudyAnalytics';

const baseStats: DashboardStatsPayload = {
  success: true,
  stats: {
    overall: {
      totalAttempts: 120,
      correctAttempts: 78,
      accuracy: 65,
      questionsSeenCount: 90,
      currentStreak: 4,
      totalStudyDays: 10,
      avgTimeMs: 45000,
      avgAnswerChanges: 0.4,
      todayCount: 12,
      todayTimeMs: 1200000,
    },
    bySystems: {
      Cardiovascular: {
        total: 24,
        correct: 12,
        accuracy: 50,
        trend: 'declining',
        avgTimeMs: 52000,
        lastAttempt: '2026-04-14T10:00:00.000Z',
      },
      Pulmonary: {
        total: 18,
        correct: 14,
        accuracy: 78,
        trend: 'improving',
        avgTimeMs: 41000,
        lastAttempt: '2026-04-13T10:00:00.000Z',
      },
    },
    byConditions: [],
    weakAreas: [],
    strongAreas: [],
    weakConditions: [],
    recentPerformance: {
      last7Days: {
        attempts: 40,
        accuracy: 62,
      },
      previous7Days: {
        attempts: 32,
        accuracy: 70,
      },
      trend: 'declining',
    },
    recommendations: ['Focus on Cardiovascular - currently at 50% accuracy'],
  },
};

const baseStudyHistory: StudyHistoryPayload = {
  reviewCount: 30,
  correctCount: 24,
  retentionRate: 0.8,
  averageRating: 3.2,
  averageResponseTimeMs: 42000,
  averageStability: 8.4,
  averageDifficulty: 5.1,
  averageRetrievability: 0.87,
  optimizer: {
    eligible: false,
    reviewCount: 740,
    minimumRequired: 1000,
    reviewsNeeded: 260,
  },
  trends: [
    {
      date: '2026-04-14',
      reviews: 30,
      correct: 24,
      retentionRate: 0.8,
      averageRating: 3.2,
    },
  ],
  bySystem: [
    {
      system: 'Cardiovascular',
      reviews: 20,
      correct: 15,
      retentionRate: 0.75,
      averageStability: 7.8,
      averageDifficulty: 5.6,
    },
  ],
  recentReviews: [],
  upcomingReviews: [
    {
      id: 'card-1',
      source: 'card',
      questionId: 'q1',
      conditionId: 'condition-1',
      dueAt: '2026-04-15T16:00:00.000Z',
      overdueDays: 0,
      stability: 8.4,
      difficulty: 5.1,
      state: 2,
      retrievability: 0.82,
      progressContext: 'main',
      system: 'Cardiovascular',
    },
  ],
};

describe('buildDashboardAnalyticsModel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes overview, trend, and weak system ranking from real inputs', () => {
    const model = buildDashboardAnalyticsModel({
      stats: baseStats,
      sessions: {
        sessions: [
          {
            id: 's1',
            startedAt: '2026-04-14T14:00:00.000Z',
            endedAt: '2026-04-14T14:30:00.000Z',
            totalQuestions: 20,
            correctAnswers: 12,
            accuracy: 60,
            totalTimeMs: 1800000,
            mode: 'main',
          },
          {
            id: 's2',
            startedAt: '2026-04-13T14:00:00.000Z',
            endedAt: '2026-04-13T14:20:00.000Z',
            totalQuestions: 10,
            correctAnswers: 8,
            accuracy: 80,
            totalTimeMs: 1200000,
            mode: 'rapid_recall',
          },
        ],
      },
      reviewForecast: {
        overdue: 5,
        today: 9,
        totalActive: 70,
        forecast: [],
      },
      studyHistory: baseStudyHistory,
      blueprintGaps: {
        totalAttempts: 42,
        coverageScore: 71,
        systems: [
          {
            system: 'Cardiovascular',
            targetPercent: 11,
            actualPercent: 5,
            gapPercent: -6,
            totalAttempts: 24,
            correctAttempts: 12,
            accuracy: 50,
          },
          {
            system: 'Pulmonary',
            targetPercent: 9,
            actualPercent: 11,
            gapPercent: 2,
            totalAttempts: 18,
            correctAttempts: 14,
            accuracy: 78,
          },
        ],
      },
      confusionPairs: {
        confusionPairs: [],
        total: 0,
      },
    });

    expect(model.overview.attemptsLast7Days).toBe(40);
    expect(model.overview.dueToday).toBe(9);
    expect(model.overview.studyMinutesLast7Days).toBe(50);
    expect(model.trend.some((day) => day.attempts > 0)).toBe(true);
    expect(model.heatmap.length).toBe(2);
    expect(model.recentSessions[0]?.modeLabel).toBe('Main');
    expect(model.weakSystems[0]?.system).toBe('Cardiovascular');
    expect(model.weakSystems[0]?.label).toBe('needs-accuracy-work');
    expect(model.fsrs.retentionPercent).toBe(80);
    expect(model.fsrs.averageRetrievabilityPercent).toBe(87);
    expect(model.fsrs.optimizer?.progressPercent).toBe(74);
    expect(model.fsrs.upcomingReviews[0]?.targetLabel).toBe('Cardiovascular');
  });

  it('returns a clean empty model for new users', () => {
    const model = buildDashboardAnalyticsModel({
      stats: {
        ...baseStats,
        stats: {
          ...baseStats.stats,
          overall: {
            ...baseStats.stats.overall,
            totalAttempts: 0,
            correctAttempts: 0,
            accuracy: 0,
            questionsSeenCount: 0,
            currentStreak: 0,
            totalStudyDays: 0,
          },
          bySystems: {},
          byConditions: [],
          weakConditions: [],
          recentPerformance: {
            last7Days: { attempts: 0, accuracy: null },
            previous7Days: { attempts: 0, accuracy: null },
            trend: 'insufficient_data',
          },
          recommendations: [],
        },
      },
      sessions: { sessions: [] },
      reviewForecast: null,
      blueprintGaps: null,
      confusionPairs: null,
    });

    expect(model.hasMeaningfulData).toBe(false);
    expect(model.weakSystems).toEqual([]);
    expect(model.recentSessions).toEqual([]);
    expect(model.heatmap).toEqual([]);
    expect(model.fsrs.reviewCount).toBe(0);
    expect(model.fsrs.optimizer).toBeNull();
  });

  it('treats FSRS review history as meaningful dashboard data', () => {
    const model = buildDashboardAnalyticsModel({
      stats: null,
      sessions: { sessions: [] },
      reviewForecast: null,
      studyHistory: {
        ...baseStudyHistory,
        upcomingReviews: [],
      },
      blueprintGaps: null,
      confusionPairs: null,
    });

    expect(model.hasMeaningfulData).toBe(true);
    expect(model.studyHistory?.reviewCount).toBe(30);
    expect(model.fsrs.dueTodayCount).toBe(0);
  });
});
