/**
 * Photo Drill Batch API (deprecated: use GET /api/drills/media)
 *
 * Returns the same photo drill cases as GET /api/drills/media for backward compatibility.
 * Query params: modality ('ecg' | 'derm' | 'radiology'), count (default 10).
 *
 * GET /api/drill/photo-batch?modality=ecg&count=10
 *
 * @deprecated Use GET /api/drills/media?modality=ecg&count=10 instead.
 * @module functions/api/drill/photo-batch
 *
 * Security: Authenticated endpoint - requires valid Clerk JWT in Authorization header
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint, AuthenticatedContext, ValidatedContext } from '../_shared/middleware';
import { mediaDrillQuerySchema } from '../_shared/zodSchemas';
import { z } from 'zod';
import { getMediaDrillCases } from '../../../services/drill/mediaDrillCases';
import type { DrillModality } from '../../../lib/mediaTypes';

type QueryType = z.infer<typeof mediaDrillQuerySchema>;

export const onRequestGet = authenticatedEndpoint(
  mediaDrillQuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<QueryType>) => {
    const { modality: modalityParam, count } = context.validated;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      const modalityForQuery: DrillModality | null =
        modalityParam === 'radiology'
          ? 'xray'
          : modalityParam
            ? (modalityParam as DrillModality)
            : null;

      const photoCases = await getMediaDrillCases(prisma, {
        modality: modalityForQuery,
        count,
      });

      if (photoCases.length === 0) {
        console.warn(`[Photo Batch] No assets found. Modality: ${modalityParam || 'all'}`);
      }

      return { data: photoCases };
    } catch (error) {
      console.error('[Photo Batch] Error:', error);
      return {
        status: 500,
        data: {
          error: 'Failed to fetch photo drill batch',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
