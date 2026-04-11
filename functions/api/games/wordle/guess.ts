/**
 * POST /api/games/wordle/guess — Submit a Wordle guess
 * Edge port of routes/games.ts
 */

import { z } from 'zod';
import { withCors, authenticatedEndpoint } from '../../_shared/middleware';
import { createEndpointLogger } from '../../_shared/secureLogger';
import {
  submitWordleGuess,
  WordleServiceError,
} from '../../../../services/core/wordleService';

const GuessSchema = z.object({
  guess: z.string().min(1),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  GuessSchema,
  async (context) => {
    const log = createEndpointLogger('games/wordle/guess');

    try {
      const { guess } = context.validated;
      const payload = await submitWordleGuess(context.auth.userId, guess);
      return new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof WordleServiceError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      log.error('Failed to submit Wordle guess', error);
      return new Response(JSON.stringify({ error: 'Failed to submit Wordle guess' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
);
