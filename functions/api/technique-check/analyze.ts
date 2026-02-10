/**
 * POST /api/technique-check/analyze
 * Analyze physical exam technique from video (e.g. otoscope hold).
 * Body: multipart form-data with "video" (file) and "query" (string).
 * Returns { critique: string, boundingBoxes?: Array<{ label, x, y, w, h }> }.
 */

import { withMiddleware, withCors, withErrorHandling, withAuth } from '../_shared/middleware';
import type { AuthenticatedContext } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB
const TECHNIQUE_MODEL = 'gemini-2.0-flash-exp';

interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestOptions = withCors();

export const onRequestPost = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  async (context: AuthenticatedContext) => {
    const { request, env } = context;
    const log = createEndpointLogger('/api/technique-check/analyze', context.auth?.userId ?? 'system');
    const envTyped = env as Env;

    if (!envTyped.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Expected multipart/form-data with "video" and "query"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Invalid multipart body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!videoFile || videoFile.size === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty "video" file' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (videoFile.size > MAX_VIDEO_SIZE) {
      return new Response(
        JSON.stringify({ error: `Video too large (max ${MAX_VIDEO_SIZE / 1024 / 1024}MB)` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Missing "query" (e.g. Is the otoscope held correctly for a pediatric exam?)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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
      log.warn('Gemini technique-check failed', { status: geminiRes.status, text: text.slice(0, 200) });
      return new Response(
        JSON.stringify({ error: 'Analysis failed', details: text.slice(0, 200) }),
        { status: geminiRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const textPart = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    let critique = '';
    let boundingBoxes: Array<{ label: string; x: number; y: number; w: number; h: number }> = [];

    try {
      const parsed = JSON.parse(textPart) as { critique?: string; boundingBoxes?: Array<{ label?: string; x?: number; y?: number; w?: number; h?: number }> };
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

    return new Response(
      JSON.stringify({ critique, boundingBoxes }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
);
