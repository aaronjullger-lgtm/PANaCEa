/**
 * API: GET /api/study/resolve-blueprint
 *
 * Returns the active exam blueprint for the authenticated user based on
 * their learner stage. No request body needed — everything is derived
 * from the user's profile in the database.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveBlueprint, checkRotationTransition } from '../../../lib/services/learnerStageBlueprint';

// GET has no body — use empty schema
const ResolveBlueprintSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ResolveBlueprintSchema,
  async (context) => {
    const { env, auth } = context;
    const logger = createEndpointLogger('/api/study/resolve-blueprint');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Fetch user profile fields needed for blueprint resolution
      const user = await prisma.user.findUniqueOrThrow({
        where: { clerkId: auth.userId },
        select: {
          id: true,
          trainingPhase: true,
          lifecycleRole: true,
          currentRotation: true,
          rotationEndDate: true,
          eorTestDate: true,
          examDate: true,
          yearInProgram: true,
        },
      });

      const blueprint = await resolveBlueprint(prisma, user);

      // Check if clinical rotation has ended and user should transition
      const transition = checkRotationTransition(user);

      logger.info('Blueprint resolved', {
        stage: blueprint.stage,
        examTypes: blueprint.examTypes,
        systemCount: Object.keys(blueprint.weights).length,
        rotationTransition: transition.shouldTransition,
      });

      return new Response(JSON.stringify({
        ...blueprint,
        rotationTransition: transition.shouldTransition ? transition.message : null,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      logger.error('Blueprint resolution failed', { error: err.message });
      return new Response(
        JSON.stringify({ error: err.message ?? 'Internal error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);