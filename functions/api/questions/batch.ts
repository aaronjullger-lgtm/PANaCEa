/**
 * GET /api/questions/batch
 *
 * This route exists only to handle legacy prefetch/speculation requests.
 * There is no "batch" GET API; use /api/questions/session or /api/questions/pool instead.
 * Returns 404 with JSON so clients and CDN get a proper response instead of 503.
 */

import { getCorsHeaders, getCorsConfig } from '../_shared/cors';

type BatchContext = { request: Request; env?: Record<string, unknown> };

export const onRequestOptions = async (context: BatchContext): Promise<Response> => {
  try {
    const config = context.env ? getCorsConfig(context.env) : undefined;
    const cors = getCorsHeaders(context.request, config) ?? {};
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'Access-Control-Max-Age': '86400' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Service unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestGet = async (context: BatchContext): Promise<Response> => {
  try {
    const config = context.env ? getCorsConfig(context.env) : undefined;
    const cors = getCorsHeaders(context.request, config) ?? {};
    const body = JSON.stringify({
      error: 'Not found',
      message: 'Use /api/questions/session or /api/questions/pool for question data.',
    });
    return new Response(body, {
      status: 404,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Service unavailable',
        message: 'The request could not be processed. Please try again.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
