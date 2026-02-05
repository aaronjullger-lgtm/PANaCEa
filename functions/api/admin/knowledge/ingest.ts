/**
 * POST /api/admin/knowledge/ingest
 * Deep Database: Ingest PANCE blueprint / textbook content for context caching.
 * Accepts text content (or fileUri from Gemini Files). Groups by PANCE category.
 * Creates Gemini context cache (cache_pance_master_v1) with 24h TTL.
 * Edge-safe: no Node fs; use fetch + Gemini API only.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEndpointLogger } from '../../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const CACHE_MODEL = 'gemini-1.5-pro';
const DEFAULT_CACHE_DISPLAY_NAME = 'cache_pance_master_v1';
const TTL_24H = 86400; // 24 hours

const IngestSchema = z.object({
  body: z.object({
    /** Pre-extracted text (e.g. from Adobe PDF Extract or Gemini). Group by category if desired. */
    content: z.string().min(1).optional(),
    /** Gemini Files API fileUri (e.g. from upload). Used when content not provided. */
    fileUri: z.string().min(1).optional(),
    /** PANCE category label for grouping (e.g. "Cardiology", "Pulmonology"). */
    category: z.string().max(128).optional(),
    /** Cache display name; default cache_pance_master_v1. */
    displayName: z.string().max(128).optional(),
    /** TTL in seconds; default 24h. */
    ttlSeconds: z.number().int().min(3600).max(604800).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(IngestSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/admin/knowledge/ingest');

  if (!env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { content, fileUri, category, displayName, ttlSeconds } = validated.body;
  const hasContent = content != null && content.trim().length > 0;
  const hasFile = fileUri != null && fileUri.trim().length > 0;

  if (!hasContent && !hasFile) {
    return new Response(
      JSON.stringify({ error: 'Provide content (text) or fileUri (Gemini file)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const ttl = ttlSeconds ?? TTL_24H;
  const name = displayName ?? DEFAULT_CACHE_DISPLAY_NAME;

  let contents: Array<{ role: string; parts: Array<{ text?: string; fileData?: { fileUri: string; mimeType?: string } }> }>;

  if (hasContent) {
    const grouped = category
      ? `## ${category}\n\n${content.trim()}`
      : content.trim();
    contents = [{ role: 'user', parts: [{ text: grouped }] }];
  } else {
    contents = [
      {
        role: 'user',
        parts: [{ fileData: { fileUri: fileUri!, mimeType: 'application/pdf' } }],
      },
    ];
  }

  const body = {
    model: `models/${CACHE_MODEL}`,
    contents,
    ttl: `${ttl}s`,
    displayName: name,
  };

  try {
    const res = await fetch(
      `${GEMINI_BASE}/v1beta/cachedContents?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      logger.warn('Gemini cache create failed', { status: res.status, text: text.slice(0, 300) });
      return new Response(
        JSON.stringify({ error: `Failed to create cache: ${res.status}`, details: text.slice(0, 500) }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = (await res.json()) as {
      name?: string;
      expireTime?: string;
      expiration?: { expireTime?: string };
    };
    const cacheName = data.name;
    const expireTime = data.expiration?.expireTime ?? data.expireTime;

    if (!cacheName) {
      return new Response(
        JSON.stringify({ error: 'Invalid cache response: missing name' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.info('PANCE knowledge cache created', {
      cacheName,
      category: category ?? 'all',
      userId: auth.userId?.substring(0, 10),
    });

    return new Response(
      JSON.stringify({
        data: {
          cacheName,
          displayName: name,
          expireTime: expireTime ?? null,
          ttlSeconds: ttl,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Ingest error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to ingest knowledge');
  }
});
