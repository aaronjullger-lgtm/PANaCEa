/**
 * API Endpoint: /api/ai/generate-mnemonic
 * POST: Generate a mnemonic for a medical concept using Gemini.
 *
 * Request: { concept, context?, existingMnemonics? }
 * Response: { data: { mnemonic, explanation, type } }
 * type: 'acronym' | 'story' | 'visual' | 'rhyme'
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';

interface Env {
  GEMINI_API_KEY: string;
  CLERK_SECRET_KEY: string;
  RATE_LIMIT_KV?: unknown;
}

const GenerateMnemonicSchema = z.object({
  concept: z.string().min(1, 'Concept is required'),
  context: z.string().optional(),
  existingMnemonics: z.array(z.string()).optional().default([]),
});

const MNEMONIC_TYPES = ['acronym', 'story', 'visual', 'rhyme'] as const;
type MnemonicType = (typeof MNEMONIC_TYPES)[number];

function parseGeminiMnemonicResponse(text: string): {
  mnemonic: string;
  explanation: string;
  type: MnemonicType;
} {
  const trimmed = text.trim();
  // Try to parse as JSON first (ask model to return JSON)
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const mnemonic = typeof parsed.mnemonic === 'string' ? parsed.mnemonic : trimmed;
      const explanation =
        typeof parsed.explanation === 'string' ? parsed.explanation : 'Generated mnemonic.';
      const typeRaw = parsed.type;
      const type: MnemonicType =
        typeof typeRaw === 'string' && MNEMONIC_TYPES.includes(typeRaw as MnemonicType)
          ? (typeRaw as MnemonicType)
          : 'acronym';
      return { mnemonic, explanation, type };
    } catch {
      // fall through to plain text
    }
  }
  return {
    mnemonic: trimmed,
    explanation: 'Generated mnemonic.',
    type: 'acronym',
  };
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  GenerateMnemonicSchema,
  async (context) => {
    const { env, validated } = context as {
      env: Env;
      validated: z.infer<typeof GenerateMnemonicSchema>;
    };

    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
    } catch (error) {
      if (error instanceof MissingEnvError) {
        return error.toResponse();
      }
      throw error;
    }

    const { request } = context;
    const identifier = getRateLimitIdentifier(request);
    const { response: rateLimitResponse } = await withRateLimit(
      env as { RATE_LIMIT_KV?: KVNamespace },
      identifier,
      'gemini'
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { concept, context: contextOpt, existingMnemonics = [] } = validated;
    const apiKey = env.GEMINI_API_KEY;
    const modelName = 'gemini-2.0-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const systemInstruction = `You are a medical education assistant. Generate a single, concise mnemonic to help remember the given medical concept. Prefer acronyms, short phrases, or memorable one-liners. Respond with a JSON object only, no markdown: {"mnemonic": "...", "explanation": "brief explanation", "type": "acronym"|"story"|"visual"|"rhyme"}.`;

    const userPrompt = [
      `Concept: ${concept}`,
      contextOpt ? `Context: ${contextOpt}` : '',
      existingMnemonics.length > 0
        ? `Avoid repeating these: ${existingMnemonics.slice(-3).join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const requestBody = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 512,
      },
    };

    try {
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        const statusCode = geminiResponse.status;
        if (statusCode === 429) {
          return { status: 429, error: 'Rate limit exceeded. Please try again later.' };
        }
        return {
          status: statusCode >= 500 ? 503 : 500,
          error: 'Failed to generate mnemonic. Please try again.',
        };
      }

      const responseData = (await geminiResponse.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        promptFeedback?: { blockReason?: string };
      };

      if (responseData.promptFeedback?.blockReason) {
        return {
          status: 400,
          error: `Content blocked: ${responseData.promptFeedback.blockReason}`,
        };
      }

      const generatedText =
        responseData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!generatedText) {
        return {
          status: 500,
          error: 'No response generated. Please try again.',
        };
      }

      const { mnemonic, explanation, type } = parseGeminiMnemonicResponse(generatedText);

      return { data: { mnemonic, explanation, type } };
    } catch (error) {
      console.error('[generate-mnemonic] Error:', error);
      return {
        status: 500,
        error: 'Failed to process request. Please try again.',
      };
    }
  },
  { source: 'body', requestsPerMinute: 30 }
);
