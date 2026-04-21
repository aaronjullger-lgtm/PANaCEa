/**
 * Sentry Tunnel - Cloudflare Pages Function
 *
 * This tunnel proxies Sentry SDK requests from the browser to Sentry's ingest servers.
 * This bypasses ad-blockers and CORS/origin restrictions that may block direct Sentry requests.
 *
 * How it works:
 * 1. Sentry SDK sends envelopes to /api/sentry-tunnel instead of directly to sentry.io
 * 2. This function validates the project ID matches our Sentry project
 * 3. Forwards the envelope to Sentry's ingest endpoint
 *
 * Security:
 * - Only forwards to our specific Sentry organization/project
 * - Rejects requests with mismatched project IDs
 *
 * Note: This does NOT violate Database-First architecture - it's a pure proxy with no data storage.
 */

// Our Sentry project configuration
const SENTRY_HOST = 'o4510664011087872.ingest.us.sentry.io';
// FIXED 2026-01-10: Corrected to match actual Sentry SDK DSN project ID
const SENTRY_PROJECT_ID = '4510664023212032';

// Simple in-memory rate limiter for unauthenticated Sentry tunnel (per-isolate).
// Not distributed — each CF isolate tracks independently, which is acceptable
// since the goal is preventing abuse, not exact counting.
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 envelopes per minute per IP
const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function checkSentryRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  bucket.count++;
  return bucket.count <= RATE_LIMIT_MAX;
}

import { fail, ErrorCode } from './_shared/endpoint';

export async function onRequestPost(context: any) {
  const { request } = context;

  // Rate limit by IP to prevent abuse of unauthenticated tunnel
  const clientIp = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!checkSentryRateLimit(clientIp)) {
    return fail(ErrorCode.RATE_LIMITED, { message: 'Rate limited' });
  }

  try {
    // Get the raw envelope body
    const envelopeBody = await request.text();

    if (!envelopeBody || envelopeBody.trim() === '') {
      console.warn('[Sentry Tunnel] Empty envelope body received');
      return fail(ErrorCode.VALIDATION_FAILED, { message: 'Empty envelope body' });
    }

    // Sentry envelopes are newline-delimited JSON; first line is the header (may contain dsn)
    const pieces = envelopeBody.split('\n').filter((line: string) => line.trim() !== '');

    if (pieces.length === 0) {
      console.warn('[Sentry Tunnel] Invalid envelope format - no lines');
      return fail(ErrorCode.VALIDATION_FAILED, { message: 'Invalid envelope format' });
    }

    // Parse the envelope header to extract DSN (optional in some envelope types)
    let header: { dsn?: string } | null = null;
    try {
      header = JSON.parse(pieces[0]) as { dsn?: string };
    } catch (e) {
      console.warn(
        '[Sentry Tunnel] Failed to parse envelope header:',
        pieces[0]?.substring(0, 100)
      );
      return fail(ErrorCode.VALIDATION_FAILED, { message: 'Failed to parse envelope header' });
    }

    // Extract and validate DSN
    const dsn = header.dsn;
    if (!dsn) {
      // Some Sentry envelopes (like session replays) may not have DSN in header
      // In that case, forward to default project
      console.log('[Sentry Tunnel] No DSN in header, using default project');
    }

    let projectId = SENTRY_PROJECT_ID;

    if (dsn) {
      // Parse DSN URL to extract project ID
      let dsnUrl: URL;
      try {
        dsnUrl = new URL(dsn);
      } catch (e) {
        console.warn('[Sentry Tunnel] Invalid DSN format:', dsn?.substring(0, 50));
        return fail(ErrorCode.VALIDATION_FAILED, { message: 'Invalid DSN format' });
      }

      projectId = dsnUrl.pathname.replace(/^\//, '').split('/')[0] || SENTRY_PROJECT_ID;

      if (projectId !== SENTRY_PROJECT_ID) {
        console.warn(`[Sentry Tunnel] Rejected envelope with wrong project ID: ${projectId}`);
        return fail(ErrorCode.FORBIDDEN, { message: 'Invalid project ID' });
      }
    }

    // Construct Sentry ingest URL
    const sentryUrl = `https://${SENTRY_HOST}/api/${SENTRY_PROJECT_ID}/envelope/`;

    // Forward the envelope to Sentry
    const sentryResponse = await fetch(sentryUrl, {
      method: 'POST',
      body: envelopeBody,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        // Pass through the SDK info for Sentry's analytics
        'User-Agent': request.headers.get('User-Agent') || 'PANaCEa-SentryTunnel/1.0',
      },
    });

    // Proxy Sentry's response directly — do not wrap in ok() as this is raw binary/text
    const responseText = await sentryResponse.text();
    const contentType = sentryResponse.headers.get('Content-Type') || 'text/plain';
    return new Response(responseText, {
      status: sentryResponse.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('[Sentry Tunnel] Error:', error);
    return fail(ErrorCode.INTERNAL_ERROR, {
      message: error instanceof Error ? error.message : 'Tunnel error',
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    },
  });
}
