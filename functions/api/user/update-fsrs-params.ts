/**
 * API Endpoint: POST /api/user/update-fsrs-params
 *
 * Saves optimized FSRS parameters to UserProgress.fsrsParams
 * This creates a global fsrsParams entry that applies to all cards
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

/**
 * Schema for FSRS parameters update
 */
const UpdateFsrsParamsSchema = z.object({
  parameters: z.array(z.number()).length(21, 'Must be an array of exactly 21 numbers'),
  metadata: z.object({
    rmse: z.number().optional(),
    logLoss: z.number().optional(),
    recordCount: z.number().optional(),
    improvementVsDefault: z.number().optional(),
  }).optional(),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  UpdateFsrsParamsSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const userId = auth.userId;
    const body = validated;

    let prisma;

    try {
      // Connect to database
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Store optimization metadata in User table (if it exists)
      // This will be a new field we'll add in a migration
      const optimizationData = {
        w: body.parameters,
        optimizedAt: new Date().toISOString(),
        ...body.metadata,
      };

      // Apply optimized params to all UserProgress for this user (MAIN session scheduling only).
      // Data isolation: these params are used only for FSRS scheduler/optimizer; CRAM/RAPID_RECALL
      // and OSCE do not use or aggregate this table.
      const updated = await prisma.userProgress.updateMany({
        where: { userId },
        data: {
          fsrsParams: optimizationData,
        },
      });

      return {
        data: {
          success: true,
          message: `Updated ${updated.count} progress records with optimized parameters`,
          parameters: body.parameters,
          metadata: body.metadata,
        }
      };
    } catch (error) {
      console.error('Failed to update FSRS parameters:', error);
      return {
        status: 500,
        error: 'Failed to update parameters'
      };
    } finally {
      if (prisma) {
        await safePrismaDisconnect(prisma);
      }
    }
  }
);
