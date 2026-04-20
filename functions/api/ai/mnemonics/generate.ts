/**
 * POST /api/ai/generate-mnemonic
 * Generate a mnemonic for a medical concept.
 *
 * Sprint 8 (AI Gateway migration): Replaced callAIMultiProvider() + Vercel AI
 * SDK dual-path with a single gateway.generate() call. Benefits:
 *   - Zod-validated structured output (MnemonicOutputSchema) with repair pass
 *   - Consistent telemetry (requestId, traceId, costUsd)
 *   - Fallback chain: gemini-2.0-flash → gemini-2.5-flash (same_provider)
 *   - No more manual JSON.parse or regex fence-stripping
 *   - Semantic cache lookup/write preserved (endpoint-specific concern)
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  findSimilarCachedQuestion,
  cacheGeneratedQuestion,
} from '../../_shared/semantic-cache';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';

// ─── Schemas ────────────────────────────────────────────────────────────────

const GenerateMnemonicSchema = z.object({
  concept: z.string().min(1, 'Concept is required'),
  context: z.string().optional(),
  existingMnemonics: z.array(z.string()).optional().default([]),
});

const MnemonicOutputSchema = z.object({
  mnemonic: z.string().min(1).max(500),
  explanation: z.string().min(1).max(1000),
  type: z.enum(['acronym', 'story', 'visual', 'rhyme']),
});
type MnemonicOutput = z.infer<typeof MnemonicOutputSchema>;

const MNEMONIC_OUTPUT_DESCRIPTION = `{
  "mnemonic": string (the mnemonic phrase or acronym, ≤500 chars),
  "explanation": string (how the mnemonic maps to the concept, ≤1000 chars),
  "type": "acronym" | "story" | "visual" | "rhyme"
}
Return ONLY this JSON object — no markdown, no code fence, no prose.`;

const MNEMONIC_SYSTEM_PROMPT =
  'You are a medical education assistant. Generate a single, concise mnemonic to help remember the given medical concept. Prefer acronyms, short phrases, or memorable one-liners.';

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(
  GenerateMnemonicSchema,
  async (context) => {
    const { env, validated } = context as {
      env: { GEMINI_API_KEY: string; DATABASE_URL?: string; [k: string]: unknown };
      validated: z.infer<typeof GenerateMnemonicSchema>;
    };

    const { concept, context: contextOpt, existingMnemonics = [] } = validated;

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      // ── Semantic cache check ──────────────────────────────────────────────
      try {
        const cacheHit = await findSimilarCachedQuestion(prisma, {
          queryText: concept,
          questionType: 'mnemonic',
          system: contextOpt,
        });
        if (cacheHit) {
          return { data: cacheHit.question };
        }
      } catch {
        // Cache miss is fine; proceed to generation
      }

      // ── Build prompt ──────────────────────────────────────────────────────
      const userPrompt = [
        `Concept: ${concept}`,
        contextOpt ? `Context: ${contextOpt}` : '',
        existingMnemonics.length > 0
          ? `Avoid repeating these: ${existingMnemonics.slice(-3).join('; ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      // ── Gateway call ──────────────────────────────────────────────────────
      let output: MnemonicOutput;
      try {
        const result = await gateway.generate<MnemonicOutput>(
          toGatewayContext(context as Parameters<typeof toGatewayContext>[0]),
          {
            schema: MnemonicOutputSchema,
            schemaDescription: MNEMONIC_OUTPUT_DESCRIPTION,
            endpoint: '/api/ai/generate-mnemonic',
            // tier:'fast' = gemini-2.0-flash — cheap for high-volume mnemonic gen
            tier: 'fast',
            fallback: 'same_provider',
            systemPrompt: MNEMONIC_SYSTEM_PROMPT,
            userPrompt,
            temperature: 0.8,
            maxOutputTokens: 512,
          }
        );
        output = result.data;
      } catch (err) {
        if (err instanceof GatewayError) {
          if (err.code === 'RATE_LIMITED') {
            return { status: 429, error: 'Rate limit exceeded. Please try again shortly.' };
          }
          if (err.code === 'SAFETY_BLOCKED') {
            return { status: 400, error: 'Content blocked by safety filter.' };
          }
          return { status: 502, error: 'Mnemonic generation failed. Please try again.' };
        }
        throw err;
      }

      // ── Cache write (best-effort) ─────────────────────────────────────────
      try {
        await cacheGeneratedQuestion(
          prisma,
          { queryText: concept, questionType: 'mnemonic', system: contextOpt },
          output
        );
      } catch {
        // Cache write failure must not block the response
      }

      return { data: output };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'body', requestsPerMinute: 30 }
);
