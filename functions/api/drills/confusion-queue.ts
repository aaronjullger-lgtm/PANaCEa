/**
 * Cloudflare Function: Confusion-Based Drill Queue
 *
 * Returns a prioritized drill queue based on the authenticated user's
 * confusion pairs. Each item includes confusion pair data, suggested drill
 * type, and FSRS scheduling info for spaced remediation.
 *
 * Endpoint: GET /api/drills/confusion-queue
 * Query params:
 *   limit (number, default 10)  — max items to return
 *   minCount (number, default 2) — minimum confusion count threshold
 *
 * Uses the confusionRouter service to build the remediation plan.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  getConfusionBasedDrillQueue,
  buildConfusionReservoirItems,
  bulkInsertReservoirItems,
} from '../../../services/core/confusionRouter';

const ConfusionQueueQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(25).optional().default(10),
  minCount: z.coerce.number().min(1).max(10).optional().default(2),
}).passthrough();

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ConfusionQueueQuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { limit, minCount } = validated;

      // Build the confusion-based drill queue
      const queue = await getConfusionBasedDrillQueue(prisma, auth.userId, {
        limit,
        minCount,
        includeScheduling: true,
      });

      // Pre-warm the reservoir with confusion-pair-targeted items
      if (queue.items.length > 0) {
        try {
          const reservoirItems = await buildConfusionReservoirItems(
            prisma,
            auth.userId,
            queue,
          );
          if (reservoirItems.length > 0) {
            const inserted = await bulkInsertReservoirItems(prisma, reservoirItems);
            // Non-blocking — reservoir pre-warming is an enhancement
            console.log(
              `[confusion-queue] Pre-warmed ${inserted} reservoir items for ${auth.userId}`
            );
          }
        } catch (reservoirErr: any) {
          // Non-fatal: don't let reservoir issues block the queue response
          console.error(
            `[confusion-queue] Reservoir pre-warm failed: ${reservoirErr.message}`
          );
        }
      }

      return {
        data: queue,
      };
    } catch (error) {
      console.error('Error building confusion drill queue:', error);
      return { status: 500, error: 'Failed to build confusion drill queue' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
