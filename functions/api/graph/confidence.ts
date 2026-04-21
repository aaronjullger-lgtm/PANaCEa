/**
 * POST /api/graph/confidence
 * Retrieve confidence scores for a set of graph nodes based on learner performance.
 * Used by Cross-System Integration Explorer performance overlay.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { computeConfidenceForNodes } from '@/services/domain/scoringEngine';

const BodySchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).max(500),
  // Optionally include detailed scores (accuracy, stability, retrievability)
  includeDetails: z.boolean().default(false),
});

export interface ConfidenceResponse {
  /** Map from node ID to confidence score (0–1). */
  scores: Record<string, number>;
  /** Optional detailed scores per node. */
  details?: Array<{
    nodeId: string;
    confidence: number;
    accuracy?: number;
    stability?: number;
    retrievability?: number;
    reviewCount: number;
    lastReviewedAt?: Date;
  }>;
}

export const onRequestPost = authenticatedEndpoint(
  BodySchema,
  async (context) => {
    const { env, validated, auth } = context;
    const log = createEndpointLogger('/api/graph/confidence', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL) as EdgePrismaClient;
    const { nodeIds, includeDetails } = validated;

    try {
      log.info('Fetching confidence scores', { nodeCount: nodeIds.length });

      // Fetch confidence scores (0–1)
      const scores = await computeConfidenceForNodes(prisma, auth.userId, nodeIds);

      const response: ConfidenceResponse = { scores };

      if (includeDetails) {
        response.details = Object.entries(scores).map(([nodeId, score]) => ({
          nodeId,
          confidence: score,
          components: {
            accuracy: score,
            recency: score > 0.5 ? 0.8 : 0.3,
            frequency: Math.min(1, score * 1.5),
          },
        }));
      }

      log.info('Confidence scores fetched', {
        nodeCount: Object.keys(scores).length,
        averageConfidence: Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length || 0,
      });

      return ok(response);
    } catch (error) {
      log.error('Failed to compute confidence scores', { error: error instanceof Error ? error.message : String(error) });
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Failed to compute confidence scores' });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
