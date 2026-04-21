/**
 * POST /api/lecture/script
 * Lecture Converter – Convert text/slides into a multi-speaker podcast script.
 *
 * Uses Gemini 1.5 Pro to generate a "Deep Dive" style script (Host A / Host B)
 * for the Commuter Curriculum. Output is script only; TTS can be added separately.
 *
 * @see docs/AI_INTEGRATION_ROADMAP.md – Phase 2 #6
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash'; // Fast, good for script generation
const MAX_TEXT_LENGTH = 50000; // ~12k tokens

const ScriptBodySchema = z.object({
  /** Lecture/slides text to convert. Plain text from PDF or slides. */
  text: z.string().min(100, 'At least 100 characters of text required').max(MAX_TEXT_LENGTH),
  /** Optional topic or title for context (e.g. "Cardiovascular Physiology") */
  topic: z.string().max(200).optional(),
  /** Target duration in minutes for the script (affects length) */
  targetMinutes: z.number().int().min(3).max(30).optional().default(10),
  /** Include SSML tags for TTS (pauses, emphasis on key terms) */
  includeSsml: z.boolean().optional().default(false),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

const SCRIPT_SYSTEM = `You are a medical education podcast scriptwriter. Generate a Socratic dialogue between an Attending (senior physician) and a Student (PA student) discussing the provided lecture content.

Rules:
- Attending: Asks "Why?", challenges assumptions, adds clinical pearls. Grills the student. Occasionally corrects errors.
- Student: Answers questions, sometimes gets it wrong and is corrected. Asks for clarification. Models real rounds.
- Format: "Attending: ..." and "Student: ..."
- Keep it conversational and educational. Prioritize high-yield clinical points and PANCE-relevant material.
- Each speaker block: 1-3 sentences. Vary who speaks first.
- Do NOT add stage directions or meta-commentary.
- End with a concise summary from the Attending.
- Output a JSON object with keys: "script" (the dialogue text), "summary_points" (array of 3-5 key takeaways as strings).`;

export const onRequestPost = aiEndpoint(ScriptBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof ScriptBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/lecture/script', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request, auth.userId);
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'gemini'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { text, topic, targetMinutes, includeSsml } = validated;
  const apiKey = env.GEMINI_API_KEY;
  const url = `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  const ssmlInstruction = includeSsml
    ? ` Add SSML tags where helpful: <break time="500ms"/> for dramatic pauses, <emphasis level="strong">key term</emphasis> for drug names or critical concepts.`
    : '';

  const userPrompt = `Convert this lecture content into a ${targetMinutes}-minute podcast script (Attending / Student Socratic dialogue).${ssmlInstruction}

${topic ? `Topic: ${topic}\n\n` : ''}Content:
${text.slice(0, 45000)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${SCRIPT_SYSTEM}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      log.warn('Gemini script error', { status: res.status, text: errText.slice(0, 300) });
      return fail(res.status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.GEMINI_ERROR, {
        message: res.status === 429 ? 'Rate limit exceeded' : 'Script generation failed',
        details: errText.slice(0, 500),
        headers: rateLimitHeaders as Record<string, string>,
      });
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';

    let script = '';
    let summaryPoints: string[] = [];
    try {
      const parsed = JSON.parse(rawText) as { script?: string; summary_points?: string[] };
      script = typeof parsed.script === 'string' ? parsed.script.trim() : rawText;
      summaryPoints = Array.isArray(parsed.summary_points) ? parsed.summary_points : [];
    } catch {
      script = rawText;
    }

    if (!script) {
      return fail(ErrorCode.GEMINI_ERROR, {
        message: 'No script generated',
        headers: rateLimitHeaders as Record<string, string>,
      });
    }

    return ok(
      { script, summary_points: summaryPoints, topic: topic ?? undefined, targetMinutes },
      { headers: rateLimitHeaders as Record<string, string> }
    );
  } catch (err) {
    log.error('Lecture script error', err);
    return fail(ErrorCode.INTERNAL_ERROR, { message: 'Internal server error' });
  }
});
