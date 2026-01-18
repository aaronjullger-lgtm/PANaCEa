/**
 * POST /api/srs/sync
 * Sync SRS items from localStorage to database for authenticated users
 * 
 * Security: Authenticated endpoint with Zod validation
 * Sprint: Security Hardening Sprint 3 - Middleware Pattern
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { SRSSyncSchema } from '../_shared/schemas';
import { logger } from '../_shared/secureLogger';

// Handle CORS preflight
export const onRequestOptions = withCors();

// POST handler with authentication + validation
export const onRequestPost = authenticatedEndpoint(SRSSyncSchema, async (context) => {
  const { env, auth, validated } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Look up user by clerkId to get internal database ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      logger.warn('SRS sync: User not found in database', { clerkId: auth.userId });
      return {
        status: 404,
        error: 'User not found. Please refresh and try again.',
      };
    }

    const userId = user.id;
    const { items } = validated;
    const now = new Date();

    let synced = 0;
    let skipped = 0;

    // Sync each item
    for (const item of items) {
      try {
        // Check if item already exists
        const existing = await prisma.sRSItem.findFirst({
          where: {
            userId,
            questionId: item.questionId,
          },
        });

        if (existing) {
          // Update only if local version is newer
          const localUpdated = new Date(item.lastReviewed);
          if (localUpdated > existing.updatedAt) {
            await prisma.sRSItem.update({
              where: { id: existing.id },
              data: {
                interval: item.interval,
                repetition: item.repetition,
                easiness: item.easiness,
                dueDate: new Date(item.dueDate),
                lastReviewed: new Date(item.lastReviewed),
                quality: item.quality,
                difficulty: item.difficulty,
                stabilityScore: item.stabilityScore,
                fsrsStability: item.fsrsStability,
                fsrsDifficulty: item.fsrsDifficulty,
                fsrsState: item.fsrsState,
                fsrsLastReview: item.fsrsLastReview ? new Date(item.fsrsLastReview) : null,
                updatedAt: now,
              },
            });
            synced++;
          } else {
            skipped++;
          }
        } else {
          // Create new item
          await prisma.sRSItem.create({
            data: {
              userId,
              questionId: item.questionId,
              interval: item.interval,
              repetition: item.repetition,
              easiness: item.easiness,
              dueDate: new Date(item.dueDate),
              lastReviewed: new Date(item.lastReviewed),
              quality: item.quality,
              difficulty: item.difficulty,
              stabilityScore: item.stabilityScore,
              fsrsStability: item.fsrsStability,
              fsrsDifficulty: item.fsrsDifficulty,
              fsrsState: item.fsrsState,
              fsrsLastReview: item.fsrsLastReview ? new Date(item.fsrsLastReview) : null,
              createdAt: now,
              updatedAt: now,
            },
          });
          synced++;
        }
      } catch (itemError) {
        logger.error('SRS sync: Error syncing individual item', itemError, {
          questionId: item.questionId,
          userId: auth.userId,
        });
        // Continue with other items
      }
    }

    logger.info('SRS sync completed', {
      userId: auth.userId,
      synced,
      skipped,
      total: items.length,
    });

    return {
      status: 200,
      data: {
        success: true,
        synced,
        skipped,
        total: items.length,
        timestamp: now.toISOString(),
      },
    };
  } catch (error) {
    logger.error('SRS sync failed', error, { userId: auth.userId });
    return {
      status: 500,
      error: 'Sync failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});