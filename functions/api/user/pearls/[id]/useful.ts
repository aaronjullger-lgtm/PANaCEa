/**
 * POST /api/user/pearls/[id]/useful - Mark pearl as useful/mastered
 *
 * Sprint 8: My Pearls Dashboard
 * Records that a user found a pearl useful and increments the global vote count.
 *
 * Migrated to authenticatedEndpoint: adds rate limiting (300/min), CORS,
 * structured logging, error handling.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { v4 as uuidv4 } from 'uuid';

const UsefulSchema = z.object({
  body: z
    .object({
      notes: z.string().max(2000).optional(),
    })
    .optional()
    .default({}),
});

export const onRequestPost = authenticatedEndpoint(
  UsefulSchema,
  async (context) => {
    const { env, auth, validated, params } = context;
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

      const notes = validated?.body?.notes || validated?.notes;

      // Use transaction to ensure atomicity
      await prisma.$transaction(async (tx: any) => {
        // Upsert user pearl interaction
        await tx.userPearl.upsert({
          where: {
            userId_pearlId: {
              userId: auth.userId,
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
            userId: auth.userId,
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

      return {
        data: {
          success: true,
          message: 'Pearl marked as mastered',
        },
      };
    } catch (error) {
      console.error('[POST /api/user/pearls/[id]/useful] Error:', error);
      return { status: 500, error: 'Failed to mark pearl' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
