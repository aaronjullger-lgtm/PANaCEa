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
        lastActiveAt: { gte: weekAgo },
      },
      select: {
        id: true,
        email: true,
      },
    });

    let prescriptionsGenerated = 0;

    for (const user of activeUsers) {
      // Get user's progress data
      const progress = await prisma.userProgress.findMany({
        where: { userId: user.id },
        orderBy: { stability: 'asc' }, // Weakest first
        take: 20,
      });

      // Get recent performance
      const recentAttempts = await prisma.questionAttempt.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: weekAgo },
        },
        select: {
          system: true,
          isCorrect: true,
        },
      });

      // Calculate weak systems
      const systemPerformance: Record<string, { correct: number; total: number }> = {};
      for (const attempt of recentAttempts) {
        if (!attempt.system) continue;
        const sys = attempt.system;
        if (!systemPerformance[sys]) {
          systemPerformance[sys] = { correct: 0, total: 0 };
        }
        systemPerformance[sys].total++;
        if (attempt.isCorrect) {
          systemPerformance[sys].correct++;
        }
      }

      // Find weak systems (accuracy < 70%)
      const weakSystems = Object.entries(systemPerformance)
        .filter(([_, stats]) => stats.total >= 5 && stats.correct / stats.total < 0.7)
        .map(([system]) => system)
        .slice(0, 5);

      type ProgressRecord = { stability: number | null; retrievability: number | null; system: string | null; dueDate: Date | null };
      // Find low stability items from FSRS
      const lowStabilityItems = progress
        .filter((p: ProgressRecord) => (p.stability ?? 0) < 2 || ((p.retrievability ?? 1) < 0.8))
        .map((p: ProgressRecord) => p.system)
        .filter((s: string | null): s is string => Boolean(s));

      // Combine for focus areas
      const focusSystems = [...new Set([...weakSystems, ...lowStabilityItems])].slice(0, 3);

      // Calculate recommended question count based on streak
      const baseQuestions = 20;
      const adjustedQuestions = Math.min(30, baseQuestions);

      // Calculate due cards from FSRS
      const dueCards = progress.filter((p: ProgressRecord) => {
        if (!p.dueDate) return true;
        return new Date(p.dueDate) <= new Date();
      }).length;

      // Store prescription (we'll create a simple entry in SessionAnalytics for now)
      // In production, you might have a DailyPrescription table
      await prisma.auditLog.create({
        data: {
          action: 'DAILY_PRESCRIPTION_GENERATED',
          entityType: 'USER',
          entityId: user.id,
          details: {
            userId: user.id,
            date: new Date().toISOString().split('T')[0],
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