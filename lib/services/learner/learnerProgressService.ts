/**
 * Learner progress summary. Read-only aggregates.
 */

import type { PrismaClient } from '@prisma/client';
import { getOrCreateDailyStudyPlan, sanitizeStudyPlanTasks } from '../studyPlanService';
import type { ProgressSummary } from './types';

function normalizePlanDate(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export async function getProgressSummary(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date()
): Promise<ProgressSummary> {
  const overdueCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const [progressRows, dueToday, overdue, plan] = await Promise.all([
    prisma.userProgress.findMany({
      where: { userId },
      select: { system: true, totalAttempts: true, correctCount: true, accuracy: true },
      take: 500,
    }),
    prisma.userProgress.count({
      where: { userId, nextReviewAt: { gte: overdueCutoff, lte: now } },
    }),
    prisma.userProgress.count({
      where: { userId, nextReviewAt: { lt: overdueCutoff } },
    }),
    getOrCreateDailyStudyPlan(prisma as any, userId, normalizePlanDate(now)),
  ]);

  let totalAttempts = 0;
  let totalCorrect = 0;
  const bySystem = new Map<string, { attempts: number; correct: number }>();

  for (const row of progressRows) {
    totalAttempts += row.totalAttempts;
    totalCorrect += row.correctCount;
    const sys = row.system ?? 'UNCATEGORIZED';
    const entry = bySystem.get(sys) ?? { attempts: 0, correct: 0 };
    entry.attempts += row.totalAttempts;
    entry.correct += row.correctCount;
    bySystem.set(sys, entry);
  }

  const weakestSystems = [...bySystem.entries()]
    .filter(([, v]) => v.attempts >= 5)
    .map(([system, v]) => ({
      system,
      accuracy: v.attempts > 0 ? v.correct / v.attempts : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)
    .map((x) => x.system);

  const tasks = sanitizeStudyPlanTasks(plan.recommendedSessions);
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

  return {
    totalAttempts,
    overallAccuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : 0,
    dueToday,
    overdue,
    todayPlanProgress: {
      completedTasks,
      totalTasks: tasks.length,
      questionsAnswered: plan.actualQuestionsAnswered ?? 0,
      targetQuestions: plan.targetQuestionsCount ?? 0,
    },
    weakestSystems,
  };
}
