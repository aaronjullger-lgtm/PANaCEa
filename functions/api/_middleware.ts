/**
 * API Gateway Middleware — runs before every /api/* request
 *
 * Provides defense-in-depth security layer for all API endpoints:
 *   1. Rate limiting (KV-backed, per-path-type)
 *   2. CORS preflight handling
 *   3. Request ID tracing header
 *   4. Security response headers
 *
 * Individual endpoints still apply their own middleware stacks (auth, validation,
 * per-endpoint rate limits) via _shared/middleware.ts. This file catches anything
 * that slips through or endpoints that don't use the middleware stacks.
 */

import type { CloudflareEnv } from './_shared/types';
import { handleCorsPreflightSecure } from './_shared/cors';

// ─── Rate limit tiers ───────────────────────────────────────────────────────

const RATE_LIMIT_TIERS: Record<string, { limit: number; windowSeconds: number }> = {
  ai: { limit: 10, windowSeconds: 60 },    // Gemini, vision, embeddings, agents
  auth: { limit: 20, windowSeconds: 60 },  // Authentication endpoints
  admin: { limit: 30, windowSeconds: 60 }, // Admin operations
  default: { limit: 60, windowSeconds: 60 }, // General API traffic
};

// Path prefixes mapped to tiers
const PATH_TIER_MAP: [string, string][] = [
  ['/api/gemini/', 'ai'],
  ['/api/vision/', 'ai'],
  ['/api/embeddings/', 'ai'],
  ['/api/agents/', 'ai'],
  ['/api/intelligence/', 'ai'],
  ['/api/smart-scribe/', 'ai'],
  ['/api/tutor/', 'ai'],
  ['/api/sim-lab/', 'ai'],
  ['/api/auth/', 'auth'],
  ['/api/admin/', 'admin'],
];

function getTierForPath(pathname: string): string {
  const lower = pathname.toLowerCase();
  for (const [prefix, tier] of PATH_TIER_MAP) {
    if (lower.startsWith(prefix)) return tier;
  }
  return 'default';
}

// ─── KV rate limiter ────────────────────────────────────────────────────────

async function isRateLimited(
  kv: CloudflareEnv['RATE_LIMIT_KV'] | undefined,
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!kv) return false; // fail-open if KV not bound (local dev)

  try {
    const current = (await kv.get(key, { type: 'json' })) as number | null;
    if (current !== null && current >= maxRequests) return true;
    await kv.put(key, String((current ?? 0) + 1), {
      expirationTtl: windowSeconds,
    });
    return false;
  } catch {
    return false; // fail-open
  }
}

// ─── Middleware entry point ─────────────────────────────────────────────────

export async function onRequest(context: {
  request: Request;
  env: CloudflareEnv;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
}): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. CORS preflight — respond immediately, don't count against rate limit
  if (request.method === 'OPTIONS') {
    return handleCorsPreflightSecure(request, env);
  }

  // 2. Rate limiting (KV-backed, per IP + tier)
  const tier = getTierForPath(pathname);
  const config = RATE_LIMIT_TIERS[tier];
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const rateLimitKey = `gateway:${tier}:${clientIp}`;

  const limited = await isRateLimited(kv(env), rateLimitKey, config.limit, config.windowSeconds);
  if (limited) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: config.windowSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(config.windowSeconds),
          'X-RateLimit-Tier': tier,
        },
      },
    );
  }

  // 3. Forward to endpoint handler
  const response = await next();

  // 4. Inject security headers on response
  const headers = new Headers(response.headers);
  const requestId = crypto.randomUUID();
  headers.set('X-Request-ID', requestId);

  // Security headers for API responses
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Forward Sentry trace for distributed tracing
  const sentryTrace = request.headers.get('sentry-trace');
  if (sentryTrace) {
    headers.set('Sentry-Trace', sentryTrace);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Helper to extract KV binding — typed to avoid `any` */
function kv(env: CloudflareEnv): CloudflareEnv['RATE_LIMIT_KV'] | undefined {
  return env.RATE_LIMIT_KV;
}
