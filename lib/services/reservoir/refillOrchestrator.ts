/**
 * Refill Orchestrator — Creates background jobs for reservoir refills
 * with deduplication and cooldown enforcement.
 *
 * The orchestrator is the traffic cop: it decides WHETHER a refill should happen,
 * not HOW. The actual question selection is in refillWorker.ts.
 *
 * Deduplication strategy:
 *   1. Cooldown check — no two refill jobs for the same user within 30 min
 *   2. Level check — skip if already above low water mark (another trigger may have filled it)
 *   3. DB unique constraint — final safety net against duplicate questions
 *
 * @module lib/services/reservoir/refillOrchestrator
 */

import { createJob, type JobType } from '../queue/jobQueue';
import { getQueueDepth } from './reservoirService';
import { RESERVOIR_POLICY, type RefillReason } from './reservoirPolicy';
import { logger } from '../../logger';

const LOG_SCOPE = 'RefillOrchestrator';
const refillOrchestratorLogger = logger.scope(LOG_SCOPE);

type PrismaClientLike = {
  backgroundJob: any;
  studentReservoirItem: any;
  $queryRaw: any;
  $queryRawUnsafe: any;
  $transaction: any;
  $executeRawUnsafe: any;
  [key: string]: any;
};

// Extend JobType to include our new type
const RESERVOIR_REFILL_JOB: JobType = 'generate_questions'; // Reuse existing job type with payload differentiation

export interface RefillRequest {
  jobId: string | null;
  skipped: boolean;
  reason?: string;
}

/**
 * Request a reservoir refill for a specific user+scope.
 *
 * This is idempotent — calling it multiple times within the cooldown window
 * produces at most one job.
 */
export async function requestRefill(
  prisma: PrismaClientLike,
  userId: string,
  scope: string,
  reason: RefillReason,
  learnerPhase?: 'didactic' | 'clinical' | 'pance_prep'
): Promise<RefillRequest> {
  try {
    // 1. Cooldown check — is there already a recent/active refill job?
    const cooldownCutoff = new Date(
      Date.now() - RESERVOIR_POLICY.REFILL_COOLDOWN_MINUTES * 60_000
    );

    const recentJob = await prisma.backgroundJob.findFirst({
      where: {
        jobType: RESERVOIR_REFILL_JOB,
        status: { in: ['pending', 'processing'] },
        createdAt: { gte: cooldownCutoff },
        AND: [
          { payload: { path: ['userId'], equals: userId } },
          { payload: { path: ['scope'], equals: scope } },
          { payload: { path: ['isReservoirRefill'], equals: true } },
        ],
      },
    });

    if (recentJob) {
      return { jobId: null, skipped: true, reason: 'cooldown_active' };
    }

    // 2. Level check — maybe another trigger already refilled
    const currentDepth = await getQueueDepth(prisma, userId, scope);
    if (currentDepth >= RESERVOIR_POLICY.LOW_WATER_MARK) {
      return { jobId: null, skipped: true, reason: 'above_threshold' };
    }

    // 3. Calculate deficit
    const deficit = Math.min(
      RESERVOIR_POLICY.HIGH_WATER_MARK - currentDepth,
      RESERVOIR_POLICY.REFILL_BATCH_SIZE
    );

    if (deficit <= 0) {
      return { jobId: null, skipped: true, reason: 'no_deficit' };
    }

    // 4. Create the refill job
    const priority = reason === 'post_session' ? 8
      : reason === 'manual' ? 7
      : reason === 'login' ? 6
      : 5; // cron / low_water

    const job = await createJob(prisma, {
      jobType: RESERVOIR_REFILL_JOB,
      payload: {
        userId,
        scope,
        deficit,
        reason,
        isReservoirRefill: true, // Distinguishes from legacy generate_questions jobs
        confusionScope: true, // Enable confusion-pair priority boosting
        requestedAt: new Date().toISOString(),
        ...(learnerPhase ? { learnerPhase } : {}),
      },
      priority,
      maxAttempts: 3,
    });

    return { jobId: job.id, skipped: false };
  } catch (err: any) {
    refillOrchestratorLogger.error('requestRefill failed', {
      error: err,
      userId,
    });
    return { jobId: null, skipped: true, reason: `error: ${err.message}` };
  }
}

/**
 * Scan all active users and trigger refills for those below low water mark.
 * Called by the cron maintenance job.
 */
export async function triggerRefillsForLowUsers(
  prisma: PrismaClientLike
): Promise<{ checked: number; triggered: number; skipped: number }> {
  // Find active onboarded users with low reservoir depth. The LEFT JOIN keeps
  // brand-new users with zero reservoir rows visible to maintenance.
  let lowUsers: any[];
  try {
    lowUsers = await prisma.$queryRawUnsafe(`
      WITH queued AS (
        SELECT "userId", "scope", COUNT(*) as queued_count
        FROM "StudentReservoirItem"
        WHERE "status" = 'queued' AND "expiresAt" > NOW()
        GROUP BY "userId", "scope"
      )
      SELECT u."id" as "userId",
             COALESCE(q."scope", 'adaptive') as "scope",
             COALESCE(q.queued_count, 0) as queued_count
      FROM "User" u
      LEFT JOIN queued q ON q."userId" = u."id"
      WHERE u."accountStatus" = 'active'
        AND u."hasCompletedOnboarding" = true
        AND COALESCE(q.queued_count, 0) < $1
      ORDER BY queued_count ASC, u."createdAt" ASC
      LIMIT 250
    `, RESERVOIR_POLICY.LOW_WATER_MARK);
  } catch (err) {
    console.warn('[RefillOrchestrator] failed to query low-water users', err);
    return { checked: 0, triggered: 0, skipped: 0 };
  }

  let triggered = 0;
  let skipped = 0;

  for (const user of lowUsers) {
    const result = await requestRefill(
      prisma,
      user.userId,
      user.scope,
      'cron'
    );
    if (result.skipped) {
      skipped++;
    } else {
      triggered++;
    }
  }

  return { checked: lowUsers.length, triggered, skipped };
}
