/**
 * GET /api/questions/batch
 *
 * This route exists only to handle legacy prefetch/speculation requests.
 * There is no "batch" GET API; use /api/questions/session or /api/questions/pool instead.
 * Returns 404 with JSON so clients and CDN get a proper response instead of 503.
 */

import { fail, ErrorCode } from '../_shared/endpoint';

type BatchContext = { request: Request; env?: Record<string, unknown> };

export const onRequestOptions = async (_context: BatchContext): Promise<Response> => {
  return new Response(null, { status: 204 });
};

export const onRequestGet = async (_context: BatchContext): Promise<Response> => {
  return fail(ErrorCode.NOT_FOUND, {
    message: 'Use /api/questions/session or /api/questions/pool for question data.',
  });
};
