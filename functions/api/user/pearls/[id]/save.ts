/**
 * POST/DELETE /api/user/pearls/[id]/save - Toggle pearl saved status
 *
 * Sprint 8: My Pearls Dashboard
 * Allows users to bookmark/save pearls for later review.
 *
 * Migrated to authenticatedEndpoint: adds rate limiting (300/min), CORS,
 * structured logging, error handling.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { v4 as uuidv4 } from 'uuid';

export const onRequestOptions = withCors();

async function handleSaveToggle(context: any, shouldSave: boolean) {
  const { env, auth, params } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const pearlId = params?.id;
    if (!pearlId) {
      return { status: 400, error: 'Pearl ID required' };
    }

    // Check if pearl exists
    const pearl = await prisma.clinicalPearl.findUnique({
      where: { id: pearlId },
      select: { id: true },
    });
    if (!pearl) {
      return { status: 404, error: 'Pearl not found' };
    }

    // Upsert user pearl interaction
    await prisma.userPearl.upsert({
      where: {
        userId_pearlId: {
          userId: auth.userId,
          pearlId,
        },
      },
      update: {
        isSaved: shouldSave,
        savedAt: shouldSave ? new Date() : null,
      },
      create: {
        id: uuidv4(),
        userId: auth.userId,
        pearlId,
        isSaved: shouldSave,
        savedAt: shouldSave ? new Date() : null,
      },
    });

    return {
      data: {
        success: true,
        saved: shouldSave,
        message: shouldSave ? 'Pearl saved' : 'Pearl unsaved',
      },
    };
  } catch (error) {
    console.error('[/api/user/pearls/[id]/save] Error:', error);
    return { status: 500, error: 'Failed to update save status' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

export const onRequestPost = authenticatedEndpoint(
  z.object({}).passthrough(),
  async (context) => handleSaveToggle(context, true)
);

export const onRequestDelete = authenticatedEndpoint(
  z.object({}).passthrough(),
  async (context) => handleSaveToggle(context, false)
);
