/**
 * Media Drill Question API Endpoint
 *
 * Returns approved media assets (ECG, X-ray, Derm photos) as drill questions.
 * Uses database-first architecture - queries MediaAsset table for real clinical images.
 *
 * Query Parameters:
 * - modality: 'ecg' | 'derm' | 'radiology' (optional, defaults to all)
 * - count: number of questions to return (optional, defaults to 20)
 *
 * Response: { data: PhotoCase[] }
 *
 * @example
 * GET /api/drills/media?modality=ecg&count=10
 *
 * Security: Public endpoint with validation (no auth required for reference data)
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { publicEndpoint, ValidatedContext } from '../_shared/middleware';
import { mediaDrillQuerySchema } from '../_shared/zodSchemas';
import { z } from 'zod';
import { getMediaDrillCases } from '../../../services/drill/mediaDrillCases';
import type { PhotoCase, ClinicalContext } from '../../../services/drill/mediaDrillCases';
import type { DrillModality } from '../../../lib/mediaTypes';

// Re-export for consumers (e.g. use-photo-drill types)
export type { PhotoCase, ClinicalContext };

type QueryType = z.infer<typeof mediaDrillQuerySchema>;

export const onRequestGet = publicEndpoint(
  mediaDrillQuerySchema,
  async (context: ValidatedContext<QueryType>) => {
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
        console.warn(`[Media Drill API] No assets found. Modality: ${modalityParam || 'all'}`);
      }

      return { data: photoCases };
    } catch (error) {
      console.error('[Media Drill API] Error:', error);
      return {
        status: 500,
        data: {
          error: 'Failed to fetch media drill questions',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
