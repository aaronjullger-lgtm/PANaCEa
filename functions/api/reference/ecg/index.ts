/**
 * ECG Patterns Reference Index API
 * GET /api/reference/ecg
 *
 * Lists and searches ECG patterns, optionally filtered by category
 *
 * Sprint: Security Hardening Sprint 3
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
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
    })
    .optional(),
});

// ============================================================================
// CORS HANDLER
// ============================================================================

export const onRequestOptions = withCors();

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

      let results;

      if (query) {
        // Search mode
        log.info('Searching ECG patterns', { query });
        results = await prisma.eCGPattern.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          orderBy: { name: 'asc' },
          take: 20,
        });
      } else {
        // List mode with optional category filter
        log.info('Listing ECG patterns', { category });
        results = await prisma.eCGPattern.findMany({
          where: category ? { category } : undefined,
          orderBy: { name: 'asc' },
        });
      }

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
