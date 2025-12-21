/**
 * User data synchronization endpoint
 * Handles uploading local data and downloading cloud data
 * 
 * DEPLOYMENT NOTE: Clock skew fix with leeway: 5 is active in auth.ts verifyToken call.
 * This ensures tokens are accepted within a 5-second clock tolerance window.
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from './_shared/auth';
import { createEdgePrismaClient, type EdgePrismaClient } from './_shared/prisma-edge';

interface PagesContext {
  request: Request;
  env: Env;
}

// Typed sync payload interfaces
interface SyncPerformanceRecord {
  id?: string;
  topic: string;
  system?: string | null;
  focus: string;
  difficulty: number;
  isCorrect: boolean;
  timestamp: number;
  questionWordCount?: number | null;
  errorTag?: string | null;
  subcategoryName?: string | null;
  conditionName?: string | null;
}

interface SyncSRSItem {
  questionId: string;
  interval: number;
  repetition: number;
  easiness: number;
  dueDate: string;
  lastReviewed: string;
  quality: number;
  difficulty: number;
  stabilityScore?: number;
  updatedAt?: string;
}

interface SyncSavedQuestion {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  explanation?: string;
  topic: string;
  system?: string;
  type: 'missed' | 'flagged';
  userNote?: string;
  repetitionLevel?: number;
  nextReviewDate?: string;
  updatedAt?: string;
}

interface SyncPayload {
  userId: string;
  performanceRecords?: SyncPerformanceRecord[];
  srsItems?: SyncSRSItem[];
  savedQuestions?: SyncSavedQuestion[];
}

interface SyncResponse {
  success: boolean;
  message?: string;
  data?: {
    performanceRecords: SyncPerformanceRecord[];
    srsItems: SyncSRSItem[];
    savedQuestions: SyncSavedQuestion[];
  };
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * Helper: Resolve Clerk ID to Internal DB ID
 * Uses Prisma ORM for database operations
 */
async function resolveUserId(prisma: EdgePrismaClient, clerkId: string): Promise<string> {
  try {
    // 1. Try to find existing user
    const existingUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (existingUser) {
      return existingUser.id;
    }

    // 2. User doesn't exist, create them
    // Note: Using a placeholder email. Ideally, extract real email from auth context if available.
    const newUser = await prisma.user.create({
      data: {
        clerkId,
        email: `${clerkId}@placeholder.panacea.app`,
      },
      select: { id: true },
    });

    return newUser.id;
  } catch (error) {
    console.error('[SYNC] Error resolving user ID:', {
      clerkId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * GET: Fetch user's data from the cloud
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  // Initialize edge-compatible Prisma client
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Authentication handled by middleware with structured logging
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      console.error('[SYNC GET] Authentication failed');
      return createErrorResponse('Unauthorized', 401);
    }

    const { clerkId } = authContext;
    // User ID resolution

    // Resolve clerkId to internal userId
    const internalUserId = await resolveUserId(prisma, clerkId);
    // Fetch user data

    // Fetch all user data (execute in parallel)
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

    // Data fetched successfully - logged by middleware

    const response: SyncResponse = {
      success: true,
      message: 'Data retrieved successfully',
      data: {
        performanceRecords: performanceRecords.map(r => ({
          ...r,
          timestamp: Number(r.timestamp), // Handle BigInt if present
        })),
        srsItems,
        savedQuestions,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('[SYNC GET] Error occurred:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return createErrorResponse('Internal server error', 500);
  } finally {
    // Clean up Prisma connection asynchronously
    await prisma.$disconnect().catch((err) => {
      console.error('[SYNC GET] Error disconnecting Prisma:', err);
    });
  }
}

/**
 * POST: Upload/merge local data to the cloud
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  
  // Initialize edge-compatible Prisma client
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Authentication handled by middleware
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      console.error('[SYNC POST] Authentication failed');
      return createErrorResponse('Unauthorized', 401);
    }

    const { clerkId } = authContext;
    // Parse request payload
    const payload: SyncPayload = await request.json();

    if (payload.userId !== clerkId) {
      console.error('[SYNC POST] User ID mismatch:', { expected: clerkId, received: payload.userId });
      return createErrorResponse('User ID mismatch', 403);
    }

    // Resolve user ID
    const internalUserId = await resolveUserId(prisma, clerkId);

    // Start database transaction
    // Begin transaction with Prisma
    await prisma.$transaction(async (tx) => {
      // 1. Insert PerformanceRecords
      if (payload.performanceRecords?.length) {
        // Upsert performance records
        for (const record of payload.performanceRecords) {
          // Ensure we use a consistent ID for both where and create
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
            update: {}, // Do nothing on conflict
          });
        }
      }

      // 2. Upsert SRSItems with Conflict Resolution
      if (payload.srsItems?.length) {
        // Upsert SRS items
        for (const item of payload.srsItems) {
          const existing = await tx.sRSItem.findUnique({
            where: {
              userId_questionId: {
                userId: internalUserId,
                questionId: item.questionId,
              },
            },
          });

          // Conflict Resolution: Last Write Wins based on updatedAt
          if (existing && item.updatedAt && new Date(existing.updatedAt) > new Date(item.updatedAt)) {
            // Skip SRS item - server version is newer
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
            // Only update updatedAt if provided, otherwise let Prisma handle it or use current time
            ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
          };

          if (existing) {
            await tx.sRSItem.update({
              where: { id: existing.id },
              data,
            });
          } else {
            await tx.sRSItem.create({
              data,
            });
          }
        }
      }

      // 3. Upsert SavedQuestions with Conflict Resolution
      if (payload.savedQuestions?.length) {
        // Upsert saved questions
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

          // Conflict Resolution: Last Write Wins based on updatedAt
          if (existing && item.updatedAt && new Date(existing.updatedAt) > new Date(item.updatedAt)) {
             // Skip saved question - server version is newer
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
            await tx.savedQuestion.create({
              data,
            });
          }
        }
      }
    });

    // Transaction completed, fetch updated data

    // Return updated data
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

    // Data synced successfully

    const response: SyncResponse = {
      success: true,
      message: 'Data synced successfully',
      data: {
        performanceRecords: performanceRecords.map(r => ({
          ...r,
          timestamp: Number(r.timestamp),
        })),
        srsItems,
        savedQuestions,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('[SYNC POST] Error occurred:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return createErrorResponse('Internal server error', 500);
  } finally {
    // Clean up Prisma connection asynchronously
    await prisma.$disconnect().catch((err) => {
      console.error('[SYNC POST] Error disconnecting Prisma:', err);
    });
  }
}
