/**
 * Daily Study Prescription Generator
 * Creates personalized study plans based on FSRS data and weak areas
 *
 * Called by: Cloudflare Scheduled Handler at 6 AM UTC
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { z } from 'zod';
import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const BodySchema = z.object({
  userId: z.string().optional(),
}).optional().default({});

export const onRequestPost = cronEndpoint({
  schema: BodySchema,
  handler: async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const activeUsers = await prisma.user.findMany({
        where: { updatedAt: { gte: weekAgo } },
        select: { id: true, email: true },
      });
      const activeUserIds = activeUsers.map((u) => u.id);

      if (activeUserIds.length === 0) {
        return ok({ prescriptionsGenerated: 0 });
      }

      type ProgressRecord = {
        userId: string;
        stability: number | null;
        retrievability: number | null;
        system: string | null;
        dueDate: Date | null;
      };
      const progressRows = await prisma.userProgress.findMany({
        where: { userId: { in: activeUserIds } },
        select: {
          userId: true,
          nextReviewAt: true,
          fsrsParams: true,
          fsrsCard: true,
          MedicalContent: { select: { system: true } },
        },
      });
      const allProgress: ProgressRecord[] = progressRows.map((p) => {
        const params = (p.fsrsParams ?? p.fsrsCard) as { S?: number; R?: number } | null;
        return {
          userId: p.userId,
          stability: params?.S ?? null,
          retrievability: params?.R ?? null,
          system: p.MedicalContent?.system ?? null,
          dueDate: p.nextReviewAt,
        };
      });
      const allAttempts = await prisma.questionAttempt.findMany({
        where: { userId: { in: activeUserIds }, createdAt: { gte: weekAgo } },
        select: { userId: true, system: true, wasCorrect: true },
      });

      const progressByUser = new Map<string, ProgressRecord[]>();
      for (const p of allProgress) {
        const list = progressByUser.get(p.userId) ?? [];
        list.push(p);
        progressByUser.set(p.userId, list);
      }
      for (const [uid, list] of progressByUser) {
        list.sort((a, b) => (a.stability ?? 0) - (b.stability ?? 0));
        progressByUser.set(uid, list.slice(0, 20));
      }
      const attemptsByUser = new Map<string, { system: string | null; wasCorrect: boolean }[]>();
      for (const a of allAttempts) {
        const list = attemptsByUser.get(a.userId) ?? [];
        list.push(a);
        attemptsByUser.set(a.userId, list);
      }

      const now = new Date();
      let prescriptionsGenerated = 0;

      for (const user of activeUsers) {
        const progress = progressByUser.get(user.id) ?? [];
        const recentAttempts = attemptsByUser.get(user.id) ?? [];

        const systemPerformance: Record<string, { correct: number; total: number }> = {};
        for (const attempt of recentAttempts) {
          if (!attempt.system) continue;
          const sys = attempt.system;
          systemPerformance[sys] ??= { correct: 0, total: 0 };
          systemPerformance[sys].total++;
          if (attempt.wasCorrect) systemPerformance[sys].correct++;
        }

        const weakSystems = Object.entries(systemPerformance)
          .filter(([_, stats]) => stats.total >= 5 && stats.correct / stats.total < 0.7)
          .map(([system]) => system)
          .slice(0, 5);

        const lowStabilityItems = progress
          .filter((p) => (p.stability ?? 0) < 2 || (p.retrievability ?? 1) < 0.8)
          .map((p) => p.system)
          .filter(Boolean) as string[];

        const focusSystems = [...new Set([...weakSystems, ...lowStabilityItems])].slice(0, 3);
        const adjustedQuestions = 20;
        const dueCards = progress.filter((p) => !p.dueDate || new Date(p.dueDate) <= now).length;

        await prisma.auditLog.create({
          data: {
            id: `audit_prescription_${user.id}_${now.toISOString().split('T')[0]}_${Date.now()}`,
            action: 'DAILY_PRESCRIPTION_GENERATED',
            entityType: 'USER',
            entityId: user.id,
            details: {
              userId: user.id,
              date: now.toISOString().split('T')[0],
              weakSystems,
              focusSystems,
              recommendedQuestions: adjustedQuestions,
              dueCards,
              lowStabilityItems: lowStabilityItems.length,
            },
          },
        });
        prescriptionsGenerated++;
      }

      return ok({ prescriptionsGenerated });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
