/**
 * PANaCEa API Contract
 *
 * Canonical reference for endpoint classification, response envelope types,
 * auth tiers, and rate-limit budgets. Import this in tests and new endpoints
 * to stay aligned with the platform contract.
 *
 * ─── Response Envelope (frozen) ──────────────────────────────────────────────
 *
 *   Success  →  { success: true,  data: T,    traceId, timestamp, message? }
 *   Error    →  { success: false, error: code, code, message, traceId, timestamp, details? }
 *
 * Every non-streaming endpoint MUST return one of these shapes via ok()/fail().
 * Never return raw `new Response(JSON.stringify(...))` or `Response.json(...)`.
 *
 * ─── Auth Tiers ──────────────────────────────────────────────────────────────
 *
 *   Tier          Wrapper                    Rate limit    Use for
 *   ──────────────────────────────────────────────────────────────────────────
 *   cron          cronEndpoint               N/A (bearer)  Cloudflare cron jobs
 *   public        publicEndpoint             600 req/min   Unauthenticated reads
 *   user          authenticatedEndpoint      300 req/min   Authenticated user actions
 *   ai            aiEndpoint                  25 req/min   ANY Gemini/AI call
 *   cms           cmsEndpoint                 60 req/min   Editor/CMS writes
 *   refinery      refineryEndpoint            60 req/min   Refinery review actions
 *   admin         adminAuthenticatedEndpoint  60 req/min   Admin-only operations
 *
 * ─── Endpoint Classification ─────────────────────────────────────────────────
 *
 * Rules:
 *   1. If the handler calls Gemini (any model) → aiEndpoint, not authenticatedEndpoint
 *   2. If the handler requires ADMIN/SUPERADMIN role → adminAuthenticatedEndpoint
 *   3. If the handler is a scheduled Cloudflare cron → cronEndpoint
 *   4. If the handler mutates CMS content (MedicalContent, Condition, Drug) → cmsEndpoint
 *   5. If the handler is part of the Refinery workflow → refineryEndpoint
 *   6. If the handler reads public data with no auth → publicEndpoint
 *   7. Otherwise → authenticatedEndpoint
 *
 * ─── Quick Import ─────────────────────────────────────────────────────────────
 *
 *   import { ok, fail, ErrorCode } from '../_shared/endpoint';
 *   import { cronEndpoint }        from '../_shared/endpoint';
 *   import {
 *     authenticatedEndpoint,
 *     aiEndpoint,
 *     adminAuthenticatedEndpoint,
 *     publicEndpoint,
 *     cmsEndpoint,
 *     refineryEndpoint,
 *   } from '../_shared/middleware';
 */

// ─── Re-exports: envelope types ──────────────────────────────────────────────

export type {
  ApiSuccessEnvelope,
  ApiErrorEnvelope,
  ApiEnvelope,
  OkOptions,
  FailOptions,
} from './api-response';

export { ok, fail, ErrorCode } from './api-response';

// ─── Auth tier constants ──────────────────────────────────────────────────────

/**
 * Rate limit budgets per auth tier (requests per minute per user/IP).
 * These match the values hardcoded in middleware.ts.
 */
export const RATE_LIMITS = {
  /** Cloudflare cron — authenticated via timing-safe CRON_SECRET bearer check */
  CRON: null,
  /** Public / unauthenticated reads */
  PUBLIC: 600,
  /** Normal authenticated user actions */
  USER: 300,
  /** Any endpoint that calls Gemini or another LLM */
  AI: 25,
  /** CMS editor writes */
  CMS: 60,
  /** Refinery review workflow */
  REFINERY: 60,
  /** Admin-only operations */
  ADMIN: 60,
} as const;

export type RateLimitTier = keyof typeof RATE_LIMITS;

/**
 * Endpoint auth classification type.
 * Used to document which tier an endpoint belongs to.
 */
export type EndpointAuthTier =
  | 'cron'      // cronEndpoint — CRON_SECRET bearer auth, no user context
  | 'public'    // publicEndpoint — no auth required
  | 'user'      // authenticatedEndpoint — Clerk JWT, 300 req/min
  | 'ai'        // aiEndpoint — Clerk JWT + Gemini, 25 req/min
  | 'cms'       // cmsEndpoint — Clerk JWT + CMS role
  | 'refinery'  // refineryEndpoint — Clerk JWT + Refinery role
  | 'admin';    // adminAuthenticatedEndpoint — Clerk JWT + Admin role

// ─── Endpoint group classifications ──────────────────────────────────────────

/**
 * Classification of each API endpoint group.
 * Update this when adding new endpoint directories.
 */
export const ENDPOINT_TIERS: Record<string, EndpointAuthTier> = {
  // Cron jobs — scheduled, no user context
  'cron/aggregate-analytics':    'cron',
  'cron/analyze-exam-outcomes':  'cron',
  'cron/compute-content-health': 'cron',
  'cron/compute-item-metrics':   'cron',
  'cron/daily-prescription':     'cron',
  'cron/generate-daily-plans':   'cron',
  'cron/nightly-health-check':   'cron',
  'cron/push-reminders':         'cron',
  'cron/replenish-pool':         'cron',
  'cron/reservoir-maintenance':  'cron',
  'cron/xapi-export':            'cron',

  // Admin-only operations
  'admin/*':                     'admin',

  // CMS content management
  'content/*':                   'cms',

  // AI / Gemini endpoints (25 req/min)
  'srs/analyze-behavior':                 'ai',
  'library/semantic-search':              'ai',
  'library/query':                        'ai',
  'smart-scribe/generate-infographic':    'ai',
  'embeddings/generate-questions':        'ai',
  'questions/generate':                   'ai',
  'osce/*':                               'ai',
  'tutor/*':                              'ai',
  'agents/*':                             'ai',
  'scribe/*':                             'ai',
  'spark/*':                              'ai',
  'causal-chain/*':                       'ai',
  'clinical-eye/*':                       'ai',

  // Refinery workflow
  'admin/refinery/*':            'refinery',

  // Standard authenticated user endpoints
  'questions/*':                 'user',
  'drills/*':                    'user',
  'srs/*':                       'user',
  'analytics/*':                 'user',
  'dashboard/*':                 'user',
  'user/*':                      'user',
  'users/*':                     'user',
  'achievements/*':              'user',
  'gamification/*':              'user',
  'conditions/*':                'user',
  'drugs/*':                     'user',
  'library/*':                   'user',
  'recommendations/*':           'user',
  'streaks/*':                   'user',
  'study/*':                     'user',
  'study-plan/*':                'user',
  'exam/*':                      'user',
  'feedback/*':                  'user',
  'push/*':                      'user',
  'reflection':                  'user',
  'sync':                        'user',

  // Unauthenticated
  'health':                      'public',
} as const;

// ─── Cron endpoint names (for wrangler.toml / CF Scheduler reference) ─────────

/**
 * All registered cron endpoint paths. These must be wired in wrangler.toml
 * cron triggers to be callable on a schedule.
 */
export const CRON_ENDPOINTS = [
  '/api/cron/aggregate-analytics',
  '/api/cron/analyze-exam-outcomes',
  '/api/cron/compute-content-health',
  '/api/cron/compute-item-metrics',
  '/api/cron/daily-prescription',
  '/api/cron/generate-daily-plans',
  '/api/cron/nightly-health-check',
  '/api/cron/push-reminders',
  '/api/cron/replenish-pool',
  '/api/cron/reservoir-maintenance',
  '/api/cron/xapi-export',
] as const;

export type CronEndpoint = typeof CRON_ENDPOINTS[number];
