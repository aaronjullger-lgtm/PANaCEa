/**
 * Daily Study Prescription Generator
 * Creates personalized study plans based on FSRS data and weak areas
 *
 * Called by: Cloudflare Scheduled Handler at 6 AM UTC
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateRequest } from '../_shared/schemas';
import { z } from 'zod';

// Zod schema for cron request (empty - triggered by scheduler)
const CronRequestSchema = z
  .object({
    userId: z.string().optional(), // Optional: run for specific user only
  })
  .optional()
  .default({});

export async function onRequestPost(context: any) {
  const { request, env } = context;

  // Verify cron secret
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate request body (optional for cron jobs)
  const validation = await validateRequest(request, CronRequestSchema);
  if (validation.success === false) {
    return validation.response;
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get active users (logged in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeUsers = await prisma.user.findMany({
      where: {
        updatedAt: { gte: weekAgo },
      },
      select: { id: true, email: true },
    });
    const activeUserIds = activeUsers.map((u) => u.id);
    if (activeUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          prescriptionsGenerated: 0,
          timestamp: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Batch: all progress for active users; all attempts for active users in window
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
      where: {
        userId: { in: activeUserIds },
        createdAt: { gte: weekAgo },
      },
      select: { userId: true, system: true, wasCorrect: true },
    });

    // Key progress by userId; sort by stability asc per user and take 20
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
      const adjustedQuestions = Math.min(30, 20);
      const dueCards = progress.filter((p) => !p.dueDate || new Date(p.dueDate) <= now).length;

      await prisma.auditLog.create({
        data: {
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

    return new Response(
      JSON.stringify({
        success: true,
        prescriptionsGenerated,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Cron] Daily prescription generation failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
