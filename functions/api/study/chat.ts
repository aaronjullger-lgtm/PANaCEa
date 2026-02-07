/**
 * POST /api/study/chat
 *
 * Intelligent Study Companion: "Chat with your Textbook"
 * Combines Smart Library (PDF in Supabase) + Tutor (Gemini with Context Caching)
 * and returns answer plus citation highlight coordinates from Adobe Extract.
 *
 * Input: { resourceId: string (UUID), userQuery: string }
 * Output: { answer: string, citations: [...], citationsFallback?: boolean }
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';
import { pdfBoundsToPercent } from '../../../lib/utils/pdfCoordinates';

const RESOURCE_BUCKET = 'educational-resources';
const STUDY_CHAT_MODEL = 'gemini-1.5-pro';
const CACHE_TTL_SECONDS = 3600; // 60 minutes
const CACHE_MIN_REMAINING_MINUTES = 10;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const StudyChatSchema = z.object({
  resourceId: z.string().uuid('Invalid resource ID'),
  userQuery: z.string().min(1, 'Query is required').max(8000),
});

export const onRequestOptions = withCors();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff for Gemini 429 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const status = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 0;
      if (status === 429 && attempt < maxAttempts - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await sleep(delayMs);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

/** Download PDF from Supabase: use fileUrl (public) or bucket + storagePath with auth */
async function downloadPdfFromSupabase(
  fileUrl: string | null,
  storagePath: string | null,
  env: Env
): Promise<ArrayBuffer> {
  if (fileUrl) {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new StudyChatError(404, 'PDF not found at file URL');
    return res.arrayBuffer();
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !storagePath) {
    throw new StudyChatError(400, 'Resource has no fileUrl or storagePath; Supabase env required for storagePath');
  }
  const url = `${env.SUPABASE_URL}/storage/v1/object/${RESOURCE_BUCKET}/${storagePath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new StudyChatError(404, 'PDF not found in storage');
  return res.arrayBuffer();
}

/** Resumable upload to Gemini Files API; returns file URI and name */
async function uploadPdfToGemini(
  pdfBytes: ArrayBuffer,
  apiKey: string
): Promise<{ fileUri: string; fileName: string }> {
  const size = pdfBytes.byteLength;
  const mimeType = 'application/pdf';

  const startRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'textbook' } }),
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    throw new StudyChatError(startRes.status === 429 ? 429 : 502, `Gemini upload start failed: ${text}`);
  }

  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new StudyChatError(502, 'Gemini did not return upload URL');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: pdfBytes,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new StudyChatError(uploadRes.status === 429 ? 429 : 502, `Gemini upload finalize failed: ${text}`);
  }

  const data = (await uploadRes.json()) as { file?: { uri?: string; name?: string } };
  const fileUri = data.file?.uri;
  const fileName = data.file?.name;
  if (!fileUri || !fileName) throw new StudyChatError(502, 'Gemini upload response missing file.uri or file.name');
  return { fileUri, fileName };
}

/** Create cachedContent from file URI; returns cache name and expire time */
async function createGeminiCache(
  fileUri: string,
  apiKey: string
): Promise<{ cacheName: string; expireTime: string }> {
  const systemInstruction =
    'You are a senior clinical educator for PA students. Answer using the provided cached textbook. Cite sources in this exact format so the frontend can highlight: {{Page:N}} for a single page or {{Pages:N-M}} for a range. You may also use [Page X] or [Pages X-Y].';

  const body = {
    model: `models/${STUDY_CHAT_MODEL}`,
    contents: [
      {
        role: 'user',
        parts: [{ fileData: { fileUri, mimeType: 'application/pdf' } }],
      },
    ],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    ttl: `${CACHE_TTL_SECONDS}s`,
  };

  const res = await fetch(`${GEMINI_BASE}/v1beta/cachedContents?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new StudyChatError(res.status === 429 ? 429 : 502, `Gemini cache create failed: ${text}`);
  }

  const data = (await res.json()) as { name?: string; expireTime?: string };
  const cacheName = data.name;
  const expireTime = data.expireTime;
  if (!cacheName || !expireTime) throw new StudyChatError(502, 'Gemini cache response missing name or expireTime');
  return { cacheName, expireTime };
}

/** Generate answer using cached content */
async function generateWithCache(
  cacheName: string,
  userQuery: string,
  apiKey: string
): Promise<string> {
  const url = `${GEMINI_BASE}/v1beta/models/${STUDY_CHAT_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    cachedContent: cacheName,
    contents: [{ role: 'user', parts: [{ text: userQuery }] }],
    generationConfig: { temperature: 0.2, topK: 40, topP: 0.95, maxOutputTokens: 2048 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new StudyChatError(res.status === 429 ? 429 : 502, `Gemini generateContent failed: ${text}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text == null) throw new StudyChatError(502, 'Gemini returned no text');
  return text;
}

/**
 * Parse page citations from tutor answer. Supports:
 * {{Page:N}}, {{Pages:N-M}}, [Page N], [Pages N-M], [p. N], [pp. N-M], [page N], (Page N)
 */
function parsePageCitations(answer: string): number[] {
  const pages = new Set<number>();
  const patterns: Array<{ single: RegExp; range?: RegExp }> = [
    { single: /\{\{Page:\s*(\d+)\}\}/g, range: /\{\{Pages:\s*(\d+)\s*[-–]\s*(\d+)\}\}/g },
    { single: /\[Page\s+(\d+)\]/gi, range: /\[Pages\s+(\d+)\s*[-–]\s*(\d+)\]/gi },
    { single: /\[p\.\s*(\d+)\]/gi, range: /\[pp\.\s*(\d+)\s*[-–]\s*(\d+)\]/gi },
    { single: /\[page\s+(\d+)\]/gi, range: /\[pages\s+(\d+)\s*[-–]\s*(\d+)\]/gi },
    { single: /\(Page\s+(\d+)\)/g },
    { single: /\(p\.\s*(\d+)\)/gi },
  ];
  for (const { single, range } of patterns) {
    let m: RegExpExecArray | null;
    single.lastIndex = 0;
    while ((m = single.exec(answer)) !== null) pages.add(Number.parseInt(m[1] ?? '0', 10));
    if (range) {
      range.lastIndex = 0;
      while ((m = range.exec(answer)) !== null) {
        const a = Number.parseInt(m[1] ?? '0', 10);
        const b = Number.parseInt(m[2] ?? '0', 10);
        for (let p = Math.min(a, b); p <= Math.max(a, b); p++) pages.add(p);
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Adobe Extract JSON (stored at resource.adobeDataPath in Supabase).
 * Expected shape: { pages: AdobePageBounds[] }. Coordinates are 72 DPI, bottom-left origin.
 * See docs/STUDY_COMPANION_ADOBE_EXTRACT.md for full format.
 */
interface AdobePageBounds {
  pageNumber?: number;
  width?: number;
  height?: number;
  bounds?: { x: number; y: number; width: number; height: number };
  elements?: Array<{ bounds?: { x: number; y: number; width: number; height: number } }>;
}

/** Fetch Adobe Extract JSON from Supabase and build citation highlight boxes. Returns fallback boxes and citationsFallback: true when Adobe data is missing or fetch fails. */
async function getCitationHighlightBoxes(
  pageNumbers: number[],
  adobeDataPath: string | null,
  env: Env
): Promise<{
  citations: Array<{ page: number; highlightBox: { top: number; left: number; width: number; height: number } }>;
  citationsFallback: boolean;
}> {
  const fallbackBox = { top: 0, left: 0, width: 100, height: 10 };
  const fallback = pageNumbers.map((page) => ({ page, highlightBox: fallbackBox }));

  if (!pageNumbers.length || !adobeDataPath || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { citations: fallback, citationsFallback: true };
  }

  const bucket = RESOURCE_BUCKET;
  const url = `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${adobeDataPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) return { citations: fallback, citationsFallback: true };

  let adobe: { pages?: AdobePageBounds[] };
  try {
    adobe = (await res.json()) as { pages?: AdobePageBounds[] };
  } catch {
    return { citations: fallback, citationsFallback: true };
  }

  const pages = adobe.pages ?? [];
  const citations = pageNumbers.map((pageNum) => {
    const pageData =
      pages.find((p) => (p.pageNumber ?? 0) === pageNum) ?? pages[pageNum - 1];
    const pageWidth = pageData?.width ?? 612;
    const pageHeight = pageData?.height ?? 792;
    const bounds = pageData?.bounds ?? pageData?.elements?.[0]?.bounds;
    if (!bounds) {
      return { page: pageNum, highlightBox: fallbackBox };
    }
    const highlightBox = pdfBoundsToPercent(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      pageWidth,
      pageHeight
    );
    return { page: pageNum, highlightBox };
  });
  return { citations, citationsFallback: false };
}

class StudyChatError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'StudyChatError';
  }
}

export const onRequestPost = authenticatedEndpoint(
  StudyChatSchema,
  async (context) => {
    const { env, validated } = context as {
      env: Env;
      validated: z.infer<typeof StudyChatSchema>;
    };
    const logger = createEndpointLogger('/api/study/chat');

    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
      validateFunctionEnv(env as unknown as Record<string, unknown>, 'DATABASE');
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const { resourceId, userQuery } = validated;

    try {
      const resource = await prisma.educationalResource.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          fileUrl: true,
          storagePath: true,
          geminiCacheName: true,
          geminiCacheExpiresAt: true,
          adobeDataPath: true,
          approvalStatus: true,
        },
      });

      if (!resource) {
        return new Response(
          JSON.stringify({ error: 'Resource not found', resourceId }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (resource.approvalStatus !== 'approved') {
        return new Response(
          JSON.stringify({ error: 'Resource not approved for use', resourceId }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const needsSupabase = (resource.storagePath != null && resource.fileUrl == null) || resource.adobeDataPath != null;
      if (needsSupabase) {
        try {
          validateFunctionEnv(env as unknown as Record<string, unknown>, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
        } catch (e) {
          if (e instanceof MissingEnvError) return e.toResponse();
          throw e;
        }
      }

      const now = new Date();
      const minExpiry = new Date(now.getTime() + CACHE_MIN_REMAINING_MINUTES * 60 * 1000);
      let cacheName = resource.geminiCacheName;
      let cacheExpiresAt = resource.geminiCacheExpiresAt;

      if (!cacheName || !cacheExpiresAt || cacheExpiresAt < minExpiry) {
        const pdfBuffer = await downloadPdfFromSupabase(
          resource.fileUrl,
          resource.storagePath,
          env
        );
        const { fileUri } = await withRetry(() =>
          uploadPdfToGemini(pdfBuffer, env.GEMINI_API_KEY)
        );
        const cache = await withRetry(() => createGeminiCache(fileUri, env.GEMINI_API_KEY));
        cacheName = cache.cacheName;
        cacheExpiresAt = new Date(cache.expireTime);

        await prisma.educationalResource.update({
          where: { id: resourceId },
          data: {
            geminiCacheName: cacheName,
            geminiCacheExpiresAt: cacheExpiresAt,
            updatedAt: now,
          },
        });
        logger.info('Study chat cold start: cache created', { resourceId, cacheName });
      }

      const effectiveCacheName = cacheName ?? '';
      if (!effectiveCacheName) {
        throw new StudyChatError(502, 'Missing cache name after cold start');
      }
      const answer = await withRetry(() =>
        generateWithCache(effectiveCacheName, userQuery, env.GEMINI_API_KEY)
      );

      const pageNumbers = parsePageCitations(answer);
      const { citations, citationsFallback } = await getCitationHighlightBoxes(
        pageNumbers,
        resource.adobeDataPath,
        env
      );

      const payload = {
        answer,
        citations,
        ...(citationsFallback ? { citationsFallback: true } : {}),
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      if (e instanceof StudyChatError) {
        logger.warn('Study chat error', { status: e.status, message: e.message });
        return new Response(JSON.stringify({ error: e.message }), {
          status: e.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      logger.error('Study chat unexpected error', e);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);
