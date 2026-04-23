/**
 * POST /api/vision/analyze
 * "Clinical Eye" (Phase 2) Visual Diagnostics: pathology detection with
 * bounding box and optional code execution for ECG analysis.
 *
 * Sprint 8 (AI Gateway migration): Replaced direct callGemini() with
 * gateway.callVision() (vision-structured mode). Benefits:
 *   - VisionAnalysisSchema Zod validation + single repair pass on malformed JSON
 *   - Telemetry (requestId, traceId, modelUsed, costUsd) captured centrally
 *   - Standardised GatewayError → HTTP status translation
 *   - No more manual regex fence stripping or unvalidated JSON.parse
 *
 * Model: gemini-2.5-pro (tier:'powerful', same capability tier as the prior
 * hardcoded 'gemini-3-pro-preview' — use the stable production alias).
 */

import { z } from 'zod';
import { aiEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../../_shared/rateLimiter';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import {
  VisionAnalysisSchema,
  VISION_ANALYSIS_DESCRIPTION,
} from '@/lib/ai/schemas/extraction';

const MAX_IMAGE_BASE64 = 4 * 1024 * 1024;

const AnalyzeBodySchema = z.object({
  body: z.object({
    imageBase64: z.string().min(1),
    mimeType: z.string().optional().default('image/png'),
    studentQuery: z.string().min(1).max(2000).optional(),
    prompt: z
      .string()
      .min(1)
      .max(4096)
      .optional()
      .default(
        'Detect the primary pathology. Return a JSON object with "diagnosis", "reasoning", and "bounding_box" as [ymin, xmin, ymax, xmax] normalized 0-1000.'
      ),
    isEcg: z.boolean().optional().default(false),
    modelName: z.string().min(1).max(64).optional(),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export const onRequestPost = aiEndpoint(AnalyzeBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof AnalyzeBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/vision/analyze', auth.userId);

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

  const { imageBase64, mimeType, studentQuery, prompt: defaultPrompt, isEcg, modelName } =
    validated.body;

  if (imageBase64.length > MAX_IMAGE_BASE64) {
    return fail(ErrorCode.VALIDATION_FAILED, { message: 'Image too large (max ~4MB base64)' });
  }

  const userPrompt = studentQuery
    ? `${studentQuery}\n\nReturn a JSON object with "diagnosis", "reasoning", and "bounding_box" as [ymin, xmin, ymax, xmax] normalized 0-1000 for overlay.`
    : defaultPrompt;

  try {
    const result = await gateway.callVision<typeof VisionAnalysisSchema._type>(
      toGatewayContext(context as Parameters<typeof toGatewayContext>[0]),
      {
        mode: 'vision-structured',
        task: 'extraction',
        // Use caller's explicit model override, or tier:'powerful' (gemini-2.5-pro)
        // for best spatial understanding without hardcoding a preview model name.
        model: modelName,
        tier: modelName ? undefined : 'powerful',
        endpoint: '/api/vision/analyze',
        userPrompt,
        images: [{ mimeType: mimeType || 'image/png', data: imageBase64 }],
        schema: VisionAnalysisSchema,
        schemaDescription: VISION_ANALYSIS_DESCRIPTION,
        temperature: 0.2,
        maxOutputTokens: 8192,
        tools: isEcg ? [{ code_execution: {} }] : undefined,
      }
    );

    // callVision returns text or structured response based on mode
    const rlHeaders = rateLimitHeaders as Record<string, string>;
    if (result.mode === 'structured') {
      return ok(
        {
          diagnosis: result.data.diagnosis,
          reasoning: result.data.reasoning,
          bounding_box: result.data.bounding_box ?? null,
          model: result.telemetry.modelUsed,
          usageMetadata: result.usage,
        },
        { headers: rlHeaders }
      );
    }

    // Fallback: text mode (shouldn't happen with vision-structured, but be safe)
    return ok(
      { diagnosis: undefined, reasoning: result.text, bounding_box: null, model: result.telemetry.modelUsed },
      { headers: rlHeaders }
    );
  } catch (error) {
    const rlHeaders = rateLimitHeaders as Record<string, string>;
    if (error instanceof GatewayError) {
      log.warn('Vision analyze gateway failure', { code: error.code, requestId: error.requestId });
      const errorCode = error.code === 'RATE_LIMITED' ? ErrorCode.RATE_LIMITED : ErrorCode.GEMINI_ERROR;
      const message = error.code === 'RATE_LIMITED' ? 'Rate limit exceeded'
        : error.code === 'SAFETY_BLOCKED' ? 'Analysis blocked by safety filter'
        : 'Analysis failed';
      return fail(errorCode, { message, headers: rlHeaders });
    }
    log.warn('Vision analyze unexpected error', {
      msg: error instanceof Error ? error.message : String(error),
    });
    return fail(ErrorCode.GEMINI_ERROR, { message: 'Analysis failed', headers: rlHeaders });
  }
});
