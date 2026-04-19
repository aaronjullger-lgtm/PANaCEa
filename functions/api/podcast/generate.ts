/**
 * POST /api/podcast/generate
 * Proxies to the Node podcast service when PODCAST_SERVICE_URL is set.
 * Auth required. Body: multipart (file = PDF) or { pdfUrl }. Returns script + audioBase64 or job/status.
 *
 * Validation model:
 *   - JSON path: bounded Zod schema via `.safeParse()` with `.passthrough()` so
 *     the downstream service can evolve its own fields without us blocking them,
 *     while still rejecting malformed top-level shapes and oversized pdfUrls.
 *   - Multipart path: content-type gate + total-size ceiling; field-level shape
 *     checks remain owned by the downstream Node service (Cloud Run / etc.),
 *     which is the canonical authority on the multipart contract.
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

interface Env {
  PODCAST_SERVICE_URL?: string;
}

/**
 * JSON-path schema. Permissive by design (this is a proxy), but bounds the
 * shapes we forward: top-level must be an object, pdfUrl must be a URL
 * shorter than 2KB, and known optional scalar fields are bounded.
 * Additional unknown keys are allowed via `.passthrough()` so the Node
 * service stays authoritative on its own field surface.
 */
const PodcastGenerateJsonSchema = z
  .object({
    pdfUrl: z.string().url().max(2048).optional(),
    topic: z.string().max(10_000).optional(),
    voice: z.string().max(128).optional(),
    title: z.string().max(512).optional(),
    // Accept common downstream knobs without enumerating exhaustively.
    language: z.string().max(16).optional(),
    style: z.string().max(64).optional(),
  })
  .passthrough();

/** Hard ceiling on proxied multipart bodies. 25 MB accommodates most PA PDFs. */
const MAX_MULTIPART_BYTES = 25 * 1024 * 1024;

export const PodcastGenerateSchema = PodcastGenerateJsonSchema;
export type PodcastGenerateRequest = z.infer<typeof PodcastGenerateJsonSchema>;

export const onRequestOptions = withCors();

// Use source:'query' with a permissive schema so the wrapper doesn't consume
// the request body stream before the handler can dispatch on content-type
// (JSON vs multipart). The JSON path performs its own Zod validation against
// PodcastGenerateJsonSchema inside the handler.
export const onRequestPost = aiEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { request, env } = context;
    const log = createEndpointLogger('/api/podcast/generate', context.auth?.userId ?? 'system');
    const baseUrl = (env as Env).PODCAST_SERVICE_URL?.replace(/\/$/, '');

    if (!baseUrl) {
      return new Response(
        JSON.stringify({
          error:
            'Podcast generation is handled by the Node service. Set PODCAST_SERVICE_URL to proxy requests.',
          hint: 'Deploy podcast-service (e.g. to Cloud Run) and set PODCAST_SERVICE_URL to its URL.',
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = `${baseUrl}/generate`;
    const contentType = request.headers.get('content-type') ?? '';
    const isMultipart = contentType.includes('multipart/form-data');
    const isJson = contentType.includes('application/json');

    if (!isMultipart && !isJson) {
      return new Response(
        JSON.stringify({
          error:
            'Unsupported content-type. Use application/json with { pdfUrl } or multipart/form-data with a PDF file.',
        }),
        { status: 415, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      if (isJson) {
        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const parsed = PodcastGenerateJsonSchema.safeParse(rawBody);
        if (!parsed.success) {
          log.warn('Podcast JSON payload failed validation', {
            issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          });
          return new Response(
            JSON.stringify({
              error: 'Validation failed',
              details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        const text = await res.text();
        return new Response(text, {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Multipart path. Reject payloads past the ceiling before formData()
      // parses the whole body into memory.
      const contentLength = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
      if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
        return new Response(
          JSON.stringify({
            error: `Payload too large. Max ${MAX_MULTIPART_BYTES} bytes.`,
          }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const formData = await request.formData();
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
      });
    } catch (e) {
      log.error('Podcast proxy error', e);
      return new Response(
        JSON.stringify({
          error: 'Podcast service unavailable',
          details: e instanceof Error ? e.message : 'Unknown',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
  { source: 'query', requestsPerMinute: 5 }
);
