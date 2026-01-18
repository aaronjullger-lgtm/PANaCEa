/**
 * Differential Diagnosis Reference Index API
 * GET /api/reference/differentials
 *
 * Lists and searches differential diagnoses, optionally filtered by category,
 * presenting complaint, or search query
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

const DifferentialsQuerySchema = z.object({
  query: z
    .object({
      category: z.string().max(100).optional(),
      query: z.string().max(200).optional(),
      presentingComplaint: z.string().max(200).optional(),
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
  DifferentialsQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/reference/differentials', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const query = url.searchParams.get('query');
      const presentingComplaint = url.searchParams.get('presentingComplaint');

      let results;

      if (query) {
        // Search mode
        log.info('Searching differentials', { query });
        results = await prisma.differentialDiagnosis.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { presentingComplaint: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          orderBy: { presentingComplaint: 'asc' },
          take: 30,
        });
      } else if (presentingComplaint) {
        // Find DDx by presenting complaint
        log.info('Finding DDx by presenting complaint', { presentingComplaint });
        results = await prisma.differentialDiagnosis.findMany({
          where: {
            presentingComplaint: { contains: presentingComplaint, mode: 'insensitive' },
          },
          orderBy: { name: 'asc' },
        });
      } else {
        // List mode with optional category filter
        log.info('Listing differentials', { category });
        results = await prisma.differentialDiagnosis.findMany({
          where: category ? { category } : undefined,
          orderBy: { presentingComplaint: 'asc' },
        });
      }

      log.info('Differentials fetch successful', { count: results.length });

      return {
        data: {
          success: true,
          data: results,
        },
      };
    } catch (error) {
      log.error('Error fetching differentials', error);
      return {
        status: 500,
        error: 'Failed to fetch differential diagnoses',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);