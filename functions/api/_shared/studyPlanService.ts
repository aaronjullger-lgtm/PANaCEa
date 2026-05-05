import { Prisma } from '@prisma/client/edge';
import {
  analyzePerformanceGaps,
  type PerformanceGap,
} from '@/services/optimizer/performanceGapAnalyzer';
import {
  scheduleReviews,
  type ScheduledReview,
} from '@/services/optimizer/retentionAwareScheduler';
import { balanceBlueprintPriorities } from '@/services/optimizer/blueprintBalancedSelector';
import { generateStudyPlan } from '@/services/optimizer/pathGenerator';
import {
  getDailyStudyAllocation,
  type DailyStudyAllocation,
} from '@/lib/services/dailyStudyAllocatorService';
import type {
  StudyPlanCurrentData,
  StudyPlanCurrentResponse,
  StudyPlanDay,
  StudyPlanOverview,
  StudyPlanProgressInput,
  StudyPlanSettings,
  StudyPlanTarget,
  StudyPlanTask,
  StudyPlanTaskKind,
  StudyPlanTaskStatus,
} from '@/lib/api/types/studyPlan';
import type { SessionSettings } from '@/types';

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_SETTINGS: StudyPlanSettings = {
  dailyMinutesLimit: 60,
  dailyQuestionGoal: 30,
  preferredDays: [1, 2, 3, 4, 5],
  focusAreas: [],
  excludeAreas: [],
  targetRetention: 0.9,
  maxSessionsPerDay: 2,
};

interface PersistedPlanTask {
  [key: string]: unknown;
  id: string;
  kind: StudyPlanTaskKind;
  status: StudyPlanTaskStatus;
  title: string;
  description: string;
  reason: string;
  systems: string[];
  conditionIds: string[];
  reviewCardIds?: string[];
  estimatedMinutes: number;
  targetQuestions: number;
  launchSettings: SessionSettings;
  route: string;
  startedAt?: string | null;
  completedAt?: string | null;
  skippedAt?: string | null;
  actualQuestionsAnswered?: number | null;
  actualDurationMinutes?: number | null;
  actualAccuracy?: number | null;
  linkedSessionId?: string | null;
}

interface PersistedStudyPlanRow {
  id: string;
  planDate: Date;
  recommendedSessions: unknown;
  recommendedModes: string[];
  targetQuestionsCount: number;
  targetSystemFocus: string[];
  estimatedTimeMinutes: number;
  status: string;
  actualQuestionsAnswered: number;
  actualDurationMinutes: number | null;
  actualAccuracy: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ResolvedPlannerContext {
  target: StudyPlanTarget;
  settings: StudyPlanSettings;
  userPreferencesUpdatedAt: Date | null;
  userProfileUpdatedAt: Date | null;
}

function toStartOfUtcDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return toStartOfUtcDay(next);
}

function toDateKey(date: Date): string {
  return toStartOfUtcDay(date).toISOString().split('T')[0] ?? '';
}

function coercePlannerSettings(
  raw: Record<string, unknown> | null | undefined
): Partial<StudyPlanSettings> {
  if (!raw || typeof raw !== 'object') return {};
  const preferredDays = Array.isArray(raw.preferredDays)
    ? raw.preferredDays
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : undefined;

  return {
    dailyMinutesLimit:
      typeof raw.dailyMinutesLimit === 'number' && raw.dailyMinutesLimit > 0
        ? Math.round(raw.dailyMinutesLimit)
        : undefined,
    dailyQuestionGoal:
      typeof raw.dailyQuestionGoal === 'number' && raw.dailyQuestionGoal > 0
        ? Math.round(raw.dailyQuestionGoal)
        : undefined,
    preferredDays:
      preferredDays && preferredDays.length > 0 ? preferredDays : undefined,
    focusAreas: Array.isArray(raw.focusAreas)
      ? raw.focusAreas.map(String).filter(Boolean)
      : undefined,
    excludeAreas: Array.isArray(raw.excludeAreas)
      ? raw.excludeAreas.map(String).filter(Boolean)
      : undefined,
    targetRetention:
      typeof raw.targetRetention === 'number' &&
      raw.targetRetention >= 0.5 &&
      raw.targetRetention <= 1
        ? raw.targetRetention
        : undefined,
    maxSessionsPerDay:
      typeof raw.maxSessionsPerDay === 'number' && raw.maxSessionsPerDay > 0
        ? Math.round(raw.maxSessionsPerDay)
        : undefined,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeTaskStatus(value: unknown): StudyPlanTaskStatus {
  if (value === 'active' || value === 'in_progress') return 'in_progress';
  if (
    value === 'completed' ||
    value === 'skipped' ||
    value === 'rescheduled' ||
    value === 'pending'
  ) {
    return value;
  }
  return 'pending';
}

function normalizeTaskKind(value: unknown): StudyPlanTaskKind {
  if (
    value === 'targeted' ||
    value === 'review' ||
    value === 'content' ||
    value === 'rest' ||
    value === 'main'
  ) {
    return value;
  }
  return 'main';
}

function normalizeLaunchSettingsForTask(
  kind: StudyPlanTaskKind,
  rawSettings: SessionSettings,
  targetQuestions: number,
  systems: string[],
  conditionIds: string[]
): SessionSettings {
  const mode =
    kind === 'targeted'
      ? 'targeted'
      : kind === 'review'
        ? 'review'
        : (rawSettings.mode ?? 'core_adaptive');
  const focus =
    kind === 'targeted'
      ? 'topic'
      : kind === 'review'
        ? 'review'
        : (rawSettings.focus ?? 'all');
  const count = rawSettings.questionCount ?? rawSettings.count ?? targetQuestions;

  return {
    ...rawSettings,
    mode,
    focus,
    count,
    questionCount: rawSettings.questionCount ?? count,
    systems: rawSettings.systems?.length ? rawSettings.systems : systems,
    conditionId: rawSettings.conditionId ?? conditionIds[0],
  };
}

function canonicalTaskMode(
  kind: StudyPlanTaskKind,
  rawMode: unknown,
  launchSettings: SessionSettings
): string {
  if (kind === 'targeted') return 'targeted';
  if (kind === 'review') return 'review';
  return typeof rawMode === 'string' && rawMode.trim()
    ? rawMode
    : launchSettings.mode ?? 'core_adaptive';
}

function normalizePersistedPlanTask(
  raw: unknown,
  index: number,
  planDate?: Date
): PersistedPlanTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const task = raw as Record<string, unknown>;
  const kind = normalizeTaskKind(task.kind);
  const directSystems = stringArray(task.systems);
  const legacySystems = stringArray(task.systemFilter);
  const systems = directSystems.length > 0 ? directSystems : legacySystems;
  const conditionIds = stringArray(task.conditionIds);
  const reviewCardIds = stringArray(task.reviewCardIds);
  const targetQuestions = positiveInt(task.targetQuestions ?? task.count, 20);
  const rawLaunchSettings =
    task.launchSettings && typeof task.launchSettings === 'object' && !Array.isArray(task.launchSettings)
      ? (task.launchSettings as SessionSettings)
      : launchSettingsForTask(kind, targetQuestions, systems);
  const launchSettings = normalizeLaunchSettingsForTask(
    kind,
    rawLaunchSettings,
    targetQuestions,
    systems,
    conditionIds
  );
  const mode = canonicalTaskMode(kind, task.mode, launchSettings);
  const id =
    typeof task.id === 'string' && task.id.trim().length > 0
      ? task.id
      : buildTaskId(planDate ?? new Date(), kind, systems.length > 0 ? systems : [`task-${index + 1}`]);
  const route = routeForTask({ id, kind, launchSettings, conditionIds, planDate });

  return {
    ...task,
    id,
    kind,
    status: normalizeTaskStatus(task.status),
    title:
      typeof task.title === 'string' && task.title.trim().length > 0
        ? task.title
        : buildTaskTitle(kind, systems),
    description:
      typeof task.description === 'string' && task.description.trim().length > 0
        ? task.description
        : buildTaskDescription(kind, systems),
    reason:
      typeof task.reason === 'string' && task.reason.trim().length > 0
        ? task.reason
        : 'Recommended by your study plan.',
    systems,
    conditionIds,
    reviewCardIds,
    mode,
    estimatedMinutes: positiveInt(task.estimatedMinutes, 20),
    targetQuestions: positiveInt(
      targetQuestions ?? launchSettings.questionCount ?? launchSettings.count,
      20
    ),
    launchSettings,
    route,
    startedAt: typeof task.startedAt === 'string' ? task.startedAt : null,
    completedAt: typeof task.completedAt === 'string' ? task.completedAt : null,
    skippedAt: typeof task.skippedAt === 'string' ? task.skippedAt : null,
    actualQuestionsAnswered:
      typeof task.actualQuestionsAnswered === 'number' ? task.actualQuestionsAnswered : null,
    actualDurationMinutes:
      typeof task.actualDurationMinutes === 'number' ? task.actualDurationMinutes : null,
    actualAccuracy: typeof task.actualAccuracy === 'number' ? task.actualAccuracy : null,
    linkedSessionId: typeof task.linkedSessionId === 'string' ? task.linkedSessionId : null,
  };
}

function safeTaskArray(value: unknown, planDate?: Date): PersistedPlanTask[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((task, index) => normalizePersistedPlanTask(task, index, planDate))
    .filter((task): task is PersistedPlanTask => task !== null);
}

function computeOverview(days: StudyPlanDay[]): StudyPlanOverview {
  const completedDays = days.filter((day) => day.status === 'completed').length;
  const inProgressDays = days.filter((day) => day.status === 'in_progress').length;
  const pendingDays = days.filter((day) => day.status === 'pending').length;
  const totalTargetQuestions = days.reduce(
    (sum, day) => sum + day.targetQuestionsCount,
    0
  );
  const totalCompletedQuestions = days.reduce(
    (sum, day) => sum + day.progress.questionsAnswered,
    0
  );

  return {
    totalDays: days.length,
    completedDays,
    inProgressDays,
    pendingDays,
    completionPercent:
      totalTargetQuestions > 0
        ? Math.round((totalCompletedQuestions / totalTargetQuestions) * 100)
        : 0,
    totalTargetQuestions,
    totalCompletedQuestions,
  };
}

function roundAccuracy(
  totalQuestions: number,
  weightedAccuracy: number | null
): number | null {
  if (!weightedAccuracy || totalQuestions <= 0) return null;
  return Number(weightedAccuracy.toFixed(3));
}

function inferDayStatus(tasks: PersistedPlanTask[]): StudyPlanTaskStatus | 'pending' | 'in_progress' | 'completed' | 'skipped' {
  if (tasks.length === 0) return 'pending';
  const statuses = tasks.map((task) => task.status);
  if (statuses.every((status) => status === 'completed')) return 'completed';
  if (statuses.every((status) => status === 'skipped')) return 'skipped';
  if (statuses.some((status) => status === 'in_progress')) return 'in_progress';
  if (
    statuses.some((status) => status === 'completed' || status === 'skipped')
  ) {
    return 'in_progress';
  }
  return 'pending';
}

function buildTaskId(
  planDate: Date,
  kind: StudyPlanTaskKind,
  systems: string[]
): string {
  const suffix = systems
    .map((system) => system.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .join('-');
  return `${toDateKey(planDate)}:${kind}:${suffix || 'general'}`;
}

function buildTaskTitle(kind: StudyPlanTaskKind, systems: string[]): string {
  if (systems.length === 0) {
    return kind === 'review' ? 'Review due material' : 'Build your study baseline';
  }

  const label = systems.slice(0, 3).join(', ');
  if (kind === 'review' || kind === 'targeted') {
    return `Review ${label}`;
  }

  return `Practice ${label}`;
}

function buildTaskDescription(kind: StudyPlanTaskKind, systems: string[]): string {
  if (kind === 'review' || kind === 'targeted') {
    return systems.length > 0
      ? `Targeted review for ${systems.join(', ')} based on current retention pressure.`
      : 'Targeted review for currently due material.';
  }

  return systems.length > 0
    ? `Adaptive practice weighted toward ${systems.join(', ')}.`
    : 'Short adaptive session to collect enough data for stronger planning.';
}

function launchSettingsForTask(
  kind: StudyPlanTaskKind,
  targetQuestions: number,
  systems: string[]
): SessionSettings {
  if (kind === 'targeted') {
    return {
      mode: 'targeted',
      focus: 'topic',
      count: targetQuestions,
      questionCount: targetQuestions,
      systems,
    };
  }

  if (kind === 'review') {
    return {
      mode: 'review',
      focus: 'review',
      count: targetQuestions,
      questionCount: targetQuestions,
      systems,
    };
  }

  return {
    mode: 'core_adaptive',
    focus: 'all',
    count: targetQuestions,
    questionCount: targetQuestions,
    systems,
  };
}

function routeForTask(task: {
  id: string;
  kind: StudyPlanTaskKind;
  launchSettings: SessionSettings;
  conditionIds?: string[];
  planDate?: Date;
}): string {
  const conditionIds = task.conditionIds ?? [];
  const systems = task.launchSettings.systems ?? [];
  const params = new URLSearchParams({
    source: 'study-plan',
    taskId: task.id,
    mode:
      (task.kind === 'review' || task.kind === 'targeted') && conditionIds.length > 0
        ? 'condition'
        : systems.length === 1
          ? 'system'
        : 'adaptive',
    count: String(task.launchSettings.questionCount ?? task.launchSettings.count ?? 20),
  });

  if (systems.length > 0) {
    params.set('systems', systems.join(','));
  }
  if (conditionIds.length > 0) {
    params.set('conditions', conditionIds.join(','));
    params.set('conditionId', conditionIds[0] ?? '');
  }
  if (task.planDate) {
    params.set('planDate', toDateKey(task.planDate));
  }

  return `/study/main-session?${params.toString()}`;
}

function createTask(
  planDate: Date,
  kind: StudyPlanTaskKind,
  systems: string[],
  estimatedMinutes: number,
  targetQuestions: number,
  reason: string
): PersistedPlanTask {
  const id = buildTaskId(planDate, kind, systems);
  const launchSettings = launchSettingsForTask(kind, targetQuestions, systems);
  return {
    id,
    kind,
    status: 'pending',
    title: buildTaskTitle(kind, systems),
    description: buildTaskDescription(kind, systems),
    reason,
    systems,
    conditionIds: [],
    estimatedMinutes,
    targetQuestions,
    launchSettings,
    route: routeForTask({ id, kind, launchSettings, conditionIds: [], planDate }),
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    actualQuestionsAnswered: null,
    actualDurationMinutes: null,
    actualAccuracy: null,
    linkedSessionId: null,
  };
}

function mergeTaskProgress(
  nextTasks: PersistedPlanTask[],
  previousTasks: PersistedPlanTask[]
): PersistedPlanTask[] {
  const previousById = new Map(previousTasks.map((task) => [task.id, task]));
  return nextTasks.map((task) => {
    const previous = previousById.get(task.id);
    if (!previous) return task;

    return {
      ...task,
      status: previous.status,
      startedAt: previous.startedAt ?? null,
      completedAt: previous.completedAt ?? null,
      skippedAt: previous.skippedAt ?? null,
      actualQuestionsAnswered: previous.actualQuestionsAnswered ?? null,
      actualDurationMinutes: previous.actualDurationMinutes ?? null,
      actualAccuracy: previous.actualAccuracy ?? null,
      linkedSessionId: previous.linkedSessionId ?? null,
      reviewCardIds: task.reviewCardIds,
    };
  });
}

function toStudyPlanDay(row: PersistedStudyPlanRow): StudyPlanDay {
  const tasks = safeTaskArray(row.recommendedSessions, row.planDate).map((task) => {
    const launchSettings =
      task.launchSettings ??
      launchSettingsForTask(task.kind, task.targetQuestions ?? 20, task.systems ?? []);
    return {
      ...task,
      launchSettings,
      route:
        (task as Partial<PersistedPlanTask>).route ??
        routeForTask({
          id: task.id,
          kind: task.kind,
          launchSettings,
          conditionIds: task.conditionIds,
          planDate: row.planDate,
        }),
    };
  });
  const totalTaskQuestions = tasks.reduce(
    (sum, task) => sum + (task.actualQuestionsAnswered ?? 0),
    0
  );
  const totalTaskMinutes = tasks.reduce(
    (sum, task) => sum + (task.actualDurationMinutes ?? 0),
    0
  );
  const weightedAccuracy = tasks.reduce((sum, task) => {
    if (
      typeof task.actualAccuracy === 'number' &&
      typeof task.actualQuestionsAnswered === 'number'
    ) {
      return sum + task.actualAccuracy * task.actualQuestionsAnswered;
    }
    return sum;
  }, 0);
  const taskAccuracy = roundAccuracy(totalTaskQuestions, weightedAccuracy / Math.max(totalTaskQuestions, 1));
  const questionsAnswered = Math.max(row.actualQuestionsAnswered ?? 0, totalTaskQuestions);
  const durationMinutes =
    row.actualDurationMinutes ?? (totalTaskMinutes > 0 ? totalTaskMinutes : null);
  const accuracy = row.actualAccuracy ?? taskAccuracy ?? null;
  const derivedStatus = inferDayStatus(tasks);
  const systemSummary =
    row.targetSystemFocus.length > 0
      ? row.targetSystemFocus.slice(0, 3).join(', ')
      : 'mixed systems';

  return {
    id: row.id,
    planDate: toDateKey(row.planDate),
    status:
      row.status === 'completed' || row.status === 'in_progress' || row.status === 'skipped'
        ? row.status
        : derivedStatus,
    title:
      tasks.length > 0
        ? `Plan for ${toDateKey(row.planDate)}`
        : 'No scheduled work yet',
    summary:
      tasks.length > 0
        ? `Focus on ${systemSummary}.`
        : 'No tasks scheduled for this day yet.',
    recommendedModes: row.recommendedModes,
    targetSystemFocus: row.targetSystemFocus,
    targetQuestionsCount: row.targetQuestionsCount,
    estimatedTimeMinutes: row.estimatedTimeMinutes,
    progress: {
      questionsAnswered,
      questionsTarget: row.targetQuestionsCount,
      percentComplete:
        row.targetQuestionsCount > 0
          ? Math.min(
              100,
              Math.round((questionsAnswered / row.targetQuestionsCount) * 100)
            )
          : 0,
      durationMinutes,
      estimatedDurationMinutes: row.estimatedTimeMinutes,
      accuracy: accuracy != null ? Number((accuracy * 100).toFixed(1)) : null,
    },
    tasks,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function resolvePlannerContext(
  prisma: any,
  userId: string
): Promise<ResolvedPlannerContext> {
  const [user, preferences, activeGoals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        examDate: true,
        currentRotation: true,
        rotationExamDate: true,
        eorTestDate: true,
        updatedAt: true,
      },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        dailyGoal: true,
        sessionLength: true,
        reminderDays: true,
        preferredSystems: true,
        customSettings: true,
        updatedAt: true,
      },
    }),
    prisma.userGoal?.findMany({
      where: { userId, status: 'active' },
      orderBy: [{ targetDate: 'asc' }, { createdAt: 'asc' }],
      take: 5,
      select: {
        title: true,
        targetDate: true,
        targetSystem: true,
      },
    }) ?? Promise.resolve([]),
  ]);

  const customSettings =
    preferences?.customSettings &&
    typeof preferences.customSettings === 'object' &&
    !Array.isArray(preferences.customSettings)
      ? (preferences.customSettings as Record<string, unknown>)
      : {};
  const plannerSettings = coercePlannerSettings(
    (customSettings.studyPlanning as Record<string, unknown> | undefined) ?? {}
  );
  const goalFocusAreas = (activeGoals as Array<{ targetSystem?: string | null }>)
    .map((goal) => goal.targetSystem)
    .filter((system): system is string => typeof system === 'string' && system.trim().length > 0);
  const firstGoal = (activeGoals as Array<{ title: string; targetDate?: Date | null }>)[0];
  const targetExamDate = user?.rotationExamDate ?? user?.eorTestDate ?? user?.examDate ?? null;
  const target: StudyPlanTarget = targetExamDate
    ? user?.currentRotation
      ? {
          kind: 'eor',
          label: `${user.currentRotation} EOR`,
          examDate: targetExamDate.toISOString(),
          currentRotation: user.currentRotation,
        }
      : {
          kind: 'pance',
          label: 'PANCE',
          examDate: targetExamDate.toISOString(),
          currentRotation: null,
        }
    : firstGoal
      ? {
          kind: 'custom',
          label: firstGoal.title,
          examDate: firstGoal.targetDate?.toISOString() ?? null,
          currentRotation: user?.currentRotation ?? null,
        }
    : {
        kind: 'none',
        label: 'No active exam target',
        examDate: null,
        currentRotation: user?.currentRotation ?? null,
      };
  const configuredFocusAreas =
    plannerSettings.focusAreas ??
    preferences?.preferredSystems ??
    DEFAULT_SETTINGS.focusAreas;
  const focusAreas = Array.from(new Set([...configuredFocusAreas, ...goalFocusAreas]));

  return {
    target,
    settings: {
      dailyMinutesLimit:
        plannerSettings.dailyMinutesLimit ??
        Math.max(DEFAULT_SETTINGS.dailyMinutesLimit, (preferences?.sessionLength ?? 30) * 2),
      dailyQuestionGoal:
        plannerSettings.dailyQuestionGoal ??
        preferences?.dailyGoal ??
        DEFAULT_SETTINGS.dailyQuestionGoal,
      preferredDays:
        plannerSettings.preferredDays ??
        (preferences?.reminderDays?.length
          ? preferences.reminderDays
          : DEFAULT_SETTINGS.preferredDays),
      focusAreas,
      excludeAreas: plannerSettings.excludeAreas ?? DEFAULT_SETTINGS.excludeAreas,
      targetRetention:
        plannerSettings.targetRetention ?? DEFAULT_SETTINGS.targetRetention,
      maxSessionsPerDay:
        plannerSettings.maxSessionsPerDay ?? DEFAULT_SETTINGS.maxSessionsPerDay,
    },
    userPreferencesUpdatedAt: preferences?.updatedAt ?? null,
    userProfileUpdatedAt: user?.updatedAt ?? null,
  };
}

async function computePlannerSignals(
  prisma: any,
  userId: string,
  settings: StudyPlanSettings,
  target: StudyPlanTarget
): Promise<{
  gaps: PerformanceGap[];
  scheduledReviews: ScheduledReview[];
  allocator: DailyStudyAllocation | null;
  flattenedTopics: Array<{
    taxonomyCode: string;
    recommendedAction: 'REVIEW' | 'NEW' | 'CALIBRATE';
    estimatedMinutes: number;
    urgencyScore: number;
  }>;
}> {
  const gaps = await analyzePerformanceGaps(prisma, userId, {
    rollingWindowSize: 200,
    targetRetention: settings.targetRetention,
    includeSubcategories: false,
    minimumReviewCount: 3,
  });
  const scheduledReviews = await scheduleReviews(
    prisma,
    userId,
    gaps.map((gap) => ({
      taxonomyCode: gap.taxonomyCode,
      subcategory: gap.subcategory,
    })),
    {
      targetRetention: settings.targetRetention,
      tolerance: 0.05,
    }
  );
  const blueprintPriorities = await balanceBlueprintPriorities(
    gaps.map((gap) => ({
      taxonomyCode: gap.taxonomyCode,
      subcategory: gap.subcategory,
      gap: gap.gap,
    })),
    scheduledReviews.map((review) => ({
      taxonomyCode: review.taxonomyCode,
      subcategory: review.subcategory,
      urgencyScore: review.urgencyScore,
    })),
    prisma,
    userId,
    {
      distributionSource: 'recent',
      recentReviewWindow: 100,
      balanceStrength: 0.45,
    }
  );
  const generatedPlan = await generateStudyPlan(prisma, {
    userId,
    constraints: {
      dailyMinutesLimit: settings.dailyMinutesLimit,
      targetRetention: settings.targetRetention,
      focusAreas: settings.focusAreas,
      excludeAreas: settings.excludeAreas,
      preferredDays: settings.preferredDays,
      maxSessionsPerDay: settings.maxSessionsPerDay,
      examDate: target.examDate ? new Date(target.examDate) : undefined,
    },
    gaps: gaps.map((gap) => ({
      taxonomyCode: gap.taxonomyCode,
      subcategory: gap.subcategory,
      currentAccuracy: gap.currentAccuracy,
      targetAccuracy: gap.targetAccuracy,
      gap: gap.gap,
      reviewCount: gap.reviewCount,
      lastReviewedAt: gap.lastReviewedAt,
    })),
    scheduledReviews: scheduledReviews.map((review) => ({
      taxonomyCode: review.taxonomyCode,
      subcategory: review.subcategory,
      recommendedReviewDate: review.recommendedReviewDate,
      urgencyScore: review.urgencyScore,
      confidence: review.confidence,
    })),
    blueprintPriorities: blueprintPriorities.map((item) => ({
      taxonomyCode: item.taxonomyCode,
      subcategory: item.subcategory,
      priorityScore: item.priorityScore,
      weightDeviation: item.weightDeviation,
    })),
  });

  const flattenedTopics = generatedPlan.plan.sessions
    .flatMap((session) => session.topics)
    .sort((left, right) => right.urgencyScore - left.urgencyScore);

  let allocator: DailyStudyAllocation | null = null;
  try {
    allocator = await getDailyStudyAllocation(prisma, userId);
  } catch {
    allocator = null;
  }

  return {
    gaps,
    scheduledReviews,
    allocator,
    flattenedTopics,
  };
}

function distributeTopicsAcrossWindow(
  startDate: Date,
  settings: StudyPlanSettings,
  flattenedTopics: Array<{
    taxonomyCode: string;
    recommendedAction: 'REVIEW' | 'NEW' | 'CALIBRATE';
    estimatedMinutes: number;
    urgencyScore: number;
  }>,
  allocator: DailyStudyAllocation | null,
  requestedDays: number
): Map<string, PersistedPlanTask[]> {
  const tasksByDate = new Map<string, PersistedPlanTask[]>();
  let cursor = 0;

  for (let offset = 0; offset < requestedDays; offset += 1) {
    const planDate = addUtcDays(startDate, offset);
    const dateKey = toDateKey(planDate);
    const dayOfWeek = planDate.getUTCDay();
    if (!settings.preferredDays.includes(dayOfWeek)) {
      tasksByDate.set(dateKey, []);
      continue;
    }

    if (flattenedTopics.length === 0) {
      if (offset === 0) {
        const systems = settings.focusAreas.slice(0, 2);
        tasksByDate.set(dateKey, [
          createTask(
            planDate,
            'main',
            systems,
            Math.min(settings.dailyMinutesLimit, 30),
            Math.min(settings.dailyQuestionGoal, 20),
            'Collect baseline performance so future plans can adapt to real data.'
          ),
        ]);
      } else {
        tasksByDate.set(dateKey, []);
      }
      continue;
    }

    let remainingMinutes = settings.dailyMinutesLimit;
    const reviewSystems = new Set<string>();
    const mainSystems = new Set<string>();
    let reviewMinutes = 0;
    let mainMinutes = 0;

    while (cursor < flattenedTopics.length && remainingMinutes > 0) {
      const topic = flattenedTopics[cursor];
      const minutes = Math.max(10, Math.min(topic.estimatedMinutes, remainingMinutes));

      if (topic.recommendedAction === 'REVIEW') {
        reviewSystems.add(topic.taxonomyCode);
        reviewMinutes += minutes;
      } else {
        mainSystems.add(topic.taxonomyCode);
        mainMinutes += minutes;
      }

      remainingMinutes -= minutes;
      cursor += 1;
    }

    const totalMinutes = Math.max(1, reviewMinutes + mainMinutes);
    const totalQuestions = settings.dailyQuestionGoal;
    const reviewQuestions = Math.round((reviewMinutes / totalMinutes) * totalQuestions);
    const mainQuestions = totalQuestions - reviewQuestions;
    const tasks: PersistedPlanTask[] = [];

    const currentAllocator = offset === 0 ? allocator : null;
    const mainSystemsArray =
      mainSystems.size > 0
        ? Array.from(mainSystems)
        : currentAllocator?.mainSystems.slice(0, 3) ?? [];
    const reviewSystemsArray =
      reviewSystems.size > 0
        ? Array.from(reviewSystems)
        : currentAllocator?.targetedConditions.slice(0, 3) ?? [];

    if (mainSystemsArray.length > 0 || mainMinutes > 0) {
      tasks.push(
        createTask(
          planDate,
          'main',
          mainSystemsArray,
          mainMinutes || Math.round(settings.dailyMinutesLimit * 0.6),
          Math.max(10, mainQuestions || Math.round(totalQuestions * 0.6)),
          'Adaptive practice weighted toward readiness gaps and blueprint coverage.'
        )
      );
    }

    if (reviewSystemsArray.length > 0 || reviewMinutes > 0) {
      tasks.push(
        createTask(
          planDate,
          'targeted',
          reviewSystemsArray,
          reviewMinutes || Math.round(settings.dailyMinutesLimit * 0.4),
          Math.max(5, reviewQuestions || Math.round(totalQuestions * 0.4)),
          'Targeted review weighted toward retention pressure and due material.'
        )
      );
    }

    tasksByDate.set(dateKey, tasks);
  }

  return tasksByDate;
}

function buildPersistedPlanRowInput(
  planDate: Date,
  tasks: PersistedPlanTask[],
  existingRow: PersistedStudyPlanRow | null
) {
  const mergedTasks = mergeTaskProgress(
    tasks,
    existingRow ? safeTaskArray(existingRow.recommendedSessions, planDate) : []
  );
  const targetQuestionsCount = mergedTasks.reduce(
    (sum, task) => sum + task.targetQuestions,
    0
  );
  const estimatedTimeMinutes = mergedTasks.reduce(
    (sum, task) => sum + task.estimatedMinutes,
    0
  );
  const targetSystemFocus = Array.from(
    new Set(mergedTasks.flatMap((task) => task.systems))
  ).slice(0, 4);
  const status = existingRow?.status && existingRow.status !== 'pending'
    ? existingRow.status
    : inferDayStatus(mergedTasks);

  return {
    planDate,
    recommendedSessions: mergedTasks as unknown as Prisma.InputJsonValue,
    recommendedModes: mergedTasks.map((task) => task.launchSettings.mode ?? 'session'),
    targetQuestionsCount,
    targetSystemFocus,
    estimatedTimeMinutes,
    status,
  };
}

function isPlanRowStale(
  row: PersistedStudyPlanRow,
  context: Pick<ResolvedPlannerContext, 'userPreferencesUpdatedAt' | 'userProfileUpdatedAt'>,
  latestReviewAt: Date | null
): boolean {
  const staleAgainstPrefs =
    context.userPreferencesUpdatedAt &&
    row.updatedAt < context.userPreferencesUpdatedAt;
  const staleAgainstProfile =
    context.userProfileUpdatedAt && row.updatedAt < context.userProfileUpdatedAt;
  const staleAgainstReviews =
    latestReviewAt &&
    row.status === 'pending' &&
    row.updatedAt < latestReviewAt;

  return Boolean(staleAgainstPrefs || staleAgainstProfile || staleAgainstReviews);
}

export async function ensureStudyPlanWindow(
  prisma: any,
  userId: string,
  options?: {
    startDate?: Date;
    days?: number;
    forceRegenerate?: boolean;
  }
): Promise<StudyPlanCurrentData> {
  const startDate = toStartOfUtcDay(options?.startDate ?? new Date());
  const requestedDays = Math.max(1, Math.min(options?.days ?? DEFAULT_WINDOW_DAYS, 14));
  const context = await resolvePlannerContext(prisma, userId);

  const existingRows = (await prisma.dailyStudyPlan.findMany({
    where: {
      userId,
      planDate: {
        gte: startDate,
        lt: addUtcDays(startDate, requestedDays),
      },
    },
    orderBy: { planDate: 'asc' },
  })) as PersistedStudyPlanRow[];
  const existingRowsHaveTasks = existingRows.some(
    (row) => safeTaskArray(row.recommendedSessions, row.planDate).length > 0
  );

  if (context.target.kind === 'none') {
    const days = existingRows.map(toStudyPlanDay);
    const todayKey = toDateKey(startDate);
    return {
      state: existingRowsHaveTasks ? 'ready' : 'needs-target',
      target: context.target,
      settings: context.settings,
      days: existingRowsHaveTasks ? days : [],
      today: existingRowsHaveTasks
        ? days.find((day) => day.planDate === todayKey) ?? null
        : null,
      overview: existingRowsHaveTasks ? computeOverview(days) : computeOverview([]),
      generatedAt:
        existingRowsHaveTasks && existingRows.length > 0
          ? existingRows.reduce((latest, row) =>
              row.updatedAt > latest ? row.updatedAt : latest
            , existingRows[0].updatedAt).toISOString()
          : null,
    };
  }

  let latestReviewAt: Date | null = null;
  try {
    const latestReview = await prisma.reviewLog.findFirst({
      where: {
        userId,
        review_type: 'real',
        sessionType: { in: ['MAIN', 'DRILL'] },
      },
      orderBy: { reviewedAt: 'desc' },
      select: { reviewedAt: true },
    });
    latestReviewAt = latestReview?.reviewedAt ?? null;
  } catch {
    latestReviewAt = null;
  }

  const shouldRegenerate =
    options?.forceRegenerate ||
    existingRows.length < requestedDays ||
    existingRows.some((row) => isPlanRowStale(row, context, latestReviewAt));

  if (shouldRegenerate) {
    const { flattenedTopics, allocator } = await computePlannerSignals(
      prisma,
      userId,
      context.settings,
      context.target
    );
    const tasksByDate = distributeTopicsAcrossWindow(
      startDate,
      context.settings,
      flattenedTopics,
      allocator,
      requestedDays
    );
    const existingByDate = new Map(
      existingRows.map((row) => [toDateKey(row.planDate), row])
    );

    for (let offset = 0; offset < requestedDays; offset += 1) {
      const planDate = addUtcDays(startDate, offset);
      const dateKey = toDateKey(planDate);
      const existingRow = existingByDate.get(dateKey) ?? null;

      if (
        existingRow &&
        (existingRow.status === 'completed' || existingRow.status === 'in_progress')
      ) {
        continue;
      }
      if (
        existingRow &&
        safeTaskArray(existingRow.recommendedSessions, existingRow.planDate).length > 0 &&
        !options?.forceRegenerate &&
        !isPlanRowStale(existingRow, context, latestReviewAt)
      ) {
        continue;
      }

      const tasks = tasksByDate.get(dateKey) ?? [];
      const rowInput = buildPersistedPlanRowInput(planDate, tasks, existingRow);

      await prisma.dailyStudyPlan.upsert({
        where: {
          userId_planDate: {
            userId,
            planDate,
          },
        },
        create: {
          userId,
          ...rowInput,
        },
        update: {
          ...rowInput,
          updatedAt: new Date(),
        },
      });
    }
  }

  const rows = (await prisma.dailyStudyPlan.findMany({
    where: {
      userId,
      planDate: {
        gte: startDate,
        lt: addUtcDays(startDate, requestedDays),
      },
    },
    orderBy: { planDate: 'asc' },
  })) as PersistedStudyPlanRow[];

  const days = rows.map(toStudyPlanDay);
  const todayKey = toDateKey(startDate);

  return {
    state: days.length > 0 ? 'ready' : 'empty',
    target: context.target,
    settings: context.settings,
    days,
    today: days.find((day) => day.planDate === todayKey) ?? null,
    overview: computeOverview(days),
    generatedAt:
      rows.length > 0
        ? rows.reduce((latest, row) =>
            row.updatedAt > latest ? row.updatedAt : latest
          , rows[0].updatedAt).toISOString()
        : null,
  };
}

export async function getTodayStudyPlan(
  prisma: any,
  userId: string
): Promise<StudyPlanDay | null> {
  const current = await ensureStudyPlanWindow(prisma, userId, { days: 7 });
  return current.today;
}

export async function updateStudyPlanProgress(
  prisma: any,
  userId: string,
  input: StudyPlanProgressInput
): Promise<StudyPlanDay> {
  const planDate = toStartOfUtcDay(new Date(input.planDate));
  const existingRow = (await prisma.dailyStudyPlan.findUnique({
    where: {
      userId_planDate: {
        userId,
        planDate,
      },
    },
  })) as PersistedStudyPlanRow | null;

  if (!existingRow) {
    throw new Error('Study plan day not found');
  }

  const tasks = safeTaskArray(existingRow.recommendedSessions, planDate);
  const targetTask = tasks.find((task) => task.id === input.taskId);
  if (!targetTask) {
    throw new Error('Study plan task not found');
  }

  const now = new Date().toISOString();
  if (input.action === 'start') {
    targetTask.status = 'in_progress';
    targetTask.startedAt = now;
  }

  if (input.action === 'skip') {
    targetTask.status = 'skipped';
    targetTask.skippedAt = now;
  }

  if (input.action === 'complete') {
    targetTask.status = 'completed';
    targetTask.completedAt = now;
    targetTask.actualQuestionsAnswered =
      input.actualQuestionsAnswered ?? targetTask.actualQuestionsAnswered ?? null;
    targetTask.actualDurationMinutes =
      input.actualDurationMinutes ?? targetTask.actualDurationMinutes ?? null;
    targetTask.actualAccuracy =
      typeof input.actualAccuracy === 'number'
        ? Math.max(0, Math.min(1, input.actualAccuracy))
        : targetTask.actualAccuracy ?? null;
    targetTask.linkedSessionId =
      input.linkedSessionId ?? targetTask.linkedSessionId ?? null;
  }

  const completedQuestionTotal = tasks.reduce(
    (sum, task) => sum + (task.actualQuestionsAnswered ?? 0),
    0
  );
  const completedDurationTotal = tasks.reduce(
    (sum, task) => sum + (task.actualDurationMinutes ?? 0),
    0
  );
  let weightedAccuracy = 0;
  let accuracyWeight = 0;
  for (const task of tasks) {
    if (
      typeof task.actualAccuracy === 'number' &&
      typeof task.actualQuestionsAnswered === 'number'
    ) {
      weightedAccuracy += task.actualAccuracy * task.actualQuestionsAnswered;
      accuracyWeight += task.actualQuestionsAnswered;
    }
  }

  const nextStatus = inferDayStatus(tasks);
  const updatedRow = (await prisma.dailyStudyPlan.update({
    where: { id: existingRow.id },
    data: {
      recommendedSessions: tasks as unknown as Prisma.InputJsonValue,
      status: nextStatus,
      actualQuestionsAnswered: completedQuestionTotal,
      actualDurationMinutes: completedDurationTotal || null,
      actualAccuracy:
        accuracyWeight > 0 ? weightedAccuracy / accuracyWeight : null,
      completedAt:
        nextStatus === 'completed' ? new Date() : existingRow.completedAt,
      updatedAt: new Date(),
    },
  })) as PersistedStudyPlanRow;

  return toStudyPlanDay(updatedRow);
}

export async function updateStudyPlanSettings(
  prisma: any,
  userId: string,
  settings: Partial<StudyPlanSettings>
): Promise<void> {
  const existing = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { customSettings: true },
  });
  const existingCustomSettings =
    existing?.customSettings &&
    typeof existing.customSettings === 'object' &&
    !Array.isArray(existing.customSettings)
      ? (existing.customSettings as Record<string, unknown>)
      : {};
  const currentPlannerSettings =
    existingCustomSettings.studyPlanning &&
    typeof existingCustomSettings.studyPlanning === 'object' &&
    !Array.isArray(existingCustomSettings.studyPlanning)
      ? (existingCustomSettings.studyPlanning as Record<string, unknown>)
      : {};

  const nextCustomSettings = {
    ...existingCustomSettings,
    studyPlanning: {
      ...currentPlannerSettings,
      ...settings,
    },
  };

  await prisma.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      customSettings: nextCustomSettings as Prisma.InputJsonValue,
    },
    update: {
      customSettings: nextCustomSettings as Prisma.InputJsonValue,
    },
  });
}
