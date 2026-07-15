/**
 * Upcoming assignments from study plan items. Read-only.
 */

import type { PrismaClient } from '@prisma/client';
import { sanitizeStudyPlanTasks, getOrCreateDailyStudyPlan } from '../studyPlanService';
import type { UpcomingAssignment } from './types';

export async function getUpcomingAssignments(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date(),
  horizonDays = 7
): Promise<UpcomingAssignment[]> {
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const assignments: UpcomingAssignment[] = [];

  const plan = await getOrCreateDailyStudyPlan(prisma as any, userId, now);
  const tasks = sanitizeStudyPlanTasks(plan.recommendedSessions);

  for (const task of tasks) {
    if (['completed', 'skipped'].includes(task.status)) continue;
    const dueRaw = task.rescheduledFor ?? null;
    const dueAt = dueRaw ? new Date(dueRaw) : null;
    if (dueAt && dueAt > horizon) continue;

    assignments.push({
      id: task.id,
      title: task.title,
      dueAt: dueRaw,
      status: task.status,
      mode: task.mode,
      estimatedMinutes: task.estimatedMinutes,
      rationale: task.reason,
    });
  }

  const planItems = await prisma.studyPlanItem.findMany({
    where: {
      StudyPlan: { userId },
      status: { in: ['PENDING', 'ACTIVE'] },
      dueAt: { lte: horizon },
    },
    select: {
      id: true,
      mode: true,
      rationale: true,
      dueAt: true,
      status: true,
      estimatedMinutes: true,
    },
    orderBy: { dueAt: 'asc' },
    take: 20,
  });

  for (const item of planItems) {
    assignments.push({
      id: item.id,
      title: `${item.mode} block`,
      dueAt: item.dueAt ? item.dueAt.toISOString() : null,
      status: item.status,
      mode: item.mode,
      estimatedMinutes: item.estimatedMinutes,
      rationale: item.rationale,
    });
  }

  return assignments.sort((a, b) => {
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return a.dueAt.localeCompare(b.dueAt);
  });
}
