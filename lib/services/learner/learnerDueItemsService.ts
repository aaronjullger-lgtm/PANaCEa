/**
 * Returns FSRS-due and plan-task items for a learner. Read-only.
 */

import type { PrismaClient } from '@prisma/client';
import { sanitizeStudyPlanTasks } from '../studyPlanService';
import type { DueLearningItem } from './types';

function normalizePlanDate(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export async function getDueLearningItems(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date()
): Promise<DueLearningItem[]> {
  const overdueCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const items: DueLearningItem[] = [];

  const overdueRows = await prisma.userProgress.findMany({
    where: { userId, nextReviewAt: { lt: overdueCutoff } },
    select: {
      id: true,
      conditionId: true,
      system: true,
      nextReviewAt: true,
      fsrsStability: true,
    },
    orderBy: { nextReviewAt: 'asc' },
    take: 50,
  });

  for (const row of overdueRows) {
    const dueAt = row.nextReviewAt!;
    const overdueHours = Math.max(0, (now.getTime() - dueAt.getTime()) / (60 * 60 * 1000));
    items.push({
      id: `fsrs:${row.id}`,
      kind: 'fsrs_review',
      title: `Review ${row.conditionId}`,
      system: row.system ?? undefined,
      conditionId: row.conditionId,
      dueAt: dueAt.toISOString(),
      overdueHours,
      priorityScore: 100 + Math.min(overdueHours / 24, 30),
      metadata: { stability: row.fsrsStability },
    });
  }

  const planDate = normalizePlanDate(now);
  const plan = await prisma.dailyStudyPlan.findUnique({
    where: { userId_planDate: { userId, planDate } },
    select: { recommendedSessions: true },
  });

  if (plan?.recommendedSessions) {
    const tasks = sanitizeStudyPlanTasks(plan.recommendedSessions);
    for (const task of tasks) {
      if (!['pending', 'active', 'in_progress', 'rescheduled'].includes(task.status)) {
        continue;
      }
      const dueAt = task.rescheduledFor ?? null;
      let overdueHours = 0;
      if (dueAt) {
        const due = new Date(dueAt);
        if (due < now) {
          overdueHours = (now.getTime() - due.getTime()) / (60 * 60 * 1000);
        }
      }
      items.push({
        id: `plan:${task.id}`,
        kind: 'plan_task',
        title: task.title,
        system: task.systems?.[0],
        dueAt,
        overdueHours,
        priorityScore: 90 + Math.min(overdueHours / 12, 20),
        metadata: { mode: task.mode, kind: task.kind },
      });
    }
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore);
}
