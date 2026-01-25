/**
 * API Endpoint: POST /api/user/update-fsrs-params
 *
 * Saves optimized FSRS parameters to UserProgress.fsrsParams
 * This creates a global fsrsParams entry that applies to all cards
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
}

interface RequestBody {
  parameters: number[];
  metadata?: {
    rmse?: number;
    logLoss?: number;
    recordCount?: number;
    improvementVsDefault?: number;
  };
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  let prisma;

  try {
    // Authenticate request
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth || !auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = auth.userId;

    // Parse request body
    const body: RequestBody = await context.request.json();

    if (!body.parameters || !Array.isArray(body.parameters) || body.parameters.length !== 21) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters: must be array of 21 numbers' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate all parameters are numbers
    if (!body.parameters.every((p: number) => typeof p === 'number' && !isNaN(p))) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters: all values must be valid numbers' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Connect to database
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Store optimization metadata in User table (if it exists)
    // This will be a new field we'll add in a migration
    const optimizationData = {
      w: body.parameters,
      optimizedAt: new Date().toISOString(),
      ...body.metadata,
    };

    // For now, we'll update all UserProgress records for this user
    // In production, you might want to create a User.optimizedFSRSParams field
    const updated = await prisma.userProgress.updateMany({
      where: { userId },
      data: {
        fsrsParams: optimizationData,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updated.count} progress records with optimized parameters`,
        parameters: body.parameters,
        metadata: body.metadata,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to update FSRS parameters:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to update parameters',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
};
