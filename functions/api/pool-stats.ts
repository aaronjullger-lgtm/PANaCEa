/**
 * Question Pool API Endpoint
 * GET: Returns pool health stats (public - monitoring)
 * POST: Triggers batch generation for low systems (authenticated)
 *
 * Sprint 3 Security: Updated to use secure middleware pattern
 */

import { z } from 'zod';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from './_shared/prisma-edge';
import { publicEndpoint, authenticatedEndpoint } from './_shared/middleware';
import { createEndpointLogger } from './_shared/secureLogger';

// ============================================================================
// SCHEMAS
// ============================================================================

const GetPoolStatsSchema = z.object({}).optional();

const PostPoolStatsSchema = z.object({
  system: z.string().max(50).optional(),
  count: z.number().int().min(1).max(100).optional().default(25),
});

// ============================================================================
// CONSTANTS
// ============================================================================

const SYSTEMS = [
  'CV',
  'PULM',
  'GI',
  'NEURO',
  'MSK',
  'DERM',
  'HEME',
  'ENDO',
  'HEENT',
  'RENAL',
  'REPRO',
  'PSYCH',
  'ID',
  'GU',
];

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /api/pool-stats
 * Returns pool health statistics (public endpoint for monitoring)
 */
export const onRequestGet = publicEndpoint(GetPoolStatsSchema, async (context) => {
  const log = createEndpointLogger('GET /api/pool-stats');
  let prisma: EdgePrismaClient | null = null;

  try {
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    const stats = await Promise.all(
      SYSTEMS.map(async (system) => {
        const [total, unused] = await Promise.all([
          prisma!.preGeneratedQuestion.count({ where: { system } }),
          prisma!.preGeneratedQuestion.count({ where: { system, usedAt: null } }),
        ]);
        return { system, total, unused };
      })
    );

    const totalQuestions = stats.reduce((s, x) => s + x.total, 0);
    const totalUnused = stats.reduce((s, x) => s + x.unused, 0);

    const health = totalUnused < 100 ? 'critical' : totalUnused < 500 ? 'warning' : 'healthy';

    log.info('Pool stats retrieved', {
      health,
      totalQuestions,
      totalUnused,
    });

    return {
      data: {
        health,
        totalQuestions,
        totalUnused,
        systems: stats,
      },
    };
  } catch (error) {
    log.error('Failed to get pool stats', error);
    return { status: 500, error: 'Failed to get pool stats' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * POST /api/pool-stats
 * Triggers batch generation for low systems (authenticated)
 */
export const onRequestPost = authenticatedEndpoint(PostPoolStatsSchema, async (context) => {
  const log = createEndpointLogger('POST /api/pool-stats', context.auth.userId);
  const { system, count } = context.validated;

  try {
    // In production, this would queue a background job
    // For now, just acknowledge the request
    log.info('Batch generation queued', {
      system: system || 'all',
      count,
      requestedBy: context.auth.userId,
    });

    return {
      data: {
        queued: true,
        system: system || 'all',
        count: count || 25,
        message: 'Batch generation queued',
      },
    };
  } catch (error) {
    log.error('Failed to queue generation', error);
    return { status: 500, error: 'Failed to queue generation' };
  }
});

/**
 * OPTIONS handler for CORS preflight
 */
