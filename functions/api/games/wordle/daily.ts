/**
 * GET /api/games/wordle/daily — Get today's Medical Wordle challenge
 * Edge port of routes/games.ts
 */

import { authenticatedEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  getDailyWordForUser,
  WordleServiceError,
} from '../../../../services/core/wordleService';

export const onRequestGet = authenticatedEndpoint(
  undefined,
  async (context) => {
    const log = createEndpointLogger('games/wordle/daily');
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const payload = await getDailyWordForUser(prisma, context.auth.userId);
      return ok(payload);
    } catch (error) {
      if (error instanceof WordleServiceError) {
        return fail(ErrorCode.VALIDATION_FAILED, { message: error.message });
      }
      log.error('Failed to fetch Wordle daily word', error);
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Failed to load Wordle challenge' });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);
