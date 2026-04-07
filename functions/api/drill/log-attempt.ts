/**
 * @deprecated SUPERSEDED by POST /api/drills/submit-review which provides
 * full FSRS scheduling, pipeline traces, and performance feedback.
 *
 * This endpoint is no longer called by any frontend component. It remains
 * only as a tombstone — safe to delete once confirmed no external clients
 * depend on it.
 *
 * Endpoint: POST /api/drill/log-attempt → 410 Gone
 */

import { withCors } from '../_shared/middleware';

export const onRequestOptions = withCors();

export const onRequestPost: PagesFunction = async () => {
  return new Response(
    JSON.stringify({
      error: 'This endpoint has been deprecated. Use POST /api/drills/submit-review instead.',
      migration: '/api/drills/submit-review',
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
