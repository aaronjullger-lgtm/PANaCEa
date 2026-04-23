/**
 * API Endpoint: POST /api/user/update-fsrs-params
 *
 * Saves optimized FSRS parameters to UserProgress.fsrsParams.
 * Creates a global fsrsParams entry that applies to all cards.
 *
 * Migrated to authenticatedEndpoint: adds rate limiting (60/min for this
 * write-heavy endpoint), CORS, structured logging, Zod validation.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const UpdateFSRSParamsSchema = z.object({
  body: z.object({
    parameters: z
      .array(z.number())
      .length(21, 'Must be array of exactly 21 numbers'),
    metadata: z
      .object({
        rmse: z.number().optional(),
        logLoss: z.number().optional(),
        recordCount: z.number().optional(),
        improvementVsDefault: z.number().optional(),
      })
      .optional(),
  }),
});

export const onRequestPost = authenticatedEndpoint(
  UpdateFSRSParamsSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { parameters, metadata } = validated?.body ?? validated;

      // Resolve Clerk ID → internal user ID
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      const optimizationData = {
        w: parameters,
        optimizedAt: new Date().toISOString(),
        ...metadata,
      };

      // Apply optimized params to all UserProgress for this user
      const updated = await prisma.userProgress.updateMany({
        where: { userId: user.id },
        data: {
          fsrsParams: optimizationData,
        },
      });

      return {
        data: {
          success: true,
          message: `Updated ${updated.count} progress records with optimized parameters`,
          parameters,
          metadata,
        },
      };
    } catch (error) {
      console.error('Failed to update FSRS parameters:', error);
      return { status: 500, error: 'Failed to update parameters' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 60 }
);
