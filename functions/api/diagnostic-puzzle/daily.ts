/**
 * GET /api/diagnostic-puzzle/daily
 * Returns today's diagnostic puzzle for the authenticated user.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getDailyPuzzleForUser } from '@/services/core/diagnosticPuzzleService';

export const onRequestOptions = withCors();

const DailyPuzzleQuerySchema = z.object({
  query: z.object({
    // optional date override (ISO string)
    date: z.string().optional(),
  }),
});

export const onRequestGet = authenticatedEndpoint(
  DailyPuzzleQuerySchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/diagnostic-puzzle/daily', auth.userId);
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

      const date = validated.query.date;
      const payload = await getDailyPuzzleForUser(user.id, date);

      log.info('Fetched daily diagnostic puzzle', {
        puzzleId: payload.puzzle.id,
        cluesRevealed: payload.userState.cluesRevealed,
      });

      return { data: payload };
    } catch (error: any) {
      log.error('Error fetching daily diagnostic puzzle', error);
      return {
        status: error.name === 'DiagnosticPuzzleServiceError' ? 400 : 500,
        error: error.message || 'Internal server error',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);