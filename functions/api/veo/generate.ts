/**
 * POST /api/veo/generate
 * Generate short clinical videos (e.g. gait, movement) via Veo.
 * Body: { prompt: string, durationSeconds?: number }.
 * Returns { videoUrl? } or { jobId? } for async polling.
 * Set VEO_ENABLED and Vertex AI credentials to enable.
 */

import { z } from 'zod';
import { withMiddleware, withCors, withErrorHandling, withAuth } from '../_shared/middleware';
import type { AuthenticatedContext } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const GenerateBodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  durationSeconds: z.number().min(1).max(30).optional().default(5),
});

interface Env {
  VEO_ENABLED?: string;
  GEMINI_API_KEY?: string;
}

export const onRequestOptions = withCors();

export const onRequestPost = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  async (context: AuthenticatedContext) => {
    const { request, env } = context;
    const log = createEndpointLogger('/api/veo/generate', context.auth?.userId ?? 'system');
    const envTyped = env as Env;

    if (!envTyped.VEO_ENABLED || envTyped.VEO_ENABLED !== 'true') {
      return new Response(
        JSON.stringify({
          error: 'Video generation is not configured',
          hint: 'Set VEO_ENABLED=true and configure Vertex AI (project/location) for Veo 2/3. When available, this endpoint will return videoUrl or jobId for async polling.',
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: z.infer<typeof GenerateBodySchema>;
    try {
      const raw = await request.json();
      body = GenerateBodySchema.parse(raw);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid body. Expected { prompt: string, durationSeconds?: number }' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, durationSeconds } = body;
    log.info('Veo generate requested', { promptLength: prompt.length, durationSeconds });

    // Placeholder: real implementation would call Vertex AI Veo API
    // POST https://LOCATION-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/LOCATION/publishers/google/models/veo-2.0-generate-001:predict
    // Returns operation/jobId for async polling or videoUrl when done.
    return new Response(
      JSON.stringify({
        jobId: `veo-placeholder-${Date.now()}`,
        message: 'Veo API not yet wired. Configure Vertex AI project/location and call the Veo predict endpoint. This placeholder allows the UI to be built.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
);
