/**
 * @deprecated SUPERSEDED.
 *
 * GET /api/questions/review → 410 Gone.
 *   Review-due / flagged / missed / weak-area question selection is now owned
 *   by the proactive question reservoir (`functions/api/reservoir/*`) and
 *   materialized through the session pipeline, not fetched ad-hoc from this
 *   endpoint. The underlying server-side `ReviewService` class has been
 *   deleted along with this tombstone.
 *
 * POST /api/questions/review → 410 Gone.
 *   The POST path wrote SRSItem (SM-2 fields only, no FSRS overlay, no
 *   UserProgress sync). New review submissions MUST use
 *   POST /api/drills/submit-review which writes ReviewLog + UserProgress +
 *   UserTopicProgress atomically with FSRS v6 scheduling and the implicit
 *   rating pipeline.
 *
 * Caller inventory (2026-04-16):
 *   - GET: no UI or service callers outside this file and its removed test.
 *   - POST: only the orphaned `lib/services/review/reviewSubmissionService.ts`
 *           client wrapper — deleted in the same commit as this tombstone.
 *
 * Kept as a 410 Gone tombstone so any stale deployment or external client
 * sees an explicit migration pointer rather than a silent 404.
 */

import { withCors } from '../_shared/middleware';

const RETIRED_RESPONSE = (migration: string) =>
  new Response(
    JSON.stringify({
      error: 'This endpoint has been deprecated.',
      migration,
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    }
  );

export const onRequestOptions = withCors();

export const onRequestGet: PagesFunction = async () =>
  RETIRED_RESPONSE('Review selection now flows through the proactive question reservoir');

export const onRequestPost: PagesFunction = async () =>
  RETIRED_RESPONSE('/api/drills/submit-review');
