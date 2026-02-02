/**
 * POST /api/podcast/generate
 * Proxies to the Node podcast service when PODCAST_SERVICE_URL is set.
 * Auth required. Body: multipart (file = PDF) or { pdfUrl }. Returns script + audioBase64 or job/status.
 */

import { withMiddleware, withCors, withErrorHandling, withAuth } from '../_shared/middleware';
import type { AuthenticatedContext } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

interface Env {
  PODCAST_SERVICE_URL?: string;
}

export const onRequestOptions = withCors();

export const onRequestPost = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  async (context: AuthenticatedContext) => {
    const { request, env } = context;
    const log = createEndpointLogger('/api/podcast/generate', context.auth?.userId ?? 'system');
    const baseUrl = (env as Env).PODCAST_SERVICE_URL?.replace(/\/$/, '');

    if (!baseUrl) {
      return new Response(
        JSON.stringify({
          error: 'Podcast generation is handled by the Node service. Set PODCAST_SERVICE_URL to proxy requests.',
          hint: 'Deploy podcast-service (e.g. to Cloud Run) and set PODCAST_SERVICE_URL to its URL.',
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = `${baseUrl}/generate`;
    const contentType = request.headers.get('content-type') ?? '';
    const isMultipart = contentType.includes('multipart/form-data');

    try {
      const headers = new Headers();
      if (!isMultipart) {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        headers.set('Content-Type', 'application/json');
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const text = await res.text();
        return new Response(text, {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
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
  }
);
