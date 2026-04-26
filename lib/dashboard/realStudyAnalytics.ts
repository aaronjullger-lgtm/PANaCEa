import type { StudyHeatmapDatum } from '@/components/charts/StudyHeatmap';

export interface DashboardStatsPayload {
  success?: boolean;
  stats: {
    overall: {
      totalAttempts: number;
      correctAttempts: number;
      accuracy: number;
      questionsSeenCount: number;
      currentStreak: number;
      totalStudyDays: number;
      avgTimeMs: number | null;
      avgAnswerChanges?: number | null;
      todayCount?: number;
      todayTimeMs?: number;
    };
    bySystems: Record<
      string,
      {
        total: number;
        correct: number;
        accuracy: number;
        trend: 'improving' | 'declining' | 'neutral';
        avgTimeMs: number | null;
        lastAttempt: string | null;
      }
    >;
    byConditions: Array<{
      conditionId: string;
      total: number;
      correct: number;
      accuracy: number;
    }>;
    weakAreas: Array<{
      system: string;
      accuracy: number;
      attempts: number;
      trend: 'improving' | 'declining' | 'neutral';
    }>;
    strongAreas: Array<{
      system: string;
      accuracy: number;
      attempts: number;
    }>;
    weakConditions: Array<{
      conditionId: string;
      total: number;
      correct: number;
      accuracy: number;
    }>;
    recentPerformance: {
      last7Days: {
        attempts: number;
        accuracy: number | null;
      };
      previous7Days: {
        attempts: number;
        accuracy: number | null;
      };
      trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
    };
    speedByType?: {
      recall: { avgTimeMs: number | null; count: number };
      clinicalReasoning: { avgTimeMs: number | null; count: number };
    };
    recommendations: string[];
  };
}

export interface SessionAnalyticsPayload {
  sessions: DashboardSessionRecord[];
  aggregateStats?: {
    recentAvgAccuracy: number | null;
    recentAvgQuestions: number | null;
    recentAvgMomentum: number | null;
    accuracyTrend: string | null;
    totalSessions: number;
  };
}

export interface DashboardSessionRecord {
  id?: string;
  startedAt: string;
  endedAt?: string | null;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number | null;
  totalTimeMs: number;
  mode?: string | null;
  focus?: string | null;
  difficulty?: string | null;
}

export interface ReviewForecastPayload {
  overdue: number;
  today: number;
  forecast: Array<{
    date: string;
    count: number;
    systems?: { system: string; count: number }[];
  }>;
  totalActive: number;
}

export interface BlueprintGapsPayload {
  systems: Array<{
    system: string;
    targetPercent: number;
    actualPercent: number;
    gapPercent: number;
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
  }>;
  totalAttempts: number;
  coverageScore: number;
}

export interface ConfusionPairsPayload {
  success?: boolean;
  confusionPairs: Array<{
    id: string;
    correctConditionId: string | null;
    selectedConditionId: string | null;
    system: string | null;
    frequency: number;
    lastSeen: string;
    correctConditionName?: string;
    selectedConditionName?: string;
  }>;
  total: number;
}

export interface DashboardOverview {
  attemptsLast7Days: number;
  accuracyLast7Days: number | null;
  accuracyDelta: number | null;
  totalAttempts: number;
  questionsSeen: number;
  currentStreak: number;
  activeDays: number;
  studyMinutesLast7Days: number;
  avgSessionQuestions: number | null;
  dueToday: number;
  overdueReviews: number;
  totalActiveReviews: number;
}

export interface DailyTrendPoint {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
  totalTimeMs: number;
  sessionCount: number;
}

export interface WeakSystemSummary {
  system: string;
  accuracy: number;
  attempts: number;
  trend: 'improving' | 'declining' | 'neutral';
  gapPercent: number | null;
  label: 'needs-accuracy-work' | 'understudied' | 'watch-list';
  score: number;
}

export interface RecentSessionSummary {
  id: string;
  startedAt: string;
  dateLabel: string;
  timeLabel: string;
  modeLabel: string;
  totalQuestions: number;
  accuracy: number | null;
  durationMinutes: number;
  completionLabel: string;
}

export interface DashboardAnalyticsModel {
  overview: DashboardOverview;
  trend: DailyTrendPoint[];
  heatmap: StudyHeatmapDatum[];
  weakSystems: WeakSystemSummary[];
  recentSessions: RecentSessionSummary[];
  reviewForecast: ReviewForecastPayload | null;
  blueprintGaps: BlueprintGapsPayload | null;
  weakConditions: DashboardStatsPayload['stats']['weakConditions'];
  conditionStats: DashboardStatsPayload['stats']['byConditions'];
  confusionPairs: Array<{
    id: string;
    correctConditionId: string;
    selectedConditionId: string;
    system: string | null;
    frequency: number;
    lastSeen: string;
    correctConditionName?: string;
    selectedConditionName?: string;
  }>;
  recommendations: string[];
  warnings: string[];
  hasMeaningfulData: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateRange(days: number): string[] {
  const result: string[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY_MS);
    result.push(toLocalDateKey(day));
  }

  return result;
}

function formatModeLabel(mode?: string | null): string {
  if (!mode) return 'Study session';
  return mode
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function safeNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clampPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildTrend(sessions: DashboardSessionRecord[], days = 14): DailyTrendPoint[] {
  const keys = buildDateRange(days);
  const byDay = new Map<string, DailyTrendPoint>();

  for (const key of keys) {
    byDay.set(key, {
      date: key,
      attempts: 0,
      correct: 0,
      accuracy: 0,
      totalTimeMs: 0,
      sessionCount: 0,
    });
  }

  for (const session of sessions) {
    const key = toLocalDateKey(session.startedAt);
    const bucket = byDay.get(key);
    if (!bucket) continue;

    bucket.attempts += safeNumber(session.totalQuestions);
    bucket.correct += safeNumber(session.correctAnswers);
    bucket.totalTimeMs += safeNumber(session.totalTimeMs);
    bucket.sessionCount += 1;
  }

  return keys.map((key) => {
    const bucket = byDay.get(key)!;
    return {
      ...bucket,
      accuracy:
        bucket.attempts > 0 ? Math.round((bucket.correct / bucket.attempts) * 100) : 0,
    };
  });
}

function buildHeatmap(sessions: DashboardSessionRecord[]): StudyHeatmapDatum[] {
  const byDay = new Map<string, number>();

  for (const session of sessions) {
    const key = toLocalDateKey(session.startedAt);
    byDay.set(key, (byDay.get(key) ?? 0) + safeNumber(session.totalQuestions));
  }

  return Array.from(byDay.entries())
    .map(([day, value]) => ({ day, value }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

function buildOverview(
  stats: DashboardStatsPayload | null,
  sessions: DashboardSessionRecord[],
  reviewForecast: ReviewForecastPayload | null,
): DashboardOverview {
  const last7DateKeys = new Set(buildDateRange(7));
  const recentSessions = sessions.filter((session) =>
    last7DateKeys.has(toLocalDateKey(session.startedAt)),
  );
  const studyMinutesLast7Days = Math.round(
    recentSessions.reduce((sum, session) => sum + safeNumber(session.totalTimeMs), 0) / 60000,
  );
  const avgSessionQuestions =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((sum, session) => sum + safeNumber(session.totalQuestions), 0) /
            sessions.length,
        )
      : null;

  const accuracyLast7Days = clampPercent(stats?.stats.recentPerformance.last7Days.accuracy ?? null);
  const previousAccuracy = clampPercent(
    stats?.stats.recentPerformance.previous7Days.accuracy ?? null,
  );

  return {
    attemptsLast7Days: safeNumber(stats?.stats.recentPerformance.last7Days.attempts),
    accuracyLast7Days,
    accuracyDelta:
      accuracyLast7Days != null && previousAccuracy != null
        ? accuracyLast7Days - previousAccuracy
        : null,
    totalAttempts: safeNumber(stats?.stats.overall.totalAttempts),
    questionsSeen: safeNumber(stats?.stats.overall.questionsSeenCount),
    currentStreak: safeNumber(stats?.stats.overall.currentStreak),
    activeDays: safeNumber(stats?.stats.overall.totalStudyDays),
    studyMinutesLast7Days,
    avgSessionQuestions,
    dueToday: safeNumber(reviewForecast?.today),
    overdueReviews: safeNumber(reviewForecast?.overdue),
    totalActiveReviews: safeNumber(reviewForecast?.totalActive),
  };
}

function buildWeakSystems(
  stats: DashboardStatsPayload | null,
  blueprintGaps: BlueprintGapsPayload | null,
): WeakSystemSummary[] {
  if (!stats) return [];

  const gapMap = new Map(
    (blueprintGaps?.systems ?? []).map((system) => [system.system, system.gapPercent]),
  );

  const systems = Object.entries(stats.stats.bySystems)
    .map(([system, details]) => {
      const attempts = safeNumber(details.total);
      const accuracy = safeNumber(details.accuracy);
      const gapPercent = gapMap.get(system) ?? null;
      const underStudyPenalty = gapPercent != null && gapPercent < 0 ? Math.abs(gapPercent) * 2 : 0;
      const accuracyPenalty = attempts >= 5 ? 100 - accuracy : 0;
      const trendPenalty = details.trend === 'declining' ? 8 : 0;
      const confidenceWeight = Math.min(1, attempts / 20);
      const score = Math.round((accuracyPenalty * confidenceWeight + underStudyPenalty + trendPenalty) * 10) / 10;

      let label: WeakSystemSummary['label'] = 'watch-list';
      if (attempts >= 5 && accuracy < 70) label = 'needs-accuracy-work';
      else if (gapPercent != null && gapPercent < -4) label = 'understudied';

      return {
        system,
        accuracy,
        attempts,
        trend: details.trend,
        gapPercent,
        label,
        score,
      };
    })
    .filter((system) => system.attempts > 0 || system.label === 'understudied')
    .filter(
      (system) =>
        system.label !== 'watch-list' ||
        system.trend === 'declining' ||
        (system.gapPercent != null && system.gapPercent < -6),
    )
    .sort((left, right) => right.score - left.score);

  return systems.slice(0, 5);
}

function buildRecentSessions(sessions: DashboardSessionRecord[]): RecentSessionSummary[] {
  return sessions.slice(0, 6).map((session, index) => {
    const startedAt = new Date(session.startedAt);
    const durationMinutes = Math.max(1, Math.round(safeNumber(session.totalTimeMs) / 60000));
    const accuracy =
      session.accuracy != null
        ? clampPercent(session.accuracy)
        : session.totalQuestions > 0
          ? Math.round((safeNumber(session.correctAnswers) / safeNumber(session.totalQuestions)) * 100)
          : null;

    return {
      id: session.id ?? `session-${index}-${session.startedAt}`,
      startedAt: session.startedAt,
      dateLabel: startedAt.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      timeLabel: startedAt.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
      modeLabel: formatModeLabel(session.mode),
      totalQuestions: safeNumber(session.totalQuestions),
      accuracy,
      durationMinutes,
      completionLabel:
        session.endedAt || safeNumber(session.totalQuestions) > 0 ? 'Completed' : 'Interrupted',
    };
  });
}

export function buildDashboardAnalyticsModel(input: {
  stats: DashboardStatsPayload | null;
  sessions: SessionAnalyticsPayload | null;
  reviewForecast: ReviewForecastPayload | null;
  blueprintGaps: BlueprintGapsPayload | null;
  confusionPairs: ConfusionPairsPayload | null;
  warnings?: string[];
}): DashboardAnalyticsModel {
  const stats = input.stats;
  const sessionList = input.sessions?.sessions ?? [];
  const trend = buildTrend(sessionList, 14);
  const heatmap = buildHeatmap(sessionList);
  const overview = buildOverview(stats, sessionList, input.reviewForecast);
  const weakSystems = buildWeakSystems(stats, input.blueprintGaps);
  const recentSessions = buildRecentSessions(sessionList);
  const confusionPairs = (input.confusionPairs?.confusionPairs ?? []).filter(
    (pair): pair is DashboardAnalyticsModel['confusionPairs'][number] =>
      typeof pair.correctConditionId === 'string' &&
      typeof pair.selectedConditionId === 'string',
  );

  const hasMeaningfulData =
    overview.totalAttempts > 0 ||
    overview.totalActiveReviews > 0 ||
    recentSessions.length > 0 ||
    heatmap.length > 0;

  return {
    overview,
    trend,
    heatmap,
    weakSystems,
    recentSessions,
    reviewForecast: input.reviewForecast,
    blueprintGaps: input.blueprintGaps,
    weakConditions: stats?.stats.weakConditions ?? [],
    conditionStats: stats?.stats.byConditions ?? [],
    confusionPairs,
    recommendations: stats?.stats.recommendations ?? [],
    warnings: input.warnings ?? [],
    hasMeaningfulData,
  };
}
