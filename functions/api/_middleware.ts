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

type RateLimitTier = 'ai' | 'auth' | 'admin' | 'default';

const RATE_LIMIT_TIERS: Record<RateLimitTier, { limit: number; windowSeconds: number }> = {
  ai: { limit: 10, windowSeconds: 60 },    // Gemini, generation, vision, embeddings, agents
  auth: { limit: 20, windowSeconds: 60 },  // Authentication endpoints
  admin: { limit: 30, windowSeconds: 60 }, // Admin operations
  default: { limit: 60, windowSeconds: 60 }, // General API traffic
};

// Path prefixes mapped to tiers
const PATH_TIER_MAP: Array<[string, RateLimitTier]> = [
  ['/api/ai/', 'ai'],
  ['/api/gemini/', 'ai'],
  ['/api/vision/', 'ai'],
  ['/api/embeddings/', 'ai'],
  ['/api/agents/', 'ai'],
  ['/api/intelligence/', 'ai'],
  ['/api/smart-scribe/', 'ai'],
  ['/api/tutor/', 'ai'],
  ['/api/sim-lab/', 'ai'],
  ['/api/questions/generate', 'ai'],
  ['/api/questions/explain-rag', 'ai'],
  ['/api/questions/due-siblings', 'ai'],
  ['/api/questions/pool', 'ai'],
  ['/api/clinical-eye/', 'ai'],
  ['/api/ddx/', 'ai'],
  ['/api/drills/contrastive/generate', 'ai'],
  ['/api/drills/elaboration/grade', 'ai'],
  ['/api/drills/soap/grade', 'ai'],
  ['/api/drills/teachback/grade', 'ai'],
  ['/api/knowledge/', 'ai'],
  ['/api/library/answer', 'ai'],
  ['/api/library/search', 'ai'],
  ['/api/library/semantic-search', 'ai'],
  ['/api/lecture/', 'ai'],
  ['/api/osce/live', 'ai'],
  ['/api/osce/live-config', 'ai'],
  ['/api/osce/live-engine', 'ai'],
  ['/api/osce/state-machine', 'ai'],
  ['/api/osce/analysis/grade', 'ai'],
  ['/api/podcast/', 'ai'],
  ['/api/scribe/', 'ai'],
  ['/api/spark/', 'ai'],
  ['/api/study/chat', 'ai'],
  ['/api/technique-check/', 'ai'],
  ['/api/veo/', 'ai'],
  ['/api/visualizer/', 'ai'],
  ['/api/admin/enrich-condition', 'ai'],
  ['/api/admin/generate-question', 'ai'],
  ['/api/admin/generate-draft', 'ai'],
  ['/api/admin/staging/run-critic', 'ai'],
  ['/api/admin/knowledge/ingest', 'ai'],
  ['/api/auth/', 'auth'],
  ['/api/admin/', 'admin'],
];

function getTierForPath(pathname: string): RateLimitTier {
  const lower = pathname.toLowerCase();
  for (const [prefix, tier] of PATH_TIER_MAP) {
    if (lower.startsWith(prefix)) return tier;
  }
  return 'default';
}

// ─── KV rate limiter ────────────────────────────────────────────────────────

type RateLimitResult = 'allowed' | 'limited' | 'unavailable';

async function checkRateLimit(
  kv: CloudflareEnv['RATE_LIMIT_KV'] | undefined,
  key: string,
  maxRequests: number,
  windowSeconds: number,
  options: { failClosedOnError: boolean },
): Promise<RateLimitResult> {
  if (!kv) return 'allowed'; // local/dev fallback when KV is intentionally absent

  try {
    const current = (await kv.get(key, { type: 'json' })) as number | null;
    if (current !== null && current >= maxRequests) return 'limited';
    await kv.put(key, String((current ?? 0) + 1), {
      expirationTtl: windowSeconds,
    });
    return 'allowed';
  } catch {
    return options.failClosedOnError ? 'unavailable' : 'allowed';
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

  const rateLimitResult = await checkRateLimit(kv(env), rateLimitKey, config.limit, config.windowSeconds, {
    failClosedOnError: tier === 'ai',
  });
  if (rateLimitResult === 'unavailable') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'AI rate limiter unavailable. Please try again shortly.',
        retryAfter: config.windowSeconds,
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(config.windowSeconds),
          'X-RateLimit-Tier': tier,
        },
      },
    );
  }

  if (rateLimitResult === 'limited') {
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
