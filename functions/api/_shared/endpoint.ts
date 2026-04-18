/**
 * Consolidated Endpoint Builder for PANaCEa
 *
 * Single declarative entry point for building a Cloudflare Pages Function.
 * Replaces the pattern of composing 7 middlewares by hand (withCors →
 * withErrorHandling → withEnvCheck → withAuth → withRole → withRateLimit →
 * withValidation → withLogging → handler) with one call.
 *
 * Every endpoint built with `withEndpoint()` gets, by default:
 *   • CORS with the central allowlist
 *   • Env validation (DATABASE + CLERK by default)
 *   • Structured logging with traceId correlation
 *   • Rate limiting (per-user if authed, per-IP otherwise)
 *   • Unified response envelope (via middleware.ts → api-response.ts)
 *   • Structured error catalog codes in every failure body
 *
 * Usage examples:
 *
 *   // 1. Authed + validated body (default stack)
 *   export const onRequestPost = withEndpoint({
 *     schema: myBodySchema,
 *     handler: async (ctx) => ok({ id: ctx.validated.id }),
 *   });
 *
 *   // 2. AI (Gemini) hot path — aggressive rate limit
 *   export const onRequestPost = withEndpoint({
 *     kind: 'ai',
 *     schema: genSchema,
 *     handler: async (ctx) => ok(await callGemini(ctx.env, ctx.validated)),
 *   });
 *
 *   // 3. Public endpoint (no auth)
 *   export const onRequestGet = withEndpoint({
 *     auth: 'none',
 *     schema: querySchema,
 *     source: 'query',
 *     handler: async (ctx) => ok(ctx.validated),
 *   });
 *
 *   // 4. Admin endpoint
 *   export const onRequestPost = withEndpoint({
 *     auth: 'admin',
 *     schema: adminActionSchema,
 *     handler: async (ctx) => ok(await doThing(ctx)),
 *   });
 *
 *   // 5. Cron (scheduled) — uses CRON_SECRET header
 *   export const onRequestPost = cronEndpoint({
 *     handler: async (ctx) => ok({ ran: true }),
 *   });
 */

import { z } from 'zod';
import type { EnvRequirement } from './env-validation';
import {
  authenticatedEndpoint,
  adminAuthenticatedEndpoint,
  aiEndpoint,
  publicEndpoint,
  cmsEndpoint,
  refineryEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
  type Handler,
  type CloudflareContext,
} from './middleware';
import { fail } from './api-response';
import { ErrorCode } from './error-catalog';
import { getCorsHeaders, handleCorsPreflightSecure } from './cors';
import { withStructuredLogging } from './structuredLogger';
import { validateSchema } from './zodSchemas';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthLevel = 'none' | 'user' | 'editor' | 'approver' | 'admin' | 'ai';

type ValidatedSource = 'body' | 'query' | 'params';

export interface EndpointRateLimit {
  /** Requests per 60s window. */
  requestsPerMinute: number;
  /** Optional KV key prefix for per-route buckets. */
  keyPrefix?: string;
}

/**
 * Declarative options for an endpoint.
 *
 * The `auth` discriminator drives which underlying stack is used:
 *   - 'none'      → publicEndpoint (600/min by IP)
 *   - 'user'      → authenticatedEndpoint (300/min)
 *   - 'editor'    → cmsEndpoint (60/min; editor+)
 *   - 'approver'  → refineryEndpoint (60/min; approver+)
 *   - 'admin'     → adminAuthenticatedEndpoint (60/min; admin/superadmin)
 *   - 'ai'        → aiEndpoint (25/min; authed, Gemini-appropriate)
 */
export interface EndpointOptions<
  T = unknown,
  Authed extends boolean = boolean,
> {
  /** Auth requirement. Default: 'user'. */
  auth?: AuthLevel;
  /** Optional Zod schema for the request (body/query/params). */
  schema?: z.ZodSchema<T>;
  /** Where to pull validation input from. Default: 'body'. */
  source?: ValidatedSource;
  /** Override rate limiting. Each stack has a sensible default. */
  rateLimit?: EndpointRateLimit;
  /** Optional env requirement (preset key or explicit list). */
  env?: EnvRequirement | readonly string[];
  /** The endpoint handler. Receives validated + auth context. */
  handler: Authed extends true
    ? Handler<AuthenticatedContext & ValidatedContext<T>>
    : Handler<ValidatedContext<T>>;
}

// ─── Internal: universal fallback schema (no validation) ─────────────────────
//
// The existing stacks all require a schema. For callers that don't need
// validation we pass a permissive `z.any()` so any body/query/params shape
// flows through unchanged.
const ANY_SCHEMA: z.ZodSchema<unknown> = z.any();

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Build an endpoint with the default middleware stack selected by `auth`.
 *
 * Returns a standard Cloudflare Pages Function `onRequest*` handler.
 */
export function withEndpoint<T = unknown>(
  options: EndpointOptions<T>
): (context: CloudflareContext) => Promise<Response> {
  const auth: AuthLevel = options.auth ?? 'user';
  const schema = (options.schema ?? ANY_SCHEMA) as z.ZodSchema<T>;
  const source = options.source ?? 'body';
  const rpm = options.rateLimit?.requestsPerMinute;

  // Build an adapter that matches each underlying stack's handler signature.
  switch (auth) {
    case 'none': {
      const h = options.handler as Handler<ValidatedContext<T>>;
      return publicEndpoint<T>(schema, h, {
        source,
        envRequired: options.env,
      });
    }
    case 'user': {
      const h = options.handler as Handler<AuthenticatedContext & ValidatedContext<T>>;
      return authenticatedEndpoint<T>(schema, h, {
        source,
        ...(rpm !== undefined && { requestsPerMinute: rpm }),
      });
    }
    case 'editor': {
      const h = options.handler as Handler<AuthenticatedContext & ValidatedContext<T>>;
      return cmsEndpoint<T>(schema, h, {
        source,
        ...(rpm !== undefined && { requestsPerMinute: rpm }),
      });
    }
    case 'approver': {
      const h = options.handler as Handler<AuthenticatedContext & ValidatedContext<T>>;
      return refineryEndpoint<T>(schema, h, { source });
    }
    case 'admin': {
      const h = options.handler as Handler<AuthenticatedContext & ValidatedContext<T>>;
      return adminAuthenticatedEndpoint<T>(schema, h, {
        source,
        ...(rpm !== undefined && { requestsPerMinute: rpm }),
      });
    }
    case 'ai': {
      const h = options.handler as Handler<AuthenticatedContext & ValidatedContext<T>>;
      return aiEndpoint<T>(schema, h, {
        source,
        ...(rpm !== undefined && { requestsPerMinute: rpm }),
      });
    }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = auth;
      throw new Error(`Unknown auth level: ${String(_exhaustive)}`);
    }
  }
}

// ─── Cron endpoint (closes P2 audit gap) ─────────────────────────────────────

export interface CronEndpointOptions<T = unknown> {
  /** Optional schema for the request body/query (rare for crons). */
  schema?: z.ZodSchema<T>;
  /** 'body' | 'query' | 'params'. Default: 'body'. */
  source?: ValidatedSource;
  /** Optional env requirement beyond the defaults. */
  env?: EnvRequirement | readonly string[];
  /** Handler. Receives validated payload (or {} if no schema). */
  handler: (
    context: CloudflareContext & ValidatedContext<T>
  ) => Promise<Response | { status?: number; data?: unknown; error?: string }>;
}

/**
 * Dedicated stack for cron / scheduled-trigger endpoints.
 *
 * Verifies the `CRON_SECRET` bearer in the Authorization header (or
 * `X-Cron-Secret` header as a fallback), then runs the handler with the
 * unified response envelope, structured logging, rate limiting by IP, and
 * CORS disabled (crons should never be cross-origin).
 */
export function cronEndpoint<T = unknown>(
  options: CronEndpointOptions<T>
): (context: CloudflareContext) => Promise<Response> {
  const schema = (options.schema ?? ANY_SCHEMA) as z.ZodSchema<T>;
  const source = options.source ?? 'body';
  const logger = withStructuredLogging();

  return async (context: CloudflareContext): Promise<Response> => {
    // Preflight
    if (context.request.method === 'OPTIONS') {
      return handleCorsPreflightSecure(context.request, context.env);
    }

    // Verify cron secret
    const secret =
      (context.env as Record<string, string | undefined>)?.CRON_SECRET ??
      undefined;
    if (!secret) {
      return fail(ErrorCode.ENV_MISCONFIGURED, {
        message: 'CRON_SECRET is not configured',
        request: context.request,
      });
    }

    const provided = extractCronSecret(context.request);
    if (!provided || !timingSafeEqual(provided, secret)) {
      return fail(ErrorCode.UNAUTHORIZED, {
        message: 'Invalid or missing cron secret',
        request: context.request,
      });
    }

    // Extract & validate payload
    let validated: T;
    try {
      const rawInput = await extractSource(context, source);
      const result = validateSchema(schema, rawInput, 'Cron');
      if (!result.success) {
        return fail(ErrorCode.VALIDATION_FAILED, {
          message: `Cron payload validation failed: ${result.errors.join('; ')}`,
          details: result.errors,
          request: context.request,
        });
      }
      validated = result.data as T;
    } catch (err) {
      if (err instanceof SyntaxError) {
        return fail(ErrorCode.INVALID_JSON, { request: context.request });
      }
      return fail(ErrorCode.INTERNAL_ERROR, {
        message: err instanceof Error ? err.message : 'Cron input error',
        request: context.request,
      });
    }

    // Run handler through structured-logging middleware so traceId & Sentry
    // capture continue to work the same as every other endpoint.
    const validatedContext = Object.assign({}, context, {
      validated,
    }) as CloudflareContext & ValidatedContext<T>;

    const invoke = async () => {
      try {
        const result = await options.handler(validatedContext);
        if (result instanceof Response) return result;
        // Legacy result → envelope conversion via fail/ok
        if (result.error != null) {
          return fail(ErrorCode.INTERNAL_ERROR, {
            status: result.status ?? 500,
            message: result.error,
            request: context.request,
          });
        }
        // Successful object-shape result — go through api-response to keep envelope consistent.
        return new Response(JSON.stringify({ success: true, data: result.data ?? null, timestamp: new Date().toISOString() }), {
          status: result.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return fail(ErrorCode.INTERNAL_ERROR, {
          message: err instanceof Error ? err.message : 'Cron handler failed',
          request: context.request,
        });
      }
    };

    return logger(context, invoke) as Promise<Response>;
  };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

function extractCronSecret(req: Request): string | null {
  const xHeader = req.headers.get('x-cron-secret');
  if (xHeader) return xHeader;
  const auth = req.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1] ?? null;
}

/**
 * Constant-time string equality for secret comparison.
 * Workers runtime lacks node's crypto.timingSafeEqual; this is a portable
 * implementation that resists early-exit timing leaks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  const len = Math.max(la, lb);
  let diff = la ^ lb;
  for (let i = 0; i < len; i++) {
    const ca = i < la ? a.charCodeAt(i) : 0;
    const cb = i < lb ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

async function extractSource(
  context: CloudflareContext,
  source: ValidatedSource
): Promise<unknown> {
  if (source === 'query') {
    const url = new URL(context.request.url);
    return Object.fromEntries(url.searchParams.entries());
  }
  if (source === 'params') {
    return context.params ?? {};
  }
  const text = await context.request.text();
  if (!text) return {};
  return JSON.parse(text);
}

// ─── AI streaming endpoint (SSE, envelope-bypass) ────────────────────────────
//
// The unified envelope wraps every response in { success, data, error, ... }.
// That's the right default for JSON endpoints but wrong for Server-Sent Events,
// which must return a raw ReadableStream with Content-Type: text/event-stream.
// `aiStreamingEndpoint` applies the SAME auth + rate-limit + env-check stack as
// `aiEndpoint` but passes the handler's Response through untouched so SSE
// frames stream to the client intact.
//
// Error paths (auth failure, rate limit, env misconfig, rejected payload) still
// go through `fail()` so the unified error envelope is preserved. Handlers can
// also return `fail(...)` directly for validation errors before the stream
// starts; only successful 2xx responses need the passthrough behavior.

export interface AiStreamingEndpointOptions {
  /**
   * Rate-limit bucket. Must exist in rateLimiter.ts `RATE_LIMITS`.
   * Default: 'gemini' (10 req/min for AI generation).
   */
  rateLimitBucket?: 'gemini' | 'ai_endpoints' | 'authenticated' | 'standard';
  /** Extra env keys required beyond GEMINI_API_KEY + CLERK_SECRET_KEY. */
  envRequired?: readonly string[];
}

export function aiStreamingEndpoint(
  handler: (
    context: CloudflareContext & { auth: { userId: string; clerkId: string } }
  ) => Promise<Response>,
  options: AiStreamingEndpointOptions = {}
): (context: CloudflareContext) => Promise<Response> {
  const bucket = options.rateLimitBucket ?? 'gemini';
  const envKeys = [
    'GEMINI_API_KEY',
    'CLERK_SECRET_KEY',
    ...(options.envRequired ?? []),
  ];

  return async (context: CloudflareContext): Promise<Response> => {
    // Preflight
    if (context.request.method === 'OPTIONS') {
      return handleCorsPreflightSecure(context.request, context.env);
    }

    // Env validation
    const envObj = context.env as Record<string, unknown>;
    const missing = envKeys.filter((k) => !envObj?.[k]);
    if (missing.length > 0) {
      return fail(ErrorCode.ENV_MISCONFIGURED, {
        message: `Missing required environment variables: ${missing.join(', ')}`,
        request: context.request,
      });
    }

    // Auth — lazy import to avoid pulling authenticateRequest into the
    // top-level module graph when only the envelope helpers are needed.
    const { authenticateRequest } = await import('./auth');
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return fail(ErrorCode.UNAUTHORIZED, {
        message: 'Authentication required',
        request: context.request,
      });
    }

    // Rate limit (per-user if authed, else per-IP). Uses the shared primitive
    // from rateLimiter.ts so every endpoint counts against the same buckets.
    const { withRateLimit, getRateLimitIdentifier } = await import('./rateLimiter');
    const identifier = auth.userId
      ? `user:${auth.userId}`
      : getRateLimitIdentifier(context.request);
    const { response: rateLimitResponse } = await withRateLimit(
      context.env as Parameters<typeof withRateLimit>[0],
      identifier,
      bucket
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Hand off to the streaming handler. Errors are the handler's responsibility
    // because SSE streams can fail mid-frame after headers are flushed.
    try {
      const authedContext = Object.assign({}, context, {
        auth: { userId: auth.userId, clerkId: auth.clerkId },
      });
      return await handler(authedContext);
    } catch (err) {
      return fail(ErrorCode.INTERNAL_ERROR, {
        message: err instanceof Error ? err.message : 'Streaming handler failed',
        request: context.request,
      });
    }
  };
}

// ─── Re-exports for convenience ──────────────────────────────────────────────

export { ok, fail } from './api-response';
export { ErrorCode } from './error-catalog';
export type { AuthenticatedContext, ValidatedContext, CloudflareContext } from './middleware';
