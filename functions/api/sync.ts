/**
 * User data synchronization endpoint
 * Handles uploading local data and downloading cloud data
 */

// CHANGE 1: Use 'Client' (WebSockets) instead of 'neon' (HTTP) for transaction support
import { Client } from '@neondatabase/serverless';
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

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * Helper: Resolve Clerk ID to Internal DB ID
 * Now accepts a 'Client' instance instead of 'neon' sql tag
 */
async function resolveUserId(client: Client, clerkId: string): Promise<string> {
  // 1. Try to find existing user
  const { rows } = await client.query(
    'SELECT id FROM "User" WHERE "clerkId" = $1', 
    [clerkId]
  );

  if (rows.length > 0) {
    return rows[0].id;
  }

  // 2. User doesn't exist, create them
  // Note: Using a placeholder email. Ideally, extract real email from auth context if available.
  const insertResult = await client.query(
    `INSERT INTO "User" ("clerkId", "email", "updatedAt") 
     VALUES ($1, $2, NOW()) 
     RETURNING id`,
    [clerkId, `${clerkId}@placeholder.panacea.app`]
  );

  return insertResult.rows[0].id;
}

/**
 * GET: Fetch user's data from the cloud
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  // CHANGE 2: Initialize Client
  const client = new Client(env.DATABASE_URL);

  try {
    // CHANGE 3: Must explicitly connect
    await client.connect();

    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { clerkId } = authContext;

    // Resolve clerkId to internal userId
    const internalUserId = await resolveUserId(client, clerkId);

    // Fetch all user data (execute in parallel)
    const [perfRes, srsRes, savedRes] = await Promise.all([
      client.query('SELECT * FROM "PerformanceRecord" WHERE "userId" = $1', [internalUserId]),
      client.query('SELECT * FROM "SRSItem" WHERE "userId" = $1', [internalUserId]),
      client.query('SELECT * FROM "SavedQuestion" WHERE "userId" = $1', [internalUserId])
    ]);

    const response: SyncResponse = {
      success: true,
      message: 'Data retrieved successfully',
      data: {
        performanceRecords: perfRes.rows.map(r => ({
           ...r,
           timestamp: Number(r.timestamp) // Handle BigInt if present
        })),
        srsItems: srsRes.rows,
        savedQuestions: savedRes.rows,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Sync GET error:', error);
    return createErrorResponse('Internal server error', 500);
  } finally {
    // CHANGE 4: Must explicitly close connection
    context.waitUntil(client.end());
  }
}

/**
 * POST: Upload/merge local data to the cloud
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const client = new Client(env.DATABASE_URL);

  try {
    await client.connect();

    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { clerkId } = authContext;
    const payload: SyncPayload = await request.json();

    if (payload.userId !== clerkId) {
      return createErrorResponse('User ID mismatch', 403);
    }

    const internalUserId = await resolveUserId(client, clerkId);

    // Begin transaction (Now works because we are using Client/WebSockets)
    await client.query('BEGIN');

    try {
      // 1. Insert PerformanceRecords
      if (payload.performanceRecords?.length) {
        for (const record of payload.performanceRecords) {
          // Note: using $1, $2 syntax for Client
          await client.query(
            `INSERT INTO "PerformanceRecord" (
              "id", "userId", "topic", "system", "focus", "difficulty",
              "isCorrect", "timestamp", "questionWordCount", "errorTag",
              "subcategoryName", "conditionName"
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT ("id") DO NOTHING`,
            [
              record.id || crypto.randomUUID(), // Ensure ID exists
              internalUserId,
              record.topic,
              record.system || null,
              record.focus,
              record.difficulty,
              record.isCorrect,
              record.timestamp,
              record.questionWordCount || null,
              record.errorTag || null,
              record.subcategoryName || null,
              record.conditionName || null
            ]
          );
        }
      }

      // 2. Upsert SRSItems
      if (payload.srsItems?.length) {
        for (const item of payload.srsItems) {
          await client.query(
            `INSERT INTO "SRSItem" (
              "userId", "questionId", "interval", "repetition",
              "easiness", "dueDate", "lastReviewed", "quality", "difficulty",
              "stabilityScore", "updatedAt"
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             ON CONFLICT ("userId", "questionId") DO UPDATE SET
               "interval" = EXCLUDED."interval",
               "repetition" = EXCLUDED."repetition",
               "easiness" = EXCLUDED."easiness",
               "dueDate" = EXCLUDED."dueDate",
               "lastReviewed" = EXCLUDED."lastReviewed",
               "quality" = EXCLUDED."quality",
               "difficulty" = EXCLUDED."difficulty",
               "stabilityScore" = EXCLUDED."stabilityScore",
               "updatedAt" = NOW()`,
            [
              internalUserId,
              item.questionId,
              item.interval,
              item.repetition,
              item.easiness,
              item.dueDate,
              item.lastReviewed,
              item.quality,
              item.difficulty,
              item.stabilityScore
            ]
          );
        }
      }

      // 3. Upsert SavedQuestions
      if (payload.savedQuestions?.length) {
        for (const question of payload.savedQuestions) {
          await client.query(
            `INSERT INTO "SavedQuestion" (
               "userId", "questionId", "questionText", "correctAnswer",
               "explanation", "topic", "system", "type", "userNote",
               "repetitionLevel", "nextReviewDate", "updatedAt"
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
             ON CONFLICT ("userId", "questionId", "type") DO UPDATE SET
               "userNote" = EXCLUDED."userNote",
               "repetitionLevel" = EXCLUDED."repetitionLevel",
               "nextReviewDate" = EXCLUDED."nextReviewDate",
               "updatedAt" = NOW()`,
            [
              internalUserId,
              question.questionId,
              question.questionText,
              question.correctAnswer,
              question.explanation,
              question.topic,
              question.system || null,
              question.type,
              question.userNote || null,
              question.repetitionLevel || 1,
              question.nextReviewDate || null
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    // Return updated data
    const [perfRes, srsRes, savedRes] = await Promise.all([
      client.query('SELECT * FROM "PerformanceRecord" WHERE "userId" = $1', [internalUserId]),
      client.query('SELECT * FROM "SRSItem" WHERE "userId" = $1', [internalUserId]),
      client.query('SELECT * FROM "SavedQuestion" WHERE "userId" = $1', [internalUserId])
    ]);

    const response: SyncResponse = {
      success: true,
      message: 'Data synced successfully',
      data: {
        performanceRecords: perfRes.rows.map(r => ({...r, timestamp: Number(r.timestamp)})),
        srsItems: srsRes.rows,
        savedQuestions: savedRes.rows,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Sync POST error:', error);
    return createErrorResponse('Internal server error', 500);
  } finally {
    context.waitUntil(client.end());
  }
}
