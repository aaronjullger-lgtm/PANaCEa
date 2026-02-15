/**
 * POST /api/intelligence/socratic-remediation
 *
 * Socratic Remediation: Returns a guiding question (NOT the answer) based on the
 * student's wrong answer. Used for "Tutor Me" in Review Mode when reviewing incorrect answers.
 * Forces the student to generate the logic and fix the knowledge gap.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.5-flash';

const BodySchema = z.object({
  body: z.object({
    vignette: z.string().min(1),
    question: z.string().min(1),
    correctAnswer: z.string().min(1),
    userWrongAnswer: z.string().min(1),
    options: z.array(z.string()).optional(),
    history: z.array(z.object({ role: z.enum(['user', 'tutor']), text: z.string() })).optional(),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

const SOCRATIC_SYSTEM = `You are a PANCE Tutor. The student got this question wrong. Your job is to help them realize WHY their answer was wrong through guiding questions.

RULES:
1. Do NOT give them the answer. Do NOT explain the correct answer yet.
2. Ask ONE short, specific guiding question (1-2 sentences max).
3. If they have responded, acknowledge their response and ask a follow-up that nudges them toward the right reasoning.
4. Reference key details from the vignette. Use a supportive, Socratic tone.
5. Output ONLY the guiding question text, no preamble, no "Here's a question:", no markdown.`;

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'gemini'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { vignette, question, correctAnswer, userWrongAnswer, options, history } = validated.body;

  const historyBlock =
    history && history.length > 0
      ? `\nPrior conversation:\n${history.map((h) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n')}\n\n`
      : '';

  const userPrompt = `Vignette:
${vignette.slice(0, 3000)}

Question: ${question}
Correct answer: "${correctAnswer}"
Student's wrong answer: "${userWrongAnswer}"
${options?.length ? `All options: ${options.join(' | ')}` : ''}
${historyBlock}Generate ONE short guiding question. Do not give the answer.`;

  const url = `${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: SOCRATIC_SYSTEM }] },
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      status: res.status === 429 ? 429 : 502,
      error: res.status === 429 ? 'Rate limit exceeded' : 'Socratic remediation failed',
    };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  return {
    data: {
      guidingQuestion:
        text || 'What detail in the vignette suggests your answer might not fit this patient?',
    },
  };
});
