/**
 * POST /api/spark/instant-calc
 * Generate ephemeral clinical calculator micro-apps via GitHub Spark (when available).
 * Body: { prompt: string, calcSlug?: string }.
 * Returns { html?, js?, sandboxConfig?, bundleUrl? } or 501 when not configured.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const BodySchema = z.object({
  prompt: z.string().min(1).max(500),
  calcSlug: z.string().max(100).optional(),
});

interface Env {
  SPARK_API_KEY?: string;
}

export const onRequestPost = aiEndpoint(
  BodySchema,
  async (context) => {
    const { env } = context;
    const log = createEndpointLogger('/api/spark/instant-calc', context.auth?.userId ?? 'system');
    const envTyped = env as Env;

    if (!envTyped.SPARK_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'Instant Calc is not configured',
          hint: 'Set SPARK_API_KEY when GitHub Spark API is available. Use the calculators below in the meantime.',
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { prompt } = context.validated;
    log.info('Instant calc requested', { promptLength: prompt.length });

    // Placeholder: real implementation would call GitHub Spark API to generate micro-app
    // Return a minimal HTML+JS snippet so the sandboxed iframe can render something when wired
    const placeholderHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Calculator</title></head><body style="font-family:system-ui;padding:1rem;background:#1e293b;color:#f1f5f9;"><p>Instant Calc (Spark) not yet wired. Prompt: ${prompt.slice(0, 80).replaceAll('<', '&lt;')}…</p><p style="color:#94a3b8;font-size:0.875rem;">Configure SPARK_API_KEY and call the Spark API to generate micro-apps.</p></body></html>`;

    return new Response(
      JSON.stringify({
        html: placeholderHtml,
        js: undefined,
        sandboxConfig: { allowScripts: true },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
  { requestsPerMinute: 30 }
);
