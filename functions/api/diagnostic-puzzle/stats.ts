/**
 * GET /api/diagnostic-puzzle/stats
 * Returns diagnostic puzzle statistics for the authenticated user.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getUserDiagnosticStats } from '@/services/core/diagnosticPuzzleService';

const StatsQuerySchema = z.object({});

export const onRequestGet = authenticatedEndpoint(
  StatsQuerySchema,
  async ({ env, auth }) => {
    const log = createEndpointLogger('/api/diagnostic-puzzle/stats', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Resolve internal user ID from Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        log.error('User not found in database', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      const stats = await getUserDiagnosticStats(user.id);

      log.info('Fetched diagnostic puzzle stats', {
        total: stats.total,
        wins: stats.wins,
        streak: stats.streak,
      });

      return { data: stats };
    } catch (error: any) {
      log.error('Error fetching diagnostic puzzle stats', error);
      return {
        status: error.name === 'DiagnosticPuzzleServiceError' ? 400 : 500,
        error: error.message || 'Internal server error',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);