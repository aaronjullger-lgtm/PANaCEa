/**
 * API: POST /api/study/session/generate
 *
 * Generates a study session by selecting questions through the concept-level
 * FSRS pipeline. Bridges blueprint resolution → concept selection → question serving.
 *
 * STATUS: Stubbed — the concept-level question selector service
 * (lib/services/conceptQuestionSelector) has not been implemented yet.
 * Returns 501 until the service is built.
 */

import { withCors } from '../../_shared/middleware';

// ─── CORS ───────────────────────────────────────────────────────────────────

export const onRequestOptions = withCors();

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction = async () => {
  return new Response(
    JSON.stringify({
      error: 'Concept-level session generation is not yet available.',
      code: 'NOT_IMPLEMENTED',
    }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
