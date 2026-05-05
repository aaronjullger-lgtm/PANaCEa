/**
 * API: POST /api/study/check-distribution
 *
 * Analyzes the user's rolling-window study distribution against their
 * active blueprint and returns anti-gaming constraints for session generation.
 *
 * Request body: { weights: Record<string, number> }
 * Response: { isBalanced, skewScore, overRepresented, constraints }
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  analyzeDistribution,
  buildSessionConstraints,
} from '../../../lib/services/antiGamingDistribution';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';

const CheckDistributionSchema = z.object({
  body: z.object({
    weights: z.record(z.string(), z.number()),
  }),
});

export const onRequestPost = authenticatedEndpoint(
  CheckDistributionSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/study/check-distribution');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const { weights } = validated.body;

      if (Object.keys(weights).length === 0) {
        return new Response(
          JSON.stringify({ error: 'weights required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Look up internal user ID from Clerk ID
      const user = await resolveOrCreateUserRecord(prisma, auth.userId, { id: true });

      // Analyze distribution
      const analysis = await analyzeDistribution(prisma, user.id, weights);

      // Build session constraints
      const constraints = buildSessionConstraints(analysis);

      logger.info('Distribution analyzed', {
        isBalanced: analysis.isBalanced,
        skewScore: analysis.skewScore,
        windowSize: analysis.windowSize,
        overCount: analysis.overRepresented.length,
      });

      return new Response(
        JSON.stringify({
          isBalanced: analysis.isBalanced,
          skewScore: analysis.skewScore,
          windowSize: analysis.windowSize,
          overRepresented: analysis.overRepresented,
          underRepresented: analysis.underRepresented,
          systemSuppressionFactors: analysis.systemSuppressionFactors,
          constraints,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      logger.error('Distribution check failed', { error: err.message });
      return new Response(
        JSON.stringify({ error: err.message ?? 'Internal error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
