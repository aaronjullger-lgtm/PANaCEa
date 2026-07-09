/**
 * POST /api/games/wordle/guess — Submit a Wordle guess
 * Edge port of routes/games.ts
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  submitWordleGuess,
  WordleServiceError,
} from '../../../../services/core/wordleService';

const GuessSchema = z.object({
  guess: z.string().min(1),
});

export const onRequestPost = authenticatedEndpoint(
  GuessSchema,
  async (context) => {
    const log = createEndpointLogger('games/wordle/guess');
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const { guess } = context.validated;
      const payload = await submitWordleGuess(prisma, context.auth.userId, guess);
      return ok(payload);
    } catch (error) {
      if (error instanceof WordleServiceError) {
        return fail(ErrorCode.VALIDATION_FAILED, { message: error.message });
      }
      log.error('Failed to submit Wordle guess', error);
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Failed to submit Wordle guess' });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);
