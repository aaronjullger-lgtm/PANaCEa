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
  difficulty: z.string().max(50).optional().default('medium'),
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
  difficulty: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val !== undefined ? String(val) : undefined)),
  stabilityScore: z.number().optional(),
  updatedAt: z.string().optional(),
});

const SyncSavedQuestionSchema = z.object({
  questionId: z.string().max(100).optional(),
  questionText: z.string().max(5000).optional(),
  correctAnswer: z.string().max(500).optional(),
  explanation: z.string().max(10000).optional(),
  topic: z.string().max(200).optional(),
  system: z.string().max(50).nullable().optional(),
  type: z.enum(['saved', 'flagged', 'missed']),
  userNote: z.string().max(2000).nullable().optional(),
  repetitionLevel: z.number().int().optional(),
  nextReviewDate: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  taskType: z.string().max(50).nullable().optional(),
  id: z.string().optional(),
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswerIndex: z.number().optional(),
  rationale: z.string().optional(),
  condition: z.string().optional(),
  conditionId: z.string().nullable().optional(),
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

// Batch size - MUST stay under Cloudflare's 50 subrequest limit
// Each batch makes ~3-5 queries (createMany, findMany for conflicts, etc.)
// So we process fewer items but use bulk operations
const BATCH_SIZE = 25;

// Retry configuration for transient Accelerate failures
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;

/**
 * Check if an error is a transient Accelerate connection error that can be retried
 */
function isTransientAccelerateError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('unable to connect to the accelerate api') ||
    message.includes('network') ||
    message.includes('dns') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('socket hang up')
  );
}

/**
 * Execute a database operation with retry logic for transient failures
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  log: ReturnType<typeof createEndpointLogger>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientAccelerateError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      log.warn(
        `${operationName} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Process array in batches to avoid Accelerate payload limits
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

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
  const now = new Date();
  const newUser = await prisma.user.create({
    data: {
      clerkId,
      email: `${clerkId}@placeholder.panacea.app`,
      updatedAt: now,
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Sync GET failed', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { status: 500, error: `Sync GET failed: ${errorMessage}` };
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

    // Resolve user ID with retry for transient failures
    const internalUserId = await withRetry(
      () => resolveUserId(prisma!, context.auth.userId),
      'resolveUserId',
      log
    );

    // Process data in BATCHED transactions to avoid Accelerate payload limits
    // CRITICAL: Must stay under Cloudflare's 50 subrequest limit per request
    // Using bulk operations (createMany, updateMany) instead of per-item queries

    // 1. Insert PerformanceRecords using createMany with skipDuplicates
    // This is efficient because performance records are insert-only (no updates needed)
    if (payload.performanceRecords?.length) {
      const recordsToInsert = payload.performanceRecords.map((record) => ({
        id: record.id || crypto.randomUUID(),
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
      }));

      // Process in chunks to avoid payload size limits
      const batches = chunk(recordsToInsert, BATCH_SIZE);
      for (const batch of batches) {
        await withRetry(
          () =>
            prisma!.performanceRecord.createMany({
              data: batch,
              skipDuplicates: true, // Ignore records that already exist
            }),
          'performanceRecords createMany',
          log
        );
      }
    }

    // 2. SRSItems - Use a simplified approach: delete + insert for the user's items
    // This avoids per-item conflict resolution queries
    if (payload.srsItems?.length) {
      // Get all question IDs being synced
      const questionIds = payload.srsItems.map((item) => item.questionId);

      // Delete existing records for these question IDs (single query)
      await withRetry(
        () =>
          prisma!.sRSItem.deleteMany({
            where: {
              userId: internalUserId,
              questionId: { in: questionIds },
            },
          }),
        'srsItems deleteMany',
        log
      );

      // Insert all items fresh (single createMany per batch)
      const now = new Date();
      const itemsToInsert = payload.srsItems.map((item) => ({
        id: crypto.randomUUID(),
        userId: internalUserId,
        questionId: item.questionId,
        interval: item.interval,
        repetition: item.repetition,
        easiness: item.easiness,
        dueDate: new Date(item.dueDate),
        lastReviewed: new Date(item.lastReviewed),
        quality: item.quality,
        difficulty:
          item.difficulty !== undefined && item.difficulty !== null
            ? Number.parseFloat(String(item.difficulty))
            : 0,
        stabilityScore: item.stabilityScore ?? 0,
        createdAt: now,
        updatedAt: now,
      }));

      const batches = chunk(itemsToInsert, BATCH_SIZE);
      for (const batch of batches) {
        await withRetry(
          () =>
            prisma!.sRSItem.createMany({
              data: batch,
              skipDuplicates: true,
            }),
          'srsItems createMany',
          log
        );
      }
    }

    // 3. SavedQuestions - Same approach: delete + insert
    if (payload.savedQuestions?.length) {
      // Build the composite keys for deletion
      const keysToDelete = payload.savedQuestions
        .filter((item) => {
          const questionText = item.questionText || item.question || '';
          return questionText.length > 0; // Only process items with content
        })
        .map((item) => ({
          questionId: item.questionId || item.id || '',
          type: item.type,
        }))
        .filter((k) => k.questionId); // Filter out empty IDs

      if (keysToDelete.length > 0) {
        // Delete existing records for these question IDs and types
        // Prisma doesn't support deleteMany with composite keys, so we use OR conditions
        const deleteConditions = keysToDelete.map((k) => ({
          userId: internalUserId,
          questionId: k.questionId,
          type: k.type,
        }));

        await withRetry(
          () =>
            prisma!.savedQuestion.deleteMany({
              where: {
                OR: deleteConditions,
              },
            }),
          'savedQuestions deleteMany',
          log
        );
      }

      // Insert all items fresh
      const itemsToInsert = payload.savedQuestions
        .map((item) => {
          const questionId = item.questionId || item.id || crypto.randomUUID();
          const questionText = item.questionText || item.question || '';
          const correctAnswer =
            item.correctAnswer ||
            (item.options && item.correctAnswerIndex !== undefined
              ? item.options[item.correctAnswerIndex]
              : '');
          const explanation = item.explanation || item.rationale || '';
          const topic = item.topic || item.condition || '';

          if (!questionText) return null;

          const updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date();
          return {
            id: crypto.randomUUID(),
            userId: internalUserId,
            questionId,
            questionText,
            correctAnswer: correctAnswer || '',
            explanation,
            topic: topic || 'general',
            system: item.system ?? null,
            type: item.type,
            userNote: item.userNote ?? null,
            repetitionLevel: item.repetitionLevel ?? 1,
            nextReviewDate: item.nextReviewDate ?? null,
            taskType: item.taskType ?? null,
            conditionId: item.conditionId ?? null,
            medicalContentId: item.medicalContentId ?? null,
            createdAt: item.createdAt ? new Date(item.createdAt) : updatedAt,
            updatedAt,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (itemsToInsert.length > 0) {
        const batches = chunk(itemsToInsert, BATCH_SIZE);
        for (const batch of batches) {
          await withRetry(
            () =>
              prisma!.savedQuestion.createMany({
                data: batch,
                skipDuplicates: true,
              }),
            'savedQuestions createMany',
            log
          );
        }
      }
    }

    // Fetch updated data with retry (3 queries in parallel)
    const [performanceRecords, srsItems, savedQuestions] = await withRetry(
      () =>
        Promise.all([
          prisma!.performanceRecord.findMany({
            where: { userId: internalUserId },
          }),
          prisma!.sRSItem.findMany({
            where: { userId: internalUserId },
          }),
          prisma!.savedQuestion.findMany({
            where: { userId: internalUserId },
          }),
        ]),
      'fetchUpdatedData',
      log
    );

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Sync POST failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { status: 500, error: `Sync POST failed: ${errorMessage}` };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * OPTIONS handler for CORS preflight
 */
export const onRequestOptions = withCors();
