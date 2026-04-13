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
import { aiEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  findSimilarCachedQuestion,
  cacheGeneratedQuestion,
} from '../../_shared/semantic-cache';
import { trackTokenUsage } from '../../_shared/tokenTracking';
import { callAIMultiProvider, GeminiModel, type GeminiError } from '../../_shared/ai-service';
import { aiGenerateObject, type AIProviderEnv } from '@/lib/ai-sdk';

const GenerateMnemonicSchema = z.object({
  concept: z.string().min(1, 'Concept is required'),
  context: z.string().optional(),
  existingMnemonics: z.array(z.string()).optional().default([]),
});

const MNEMONIC_TYPES = ['acronym', 'story', 'visual', 'rhyme'] as const;
type MnemonicType = (typeof MNEMONIC_TYPES)[number];

/** Zod schema for Vercel AI SDK structured output */
const MnemonicOutputSchema = z.object({
  mnemonic: z.string().describe('The mnemonic phrase or acronym'),
  explanation: z.string().describe('Brief explanation of how the mnemonic maps to the concept'),
  type: z.enum(['acronym', 'story', 'visual', 'rhyme']).describe('Type of mnemonic technique'),
});

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

    // ─── Call AI ───────────────────────────────────────────────────
    try {
      let mnemonic: string;
      let explanation: string;
      let type: MnemonicType;

      const systemPrompt = 'You are a medical education assistant. Generate a single, concise mnemonic to help remember the given medical concept. Prefer acronyms, short phrases, or memorable one-liners.';

      // Primary path: Vercel AI SDK with structured output (Zod schema validation)
      const aiSdkEnv = env as unknown as AIProviderEnv;
      const hasAiSdkKey = !!(aiSdkEnv.GOOGLE_GENERATIVE_AI_API_KEY || aiSdkEnv.GEMINI_API_KEY);

      if (hasAiSdkKey) {
        // Ensure the AI SDK can find the key (it expects GOOGLE_GENERATIVE_AI_API_KEY)
        if (!aiSdkEnv.GOOGLE_GENERATIVE_AI_API_KEY && aiSdkEnv.GEMINI_API_KEY) {
          (aiSdkEnv as any).GOOGLE_GENERATIVE_AI_API_KEY = aiSdkEnv.GEMINI_API_KEY;
        }

        try {
          const aiResult = await aiGenerateObject(aiSdkEnv, {
            model: 'gemini-2.0-flash',
            system: systemPrompt,
            prompt: userPrompt,
            schema: MnemonicOutputSchema,
            schemaName: 'Mnemonic',
            schemaDescription: 'A medical mnemonic with explanation',
            temperature: 0.8,
            maxTokens: 512,
            endpoint: '/api/ai/generate-mnemonic',
          });

          mnemonic = aiResult.object.mnemonic;
          explanation = aiResult.object.explanation;
          type = aiResult.object.type;

          trackTokenUsage(context as any, {
            endpoint: '/api/ai/generate-mnemonic',
            model: aiResult.model,
            usage: {
              promptTokenCount: aiResult.usage.promptTokens,
              candidatesTokenCount: aiResult.usage.completionTokens,
              totalTokenCount: aiResult.usage.totalTokens,
            },
            latencyMs: aiResult.latencyMs,
            statusCode: 200,
            cacheHit: false,
          });
        } catch (aiSdkError) {
          // Fall back to callAIMultiProvider if AI SDK fails
          console.warn('[generate-mnemonic] AI SDK failed, falling back to multi-provider:', aiSdkError);
          const result = await callAIMultiProvider(context as any, {
            langchainTask: 'mnemonic',
            model,
            systemInstruction: systemPrompt + ' Respond with a JSON object only, no markdown: {"mnemonic": "...", "explanation": "brief explanation", "type": "acronym"|"story"|"visual"|"rhyme"}.',
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
          ({ mnemonic, explanation, type } = parseMnemonicResponse(result.text));
        }
      } else {
        // No AI key available at all
        return { status: 500, error: 'AI provider not configured' };
      }

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
