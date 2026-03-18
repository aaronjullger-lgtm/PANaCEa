import { Request, Response } from '@cloudflare/workers-types';
import { computeUserPhenotype, generateDailyPlan } from '../_shared/phenotypeService';
import { prisma } from '../_shared/prisma-edge';

/**
 * Nightly cron job: Generate personalized daily study plans
 *
 * For each active user:
 * 1. Compute/update their study phenotype (learning patterns, strengths, weaknesses)
 * 2. Generate personalized daily plan for tomorrow
 * 3. Create study recommendations based on their profile
 *
 * Scheduled to run in the evening so plans are ready for the next morning
 */
export default async function generateDailyPlans(
  request: Request,
  _context: unknown
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Verify request is from cron
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.includes('Bearer')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    console.log('[dailyPlans] Starting daily plan generation job');

    // Get all active users (with study activity in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUserIds = await prisma.reviewLog.findMany({
      where: {
        reviewedAt: { gte: sevenDaysAgo },
      },
      distinct: ['userId'],
      select: { userId: true },
    });

    console.log(`[dailyPlans] Found ${activeUserIds.length} active users`);

    // Generate plans for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const planResults = {
      created: 0,
      updated: 0,
      errors: 0,
    };

    // Process users in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < activeUserIds.length; i += batchSize) {
      const batch = activeUserIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user) => {
          try {
            // Compute/update phenotype
            await computeUserPhenotype(user.userId);

            // Generate daily plan for tomorrow
            const result = await generateDailyPlan(user.userId, tomorrow);

            if (result.status === 'pending') {
              planResults.created++;
            } else {
              planResults.updated++;
            }
          } catch (error) {
            planResults.errors++;
            console.warn(
              `[dailyPlans] Error processing user ${user.userId}:`,
              error instanceof Error ? error.message : String(error)
            );
          }
        })
      );
    }

    console.log(`[dailyPlans] Generated plans summary:`, planResults);

    // Compile summary statistics
    const summary = {
      timestamp: new Date().toISOString(),
      usersProcessed: activeUserIds.length,
      plansCreated: planResults.created,
      plansUpdated: planResults.updated,
      planErrors: planResults.errors,
      durationMs: Date.now() - startTime,
    };

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[dailyPlans] Error:', errorMessage);

    return new Response(
      JSON.stringify({
        error: 'Daily plan generation failed',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
