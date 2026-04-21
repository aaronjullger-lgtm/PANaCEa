/**
 * POST /api/technique-check/analyze
 * Analyze physical exam technique from video (e.g. otoscope hold).
 * Body: multipart form-data with "video" (file) and "query" (string).
 * Returns { critique: string, boundingBoxes?: Array<{ label, x, y, w, h }> }.
 *
 * Validation model:
 *   - Content-type gate (415) rejects non-multipart requests before formData()
 *     materializes the body.
 *   - Content-Length short-circuit (413) rejects oversized payloads before
 *     materialization. A post-materialization video.size guard remains as
 *     defense-in-depth for requests that omit or misreport Content-Length.
 *   - "query" field is bounded to MAX_QUERY_CHARS to prevent oversized prompts
 *     from reaching Gemini.
 *   - "video" field must be a non-empty File.
 *
 * Auth / rate-limit stack:
 *   Uses `aiEndpoint` (authed + 10 req/min, Gemini-appropriate budget).
 *   `source: 'query'` is required because this endpoint consumes the multipart
 *   body itself — the default `source: 'body'` would try to JSON.parse the
 *   multipart payload and fail.
 */

import { z } from 'zod';
import { aiEndpoint, withCors} from '../_shared/middleware';
import { ok, fail } from '../_shared/api-response';
import { ErrorCode } from '../_shared/error-catalog';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_QUERY_CHARS = 2000;
const TECHNIQUE_MODEL = 'gemini-2.0-flash-exp';

interface Env {
  GEMINI_API_KEY?: string;
}

// No query params are required — the real payload is in the multipart body.
// A permissive schema keeps validation middleware happy without consuming it.
const querySchema = z.record(z.string(), z.string()).optional();

export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(
  querySchema,
  async (context) => {
    const { request, env } = context;
    const log = createEndpointLogger(
      '/api/technique-check/analyze',
      context.auth?.userId ?? 'system'
    );
    const envTyped = env as Env;

    if (!envTyped.GEMINI_API_KEY) {
      return fail(ErrorCode.ENV_MISCONFIGURED, {
        message: 'GEMINI_API_KEY not configured',
        request,
      });
    }

    // Content-type gate: only multipart/form-data is supported.
    // Rejecting before formData() avoids wasted work on misrouted traffic.
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return fail(ErrorCode.VALIDATION_FAILED, {
        status: 415,
        message:
          'Unsupported content-type. Expected multipart/form-data with "video" and "query" fields.',
        request,
      });
    }

    // Content-Length short-circuit: reject oversized payloads before formData()
    // materializes the whole body into memory. The post-materialization
    // video.size check below remains as a defense-in-depth safety net for
    // requests that omit or misreport Content-Length.
    const contentLength = Number.parseInt(
      request.headers.get('content-length') ?? '0',
      10
    );
    if (Number.isFinite(contentLength) && contentLength > MAX_VIDEO_SIZE) {
      return fail(ErrorCode.PAYLOAD_TOO_LARGE, {
        status: 413,
        message: `Payload too large. Max ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
        request,
      });
    }

    let videoFile: File | null = null;
    let query = '';

    try {
      const formData = await request.formData();
      const videoEntry = formData.get('video');
      if (videoEntry instanceof File) videoFile = videoEntry;
      const queryEntry = formData.get('query');
      if (typeof queryEntry === 'string') query = queryEntry.trim();
    } catch {
      return fail(ErrorCode.VALIDATION_FAILED, {
        status: 400,
        message: 'Invalid multipart body',
        request,
      });
    }

    if (!videoFile || videoFile.size === 0) {
      return fail(ErrorCode.VALIDATION_FAILED, {
        status: 400,
        message: 'Missing or empty "video" file',
        request,
      });
    }
    if (videoFile.size > MAX_VIDEO_SIZE) {
      return fail(ErrorCode.PAYLOAD_TOO_LARGE, {
        status: 413,
        message: `Video too large (max ${MAX_VIDEO_SIZE / 1024 / 1024}MB)`,
        request,
      });
    }
    if (!query) {
      return fail(ErrorCode.VALIDATION_FAILED, {
        status: 400,
        message:
          'Missing "query" (e.g. Is the otoscope held correctly for a pediatric exam?)',
        request,
      });
    }
    if (query.length > MAX_QUERY_CHARS) {
      return fail(ErrorCode.VALIDATION_FAILED, {
        status: 400,
        message: `"query" too long (max ${MAX_QUERY_CHARS} characters)`,
        request,
      });
    }

    const mimeType = videoFile.type || 'video/mp4';
    const videoBytes = await videoFile.arrayBuffer();
    const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoBytes)));

    const systemPrompt = `You are a medical education expert evaluating physical exam technique from video. Answer the user's question with a brief, actionable critique. If you can identify specific regions (e.g. hand position, instrument handle), return a JSON object with:
- "critique": string (2-4 sentences)
- "boundingBoxes": optional array of { "label": string, "x": number 0-1, "y": number 0-1, "w": number 0-1, "h": number 0-1 } for key regions (normalized coordinates, top-left origin)
Return ONLY valid JSON, no markdown.`;

    const geminiUrl = `${GEMINI_BASE}/v1beta/models/${TECHNIQUE_MODEL}:generateContent?key=${envTyped.GEMINI_API_KEY}`;
    const geminiBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: videoBase64,
              },
            },
            {
              text: `${systemPrompt}\n\nUser question: ${query}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const text = await geminiRes.text();
      log.warn('Gemini technique-check failed', {
        status: geminiRes.status,
        text: text.slice(0, 200),
      });
      return fail(ErrorCode.GEMINI_ERROR, {
        status: geminiRes.status,
        message: 'Analysis failed',
        details: text.slice(0, 200),
        request,
      });
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const textPart =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    let critique = '';
    let boundingBoxes: Array<{
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }> = [];

    try {
      const parsed = JSON.parse(textPart) as {
        critique?: string;
        boundingBoxes?: Array<{
          label?: string;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
        }>;
      };
      critique = typeof parsed.critique === 'string' ? parsed.critique : '';
      const boxes = parsed.boundingBoxes;
      if (Array.isArray(boxes)) {
        boundingBoxes = boxes
          .filter((b) => b && typeof b.label === 'string')
          .map((b) => ({
            label: b.label!,
            x: Number(b.x) || 0,
            y: Number(b.y) || 0,
            w: Number(b.w) || 0.1,
            h: Number(b.h) || 0.1,
          }));
      }
    } catch {
      critique = textPart.slice(0, 500);
    }

    return ok({ critique, boundingBoxes }, { request });
  },
  { source: 'query', requestsPerMinute: 10 }
);
