import { getAllSystems, normalizeSystemName } from '@/lib/constants/blueprint';

export type DashboardTrend = 'improving' | 'declining' | 'stable' | 'neutral' | 'insufficient_data';

export interface SystemDashboardStats {
  total: number;
  correct: number;
  accuracy: number;
  trend: 'improving' | 'declining' | 'neutral';
  avgTimeMs: number | null;
  lastAttempt: string | null;
}

export interface WeakArea {
  system: string;
  accuracy: number;
  attempts: number;
  trend: 'improving' | 'declining' | 'neutral';
}

export interface StudyPlanProgress {
  planDate: string | null;
  status: string;
  targetQuestionsCount: number;
  actualQuestionsAnswered: number;
  completionPercent: number;
  actualAccuracy: number | null;
  estimatedTimeMinutes: number | null;
}

export interface ReviewQueueStats {
  dueNow: number;
  overdue: number;
  dueToday: number;
  upcoming7Days: number;
  totalActive: number;
}

export interface RecentActivityDay {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
  timeSpentMs: number;
}

interface AttemptLike {
  wasCorrect: boolean | null;
  system?: string | null;
  conditionId?: string | null;
  mode?: string | null;
  timeSpentMs?: number | null;
  durationMs?: number | null;
  createdAt: Date | string;
}

interface GroupRow {
  system?: string | null;
  conditionId?: string | null;
  wasCorrect: boolean | null;
  _count: number | { id?: number } | Record<string, number>;
}

interface DashboardAnalyticsPrisma {
  questionAttempt: {
    count(args: Record<string, unknown>): Promise<number>;
    aggregate(args: Record<string, unknown>): Promise<{ _avg?: Record<string, number | null> }>;
    groupBy(args: Record<string, unknown>): Promise<GroupRow[]>;
    findMany(args: Record<string, unknown>): Promise<AttemptLike[]>;
  };
  reviewLog: {
    count(args: Record<string, unknown>): Promise<number>;
    findMany(args: Record<string, unknown>): Promise<
      Array<{
        wasCorrect: boolean | null;
        system?: string | null;
        conditionId?: string | null;
        responseTimeMs?: number | null;
        reviewedAt: Date | string;
      }>
    >;
  };
  userQuestionSeen: {
    count(args: Record<string, unknown>): Promise<number>;
  };
  studySession: {
    findMany(args: Record<string, unknown>): Promise<
      Array<{
        id: string;
        startedAt: Date | string;
        endedAt?: Date | string | null;
        totalQuestions: number;
        correctAnswers: number;
        accuracy: number;
        totalTimeMs: number;
      }>
    >;
  };
  userProgress: {
    findMany(args: Record<string, unknown>): Promise<
      Array<{
        nextReviewAt?: Date | string | null;
        totalAttempts?: number | null;
        correctCount?: number | null;
        accuracy?: number | null;
        system?: string | null;
      }>
    >;
  };
  dailyStudyPlan: {
    findFirst(args: Record<string, unknown>): Promise<{
      planDate: Date | string;
      status: string;
      targetQuestionsCount: number;
      actualQuestionsAnswered: number;
      actualAccuracy?: number | null;
      estimatedTimeMinutes?: number | null;
    } | null>;
  };
}

const RECENT_ATTEMPT_LIMIT = 2_000;
const MS_PER_DAY = 86_400_000;

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampNonNegativeInt(value: unknown): number {
  return Math.max(0, Math.round(toFiniteNumber(value, 0)));
}

export function clampPercent(value: unknown): number {
  const n = toFiniteNumber(value, 0);
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function percentFromCounts(numerator: unknown, denominator: unknown): number {
  const safeNumerator = Math.max(0, toFiniteNumber(numerator, 0));
  const safeDenominator = Math.max(0, toFiniteNumber(denominator, 0));
  if (safeDenominator <= 0) return 0;
  return clampPercent((safeNumerator / safeDenominator) * 100);
}

function nullableAverage(sum: number, count: number): number | null {
  return count > 0 ? Math.round(sum / count) : null;
}

function coerceDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value: Date | string): string | null {
  const date = coerceDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getGroupCount(row: GroupRow): number {
  if (typeof row._count === 'number') return clampNonNegativeInt(row._count);
  if ('id' in row._count) return clampNonNegativeInt(row._count.id);
  return clampNonNegativeInt(Object.values(row._count)[0] ?? 0);
}

function getAttemptTimeMs(attempt: AttemptLike): number {
  return clampNonNegativeInt(attempt.timeSpentMs ?? attempt.durationMs ?? 0);
}

export function calculateCurrentStreak(activityDates: Array<Date | string>, now: Date = new Date()): number {
  const keys = new Set<string>();
  for (const value of activityDates) {
    const key = dateKey(value);
    if (key) keys.add(key);
  }

  if (keys.size === 0) return 0;

  const today = startOfUtcDay(now);
  const yesterday = new Date(today.getTime() - MS_PER_DAY);
  let cursor: Date;
  if (keys.has(today.toISOString().slice(0, 10))) {
    cursor = today;
  } else if (keys.has(yesterday.toISOString().slice(0, 10))) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (keys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }
  return streak;
}

export function buildEmptyDashboardStats() {
  return {
    success: true,
    stats: {
      overall: {
        totalAttempts: 0,
        correctAttempts: 0,
        accuracy: 0,
        questionsSeenCount: 0,
        currentStreak: 0,
        totalStudyDays: 0,
        avgTimeMs: null as number | null,
        avgAnswerChanges: null as number | null,
        todayCount: 0,
        todayTimeMs: 0,
      },
      bySystems: buildSystemStats([], []),
      byConditions: [] as Array<{ conditionId: string; total: number; correct: number; accuracy: number }>,
      weakAreas: [] as WeakArea[],
      strongAreas: [] as Array<{ system: string; accuracy: number; attempts: number }>,
      weakConditions: [] as Array<{ conditionId: string; total: number; correct: number; accuracy: number }>,
      recentPerformance: {
        last7Days: { attempts: 0, accuracy: null as number | null },
        previous7Days: { attempts: 0, accuracy: null as number | null },
        trend: 'insufficient_data' as DashboardTrend,
      },
      speedByType: {
        recall: { avgTimeMs: null as number | null, count: 0 },
        clinicalReasoning: { avgTimeMs: null as number | null, count: 0 },
      },
      recommendations: ['Start studying to see your statistics.'],
      studyPlanProgress: null as StudyPlanProgress | null,
      reviewQueueStats: {
        dueNow: 0,
        overdue: 0,
        dueToday: 0,
        upcoming7Days: 0,
        totalActive: 0,
      } satisfies ReviewQueueStats,
      recentActivity: [] as RecentActivityDay[],
    },
  };
}

export function buildSystemStats(
  groupedRows: GroupRow[],
  recentAttempts: AttemptLike[]
): Record<string, SystemDashboardStats> {
  const counts = new Map<string, { total: number; correct: number; timeSum: number; timeN: number; lastAttempt: Date | null }>();

  for (const row of groupedRows) {
    if (!row.system) continue;
    const system = normalizeSystemName(row.system);
    const current = counts.get(system) ?? { total: 0, correct: 0, timeSum: 0, timeN: 0, lastAttempt: null };
    const count = getGroupCount(row);
    current.total += count;
    if (row.wasCorrect === true) current.correct += count;
    counts.set(system, current);
  }

  for (const attempt of recentAttempts) {
    if (!attempt.system) continue;
    const system = normalizeSystemName(attempt.system);
    const current = counts.get(system) ?? { total: 0, correct: 0, timeSum: 0, timeN: 0, lastAttempt: null };
    const timeMs = getAttemptTimeMs(attempt);
    if (timeMs > 0) {
      current.timeSum += timeMs;
      current.timeN += 1;
    }
    const createdAt = coerceDate(attempt.createdAt);
    if (createdAt && (!current.lastAttempt || createdAt > current.lastAttempt)) {
      current.lastAttempt = createdAt;
    }
    counts.set(system, current);
  }

  const out: Record<string, SystemDashboardStats> = {};
  for (const system of getAllSystems()) {
    const data = counts.get(system) ?? { total: 0, correct: 0, timeSum: 0, timeN: 0, lastAttempt: null };
    const systemRecent = recentAttempts.filter((a) => a.system && normalizeSystemName(a.system) === system);
    let trend: 'improving' | 'declining' | 'neutral' = 'neutral';
    if (systemRecent.length >= 10) {
      const recent5 = systemRecent.slice(0, 5);
      const previous5 = systemRecent.slice(5, 10);
      const recentAccuracy = percentFromCounts(recent5.filter((a) => a.wasCorrect === true).length, recent5.length);
      const previousAccuracy = percentFromCounts(previous5.filter((a) => a.wasCorrect === true).length, previous5.length);
      if (recentAccuracy > previousAccuracy + 15) trend = 'improving';
      if (recentAccuracy < previousAccuracy - 15) trend = 'declining';
    }

    out[system] = {
      total: clampNonNegativeInt(data.total),
      correct: clampNonNegativeInt(Math.min(data.correct, data.total)),
      accuracy: percentFromCounts(data.correct, data.total),
      trend,
      avgTimeMs: nullableAverage(data.timeSum, data.timeN),
      lastAttempt: data.lastAttempt ? data.lastAttempt.toISOString() : null,
    };
  }

  return out;
}

export function getWeakAreas(systemStats: Record<string, SystemDashboardStats>): WeakArea[] {
  return Object.entries(systemStats)
    .filter(([, stats]) => stats.total >= 5 && stats.accuracy < 70)
    .sort((a, b) => a[1].accuracy - b[1].accuracy)
    .map(([system, stats]) => ({
      system,
      accuracy: stats.accuracy,
      attempts: stats.total,
      trend: stats.trend,
    }));
}

export function getRecentActivity(attempts: AttemptLike[], now: Date = new Date()): RecentActivityDay[] {
  const start = startOfUtcDay(new Date(now.getTime() - 13 * MS_PER_DAY));
  const buckets = new Map<string, { attempts: number; correct: number; timeSpentMs: number }>();
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(start.getTime() + i * MS_PER_DAY);
    buckets.set(day.toISOString().slice(0, 10), { attempts: 0, correct: 0, timeSpentMs: 0 });
  }

  for (const attempt of attempts) {
    const key = dateKey(attempt.createdAt);
    if (!key || !buckets.has(key)) continue;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.attempts += 1;
    if (attempt.wasCorrect === true) bucket.correct += 1;
    bucket.timeSpentMs += getAttemptTimeMs(attempt);
  }

  return Array.from(buckets.entries()).map(([date, bucket]) => ({
    date,
    attempts: bucket.attempts,
    correct: bucket.correct,
    accuracy: percentFromCounts(bucket.correct, bucket.attempts),
    timeSpentMs: bucket.timeSpentMs,
  }));
}

export function calculateReviewQueueStats(
  progressRows: Array<{ nextReviewAt?: Date | string | null }>,
  now: Date = new Date()
): ReviewQueueStats {
  const todayStart = startOfUtcDay(now);
  const todayEnd = new Date(todayStart.getTime() + MS_PER_DAY - 1);
  const upcomingEnd = new Date(now.getTime() + 7 * MS_PER_DAY);

  let dueNow = 0;
  let overdue = 0;
  let dueToday = 0;
  let upcoming7Days = 0;

  for (const row of progressRows) {
    const dueAt = coerceDate(row.nextReviewAt);
    if (!dueAt) continue;
    if (dueAt <= now) dueNow += 1;
    if (dueAt < todayStart) overdue += 1;
    if (dueAt >= todayStart && dueAt <= todayEnd) dueToday += 1;
    if (dueAt > now && dueAt <= upcomingEnd) upcoming7Days += 1;
  }

  return {
    dueNow,
    overdue,
    dueToday,
    upcoming7Days,
    totalActive: progressRows.length,
  };
}

export function calculateStudyPlanProgress(plan: Awaited<ReturnType<DashboardAnalyticsPrisma['dailyStudyPlan']['findFirst']>>): StudyPlanProgress | null {
  if (!plan) return null;
  const targetQuestionsCount = clampNonNegativeInt(plan.targetQuestionsCount);
  const actualQuestionsAnswered = clampNonNegativeInt(plan.actualQuestionsAnswered);
  return {
    planDate: dateKey(plan.planDate),
    status: plan.status || 'pending',
    targetQuestionsCount,
    actualQuestionsAnswered,
    completionPercent: percentFromCounts(actualQuestionsAnswered, targetQuestionsCount),
    actualAccuracy: plan.actualAccuracy == null ? null : clampPercent(plan.actualAccuracy),
    estimatedTimeMinutes: plan.estimatedTimeMinutes == null ? null : clampNonNegativeInt(plan.estimatedTimeMinutes),
  };
}

export async function getStudyPlanProgress(
  prisma: Pick<DashboardAnalyticsPrisma, 'dailyStudyPlan'>,
  userId: string,
  now: Date = new Date()
): Promise<StudyPlanProgress | null> {
  const today = startOfUtcDay(now);
  const plan = await prisma.dailyStudyPlan.findFirst({
    where: { userId, planDate: { lte: today } },
    orderBy: { planDate: 'desc' },
  });
  return calculateStudyPlanProgress(plan);
}

export async function getReviewQueueStats(
  prisma: Pick<DashboardAnalyticsPrisma, 'userProgress'>,
  userId: string,
  now: Date = new Date()
): Promise<ReviewQueueStats> {
  const rows = await prisma.userProgress.findMany({
    where: { userId, nextReviewAt: { not: null } },
    select: { nextReviewAt: true },
    take: 10_000,
  });
  return calculateReviewQueueStats(rows, now);
}

function buildConditionStats(groupedRows: GroupRow[]) {
  const counts = new Map<string, { total: number; correct: number }>();
  for (const row of groupedRows) {
    if (!row.conditionId) continue;
    const current = counts.get(row.conditionId) ?? { total: 0, correct: 0 };
    const count = getGroupCount(row);
    current.total += count;
    if (row.wasCorrect === true) current.correct += count;
    counts.set(row.conditionId, current);
  }

  const byConditions = Array.from(counts.entries())
    .filter(([, c]) => c.total >= 3)
    .map(([conditionId, c]) => ({
      conditionId,
      total: clampNonNegativeInt(c.total),
      correct: clampNonNegativeInt(Math.min(c.correct, c.total)),
      accuracy: percentFromCounts(c.correct, c.total),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);

  const weakConditions = Array.from(counts.entries())
    .filter(([, c]) => c.total >= 5 && percentFromCounts(c.correct, c.total) < 60)
    .map(([conditionId, c]) => ({
      conditionId,
      total: clampNonNegativeInt(c.total),
      correct: clampNonNegativeInt(Math.min(c.correct, c.total)),
      accuracy: percentFromCounts(c.correct, c.total),
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);

  return { byConditions, weakConditions };
}

function buildRecentPerformance(attempts: AttemptLike[], now: Date) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * MS_PER_DAY);
  const last7Days = attempts.filter((a) => {
    const date = coerceDate(a.createdAt);
    return date ? date >= sevenDaysAgo : false;
  });
  const previous7Days = attempts.filter((a) => {
    const date = coerceDate(a.createdAt);
    return date ? date >= fourteenDaysAgo && date < sevenDaysAgo : false;
  });

  const lastAccuracy = last7Days.length > 0 ? percentFromCounts(last7Days.filter((a) => a.wasCorrect === true).length, last7Days.length) : null;
  const previousAccuracy = previous7Days.length > 0 ? percentFromCounts(previous7Days.filter((a) => a.wasCorrect === true).length, previous7Days.length) : null;

  let trend: DashboardTrend = 'insufficient_data';
  if (lastAccuracy !== null && previousAccuracy !== null) {
    trend = lastAccuracy > previousAccuracy ? 'improving' : lastAccuracy < previousAccuracy ? 'declining' : 'stable';
  }

  return {
    last7Days: { attempts: last7Days.length, accuracy: lastAccuracy },
    previous7Days: { attempts: previous7Days.length, accuracy: previousAccuracy },
    trend,
  };
}

function buildSpeedByType(attempts: AttemptLike[]) {
  const recall = attempts.filter((a) => a.mode === 'rapid_recall' && getAttemptTimeMs(a) > 0);
  const clinical = attempts.filter((a) => a.mode !== 'rapid_recall' && getAttemptTimeMs(a) > 0);
  const recallSum = recall.reduce((sum, a) => sum + getAttemptTimeMs(a), 0);
  const clinicalSum = clinical.reduce((sum, a) => sum + getAttemptTimeMs(a), 0);

  return {
    recall: { avgTimeMs: nullableAverage(recallSum, recall.length), count: recall.length },
    clinicalReasoning: { avgTimeMs: nullableAverage(clinicalSum, clinical.length), count: clinical.length },
  };
}

async function loadAttemptFacts(prisma: DashboardAnalyticsPrisma, userId: string, now: Date) {
  const ninetyDaysAgo = new Date(now.getTime() - 90 * MS_PER_DAY);
  const [
    totalCount,
    correctCount,
    aggregates,
    systemGrouped,
    conditionGrouped,
    recentAttempts,
    questionsSeenCount,
  ] = await Promise.all([
    prisma.questionAttempt.count({ where: { userId } }),
    prisma.questionAttempt.count({ where: { userId, wasCorrect: true } }),
    prisma.questionAttempt.aggregate({
      where: { userId },
      _avg: { timeSpentMs: true, answerChangedCount: true },
    }),
    prisma.questionAttempt.groupBy({
      by: ['system', 'wasCorrect'],
      where: { userId, system: { not: null } },
      _count: { id: true },
    }),
    prisma.questionAttempt.groupBy({
      by: ['conditionId', 'wasCorrect'],
      where: { userId, conditionId: { not: null } },
      _count: { id: true },
    }),
    prisma.questionAttempt.findMany({
      where: { userId, createdAt: { gte: ninetyDaysAgo } },
      select: {
        wasCorrect: true,
        system: true,
        conditionId: true,
        timeSpentMs: true,
        durationMs: true,
        mode: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ATTEMPT_LIMIT,
    }),
    prisma.userQuestionSeen.count({ where: { userId } }),
  ]);

  return { totalCount, correctCount, aggregates, systemGrouped, conditionGrouped, recentAttempts, questionsSeenCount };
}

async function loadReviewLogFallbackFacts(prisma: DashboardAnalyticsPrisma, userId: string, now: Date) {
  const ninetyDaysAgo = new Date(now.getTime() - 90 * MS_PER_DAY);
  const [totalCount, correctCount, reviewRows, questionsSeenCount] = await Promise.all([
    prisma.reviewLog.count({ where: { userId, review_type: 'real', sessionType: 'MAIN' } }),
    prisma.reviewLog.count({ where: { userId, wasCorrect: true, review_type: 'real', sessionType: 'MAIN' } }),
    prisma.reviewLog.findMany({
      where: { userId, reviewedAt: { gte: ninetyDaysAgo }, review_type: 'real', sessionType: 'MAIN' },
      select: { wasCorrect: true, system: true, conditionId: true, responseTimeMs: true, reviewedAt: true },
      orderBy: { reviewedAt: 'desc' },
      take: RECENT_ATTEMPT_LIMIT,
    }),
    prisma.userQuestionSeen.count({ where: { userId } }),
  ]);

  const recentAttempts: AttemptLike[] = reviewRows.map((row) => ({
    wasCorrect: row.wasCorrect,
    system: row.system,
    conditionId: row.conditionId,
    mode: 'review',
    timeSpentMs: row.responseTimeMs,
    durationMs: row.responseTimeMs,
    createdAt: row.reviewedAt,
  }));
  const systemGrouped = groupAttemptsByField(recentAttempts, 'system');
  const conditionGrouped = groupAttemptsByField(recentAttempts, 'conditionId');

  return {
    totalCount,
    correctCount,
    aggregates: { _avg: { timeSpentMs: null, answerChangedCount: null } },
    systemGrouped,
    conditionGrouped,
    recentAttempts,
    questionsSeenCount,
  };
}

function groupAttemptsByField(attempts: AttemptLike[], field: 'system' | 'conditionId'): GroupRow[] {
  const map = new Map<string, { correct: number; incorrect: number }>();
  for (const attempt of attempts) {
    const key = attempt[field];
    if (!key) continue;
    const current = map.get(key) ?? { correct: 0, incorrect: 0 };
    if (attempt.wasCorrect === true) current.correct += 1;
    else current.incorrect += 1;
    map.set(key, current);
  }

  const rows: GroupRow[] = [];
  for (const [key, counts] of map.entries()) {
    rows.push({ [field]: key, wasCorrect: true, _count: { id: counts.correct } });
    rows.push({ [field]: key, wasCorrect: false, _count: { id: counts.incorrect } });
  }
  return rows;
}

export async function getUserDashboardSummary(
  prisma: DashboardAnalyticsPrisma,
  userId: string,
  now: Date = new Date()
) {
  let facts: Awaited<ReturnType<typeof loadAttemptFacts>>;
  try {
    facts = await loadAttemptFacts(prisma, userId, now);
  } catch {
    facts = await loadReviewLogFallbackFacts(prisma, userId, now);
  }

  const totalAttempts = clampNonNegativeInt(facts.totalCount);
  const correctAttempts = clampNonNegativeInt(Math.min(facts.correctCount, facts.totalCount));
  const systemStats = buildSystemStats(facts.systemGrouped, facts.recentAttempts);
  const weakAreas = getWeakAreas(systemStats);
  const strongAreas = Object.entries(systemStats)
    .filter(([, stats]) => stats.total >= 10 && stats.accuracy >= 80)
    .sort((a, b) => b[1].accuracy - a[1].accuracy)
    .map(([system, stats]) => ({ system, accuracy: stats.accuracy, attempts: stats.total }));
  const conditionStats = buildConditionStats(facts.conditionGrouped);
  const activityDates = facts.recentAttempts.map((a) => a.createdAt);
  const studyDates = new Set(activityDates.map((d) => dateKey(d)).filter((d): d is string => Boolean(d)));
  const todayStart = startOfUtcDay(now);
  const todayAttempts = facts.recentAttempts.filter((a) => {
    const date = coerceDate(a.createdAt);
    return date ? date >= todayStart : false;
  });
  const todayTimeMs = todayAttempts.reduce((sum, attempt) => sum + getAttemptTimeMs(attempt), 0);
  const rawAvgTime = facts.aggregates._avg?.timeSpentMs;
  const rawAnswerChanges = facts.aggregates._avg?.answerChangedCount;
  const studyPlanProgress = await getStudyPlanProgress(prisma, userId, now);
  const reviewQueueStats = await getReviewQueueStats(prisma, userId, now);

  const recommendations: string[] = [];
  const firstWeakArea = weakAreas[0];
  if (firstWeakArea) {
    recommendations.push(`Focus on ${firstWeakArea.system} - currently at ${firstWeakArea.accuracy}% accuracy`);
  }
  const currentStreak = calculateCurrentStreak(activityDates, now);
  if (currentStreak === 0) {
    recommendations.push('Maintain your daily continuity.');
  } else if (currentStreak >= 7) {
    recommendations.push(`${currentStreak}-day continuity. Keep it up.`);
  }
  const underStudiedSystems = Object.entries(systemStats)
    .filter(([, stats]) => stats.total < 10)
    .map(([system]) => system);
  if (underStudiedSystems.length > 0) {
    recommendations.push(`Try more questions in: ${underStudiedSystems.slice(0, 3).join(', ')}`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Continue with your next scheduled review.');
  }

  return {
    success: true,
    stats: {
      overall: {
        totalAttempts,
        correctAttempts,
        accuracy: percentFromCounts(correctAttempts, totalAttempts),
        questionsSeenCount: clampNonNegativeInt(facts.questionsSeenCount),
        currentStreak,
        totalStudyDays: studyDates.size,
        avgTimeMs: rawAvgTime != null && Number(rawAvgTime) > 0 ? Math.round(Number(rawAvgTime)) : null,
        avgAnswerChanges: rawAnswerChanges != null ? Number(Number(rawAnswerChanges).toFixed(2)) : null,
        todayCount: todayAttempts.length,
        todayTimeMs,
      },
      bySystems: systemStats,
      byConditions: conditionStats.byConditions,
      weakAreas,
      strongAreas,
      weakConditions: conditionStats.weakConditions,
      recentPerformance: buildRecentPerformance(facts.recentAttempts, now),
      speedByType: buildSpeedByType(facts.recentAttempts),
      recommendations,
      studyPlanProgress,
      reviewQueueStats,
      recentActivity: getRecentActivity(facts.recentAttempts, now),
    },
  };
}
