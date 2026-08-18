/**
 * Aggregates verified learner context from canonical Postgres sources.
 * Read-only. Edge-safe when passed a Prisma client.
 */

import type { PrismaClient } from '@prisma/client';
import { getDailyStudyAllocation } from '../dailyStudyAllocatorService';
import { getSystemsForRotation } from '@/config/rotation-systems';
import type { LearnerContext, LearnerProfileSnapshot, RotationContext } from './types';

export interface LearnerContextPrisma {
  user: {
    findUnique(args: {
      where: { id: string };
      select: Record<string, boolean>;
    }): Promise<{
      id: string;
      examDate?: Date | null;
      currentRotation?: string | null;
      rotationEndDate?: Date | null;
      eorTestDate?: Date | null;
      trainingPhase?: string | null;
    } | null>;
  };
  userPreferences?: {
    findUnique(args: {
      where: { userId: string };
      select: Record<string, boolean>;
    }): Promise<{
      dailyGoal?: number | null;
      sessionLength?: number | null;
      preferredSystems?: string[] | null;
    } | null>;
  };
  userProgress: {
    count(args: { where: Record<string, unknown> }): Promise<number>;
  };
  dailyStudyPlan?: {
    findUnique(args: {
      where: { userId_planDate: { userId: string; planDate: Date } };
      select: Record<string, boolean>;
    }): Promise<{ recommendedSessions?: unknown } | null>;
  };
}

function normalizePlanDate(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function countPendingPlanTasks(sessions: unknown): number {
  if (!Array.isArray(sessions)) return 0;
  return sessions.filter(
    (t) =>
      t &&
      typeof t === 'object' &&
      ['pending', 'active', 'in_progress', 'rescheduled'].includes(
        String((t as { status?: string }).status ?? '')
      )
  ).length;
}

export async function getLearnerContext(
  prisma: LearnerContextPrisma & PrismaClient,
  userId: string,
  now: Date = new Date()
): Promise<LearnerContext> {
  const planDate = normalizePlanDate(now);
  const overdueCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const [user, prefs, allocation, overdueFsrs, dueTodayFsrs, dailyPlan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        examDate: true,
        currentRotation: true,
        rotationEndDate: true,
        eorTestDate: true,
        trainingPhase: true,
      },
    }),
    prisma.userPreferences?.findUnique({
      where: { userId },
      select: { dailyGoal: true, sessionLength: true, preferredSystems: true },
    }),
    getDailyStudyAllocation(prisma as PrismaClient, userId),
    prisma.userProgress.count({
      where: { userId, nextReviewAt: { lt: overdueCutoff } },
    }),
    prisma.userProgress.count({
      where: {
        userId,
        nextReviewAt: { gte: overdueCutoff, lte: now },
      },
    }),
    prisma.dailyStudyPlan?.findUnique({
      where: { userId_planDate: { userId, planDate } },
      select: { recommendedSessions: true },
    }),
  ]);

  if (!user) {
    throw new Error('LEARNER_NOT_FOUND');
  }

  const profile: LearnerProfileSnapshot = {
    userId,
    examDate: user.examDate ? user.examDate.toISOString() : null,
    currentRotation: user.currentRotation ?? null,
    rotationEndDate: user.rotationEndDate ? user.rotationEndDate.toISOString() : null,
    trainingPhase: user.trainingPhase ?? null,
    dailyGoal: prefs?.dailyGoal ?? null,
    sessionLengthMinutes: prefs?.sessionLength ?? null,
    preferredSystems: prefs?.preferredSystems ?? [],
  };

  const rotation = buildRotationContext(user, now);

  return {
    profile,
    rotation,
    allocation,
    dueItemCounts: {
      overdueFsrs,
      dueTodayFsrs,
      pendingPlanTasks: countPendingPlanTasks(dailyPlan?.recommendedSessions),
    },
    fetchedAt: now.toISOString(),
  };
}

export function buildRotationContext(
  user: {
    currentRotation?: string | null;
    rotationEndDate?: Date | null;
    eorTestDate?: Date | null;
  },
  now: Date
): RotationContext {
  const rotation = user.currentRotation ?? null;
  let systemsInScope: string[] = [];
  if (rotation) {
    try {
      systemsInScope = getSystemsForRotation(rotation as Parameters<typeof getSystemsForRotation>[0]);
    } catch {
      systemsInScope = [];
    }
  }

  const end = user.rotationEndDate ?? user.eorTestDate ?? null;
  let daysRemaining: number | null = null;
  if (end) {
    daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  }

  return {
    rotation,
    systemsInScope,
    eorTestDate: user.eorTestDate ? user.eorTestDate.toISOString() : null,
    rotationEndDate: user.rotationEndDate ? user.rotationEndDate.toISOString() : null,
    daysRemaining,
  };
}
