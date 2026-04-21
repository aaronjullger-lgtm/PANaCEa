/**
 * POST /api/cron/generate-daily-plans
 *
 * Nightly cron job: Generate personalized daily study plans.
 * For each active user: compute study phenotype and generate daily plan for tomorrow.
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { computeUserPhenotype, generateDailyPlan } from '../_shared/phenotypeService';

export const onRequestPost = cronEndpoint({
  handler: async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startTime = Date.now();

    try {
      console.log('[dailyPlans] Starting daily plan generation job');

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const activeUserIds = await prisma.reviewLog.findMany({
        where: { reviewedAt: { gte: sevenDaysAgo } },
        distinct: ['userId'],
        select: { userId: true },
      });

      console.log(`[dailyPlans] Found ${activeUserIds.length} active users`);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const planResults = { created: 0, updated: 0, errors: 0 };
      const batchSize = 50;

      for (let i = 0; i < activeUserIds.length; i += batchSize) {
        const batch = activeUserIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (user) => {
            try {
              await computeUserPhenotype(user.userId);
              const result = await generateDailyPlan(user.userId, tomorrow);
              if (result.status === 'pending') planResults.created++;
              else planResults.updated++;
            } catch (error) {
              planResults.errors++;
              console.warn(`[dailyPlans] Error processing user ${user.userId}:`, error instanceof Error ? error.message : String(error));
            }
          })
        );
      }

      console.log('[dailyPlans] Generated plans summary:', planResults);

      return ok({
        usersProcessed: activeUserIds.length,
        plansCreated: planResults.created,
        plansUpdated: planResults.updated,
        planErrors: planResults.errors,
        durationMs: Date.now() - startTime,
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
