/**
 * Account Deletion API
 *
 * DELETE /api/user/delete
 *
 * Implements a soft-delete with 30-day grace period:
 * 1. Marks user as "pending_deletion" with a scheduledDeletionDate
 * 2. Returns a summary of data that will be deleted
 * 3. User can cancel deletion within the grace period via PUT
 *
 * Hard deletion happens via the Clerk webhook (user.deleted event)
 * which triggers cascade delete on all user-related models.
 *
 * PUT /api/user/delete — Cancel pending deletion
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import { validateFunctionEnv } from '../_shared/env-validation';

const EmptySchema = z.object({});

const GRACE_PERIOD_DAYS = 30;

/**
 * DELETE — Initiate account deletion (soft delete with grace period)
 */
export const onRequestDelete = authenticatedEndpoint(EmptySchema, async (context) => {
  const log = createEndpointLogger('user/delete');
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    validateFunctionEnv(context.env, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
    const user = await resolveUserByClerkId(prisma, context.auth.userId);

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Check if already pending deletion
    if (user.deletionScheduledAt) {
      return {
        status: 200,
        data: {
          status: 'already_pending',
          scheduledDeletionDate: user.deletionScheduledAt,
          message: `Account deletion already scheduled for ${user.deletionScheduledAt.toISOString().split('T')[0]}`,
        },
      };
    }

    // Calculate deletion date
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + GRACE_PERIOD_DAYS);

    // Gather data summary for the user
    const [
      questionAttemptCount,
      reviewLogCount,
      progressCount,
      osceSessionCount,
    ] = await Promise.all([
      prisma.questionAttempt.count({ where: { userId: user.id } }),
      prisma.reviewLog.count({ where: { userId: user.id } }),
      prisma.userProgress.count({ where: { userId: user.id } }),
      prisma.patientEncounterSession.count({ where: { userId: user.id } }),
    ]);

    // Mark user as pending deletion
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletionScheduledAt: scheduledDate,
        accountStatus: 'pending_deletion',
      },
    });

    log.info('Account deletion initiated', {
      userId: user.id,
      scheduledDate: scheduledDate.toISOString(),
    });

    return {
      status: 200,
      data: {
        status: 'deletion_scheduled',
        scheduledDeletionDate: scheduledDate.toISOString(),
        gracePeriodDays: GRACE_PERIOD_DAYS,
        dataSummary: {
          questionAttempts: questionAttemptCount,
          reviewLogs: reviewLogCount,
          progressRecords: progressCount,
          osceSessions: osceSessionCount,
        },
        message: `Your account is scheduled for deletion on ${scheduledDate.toISOString().split('T')[0]}. You can cancel this within the grace period.`,
      },
    };
  } catch (error) {
    log.error('Account deletion failed', { error });
    return { status: 500, error: 'Failed to initiate account deletion' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * PUT — Cancel pending account deletion
 */
export const onRequestPut = authenticatedEndpoint(EmptySchema, async (context) => {
  const log = createEndpointLogger('user/delete');
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    validateFunctionEnv(context.env, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
    const user = await resolveUserByClerkId(prisma, context.auth.userId);

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    if (!user.deletionScheduledAt) {
      return { status: 400, error: 'No pending deletion to cancel' };
    }

    // Check if grace period has expired
    if (new Date() > user.deletionScheduledAt) {
      return { status: 410, error: 'Grace period has expired. Account deletion is in progress.' };
    }

    // Cancel deletion
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletionScheduledAt: null,
        accountStatus: 'active',
      },
    });

    log.info('Account deletion cancelled', { userId: user.id });

    return {
      status: 200,
      data: {
        status: 'deletion_cancelled',
        message: 'Account deletion has been cancelled. Your data is safe.',
      },
    };
  } catch (error) {
    log.error('Cancel deletion failed', { error });
    return { status: 500, error: 'Failed to cancel account deletion' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * OPTIONS — CORS preflight
 */
