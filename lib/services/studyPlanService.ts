import { getDailyStudyAllocation, type DailyStudyAllocation } from './dailyStudyAllocatorService';

export type StudyPlanTaskStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'rescheduled';
export type StudyPlanTaskKind = 'main' | 'targeted' | 'content';

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
  systemFilter?: string[];
  conditionIds?: string[];
  route: string;
  launchParams: Record<string, string>;
  completedAt?: string;
  skippedAt?: string;
  rescheduledFor?: string;
}

export interface CompleteStudyPlanTaskInput {
  action?: 'complete' | 'skip' | 'reschedule';
  taskId?: string;
  accuracy?: number;
  durationMinutes?: number;
  questionsAnswered?: number;
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
  questionAttempt: {
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
  const launchParams: Record<string, string> = {
    source: 'study-plan',
    mode: task.kind === 'targeted' ? 'condition' : 'adaptive',
  };
  if (task.id) launchParams.taskId = task.id;

  if (task.kind === 'targeted') {
    const conditions = task.conditionIds ?? [];
    if (conditions.length > 0) {
      launchParams.conditions = conditions.join(',');
      launchParams.conditionId = conditions[0] ?? '';
    }
    const query = new URLSearchParams(launchParams).toString();
    return { route: `/study/main-session?${query}`, launchParams };
  }

  const systems = task.systemFilter ?? [];
  if (systems.length > 0) launchParams.systems = systems.join(',');
  const query = new URLSearchParams(launchParams).toString();
  return { route: `/study/main-session?${query}`, launchParams };
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
}: {
  allocation: DailyStudyAllocation;
  planDate: Date;
  dailyGoal?: number | null;
  sessionLength?: number | null;
  daysToExam?: number | null;
}): StudyPlanTask[] {
  const date = dateKey(planDate);
  const availableMinutes = clampCount(sessionLength, 45) || 45;
  const targetQuestions = clampCount(dailyGoal, allocation.recommendedMainCount + allocation.recommendedTargetedCount);
  const mainCount = Math.max(0, Math.min(allocation.recommendedMainCount, targetQuestions));
  const targetedCount = Math.max(0, Math.min(allocation.recommendedTargetedCount, Math.max(0, targetQuestions - mainCount)));
  const mainMinutes = Math.max(10, Math.round(availableMinutes * (mainCount / Math.max(1, mainCount + targetedCount))));
  const targetedMinutes = Math.max(10, availableMinutes - mainMinutes);
  const examUrgency = daysToExam != null && daysToExam >= 0 && daysToExam <= 14;

  const mainSystems = allocation.mainSystems.length > 0 ? allocation.mainSystems : ['Cardiovascular', 'Pulmonary', 'Gastrointestinal'];
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
      systemFilter: mainSystems.slice(0, 3),
    };
    tasks.push({ ...draft, ...routeForTask(draft) });
  }

  if (targetedCount > 0 && allocation.targetedConditions.length > 0) {
    const conditions = allocation.targetedConditions.slice(0, 8);
    const draft = {
      id: `${date}-targeted-review`,
      kind: 'targeted' as const,
      mode: 'rapid_recall',
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
      systemFilter: mainSystems.slice(0, 3),
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
      const kind = task.kind === 'targeted' || task.kind === 'content' ? task.kind : 'main';
      const statusValues: StudyPlanTaskStatus[] = ['pending', 'active', 'completed', 'skipped', 'rescheduled'];
      const status = statusValues.includes(task.status as StudyPlanTaskStatus)
        ? (task.status as StudyPlanTaskStatus)
        : 'pending';
      const systemFilter = Array.isArray(task.systemFilter)
        ? task.systemFilter.filter((item): item is string => typeof item === 'string')
        : undefined;
      const conditionIds = Array.isArray(task.conditionIds)
        ? task.conditionIds.filter((item): item is string => typeof item === 'string')
        : undefined;
      const id = typeof task.id === 'string' ? task.id : `task-${index + 1}`;
      const mode = typeof task.mode === 'string' ? task.mode : kind === 'targeted' ? 'condition' : 'core_adaptive';
      const routed = routeForTask({ id, kind, mode, systemFilter, conditionIds });
      const providedLaunchParams = task.launchParams && typeof task.launchParams === 'object'
        ? Object.fromEntries(
            Object.entries(task.launchParams as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          )
        : {};
      const launchParams = {
        ...routed.launchParams,
        ...providedLaunchParams,
        taskId: id,
        source: 'study-plan',
      };
      const route = `/study/main-session?${new URLSearchParams(launchParams).toString()}`;

      return {
        id,
        kind,
        mode,
        title: typeof task.title === 'string' ? task.title : kind === 'targeted' ? 'Due review block' : 'Readiness question block',
        count: clampCount(task.count, 10),
        estimatedMinutes: clampCount(task.estimatedMinutes, 20),
        reason: typeof task.reason === 'string' ? task.reason : 'Recommended by your study plan.',
        priority: task.priority === 'high' || task.priority === 'low' ? task.priority : 'medium',
        status,
        systemFilter,
        conditionIds,
        route,
        launchParams,
        completedAt: typeof task.completedAt === 'string' ? task.completedAt : undefined,
        skippedAt: typeof task.skippedAt === 'string' ? task.skippedAt : undefined,
        rescheduledFor: typeof task.rescheduledFor === 'string' ? task.rescheduledFor : undefined,
      };
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
  if (!plan?.id || plan.status === 'completed' || plan.status === 'skipped') return plan;
  const planDate = normalizePlanDate(plan.planDate);
  const nextDate = addDays(planDate, 1);
  const answeredToday = await prisma.questionAttempt.count({
    where: { userId: plan.userId, createdAt: { gte: planDate, lt: nextDate } },
  });
  if (answeredToday <= (plan.actualQuestionsAnswered ?? 0)) return plan;
  const target = clampCount(plan.targetQuestionsCount, 0);
  const nextStatus = target > 0 && answeredToday >= target ? 'completed' : 'active';
  return prisma.dailyStudyPlan.update({
    where: { id: plan.id },
    data: {
      actualQuestionsAnswered: answeredToday,
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? new Date() : plan.completedAt,
      updatedAt: new Date(),
    },
  });
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
  if (existing && existing.status !== 'pending') {
    return syncPlanProgressFromAttempts(prisma, existing);
  }

  const [allocation, user, prefs] = await Promise.all([
    getDailyStudyAllocation(prisma as any, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, examDate: true } }),
    prisma.userPreferences?.findUnique({
      where: { userId },
      select: { dailyGoal: true, sessionLength: true },
    }) ?? Promise.resolve(null),
  ]);
  const daysToExam = getDaysToExam(user?.examDate, planDate);
  const tasks = buildStudyPlanTasks({
    allocation,
    planDate,
    dailyGoal: prefs?.dailyGoal,
    sessionLength: prefs?.sessionLength,
    daysToExam,
  });
  const targetQuestionsCount = tasks.reduce((sum, task) => sum + task.count, 0);
  const estimatedTimeMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const recommendedModes = Array.from(new Set(tasks.map((task) => task.mode)));
  const targetSystemFocus = Array.from(new Set(tasks.flatMap((task) => task.systemFilter ?? []))).slice(0, 5);

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
      return { ...task, status: 'completed', completedAt: now.toISOString() };
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
  const task = taskId ? nextTasks.find((item) => item.id === taskId) : null;
  const additionalQuestions = action === 'complete'
    ? questionsAnswered || task?.count || Math.max(0, plan.targetQuestionsCount - (plan.actualQuestionsAnswered ?? 0))
    : 0;
  const nextAnswered = Math.min(
    clampCount(plan.targetQuestionsCount, 0),
    clampCount(plan.actualQuestionsAnswered, 0) + additionalQuestions
  );

  return prisma.dailyStudyPlan.update({
    where: { id: plan.id },
    data: {
      recommendedSessions: nextTasks,
      status: nextStatus,
      actualQuestionsAnswered: nextAnswered,
      actualAccuracy: clampPercentDecimal(input.accuracy),
      actualDurationMinutes: input.durationMinutes == null ? undefined : clampCount(input.durationMinutes, 0),
      completedAt: nextStatus === 'completed' ? now : plan.completedAt,
      updatedAt: now,
    },
  });
}
