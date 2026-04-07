/**
 * API Endpoint: /api/ai/generate-mnemonic
 * POST: Generate a mnemonic for a medical concept using Gemini.
 *
 * Request: { concept, context?, existingMnemonics? }
 * Response: { data: { mnemonic, explanation, type } }
 *
 * Refactored to use unified ai-service layer for Gemini API calls.
 * Semantic cache still handled locally (endpoint-specific concern).
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  findSimilarCachedQuestion,
  cacheGeneratedQuestion,
} from '../_shared/semantic-cache';
import { trackTokenUsage } from '../_shared/tokenTracking';
import { callGemini, GeminiModel, type GeminiError } from '../_shared/ai-service';

const GenerateMnemonicSchema = z.object({
  concept: z.string().min(1, 'Concept is required'),
  context: z.string().optional(),
  existingMnemonics: z.array(z.string()).optional().default([]),
});

const MNEMONIC_TYPES = ['acronym', 'story', 'visual', 'rhyme'] as const;
type MnemonicType = (typeof MNEMONIC_TYPES)[number];

function parseMnemonicResponse(text: string): {
  mnemonic: string;
  explanation: string;
  type: MnemonicType;
} {
  const trimmed = text.trim();
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
  return { mnemonic: trimmed, explanation: 'Generated mnemonic.', type: 'acronym' };
}

export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(
  GenerateMnemonicSchema,
  async (context) => {
    const { env, validated } = context as {
      env: { GEMINI_API_KEY: string; DATABASE_URL?: string; [k: string]: any };
      validated: z.infer<typeof GenerateMnemonicSchema>;
    };

    const { concept, context: contextOpt, existingMnemonics = [] } = validated;
    const model = GeminiModel.FLASH_2_0;

    // ─── Semantic Cache Check ──────────────────────────────────────
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      const cacheHit = await findSimilarCachedQuestion(prisma, {
        queryText: concept,
        questionType: 'mnemonic',
        system: contextOpt,
      });
      if (cacheHit) {
        trackTokenUsage(context as any, {
          endpoint: '/api/ai/generate-mnemonic',
          model,
          usage: null,
          statusCode: 200,
          cacheHit: true,
        });
        return { data: cacheHit.question };
      }
    } catch {
      // Cache lookup failure should not block generation
    }

    // ─── Build Prompt ──────────────────────────────────────────────
    const userPrompt = [
      `Concept: ${concept}`,
      contextOpt ? `Context: ${contextOpt}` : '',
      existingMnemonics.length > 0
        ? `Avoid repeating these: ${existingMnemonics.slice(-3).join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    // ─── Call Gemini via Unified Service ────────────────────────────
    try {
      const result = await callGemini(context as any, {
        model,
        systemInstruction:
          'You are a medical education assistant. Generate a single, concise mnemonic to help remember the given medical concept. Prefer acronyms, short phrases, or memorable one-liners. Respond with a JSON object only, no markdown: {"mnemonic": "...", "explanation": "brief explanation", "type": "acronym"|"story"|"visual"|"rhyme"}.',
        prompt: userPrompt,
        generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
        endpoint: '/api/ai/generate-mnemonic',
      });

      if (result.blocked) {
        return { status: 400, error: `Content blocked: ${result.blockReason}` };
      }

      if (!result.text) {
        return { status: 500, error: 'No response generated. Please try again.' };
      }

      const { mnemonic, explanation, type } = parseMnemonicResponse(result.text);

      // Cache the result for future similar queries
      try {
        await cacheGeneratedQuestion(
          prisma,
          { queryText: concept, questionType: 'mnemonic', system: contextOpt },
          { mnemonic, explanation, type }
        );
      } catch {
        // Cache write failure should not block the response
      }

      return { data: { mnemonic, explanation, type } };
    } catch (error) {
      const geminiError = error as GeminiError;
      if (geminiError.status) {
        return {
          status: geminiError.status === 429 ? 429 : geminiError.retryable ? 503 : 500,
          error: geminiError.error,
        };
      }
      console.error('[generate-mnemonic] Error:', error);
      return { status: 500, error: 'Failed to process request. Please try again.' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'body', requestsPerMinute: 30 }
);
