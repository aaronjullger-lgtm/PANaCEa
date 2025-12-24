/**
 * POST /api/srs/sync
 * Sync SRS items from localStorage to database for authenticated users
 */

import { authenticateRequest, createErrorResponse, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface SRSItemData {
  questionId: string;
  interval: number;
  repetition: number;
  easiness: number;
  dueDate: string;
  lastReviewed: string;
  quality: number;
  difficulty: number;
  stabilityScore: number;
  fsrsStability?: number;
  fsrsDifficulty?: number;
  fsrsState?: number;
  fsrsLastReview?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Authenticate request
  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const { userId } = authContext;

  if (!env.DATABASE_URL) {
    return createErrorResponse('Database not configured', 500);
  }

  try {
    const body = await request.json() as { items: SRSItemData[] };
    
    if (!body.items || !Array.isArray(body.items)) {
      return createErrorResponse('Invalid request body', 400);
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const now = new Date();

    let synced = 0;
    let skipped = 0;

    // Sync each item
    for (const item of body.items) {
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
        console.error(`[SRS Sync] Error syncing item ${item.questionId}:`, itemError);
        // Continue with other items
      }
    }

    await prisma.$disconnect();

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        skipped,
        total: body.items.length,
        timestamp: now.toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SRS Sync] Error:', error);
    return createErrorResponse('Sync failed', 500);
  }
}
