/**
 * POST /api/user/pearls/[id]/useful - Mark pearl as useful/mastered
 *
 * Sprint 8: My Pearls Dashboard
 * Records that a user found a pearl useful and increments the global vote count
 */

import type { EventContext, KVNamespace } from '@cloudflare/workers-types';
import type { PrismaClient } from '@prisma/client';
import { authenticateRequest } from '../../../_shared/auth';
import { createEdgePrismaClient } from '../../../_shared/prisma-edge';
import { v4 as uuidv4 } from 'uuid';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY?: string;
  CACHE?: KVNamespace;
}

export async function onRequestPost(context: EventContext<Env, string, unknown>): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate user
    const authResult = await authenticateRequest(context.request as unknown as Request, context.env);
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
    const pearlId = pathParts[pathParts.length - 2]; // /api/user/pearls/[id]/useful

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

    // Parse optional notes from request body
    let notes: string | undefined;
    try {
      const body = await context.request.json() as { notes?: string };
      notes = body?.notes;
    } catch {
      // No body or invalid JSON, that's fine
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
      // Upsert user pearl interaction
      await tx.userPearl.upsert({
        where: {
          userId_pearlId: {
            userId,
            pearlId,
          },
        },
        update: {
          markedUseful: true,
          viewedAt: new Date(),
          notes: notes || undefined,
        },
        create: {
          id: uuidv4(),
          userId,
          pearlId,
          markedUseful: true,
          viewedAt: new Date(),
          notes: notes || undefined,
        },
      });

      // Increment global useful votes
      await tx.clinicalPearl.update({
        where: { id: pearlId },
        data: {
          usefulVotes: { increment: 1 },
        },
      });
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pearl marked as mastered',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[POST /api/user/pearls/[id]/useful] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to mark pearl',
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
