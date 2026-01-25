/**
 * User data synchronization endpoint
 * Handles uploading local data and downloading cloud data
 *
 * Sprint 3 Security: Updated to use secure middleware pattern
 *
 * DEPLOYMENT NOTE: Clock skew fix with leeway: 5 is active in auth.ts verifyToken call.
 * This ensures tokens are accepted within a 5-second clock tolerance window.
 */

import { z } from 'zod';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from './_shared/prisma-edge';
import { authenticatedEndpoint, withCors } from './_shared/middleware';
import { createEndpointLogger } from './_shared/secureLogger';

// ============================================================================
// SCHEMAS
// ============================================================================

const GetSyncSchema = z.object({}).optional();

const SyncPerformanceRecordSchema = z.object({
  id: z.string().uuid().optional(),
  topic: z.string().max(200),
  system: z.string().max(50).nullable().optional(),
  focus: z.string().max(100),
  difficulty: z.string().max(50),
  isCorrect: z.boolean(),
  timestamp: z.number(),
  questionWordCount: z.number().int().nullable().optional(),
  errorTag: z.string().max(100).nullable().optional(),
  subcategoryName: z.string().max(200).nullable().optional(),
  conditionName: z.string().max(200).nullable().optional(),
});

const SyncSRSItemSchema = z.object({
  questionId: z.string().max(100),
  interval: z.number(),
  repetition: z.number().int(),
  easiness: z.number(),
  dueDate: z.string(),
  lastReviewed: z.string(),
  quality: z.number().int().min(0).max(5),
  difficulty: z.string().max(50).optional(),
  stabilityScore: z.number().optional(),
  updatedAt: z.string().optional(),
});

const SyncSavedQuestionSchema = z.object({
  questionId: z.string().max(100),
  questionText: z.string().max(5000),
  correctAnswer: z.string().max(500),
  explanation: z.string().max(10000).optional(),
  topic: z.string().max(200),
  system: z.string().max(50).optional(),
  type: z.enum(['saved', 'flagged', 'missed']),
  userNote: z.string().max(2000).optional(),
  repetitionLevel: z.number().int().optional(),
  nextReviewDate: z.string().optional(),
  updatedAt: z.string().optional(),
});

const PostSyncSchema = z.object({
  userId: z.string().min(1).max(100),
  performanceRecords: z.array(SyncPerformanceRecordSchema).max(1000).optional(),
  srsItems: z.array(SyncSRSItemSchema).max(1000).optional(),
  savedQuestions: z.array(SyncSavedQuestionSchema).max(500).optional(),
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve Clerk ID to Internal DB ID
 */
async function resolveUserId(prisma: EdgePrismaClient, clerkId: string): Promise<string> {
  const existingUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (existingUser) {
    return existingUser.id;
  }

  // User doesn't exist, create them
  const newUser = await prisma.user.create({
    data: {
      clerkId,
      email: `${clerkId}@placeholder.panacea.app`,
    },
    select: { id: true },
  });

  return newUser.id;
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /api/sync
 * Fetch user's data from the cloud
 */
export const onRequestGet = authenticatedEndpoint(
  GetSyncSchema,
  async (context) => {
    const log = createEndpointLogger('GET /api/sync', context.auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(context.env.DATABASE_URL);

      // Resolve clerkId to internal userId
      const internalUserId = await resolveUserId(prisma, context.auth.userId);

      // Fetch all user data in parallel
      const [performanceRecords, srsItems, savedQuestions] = await Promise.all([
        prisma.performanceRecord.findMany({
          where: { userId: internalUserId },
        }),
        prisma.sRSItem.findMany({
          where: { userId: internalUserId },
        }),
        prisma.savedQuestion.findMany({
          where: { userId: internalUserId },
        }),
      ]);

      log.info('Sync data retrieved', {
        performanceRecords: performanceRecords.length,
        srsItems: srsItems.length,
        savedQuestions: savedQuestions.length,
      });

      type PerformanceRecordItem = (typeof performanceRecords)[0];
      return {
        data: {
          success: true,
          message: 'Data retrieved successfully',
          data: {
            performanceRecords: performanceRecords.map((r: PerformanceRecordItem) => ({
              ...r,
              timestamp: Number(r.timestamp),
            })),
            srsItems,
            savedQuestions,
          },
        },
      };
    } catch (error) {
      log.error('Sync GET failed', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);

/**
 * POST /api/sync
 * Upload/merge local data to the cloud
 */
export const onRequestPost = authenticatedEndpoint(PostSyncSchema, async (context) => {
  const log = createEndpointLogger('POST /api/sync', context.auth.userId);
  let prisma: EdgePrismaClient | null = null;

  const payload = context.validated;

  // Verify user ID matches authenticated user
  if (payload.userId !== context.auth.userId) {
    log.warn('User ID mismatch', {
      expected: context.auth.userId,
      received: payload.userId,
    });
    return { status: 403, error: 'User ID mismatch' };
  }

  try {
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Resolve user ID
    const internalUserId = await resolveUserId(prisma, context.auth.userId);

    // Process data in a transaction
    await prisma.$transaction(async (tx: any) => {
      // 1. Insert PerformanceRecords
      if (payload.performanceRecords?.length) {
        for (const record of payload.performanceRecords) {
          const recordId = record.id || crypto.randomUUID();
          await tx.performanceRecord.upsert({
            where: { id: recordId },
            create: {
              id: recordId,
              userId: internalUserId,
              topic: record.topic,
              system: record.system || null,
              focus: record.focus,
              difficulty: record.difficulty,
              isCorrect: record.isCorrect,
              timestamp: BigInt(record.timestamp),
              questionWordCount: record.questionWordCount || null,
              errorTag: record.errorTag || null,
              subcategoryName: record.subcategoryName || null,
              conditionName: record.conditionName || null,
            },
            update: {},
          });
        }
      }

      // 2. Upsert SRSItems with Conflict Resolution
      if (payload.srsItems?.length) {
        for (const item of payload.srsItems) {
          const existing = await tx.sRSItem.findUnique({
            where: {
              userId_questionId: {
                userId: internalUserId,
                questionId: item.questionId,
              },
            },
          });

          // Last Write Wins based on updatedAt
          if (
            existing &&
            item.updatedAt &&
            new Date(existing.updatedAt) > new Date(item.updatedAt)
          ) {
            continue;
          }

          const data = {
            userId: internalUserId,
            questionId: item.questionId,
            interval: item.interval,
            repetition: item.repetition,
            easiness: item.easiness,
            dueDate: new Date(item.dueDate),
            lastReviewed: new Date(item.lastReviewed),
            quality: item.quality,
            difficulty: item.difficulty,
            stabilityScore: item.stabilityScore,
            ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
          };

          if (existing) {
            await tx.sRSItem.update({
              where: { id: existing.id },
              data,
            });
          } else {
            await tx.sRSItem.create({ data });
          }
        }
      }

      // 3. Upsert SavedQuestions with Conflict Resolution
      if (payload.savedQuestions?.length) {
        for (const item of payload.savedQuestions) {
          const existing = await tx.savedQuestion.findUnique({
            where: {
              userId_questionId_type: {
                userId: internalUserId,
                questionId: item.questionId,
                type: item.type,
              },
            },
          });

          // Last Write Wins based on updatedAt
          if (
            existing &&
            item.updatedAt &&
            new Date(existing.updatedAt) > new Date(item.updatedAt)
          ) {
            continue;
          }

          const data = {
            userId: internalUserId,
            questionId: item.questionId,
            questionText: item.questionText,
            correctAnswer: item.correctAnswer,
            explanation: item.explanation,
            topic: item.topic,
            system: item.system,
            type: item.type,
            userNote: item.userNote,
            repetitionLevel: item.repetitionLevel,
            nextReviewDate: item.nextReviewDate,
            ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
          };

          if (existing) {
            await tx.savedQuestion.update({
              where: { id: existing.id },
              data,
            });
          } else {
            await tx.savedQuestion.create({ data });
          }
        }
      }
    });

    // Fetch updated data
    const [performanceRecords, srsItems, savedQuestions] = await Promise.all([
      prisma.performanceRecord.findMany({
        where: { userId: internalUserId },
      }),
      prisma.sRSItem.findMany({
        where: { userId: internalUserId },
      }),
      prisma.savedQuestion.findMany({
        where: { userId: internalUserId },
      }),
    ]);

    log.info('Sync completed', {
      performanceRecords: performanceRecords.length,
      srsItems: srsItems.length,
      savedQuestions: savedQuestions.length,
    });

    type PerformanceRecordResult = (typeof performanceRecords)[0];
    return {
      data: {
        success: true,
        message: 'Data synced successfully',
        data: {
          performanceRecords: performanceRecords.map((r: PerformanceRecordResult) => ({
            ...r,
            timestamp: Number(r.timestamp),
          })),
          srsItems,
          savedQuestions,
        },
      },
    };
  } catch (error) {
    log.error('Sync POST failed', error);
    return { status: 500, error: 'Internal server error' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * OPTIONS handler for CORS preflight
 */
export const onRequestOptions = withCors();
