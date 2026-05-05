import { getDailyStudyAllocation, type DailyStudyAllocation } from './dailyStudyAllocatorService';
import type { SessionSettings } from '@/types';
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from './questionServingSafety';

export type StudyPlanTaskStatus = 'pending' | 'active' | 'in_progress' | 'completed' | 'skipped' | 'rescheduled';
export type StudyPlanTaskKind = 'main' | 'targeted' | 'review' | 'content' | 'rest';

export interface StudyPlanTask {
  id: string;
  kind: StudyPlanTaskKind;
  mode: string;
  title: string;
  count: number;
  estimatedMinutes: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  status: StudyPlanTaskStatus;
  systems?: string[];
  systemFilter?: string[];
  conditionIds?: string[];
  reviewCardIds?: string[];
  targetQuestions?: number;
  launchSettings?: SessionSettings;
  route: string;
  launchParams: Record<string, string>;
  startedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  rescheduledFor?: string;
  actualQuestionsAnswered?: number | null;
  actualDurationMinutes?: number | null;
  actualAccuracy?: number | null;
  linkedSessionId?: string | null;
}

export interface CompleteStudyPlanTaskInput {
  action?: 'complete' | 'skip' | 'reschedule';
  taskId?: string;
  accuracy?: number;
  durationMinutes?: number;
  questionsAnswered?: number;
  linkedSessionId?: string;
  rescheduleDate?: Date;
}

interface StudyPlanPrisma {
  user: {
    findUnique(args: Record<string, unknown>): Promise<{
      id: string;
      examDate?: Date | string | null;
    } | null>;
  };
  userPreferences?: {
    findUnique(args: Record<string, unknown>): Promise<{
      dailyGoal?: number | null;
      sessionLength?: number | null;
    } | null>;
  };
  userGoal?: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      targetSystem?: string | null;
    }>>;
  };
  questionAttempt: {
    count(args: Record<string, unknown>): Promise<number>;
  };
  medicalContent?: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      id: string;
      conditionId?: string | null;
      system?: string | null;
    }>>;
  };
  question?: {
    count(args: Record<string, unknown>): Promise<number>;
  };
  preGeneratedQuestion?: {
    count(args: Record<string, unknown>): Promise<number>;
  };
  dailyStudyPlan: {
    findUnique(args: Record<string, unknown>): Promise<any | null>;
    upsert(args: Record<string, unknown>): Promise<any>;
    update(args: Record<string, unknown>): Promise<any>;
  };
}

const MS_PER_DAY = 86_400_000;

export function normalizePlanDate(input: Date = new Date()): Date {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback;
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function dateKey(date: Date): string {
  return normalizePlanDate(date).toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(normalizePlanDate(date).getTime() + days * MS_PER_DAY);
}

function clampCount(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function clampPercentDecimal(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed > 1) return Math.min(1, Math.max(0, parsed / 100));
  return Math.min(1, Math.max(0, parsed));
}

function routeForTask(
  task: Pick<StudyPlanTask, 'kind' | 'systemFilter' | 'conditionIds'> & {
    id?: string;
    mode?: string;
  }
): {
  route: string;
  launchParams: Record<string, string>;
} {
  const conditions = task.conditionIds ?? [];
  const systems = task.systemFilter ?? [];
  const routeMode =
    conditions.length > 0
      ? 'condition'
      : systems.length === 1
        ? 'system'
        : 'adaptive';
  const launchParams: Record<string, string> = {
    source: 'study-plan',
    mode: routeMode,
  };
  if (task.id) launchParams.taskId = task.id;
  if (task.id && /^\d{4}-\d{2}-\d{2}/.test(task.id)) {
    launchParams.planDate = task.id.slice(0, 10);
  }

  if (conditions.length > 0) {
    launchParams.conditions = conditions.join(',');
    launchParams.conditionId = conditions[0] ?? '';
  }
  if (systems.length > 0) launchParams.systems = systems.join(',');
  const query = new URLSearchParams(launchParams).toString();
  return { route: `/study/main-session?${query}`, launchParams };
}

function canonicalTaskMode(
  kind: StudyPlanTaskKind,
  taskMode: unknown,
  launchSettings: SessionSettings | undefined
): string {
  if (kind === 'targeted') return 'targeted';
  if (kind === 'review') return 'review';
  if (typeof taskMode === 'string' && taskMode.trim()) return taskMode;
  if (typeof launchSettings?.mode === 'string' && launchSettings.mode.trim()) {
    return launchSettings.mode;
  }
  return 'core_adaptive';
}

function getDaysToExam(examDate: Date | string | null | undefined, planDate: Date): number | null {
  if (!examDate) return null;
  const exam = normalizePlanDate(new Date(examDate));
  return Math.ceil((exam.getTime() - normalizePlanDate(planDate).getTime()) / MS_PER_DAY);
}

export function buildStudyPlanTasks({
  allocation,
  planDate,
  dailyGoal,
  sessionLength,
  daysToExam,
  goalSystems = [],
}: {
  allocation: DailyStudyAllocation;
  planDate: Date;
  dailyGoal?: number | null;
  sessionLength?: number | null;
  daysToExam?: number | null;
  goalSystems?: string[];
}): StudyPlanTask[] {
  const date = dateKey(planDate);
  const availableMinutes = clampCount(sessionLength, 45) || 45;
  const targetQuestions = clampCount(dailyGoal, allocation.recommendedMainCount + allocation.recommendedTargetedCount);
  const mainCount = Math.max(0, Math.min(allocation.recommendedMainCount, targetQuestions));
  const targetedCount = Math.max(0, Math.min(allocation.recommendedTargetedCount, Math.max(0, targetQuestions - mainCount)));
  const mainMinutes = Math.max(10, Math.round(availableMinutes * (mainCount / Math.max(1, mainCount + targetedCount))));
  const targetedMinutes = Math.max(10, availableMinutes - mainMinutes);
  const examUrgency = daysToExam != null && daysToExam >= 0 && daysToExam <= 14;

  const mainSystems = Array.from(new Set([
    ...(allocation.mainSystems.length > 0 ? allocation.mainSystems : goalSystems),
    ...(allocation.mainSystems.length > 0 ? goalSystems : []),
  ])).slice(0, 5);
  const fallbackMainSystems = mainSystems.length > 0 ? mainSystems : ['Cardiovascular', 'Pulmonary', 'Gastrointestinal'];
  const tasks: StudyPlanTask[] = [];

  if (mainCount > 0) {
    const draft = {
      id: `${date}-main-readiness`,
      kind: 'main' as const,
      mode: 'core_adaptive',
      title: examUrgency ? 'Exam readiness block' : 'Readiness question block',
      count: mainCount,
      estimatedMinutes: mainMinutes,
      reason: allocation.mainSystems.length > 0
        ? `Focus on ${mainSystems.slice(0, 3).join(', ')} based on recent readiness gaps.`
        : 'Start with a broad blueprint-weighted block to establish baseline coverage.',
      priority: (examUrgency || allocation.readinessPriority >= allocation.retentionPriority ? 'high' : 'medium') as 'high' | 'medium',
      status: 'pending' as const,
      systemFilter: fallbackMainSystems.slice(0, 3),
    };
    tasks.push({ ...draft, ...routeForTask(draft) });
  }

  if (targetedCount > 0 && allocation.targetedConditions.length > 0) {
    const conditions = allocation.targetedConditions.slice(0, 8);
    const draft = {
      id: `${date}-targeted-review`,
      kind: 'targeted' as const,
      mode: 'targeted',
      title: 'Due review block',
      count: targetedCount,
      estimatedMinutes: targetedMinutes,
      reason: 'Prioritize due and overdue FSRS review items before they decay further.',
      priority: (allocation.retentionPriority >= 70 ? 'high' : 'medium') as 'high' | 'medium',
      status: 'pending' as const,
      conditionIds: conditions,
    };
    tasks.push({ ...draft, ...routeForTask(draft) });
  }

  if (tasks.length === 0) {
    const draft = {
      id: `${date}-starter-block`,
      kind: 'main' as const,
      mode: 'core_adaptive',
      title: 'Starter study block',
      count: Math.max(10, targetQuestions || 10),
      estimatedMinutes: availableMinutes,
      reason: 'No due reviews or attempt history yet. Start with a short adaptive block.',
      priority: 'medium' as const,
      status: 'pending' as const,
      systemFilter: fallbackMainSystems.slice(0, 3),
    };
    tasks.push({ ...draft, ...routeForTask(draft) });
  }

  return tasks;
}

export function sanitizeStudyPlanTasks(raw: unknown): StudyPlanTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((task): task is Record<string, unknown> => Boolean(task) && typeof task === 'object')
    .map((task, index) => {
      const kind =
        task.kind === 'targeted' ||
        task.kind === 'review' ||
        task.kind === 'content' ||
        task.kind === 'rest'
          ? task.kind
          : 'main';
      const statusValues: StudyPlanTaskStatus[] = ['pending', 'active', 'in_progress', 'completed', 'skipped', 'rescheduled'];
      const status = statusValues.includes(task.status as StudyPlanTaskStatus)
        ? (task.status as StudyPlanTaskStatus)
        : 'pending';
      const systems = Array.isArray(task.systems)
        ? task.systems.filter((item): item is string => typeof item === 'string')
        : undefined;
      const systemFilter = Array.isArray(task.systemFilter)
        ? task.systemFilter.filter((item): item is string => typeof item === 'string')
        : systems;
      const conditionIds = Array.isArray(task.conditionIds)
        ? task.conditionIds.filter((item): item is string => typeof item === 'string')
        : undefined;
      const reviewCardIds = Array.isArray(task.reviewCardIds)
        ? task.reviewCardIds.filter((item): item is string => typeof item === 'string')
        : undefined;
      const id = typeof task.id === 'string' ? task.id : `task-${index + 1}`;
      const launchSettings =
        task.launchSettings && typeof task.launchSettings === 'object' && !Array.isArray(task.launchSettings)
          ? (task.launchSettings as SessionSettings)
          : undefined;
      const mode = canonicalTaskMode(kind, task.mode, launchSettings);
      const routed = routeForTask({ id, kind, mode, systemFilter, conditionIds });
      const providedLaunchParams = task.launchParams && typeof task.launchParams === 'object'
        ? Object.fromEntries(
            Object.entries(task.launchParams as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          )
        : {};
      const launchParams = {
        ...providedLaunchParams,
        ...routed.launchParams,
        taskId: id,
        source: 'study-plan',
      };
      const route = `/study/main-session?${new URLSearchParams(launchParams).toString()}`;

      return {
        ...task,
        id,
        kind,
        mode,
        title: typeof task.title === 'string' ? task.title : kind === 'targeted' ? 'Due review block' : 'Readiness question block',
        count: clampCount(task.count ?? task.targetQuestions ?? launchSettings?.questionCount ?? launchSettings?.count, 10),
        estimatedMinutes: clampCount(task.estimatedMinutes, 20),
        reason: typeof task.reason === 'string' ? task.reason : 'Recommended by your study plan.',
        priority: task.priority === 'high' || task.priority === 'low' ? task.priority : 'medium',
        status,
        systems,
        systemFilter,
        conditionIds,
        reviewCardIds,
        targetQuestions: clampCount(task.targetQuestions ?? task.count ?? launchSettings?.questionCount ?? launchSettings?.count, 10),
        launchSettings,
        route,
        launchParams,
        startedAt: typeof task.startedAt === 'string' ? task.startedAt : undefined,
        completedAt: typeof task.completedAt === 'string' ? task.completedAt : undefined,
        skippedAt: typeof task.skippedAt === 'string' ? task.skippedAt : undefined,
        rescheduledFor: typeof task.rescheduledFor === 'string' ? task.rescheduledFor : undefined,
        actualQuestionsAnswered: typeof task.actualQuestionsAnswered === 'number' ? task.actualQuestionsAnswered : undefined,
        actualDurationMinutes: typeof task.actualDurationMinutes === 'number' ? task.actualDurationMinutes : undefined,
        actualAccuracy: typeof task.actualAccuracy === 'number' ? task.actualAccuracy : undefined,
        linkedSessionId: typeof task.linkedSessionId === 'string' ? task.linkedSessionId : undefined,
      };
    });
}

async function hasApprovedQuestionPoolForConditions(
  prisma: StudyPlanPrisma,
  conditionIds: string[]
): Promise<boolean> {
  if (conditionIds.length === 0) return false;
  if (!prisma.question?.count && !prisma.preGeneratedQuestion?.count) {
    return true;
  }

  try {
    const medicalRows = prisma.medicalContent?.findMany
      ? await prisma.medicalContent.findMany({
          where: {
            OR: [
              { id: { in: conditionIds } },
              { conditionId: { in: conditionIds } },
            ],
          },
          select: { id: true, conditionId: true, system: true },
        })
      : [];
    const medicalContentIds = new Set(medicalRows.map((row) => row.id));
    const conditionDomainIds = new Set(
      medicalRows.map((row) => row.conditionId).filter((id): id is string => Boolean(id))
    );

    for (const id of conditionIds) {
      if (!medicalContentIds.has(id) && !conditionDomainIds.has(id)) {
        conditionDomainIds.add(id);
      }
    }

    const scopeOr: Array<Record<string, unknown>> = [];
    if (conditionDomainIds.size > 0) {
      scopeOr.push({ conditionId: { in: [...conditionDomainIds] } });
    }
    if (medicalContentIds.size > 0) {
      scopeOr.push({ medicalContentId: { in: [...medicalContentIds] } });
    }
    if (scopeOr.length === 0) return false;

    const where = scopeOr.length === 1 ? scopeOr[0]! : { OR: scopeOr };
    const [questionCount, preGeneratedCount] = await Promise.all([
      prisma.question?.count
        ? prisma.question.count({ where: withProductionQuestionSafety(where) })
        : Promise.resolve(0),
      prisma.preGeneratedQuestion?.count
        ? prisma.preGeneratedQuestion.count({ where: withProductionPregeneratedSafety(where) })
        : Promise.resolve(0),
    ]);

    return questionCount + preGeneratedCount > 0;
  } catch {
    return true;
  }
}

export async function ensureStudyPlanTasksLaunchable(
  prisma: StudyPlanPrisma,
  tasks: StudyPlanTask[]
): Promise<StudyPlanTask[]> {
  const nextTasks: StudyPlanTask[] = [];

  for (const task of tasks) {
    const isConditionTask = task.kind === 'targeted' || task.kind === 'review';
    const conditionIds = task.conditionIds ?? [];
    const canStillLaunch = ['pending', 'active', 'in_progress', 'rescheduled'].includes(task.status);
    if (!canStillLaunch || !isConditionTask || conditionIds.length === 0) {
      nextTasks.push(task);
      continue;
    }

    const hasPool = await hasApprovedQuestionPoolForConditions(prisma, conditionIds);
    if (hasPool) {
      nextTasks.push(task);
      continue;
    }

    const fallbackDraft = {
      ...task,
      kind: 'main' as const,
      mode: 'core_adaptive',
      title: `${task.title} fallback`,
      reason: `${task.reason} No approved targeted question pool is available yet, so this block launches as blueprint-weighted readiness work.`,
      conditionIds: undefined,
      reviewCardIds: undefined,
      systemFilter: task.systemFilter?.length ? task.systemFilter : task.systems,
    };
    nextTasks.push({
      ...fallbackDraft,
      ...routeForTask(fallbackDraft),
    });
  }

  return nextTasks;
}

function studyPlanTasksChanged(current: StudyPlanTask[], next: StudyPlanTask[]): boolean {
  return JSON.stringify(current) !== JSON.stringify(next);
}

async function repairStoredPlanLaunchability(prisma: StudyPlanPrisma, plan: any) {
  const currentTasks = sanitizeStudyPlanTasks(plan.recommendedSessions);
  if (currentTasks.length === 0) return plan;

  const nextTasks = await ensureStudyPlanTasksLaunchable(prisma, currentTasks);
  if (!studyPlanTasksChanged(currentTasks, nextTasks)) return plan;

  const recommendedModes = Array.from(new Set(nextTasks.map((task) => task.mode)));
  const targetQuestionsCount = nextTasks.reduce((sum, task) => sum + task.count, 0);
  const estimatedTimeMinutes = nextTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const taskSystemFocus = Array.from(new Set(
    nextTasks.flatMap((task) => task.systemFilter ?? task.systems ?? [])
  )).slice(0, 5);
  const previousFocus = Array.isArray(plan.targetSystemFocus) ? plan.targetSystemFocus : [];

  return prisma.dailyStudyPlan.update({
    where: { id: plan.id },
    data: {
      recommendedSessions: nextTasks,
      recommendedModes,
      targetQuestionsCount,
      estimatedTimeMinutes,
      targetSystemFocus: taskSystemFocus.length > 0 ? taskSystemFocus : previousFocus,
      updatedAt: new Date(),
    },
  });
}

function derivePlanStatus(tasks: StudyPlanTask[], previousStatus: string): string {
  if (tasks.length === 0) return 'pending';
  if (tasks.every((task) => task.status === 'completed')) return 'completed';
  if (tasks.every((task) => task.status === 'skipped' || task.status === 'rescheduled')) return 'skipped';
  if (tasks.some((task) => task.status !== 'pending')) return 'active';
  return previousStatus === 'completed' || previousStatus === 'skipped' ? previousStatus : 'pending';
}

function formatReason(allocation: DailyStudyAllocation, daysToExam: number | null): string {
  if (daysToExam != null && daysToExam >= 0 && daysToExam <= 14) {
    return `${allocation.reasonSummary} Exam date is ${daysToExam} day${daysToExam === 1 ? '' : 's'} away, so readiness work is prioritized.`;
  }
  if (daysToExam == null) {
    return `${allocation.reasonSummary} No exam date is set, so the plan balances blueprint coverage and due reviews.`;
  }
  return allocation.reasonSummary;
}

async function syncPlanProgressFromAttempts(prisma: StudyPlanPrisma, plan: any) {
  // Do not infer plan completion from all attempts on the same calendar date.
  // Study-plan progress is linked by task/session via /api/study-plan/progress
  // or explicit daily-plan compatibility actions.
  void prisma;
  return plan;
}

export async function getOrCreateDailyStudyPlan(
  prisma: StudyPlanPrisma,
  userId: string,
  forDate: Date = new Date()
) {
  const planDate = normalizePlanDate(forDate);
  const existing = await prisma.dailyStudyPlan.findUnique({
    where: { userId_planDate: { userId, planDate } },
  });
  const existingTasks = existing ? sanitizeStudyPlanTasks(existing.recommendedSessions) : [];
  if (existing && (existing.status !== 'pending' || existingTasks.length > 0)) {
    const repaired = await repairStoredPlanLaunchability(prisma, existing);
    return syncPlanProgressFromAttempts(prisma, repaired);
  }

  const [allocation, user, prefs, goals] = await Promise.all([
    getDailyStudyAllocation(prisma as any, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, examDate: true } }),
    prisma.userPreferences?.findUnique({
      where: { userId },
      select: { dailyGoal: true, sessionLength: true },
    }) ?? Promise.resolve(null),
    prisma.userGoal?.findMany({
      where: { userId, status: 'active' },
      orderBy: [{ targetDate: 'asc' }, { createdAt: 'asc' }],
      take: 5,
      select: { targetSystem: true },
    }) ?? Promise.resolve([]),
  ]);
  const goalSystems = Array.from(new Set(
    (goals as Array<{ targetSystem?: string | null }>)
      .map((goal) => goal.targetSystem)
      .filter((system): system is string => typeof system === 'string' && system.trim().length > 0)
  ));
  const daysToExam = getDaysToExam(user?.examDate, planDate);
  const draftTasks = buildStudyPlanTasks({
    allocation,
    planDate,
    dailyGoal: prefs?.dailyGoal,
    sessionLength: prefs?.sessionLength,
    daysToExam,
    goalSystems,
  });
  const tasks = await ensureStudyPlanTasksLaunchable(prisma, draftTasks);
  const targetQuestionsCount = tasks.reduce((sum, task) => sum + task.count, 0);
  const estimatedTimeMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const recommendedModes = Array.from(new Set(tasks.map((task) => task.mode)));
  const targetSystemFocus = Array.from(new Set([
    ...tasks.flatMap((task) => task.systemFilter ?? []),
    ...goalSystems,
  ])).slice(0, 5);

  const plan = await prisma.dailyStudyPlan.upsert({
    where: { userId_planDate: { userId, planDate } },
    create: {
      userId,
      planDate,
      recommendedSessions: tasks,
      recommendedModes,
      targetQuestionsCount,
      targetSystemFocus,
      estimatedTimeMinutes,
      status: 'pending',
      feedbackReason: formatReason(allocation, daysToExam),
    },
    update: {
      recommendedSessions: tasks,
      recommendedModes,
      targetQuestionsCount,
      targetSystemFocus,
      estimatedTimeMinutes,
      status: 'pending',
      feedbackReason: formatReason(allocation, daysToExam),
      updatedAt: new Date(),
    },
  });

  return syncPlanProgressFromAttempts(prisma, plan);
}

export async function applyDailyStudyPlanAction(
  prisma: StudyPlanPrisma,
  plan: any,
  input: CompleteStudyPlanTaskInput
) {
  const action = input.action ?? 'complete';
  const now = new Date();
  const tasks = sanitizeStudyPlanTasks(plan.recommendedSessions);
  const taskId = input.taskId;
  const questionsAnswered = clampCount(input.questionsAnswered, 0);
  let nextTasks = tasks;

  if (taskId) {
    let matched = false;
    nextTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      matched = true;
      if (action === 'skip') {
        return { ...task, status: 'skipped', skippedAt: now.toISOString() };
      }
      if (action === 'reschedule') {
        const rescheduledFor = dateKey(input.rescheduleDate ?? addDays(new Date(plan.planDate), 1));
        return { ...task, status: 'rescheduled', rescheduledFor };
      }
      return {
        ...task,
        status: 'completed',
        completedAt: now.toISOString(),
        linkedSessionId: input.linkedSessionId ?? task.linkedSessionId,
        actualQuestionsAnswered:
          input.questionsAnswered != null
            ? questionsAnswered
            : task.actualQuestionsAnswered ?? task.count,
        actualDurationMinutes:
          input.durationMinutes != null
            ? clampCount(input.durationMinutes, 0)
            : task.actualDurationMinutes,
        actualAccuracy:
          input.accuracy != null ? clampPercentDecimal(input.accuracy) : task.actualAccuracy,
      };
    });
    if (!matched) {
      throw new Error('Task not found on this daily plan');
    }
  } else if (action === 'skip') {
    nextTasks = tasks.map((task) => ({ ...task, status: 'skipped' as const, skippedAt: now.toISOString() }));
  } else {
    nextTasks = tasks.map((task) => ({ ...task, status: 'completed' as const, completedAt: task.completedAt ?? now.toISOString() }));
  }

  const nextStatus = derivePlanStatus(nextTasks, plan.status);
  const completedQuestionTotal = nextTasks.reduce(
    (sum, task) => sum + clampCount(task.actualQuestionsAnswered, 0),
    0
  );
  const completedDurationTotal = nextTasks.reduce(
    (sum, task) => sum + clampCount(task.actualDurationMinutes, 0),
    0
  );
  let weightedAccuracy = 0;
  let accuracyWeight = 0;
  for (const task of nextTasks) {
    const answered = clampCount(task.actualQuestionsAnswered, 0);
    if (answered > 0 && typeof task.actualAccuracy === 'number') {
      weightedAccuracy += task.actualAccuracy * answered;
      accuracyWeight += answered;
    }
  }
  const nextAnswered = Math.min(
    clampCount(plan.targetQuestionsCount, 0),
    completedQuestionTotal
  );

  return prisma.dailyStudyPlan.update({
    where: { id: plan.id },
    data: {
      recommendedSessions: nextTasks,
      status: nextStatus,
      actualQuestionsAnswered: nextAnswered,
      actualAccuracy: accuracyWeight > 0 ? weightedAccuracy / accuracyWeight : clampPercentDecimal(input.accuracy),
      actualDurationMinutes: completedDurationTotal || (input.durationMinutes == null ? undefined : clampCount(input.durationMinutes, 0)),
      completedAt: nextStatus === 'completed' ? now : plan.completedAt,
      updatedAt: now,
    },
  });
}
