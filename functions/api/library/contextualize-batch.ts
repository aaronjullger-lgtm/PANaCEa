/**
 * POST /api/library/contextualize-batch
 *
 * Batch contextual retrieval preprocessing endpoint.
 * Prepends LLM-generated context to content chunks before embedding.
 * Reduces retrieval failure by ~35% (Anthropic benchmark).
 *
 * Also supports parent-child chunking for two-tier retrieval.
 *
 * Admin-only endpoint — runs as a batch job for content ingestion.
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';
import { aiGenerateText } from '@/lib/ai-sdk';
import type { AIProviderEnv } from '@/lib/ai-sdk/providers';
import {
  batchContextualize,
  splitIntoParentChild,
  type ContentChunk,
  type ContextualizedChunk,
} from '@/lib/services/search/contextualRetrieval';

const ChunkSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(10000),
  metadata: z.object({
    source: z.string().optional(),
    section: z.string().optional(),
    conditionId: z.string().optional(),
    system: z.string().optional(),
  }).optional(),
});

const BodySchema = z.object({
  /** Chunks to contextualize */
  chunks: z.array(ChunkSchema).min(1).max(50),
  /** Optional document-level summary for better context */
  documentSummary: z.string().max(2000).optional(),
  /** Whether to also split into parent-child chunks */
  splitParentChild: z.boolean().optional().default(false),
  /** Concurrency for LLM calls */
  concurrency: z.number().int().min(1).max(10).optional().default(5),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export const onRequestPost = adminAuthenticatedEndpoint(BodySchema, async (context) => {
  const { env, validated, auth } = context as {
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

  // Admin role is enforced by adminAuthenticatedEndpoint middleware

  const { chunks, documentSummary, splitParentChild, concurrency } = validated;
  const aiSdkEnv: AIProviderEnv = { GEMINI_API_KEY: env.GEMINI_API_KEY };

  try {
    // LLM generate function using AI SDK
    const generateFn = async (prompt: string): Promise<string> => {
      const result = await aiGenerateText(aiSdkEnv, {
        model: 'gemini-2.0-flash',
        prompt,
        temperature: 0.3,
        maxTokens: 256,
      });
      return result.text;
    };

    // Convert input to ContentChunk format
    const contentChunks: ContentChunk[] = chunks.map((c) => ({
      id: c.id,
      text: c.text,
      metadata: c.metadata ?? {},
    }));

    // Contextualize all chunks
    let processed = 0;
    const contextualized: ContextualizedChunk[] = await batchContextualize(
      contentChunks,
      generateFn,
      {
        concurrency,
        documentSummary,
        onProgress: () => { processed++; },
      }
    );

    // Optional: split into parent-child chunks for two-tier retrieval
    let parentChildChunks: Array<{ parentId: string; parent: string; children: Array<{ id: string; text: string }> }> | undefined;

    if (splitParentChild) {
      parentChildChunks = contextualized.map((chunk) => {
        const hierarchy = splitIntoParentChild(chunk.contextualizedText, {
          parentMaxChars: 1200,
          childMaxChars: 400,
          overlap: 50,
        });
        return {
          parentId: chunk.id,
          parent: hierarchy.parent,
          children: hierarchy.children.map((child, i) => ({
            id: `${chunk.id}_child_${i}`,
            text: child,
          })),
        };
      });
    }

    return {
      data: {
        contextualized: contextualized.map((c) => ({
          id: c.id,
          originalText: c.originalText.slice(0, 200) + (c.originalText.length > 200 ? '...' : ''),
          contextualizedText: c.contextualizedText,
          contextPrefix: c.contextPrefix,
        })),
        parentChildChunks,
        stats: {
          totalChunks: chunks.length,
          processed: contextualized.length,
          avgContextLength: Math.round(
            contextualized.reduce((sum, c) => sum + c.contextPrefix.length, 0) / contextualized.length
          ),
        },
      },
    };
  } catch (error) {
    createEndpointLogger('/api/library/contextualize-batch').error('Batch contextualization error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 500,
      error: 'Batch contextualization failed. Please try again.',
    };
  }
});
