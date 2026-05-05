/**
 * GET /api/health
 *
 * Public liveness only. Do not expose environment, database, auth, content, or
 * user-count diagnostics here; detailed readiness belongs behind admin auth.
 */

import { getCorsHeaders, getCorsConfig } from './_shared/cors';
import { withRateLimit, getRateLimitIdentifier } from './_shared/rateLimiter';
import type { KVNamespace } from '@cloudflare/workers-types';

function jsonResponse(request: Request, env: any, body: unknown, status = 200): Response {
  const corsConfig = env ? getCorsConfig(env) : undefined;
  const cors = getCorsHeaders(request, corsConfig) ?? {};
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const onRequestOptions = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request, corsConfig) ?? {},
  });
};

export const onRequestGet = async (context: any) => {
  const request = context?.request as Request;
  const env = context?.env ?? {};

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'anonymous'
  );
  if (rateLimitResponse) return rateLimitResponse;

  return jsonResponse(request, env, {
    timestamp: new Date().toISOString(),
    endpoint: '/api/health',
    status: 'ok',
    checks: {
      functionDeployed: {
        status: 'pass',
        message: 'Cloudflare Pages Functions',
      },
    },
  });
};
