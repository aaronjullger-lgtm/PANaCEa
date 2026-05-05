import type { TodayPlanData } from '@/hooks/useTodayPlan';
import type { DashboardAnalyticsModel, DashboardOverview } from '@/lib/dashboard/realStudyAnalytics';
import type { PerformanceRecord, UserProfile } from '@/types';
import { normalizeDashboardSignals } from '../engine/normalizeSignals';
import type { DashboardContext } from '../model/DashboardContext';

const NOW = new Date('2026-04-29T12:00:00-04:00');

function isoDays(days: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function makePerformanceRecords(count = 60, system = 'Pulmonary'): PerformanceRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: NOW.getTime() - index * 3_600_000,
    system: index % 3 === 0 ? 'Cardiology' : system,
    subcategory: null,
    conditionId: `condition-${index}`,
    condition: index % 2 === 0 ? 'Pulmonary embolism' : 'Pneumonia',
    topic: system,
    isCorrect: index % 4 !== 0,
    focus: 'all',
    timeSpentMs: index % 7 === 0 ? 3_000 : 24_000,
  }));
}

export function makeTodayPlan(overrides: Partial<TodayPlanData> = {}): TodayPlanData {
  return {
    recommendedMainCount: 18,
    recommendedTargetedCount: 12,
    mainSystems: ['Pulmonary'],
    targetedConditions: ['PE vs pneumonia'],
    readinessPriority: 72,
    retentionPriority: 62,
    recommendedSplit: 'balanced',
    reasonSummary: 'Pulmonary moved up because recent misses clustered and review coverage is manageable.',
    generatedAt: NOW.toISOString(),
    tasks: [
      {
        id: 'today-main-readiness',
        kind: 'main',
        mode: 'core_adaptive',
        title: 'Readiness question block',
        count: 18,
        estimatedMinutes: 28,
        reason: 'Focus on Pulmonary based on recent readiness gaps.',
        priority: 'high',
        status: 'pending',
        systemFilter: ['Pulmonary'],
        route: '/study/main-session',
        launchParams: { source: 'study-plan', mode: 'core_adaptive' },
      },
      {
        id: 'today-targeted-review',
        kind: 'targeted',
        mode: 'rapid_recall',
        title: 'Due review block',
        count: 12,
        estimatedMinutes: 16,
        reason: 'Prioritize due and overdue FSRS review items.',
        priority: 'high',
        status: 'pending',
        conditionIds: ['PE vs pneumonia'],
        route: '/modes/rapid-recall',
        launchParams: { source: 'study-plan', mode: 'rapid_recall' },
      },
    ],
    ...overrides,
  };
}

type AnalyticsOverrides = Omit<Partial<DashboardAnalyticsModel>, 'overview'> & {
  overview?: Partial<DashboardOverview>;
};

export function makeAnalytics(overrides: AnalyticsOverrides = {}): DashboardAnalyticsModel {
  const base: DashboardAnalyticsModel = {
    overview: {
      attemptsLast7Days: 42,
      accuracyLast7Days: 68,
      accuracyDelta: 4,
      totalAttempts: 120,
      questionsSeen: 90,
      currentStreak: 4,
      activeDays: 18,
      studyMinutesLast7Days: 160,
      avgSessionQuestions: 14,
      dueToday: 12,
      overdueReviews: 2,
      totalActiveReviews: 80,
    },
    trend: Array.from({ length: 14 }, (_, index) => ({
      date: `2026-04-${String(16 + index).padStart(2, '0')}`,
      attempts: 8,
      correct: 5 + (index % 3),
      accuracy: 58 + index,
      totalTimeMs: 18 * 60_000,
      sessionCount: 1,
    })),
    heatmap: [],
    weakSystems: [
      {
        system: 'Pulmonary',
        accuracy: 61,
        attempts: 28,
        trend: 'declining',
        gapPercent: -8,
        label: 'needs-accuracy-work',
        score: 48,
      },
      {
        system: 'Renal',
        accuracy: 69,
        attempts: 18,
        trend: 'neutral',
        gapPercent: -5,
        label: 'understudied',
        score: 28,
      },
    ],
    recentSessions: [],
    reviewForecast: {
      overdue: 2,
      today: 12,
      totalActive: 80,
      dueConditionIds: [],
      overdueConditionIds: [],
      dueReviewCardIds: [],
      overdueReviewCardIds: [],
      forecast: Array.from({ length: 7 }, (_, index) => ({
        date: isoDays(index).slice(0, 10),
        count: index === 0 ? 12 : 5 + index,
      })),
    },
    blueprintGaps: {
      systems: [
        {
          system: 'Pulmonary',
          targetPercent: 10,
          actualPercent: 5,
          gapPercent: -5,
          totalAttempts: 28,
          correctAttempts: 17,
          accuracy: 61,
        },
        {
          system: 'Cardiology',
          targetPercent: 16,
          actualPercent: 14,
          gapPercent: -2,
          totalAttempts: 30,
          correctAttempts: 21,
          accuracy: 70,
        },
      ],
      totalAttempts: 120,
      coverageScore: 74,
    },
    weakConditions: [],
    conditionStats: [],
    confusionPairs: [
      {
        id: 'pair-1',
        correctConditionId: 'pe',
        selectedConditionId: 'pneumonia',
        system: 'Pulmonary',
        frequency: 6,
        lastSeen: NOW.toISOString(),
        correctConditionName: 'PE',
        selectedConditionName: 'Pneumonia',
      },
    ],
    recommendations: [],
    warnings: [],
    hasMeaningfulData: true,
  };

  return {
    ...base,
    ...overrides,
    overview: { ...base.overview, ...overrides.overview },
  };
}

function buildContext(input: {
  performanceCount?: number;
  profile?: Partial<UserProfile>;
  plan?: TodayPlanData | null;
  analytics?: DashboardAnalyticsModel | null;
  dueCount?: number;
  growthAreas?: string[];
  examLabel?: string;
  availableMinutes?: number | null;
  todayPlanError?: string | null;
  dashboardAnalyticsError?: string | null;
}): DashboardContext {
  return normalizeDashboardSignals({
    performanceData: makePerformanceRecords(input.performanceCount ?? 60),
    growthAreas: input.growthAreas ?? ['Pulmonary'],
    dueCount: input.dueCount ?? input.analytics?.overview.dueToday ?? 12,
    examLabel: input.examLabel ?? 'PANCE',
    profile: input.profile ?? { examDate: isoDays(84), hasCompletedOnboarding: true, yearInProgram: 'Preparing for PANCE' },
    todayPlan: input.plan === undefined ? makeTodayPlan() : input.plan,
    todayPlanError: input.todayPlanError ?? null,
    dashboardAnalytics: input.analytics === undefined ? makeAnalytics() : input.analytics,
    dashboardAnalyticsError: input.dashboardAnalyticsError ?? null,
    availableMinutes: input.availableMinutes,
    now: NOW,
  });
}

export const dashboardFixtures = {
  panceNormal: () => buildContext({}),
  panceBehind: () =>
    buildContext({
      profile: { examDate: isoDays(18), hasCompletedOnboarding: true, yearInProgram: 'Preparing for PANCE' },
      plan: makeTodayPlan({ readinessPriority: 38 }),
      analytics: makeAnalytics({ overview: { totalAttempts: 130, dueToday: 18, overdueReviews: 6 } }),
    }),
  panceOverloaded: () => buildContext({ availableMinutes: 15 }),
  eorInFiveDays: () =>
    buildContext({
      profile: { currentRotation: 'Surgery', eorTestDate: isoDays(5), hasCompletedOnboarding: true, yearInProgram: 'Clinical Year' },
      examLabel: 'Surgery EOR',
    }),
  didacticExamSoon: () =>
    buildContext({
      profile: { examDate: isoDays(9), hasCompletedOnboarding: true, yearInProgram: 'Didactic Year 2' },
      examLabel: 'Cardiology block exam',
    }),
  panreMaintenance: () =>
    buildContext({
      profile: { examDate: isoDays(220), hasCompletedOnboarding: true, yearInProgram: 'Graduated', isCertifiedPA: true },
      examLabel: 'PANRE-LA',
      plan: makeTodayPlan({ readinessPriority: 86, targetedConditions: [], mainSystems: ['Primary Care'] }),
      analytics: makeAnalytics({ overview: { totalAttempts: 150, dueToday: 0, overdueReviews: 0 } }),
    }),
  newUserDayOne: () =>
    buildContext({
      performanceCount: 4,
      plan: null,
      analytics: makeAnalytics({
        overview: { totalAttempts: 4, dueToday: 0, overdueReviews: 0, totalActiveReviews: 0 },
        reviewForecast: { overdue: 0, today: 0, totalActive: 0, forecast: [] },
        confusionPairs: [],
        weakSystems: [],
        hasMeaningfulData: false,
      }),
    }),
  highReviewDebt: () =>
    buildContext({
      analytics: makeAnalytics({ overview: { dueToday: 52, overdueReviews: 18, totalAttempts: 120 } }),
      dueCount: 52,
    }),
  reviewDebtWithoutPlanTask: () =>
    buildContext({
      plan: makeTodayPlan({ tasks: [] }),
      analytics: makeAnalytics({ overview: { dueToday: 28, overdueReviews: 8, totalAttempts: 120 } }),
      dueCount: 28,
    }),
  reviewDebtCoveredByConditionTask: () =>
    buildContext({
      plan: makeTodayPlan({
        tasks: [
          {
            id: 'today-targeted-review',
            kind: 'targeted',
            mode: 'targeted',
            title: 'Due review block',
            count: 12,
            estimatedMinutes: 16,
            reason: 'Prioritize due and overdue FSRS review items.',
            priority: 'high',
            status: 'pending',
            conditionIds: ['condition-pulmonary-embolism'],
            route: '/study/main-session',
            launchParams: { source: 'study-plan', mode: 'condition' },
          },
        ],
      }),
      analytics: makeAnalytics({
        overview: { dueToday: 3, overdueReviews: 1, totalAttempts: 120 },
        reviewForecast: {
          overdue: 1,
          today: 3,
          totalActive: 80,
          dueConditionIds: ['condition-pulmonary-embolism', 'condition-asthma'],
          overdueConditionIds: ['condition-pulmonary-embolism'],
          forecast: Array.from({ length: 7 }, (_, index) => ({
            date: isoDays(index).slice(0, 10),
            count: index === 0 ? 3 : 1,
          })),
        },
      }),
      dueCount: 3,
    }),
  confusionPairHandled: () => buildContext({ plan: makeTodayPlan({ targetedConditions: ['PE vs pneumonia'] }) }),
  confusionPairUnhandled: () =>
    buildContext({
      plan: makeTodayPlan({ targetedConditions: [], mainSystems: ['Cardiology'] }),
      growthAreas: ['Pulmonary'],
    }),
  partialFailure: () =>
    buildContext({
      todayPlanError: 'Study plan fetch failed',
      dashboardAnalyticsError: 'Review forecast unavailable.',
      plan: null,
    }),
};
