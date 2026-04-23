/**
 * ECG Patterns Reference Index API
 * GET /api/reference/ecg
 *
 * Lists and searches ECG patterns, optionally filtered by category
 *
 * Sprint: Security Hardening Sprint 3
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const ECGQuerySchema = z.object({
  query: z
    .object({
      category: z.string().max(100).optional(),
      query: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// CORS HANDLER
// ============================================================================

// ============================================================================
// GET HANDLER
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  ECGQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/reference/ecg', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const query = url.searchParams.get('query');
      const highYield = url.searchParams.get('highYield');

      const where: any = {};
      if (category) where.category = category;
      if (highYield === 'true') where.isHighYield = true;

      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ];
      }

      log.info('Listing ECG patterns', { category, highYield: highYield || 'false' });
      const results = await prisma.eCGPattern.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { name: 'asc' }],
        select: {
          id: true, name: true, displayName: true, category: true,
          subcategory: true, isHighYield: true, panceYield: true,
          isEmergency: true, rate: true, rhythm: true,
          pWave: true, prInterval: true, qrsComplex: true,
          stSegment: true, tWave: true,
          diagnosticCriteria: true, pathognomonic: true,
          etiology: true, symptoms: true,
          acuteManagement: true, medications: true, mimics: true,
          clinicalPearls: true, testQuestionTips: true,
          commonMistakes: true, mnemonics: true, boardYieldFacts: true,
        },
      });

      log.info('ECG patterns fetch successful', { count: results.length });

      return {
        data: {
          success: true,
          data: results,
        },
      };
    } catch (error) {
      log.error('Error fetching ECG patterns', error);
      return {
        status: 500,
        error: 'Failed to fetch ECG patterns',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
