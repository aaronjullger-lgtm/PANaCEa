/**
 * User data synchronization endpoint
 * Handles uploading local data and downloading cloud data
 */

import { neon } from '@neondatabase/serverless';
import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from './_shared/auth';

interface PagesContext {
  request: Request;
  env: Env;
}

interface SyncPayload {
  userId: string;
  performanceRecords?: any[];
  srsItems?: any[];
  savedQuestions?: any[];
}

interface SyncResponse {
  success: boolean;
  message?: string;
  data?: {
    performanceRecords: any[];
    srsItems: any[];
    savedQuestions: any[];
  };
}

/**
 * Resolve Clerk user ID to internal database UUID
 * Creates user if they don't exist
 */
async function resolveUserId(sql: any, clerkId: string): Promise<string> {
  // Try to find existing user
  const existingUser = await sql`
    SELECT id FROM "User" WHERE "clerkId" = ${clerkId}
  `;

  if (existingUser.length > 0) {
    return existingUser[0].id;
  }

  // User doesn't exist, create them
  const newUser = await sql`
    INSERT INTO "User" ("clerkId", "email")
    VALUES (${clerkId}, ${clerkId + '@clerk.temp'})
    RETURNING id
  `;

  return newUser[0].id;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Fetch user's data from the cloud
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { clerkId } = authContext;

    if (!env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return createErrorResponse('Database not configured', 500);
    }

    const sql = neon(env.DATABASE_URL);

    // Resolve clerkId to internal userId
    const internalUserId = await resolveUserId(sql, clerkId);

    // Fetch all user data (execute in parallel for better performance)
    const [performanceRecords, srsItems, savedQuestions] = await Promise.all([
      sql`SELECT * FROM "PerformanceRecord" WHERE "userId" = ${internalUserId}`,
      sql`SELECT * FROM "SRSItem" WHERE "userId" = ${internalUserId}`,
      sql`SELECT * FROM "SavedQuestion" WHERE "userId" = ${internalUserId}`
    ]);

    const response: SyncResponse = {
      success: true,
      message: 'Data retrieved successfully',
      data: {
        performanceRecords,
        srsItems,
        savedQuestions,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Sync GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST: Upload/merge local data to the cloud
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { clerkId } = authContext;

    const payload: SyncPayload = await request.json();

    // Validate payload - note that payload.userId is clerkId
    if (payload.userId !== clerkId) {
      return createErrorResponse('User ID mismatch', 403);
    }

    if (!env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return createErrorResponse('Database not configured', 500);
    }

    const sql = neon(env.DATABASE_URL);

    // Resolve clerkId to internal userId
    const internalUserId = await resolveUserId(sql, clerkId);

    // Begin transaction
    await sql`BEGIN`;

    try {
      // Insert PerformanceRecords
      if (payload.performanceRecords && payload.performanceRecords.length > 0) {
        for (const record of payload.performanceRecords) {
          if (record.id) {
            // If ID is provided, try to insert with it
            await sql`
              INSERT INTO "PerformanceRecord" (
                "id", "userId", "topic", "system", "focus", "difficulty",
                "isCorrect", "timestamp", "questionWordCount", "errorTag",
                "subcategoryName", "conditionName"
              ) VALUES (
                ${record.id},
                ${internalUserId},
                ${record.topic},
                ${record.system || null},
                ${record.focus},
                ${record.difficulty},
                ${record.isCorrect},
                ${record.timestamp},
                ${record.questionWordCount || null},
                ${record.errorTag || null},
                ${record.subcategoryName || null},
                ${record.conditionName || null}
              )
              ON CONFLICT (id) DO NOTHING
            `;
          } else {
            // If no ID, let database generate it
            await sql`
              INSERT INTO "PerformanceRecord" (
                "userId", "topic", "system", "focus", "difficulty",
                "isCorrect", "timestamp", "questionWordCount", "errorTag",
                "subcategoryName", "conditionName"
              ) VALUES (
                ${internalUserId},
                ${record.topic},
                ${record.system || null},
                ${record.focus},
                ${record.difficulty},
                ${record.isCorrect},
                ${record.timestamp},
                ${record.questionWordCount || null},
                ${record.errorTag || null},
                ${record.subcategoryName || null},
                ${record.conditionName || null}
              )
            `;
          }
        }
      }

      // Upsert SRSItems
      if (payload.srsItems && payload.srsItems.length > 0) {
        for (const item of payload.srsItems) {
          await sql`
            INSERT INTO "SRSItem" (
              "userId", "questionId", "interval", "repetition",
              "easiness", "dueDate", "lastReviewed", "quality", "difficulty",
              "stabilityScore"
            ) VALUES (
              ${internalUserId},
              ${item.questionId},
              ${item.interval},
              ${item.repetition},
              ${item.easiness},
              ${item.dueDate},
              ${item.lastReviewed},
              ${item.quality},
              ${item.difficulty},
              ${item.stabilityScore}
            )
            ON CONFLICT ("userId", "questionId") DO UPDATE SET
              "interval" = ${item.interval},
              "repetition" = ${item.repetition},
              "easiness" = ${item.easiness},
              "dueDate" = ${item.dueDate},
              "lastReviewed" = ${item.lastReviewed},
              "quality" = ${item.quality},
              "difficulty" = ${item.difficulty},
              "stabilityScore" = ${item.stabilityScore}
          `;
        }
      }

      // Upsert SavedQuestions
      if (payload.savedQuestions && payload.savedQuestions.length > 0) {
        for (const question of payload.savedQuestions) {
          await sql`
            INSERT INTO "SavedQuestion" (
              "userId", "questionId", "questionText", "correctAnswer",
              "explanation", "topic", "system", "type", "userNote",
              "repetitionLevel", "nextReviewDate"
            ) VALUES (
              ${internalUserId},
              ${question.questionId},
              ${question.questionText},
              ${question.correctAnswer},
              ${question.explanation},
              ${question.topic},
              ${question.system || null},
              ${question.type},
              ${question.userNote || null},
              ${question.repetitionLevel || 1},
              ${question.nextReviewDate || null}
            )
            ON CONFLICT ("userId", "questionId", "type") DO UPDATE SET
              "userNote" = ${question.userNote || null},
              "repetitionLevel" = ${question.repetitionLevel || 1},
              "nextReviewDate" = ${question.nextReviewDate || null}
          `;
        }
      }

      // Commit transaction
      await sql`COMMIT`;
    } catch (error) {
      // Rollback on error
      await sql`ROLLBACK`;
      throw error;
    }

    // Fetch updated data to return (execute in parallel for better performance)
    const [performanceRecords, srsItems, savedQuestions] = await Promise.all([
      sql`SELECT * FROM "PerformanceRecord" WHERE "userId" = ${internalUserId}`,
      sql`SELECT * FROM "SRSItem" WHERE "userId" = ${internalUserId}`,
      sql`SELECT * FROM "SavedQuestion" WHERE "userId" = ${internalUserId}`
    ]);

    const response: SyncResponse = {
      success: true,
      message: 'Data synced successfully',
      data: {
        performanceRecords,
        srsItems,
        savedQuestions,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Sync POST error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
