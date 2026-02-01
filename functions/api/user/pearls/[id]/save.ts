/**
 * POST/DELETE /api/user/pearls/[id]/save - Toggle pearl saved status
 *
 * Sprint 8: My Pearls Dashboard
 * Allows users to bookmark/save pearls for later review
 */

import type { EventContext, KVNamespace } from '@cloudflare/workers-types';
import { authenticateRequest } from '../../../_shared/auth';
import { createEdgePrismaClient } from '../../../_shared/prisma-edge';
import { v4 as uuidv4 } from 'uuid';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY?: string;
  CACHE?: KVNamespace;
}

export async function onRequestPost(
  context: EventContext<Env, string, unknown>
): Promise<Response> {
  return handleSaveToggle(context, true);
}

export async function onRequestDelete(
  context: EventContext<Env, string, unknown>
): Promise<Response> {
  return handleSaveToggle(context, false);
}

async function handleSaveToggle(
  context: EventContext<Env, string, unknown>,
  shouldSave: boolean
): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate user
    const authResult = await authenticateRequest(
      context.request as unknown as Request,
      context.env
    );
    if (!authResult?.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = authResult.userId;

    // Extract pearl ID from URL path
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/');
    const pearlId = pathParts[pathParts.length - 2]; // /api/user/pearls/[id]/save

    if (!pearlId) {
      return new Response(JSON.stringify({ error: 'Pearl ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if pearl exists
    const pearl = await prisma.clinicalPearl.findUnique({
      where: { id: pearlId },
      select: { id: true },
    });

    if (!pearl) {
      return new Response(JSON.stringify({ error: 'Pearl not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upsert user pearl interaction
    await prisma.userPearl.upsert({
      where: {
        userId_pearlId: {
          userId,
          pearlId,
        },
      },
      update: {
        isSaved: shouldSave,
        savedAt: shouldSave ? new Date() : null,
      },
      create: {
        id: uuidv4(),
        userId,
        pearlId,
        isSaved: shouldSave,
        savedAt: shouldSave ? new Date() : null,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        saved: shouldSave,
        message: shouldSave ? 'Pearl saved' : 'Pearl unsaved',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[/api/user/pearls/[id]/save] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to update save status',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
