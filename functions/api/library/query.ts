/**
 * POST /api/library/query
 * Phase 5: Smart Library (Context Caching) — "Chat with your Textbook."
 *
 * Student benefit: Ask "What is the first-line treatment for Lyme disease according to Harrison's?"
 * and get a cited answer. Reduces hallucination; PANCE requires textbook-perfect answers.
 *
 * Cursor Implementation Plan (Phase 5):
 * 1. Step 1 (Ingest): Adobe PDF Extract → text + bounding boxes → structuredData.json in Supabase; set adobeDataPath.
 * 2. Step 2 (Cache): scripts/library/ingest-cache.ts or genai.caches.create → TTL 2h; store cacheName in DB (geminiCacheName).
 * 3. Step 3 (Query): models.generateContent with cachedContent (this endpoint). Returns answer + citations.
 * 4. Citation mapping: LLM must return citations as {{Page:X}} or {{Pages:N-M}}. Frontend uses Adobe JSON bounds to draw yellow highlight on page X in the PDF viewer.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const LIBRARY_QUERY_MODEL = 'gemini-2.0-flash';

const QueryBodySchema = z.object({
  body: z.object({
    cachedContent: z.string().min(1).startsWith('cachedContents/'),
    query: z.string().min(1).max(8000),
    maxTokens: z.number().int().min(256).max(8192).optional().default(2048),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

/** Parse {{Page:N}} and {{Pages:N-M}} from answer. */
function parsePageCitations(answer: string): number[] {
  const pages = new Set<number>();
  const single = /\{\{Page:\s*(\d+)\}\}/g;
  const range = /\{\{Pages:\s*(\d+)\s*[-–]\s*(\d+)\}\}/g;
  let m: RegExpExecArray | null;
  single.lastIndex = 0;
  while ((m = single.exec(answer)) !== null) pages.add(Number.parseInt(m[1], 10));
  range.lastIndex = 0;
  while ((m = range.exec(answer)) !== null) {
    const a = Number.parseInt(m[1], 10);
    const b = Number.parseInt(m[2], 10);
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++) pages.add(p);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

const CITATION_INSTRUCTION =
  'Answer using only the cached content. Cite sources in this exact format so the frontend can highlight: {{Page:N}} for a single page or {{Pages:N-M}} for a range.';

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(QueryBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof QueryBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/library/query', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
    env,
    identifier,
    'gemini'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { cachedContent, query, maxTokens } = validated.body;

  const url = `${GEMINI_BASE}/v1beta/models/${LIBRARY_QUERY_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = {
    cachedContent,
    contents: [{ role: 'user', parts: [{ text: query }] }],
    systemInstruction: { parts: [{ text: CITATION_INSTRUCTION }] },
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: maxTokens,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    log.warn('Library query fetch error', { msg: err instanceof Error ? err.message : String(err) });
    return new Response(
      JSON.stringify({ error: 'Library query service unavailable' }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
    );
  }

  if (res.ok) {
    const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const answer = typeof rawText === 'string' ? rawText.trim() : '';
  const pageNumbers = parsePageCitations(answer);

  return new Response(
    JSON.stringify({
      data: {
        answer,
        citations: pageNumbers.map((page) => ({ page })),
        pageNumbers,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
    }
  );
  }

  const text = await res.text();
  log.warn('Library query Gemini error', { status: res.status, text: text.slice(0, 300) });
  return new Response(
    JSON.stringify({
      error: res.status === 429 ? 'Rate limit exceeded' : 'Query failed',
      details: res.status === 429 ? undefined : text.slice(0, 500),
    }),
    {
      status: res.status === 429 ? 429 : 502,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
    }
  );
});
