/**
 * GET /api/games/wordle/daily — Get today's Medical Wordle challenge
 * Edge port of routes/games.ts
 */

import { withCors, authenticatedEndpoint } from '../../_shared/middleware';
import { createEndpointLogger } from '../../_shared/secureLogger';
import {
  getDailyWordForUser,
  WordleServiceError,
} from '../../../../services/core/wordleService';

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  undefined,
  async (context) => {
    const log = createEndpointLogger('games/wordle/daily');

    try {
      const payload = await getDailyWordForUser(context.auth.userId);
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
      log.error('Failed to fetch Wordle daily word', error);
      return new Response(JSON.stringify({ error: 'Failed to load Wordle challenge' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
);
