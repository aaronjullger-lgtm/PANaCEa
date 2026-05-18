/**
 * POST /api/library/answer
 *
 * "Answer, don't just list": takes user question, runs semantic search for top K
 * reference cards, feeds excerpts to the shared AI gateway, returns a 1-sentence answer
 * (SGE style) plus the ranked results.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { findSimilarCachedQuestion, cacheGeneratedQuestion } from '../_shared/semantic-cache';
import { createEndpointLogger } from '../_shared/secureLogger';
import type { CloudflareEnv } from '../_shared/types';
import { gateway, GatewayError, toGatewayContext } from '../../../lib/ai/aiGateway';
import { getEmbedding } from '../../../lib/gemini';
import {
  formatMemorySafetyFlags,
  sanitizeRetrievedContextText,
} from '../../../lib/services/memory/contextSanitizer';

const TOP_K = 3;
const HNSW_EF_SEARCH = 100;
const MIN_SIMILARITY = 0.25;

const BodySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(10).optional().default(TOP_K),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string };

function buildExcerpt(item: {
  condition: string | null;
  overview: string | null;
  first_line_rx: string | null;
  gold_standard_dx: string | null;
  symptoms: string | null;
  treatment: string | null;
}): string {
  const parts: string[] = [];
  if (item.condition) parts.push(`Condition: ${item.condition}`);
  if (item.overview) parts.push(`Overview: ${item.overview}`);
  if (item.first_line_rx) parts.push(`First-line: ${item.first_line_rx}`);
  if (item.gold_standard_dx) parts.push(`Gold standard: ${item.gold_standard_dx}`);
  if (item.symptoms) parts.push(`Symptoms: ${item.symptoms}`);
  if (item.treatment) parts.push(`Treatment: ${item.treatment}`);
  return parts.join('\n');
}

function buildSafeExcerpt(item: Parameters<typeof buildExcerpt>[0]): string {
  const sanitized = sanitizeRetrievedContextText(buildExcerpt(item));
  const safetyFlags = formatMemorySafetyFlags(sanitized.flags);
  return safetyFlags ? `${safetyFlags}\n${sanitized.text}` : sanitized.text;
}

export const onRequestPost = aiEndpoint(BodySchema, async (context) => {
  const { env, validated, auth } = context as {
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, [
      'GEMINI_API_KEY',
      'DATABASE_URL',
    ]);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const { query, topK } = validated;
  const apiKey = env.GEMINI_API_KEY;
  const logger = createEndpointLogger('/api/library/answer', auth.userId);
  if (!apiKey) {
    return { status: 500, error: 'AI answer service not configured' };
  }

  try {
    // Semantic cache: check if we already answered a similar question
    try {
      const cacheHit = await findSimilarCachedQuestion(prisma, {
        queryText: query,
        questionType: 'library_answer',
      });
      if (cacheHit) {
        return { data: cacheHit.question, headers: { 'Cache-Control': 'private, max-age=300' } };
      }
    } catch {
      // Cache lookup failure should not block generation
    }

    const embedding = await getEmbedding(query, apiKey);
    const vectorStr = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${HNSW_EF_SEARCH}`);

    type Row = { medicalContentId: string; similarity: number };
    const allRows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT e."medicalContentId", (1 - (e.embedding <=> $1::vector))::float as similarity
       FROM "MedicalContentEmbedding" e
       ORDER BY e.embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      topK
    );

    // Drop results below the minimum similarity threshold so the LLM is never
    // grounded in irrelevant content (a cosine sim < 0.25 is essentially noise
    // for 768-dim clinical embeddings).
    const rows = allRows.filter((r) => r.similarity >= MIN_SIMILARITY);

    if (rows.length === 0) {
      return {
        data: {
          answer: null,
          results: [],
          message: 'No reference content found for this question.',
        },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    }

    const ids = rows.map((r) => r.medicalContentId);
    const scoreMap = new Map(rows.map((r) => [r.medicalContentId, r.similarity]));

    const content = await prisma.medicalContent.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        condition: true,
        conditionId: true,
        system: true,
        subcategory: true,
        overview: true,
        first_line_rx: true,
        gold_standard_dx: true,
        symptoms: true,
        treatment: true,
        best_initial_test: true,
      },
    });

    const results = ids
      .map((id) => {
        const item = content.find((c) => c.id === id);
        const similarity = scoreMap.get(id) ?? 0;
        return item ? { ...item, similarity } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const excerpts = results.map((r) => buildSafeExcerpt(r)).join('\n\n---\n\n');
    const prompt = `You are a medical reference assistant. Using ONLY the following reference excerpts, answer the user's question in exactly one short sentence. Do not add caveats or "it depends." If the excerpts do not contain the answer, say "Not found in the reference cards."

Reference excerpts:
${excerpts}

User question: ${query}

One-sentence answer:`;

    let answer: string | null = null;
    try {
      const answerResult = await gateway.callText(toGatewayContext(context), {
        mode: 'text',
        task: 'enrichment',
        tier: 'fast',
        endpoint: '/api/library/answer',
        userPrompt: prompt,
        temperature: 0.2,
        maxOutputTokens: 150,
      });

      if (answerResult.blocked) {
        logger.warn('Library answer generation blocked by safety filter', {
          reason: answerResult.blockReason ?? 'unknown',
        });
        return {
          data: {
            answer: null,
            results,
            message: 'Could not generate answer.',
          },
          headers: { 'Cache-Control': 'private, max-age=60' },
        };
      }

      answer = answerResult.text.trim() || null;
    } catch (err) {
      if (err instanceof GatewayError) {
        logger.warn('Library answer gateway failure', {
          code: err.code,
          retryable: err.retryable,
          requestId: err.requestId,
          traceId: err.traceId,
        });
      } else {
        logger.warn('Library answer generation failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return {
        data: { answer: null, results, message: 'Could not generate answer.' },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    }

    // Cache the answer for future similar queries
    const cachePayload = { answer, results, count: results.length };
    try {
      await cacheGeneratedQuestion(
        prisma,
        {
          queryText: query,
          questionType: 'library_answer',
        },
        cachePayload
      );
    } catch {
      // Cache write failure should not block the response
    }

    return {
      data: cachePayload,
      headers: { 'Cache-Control': 'private, max-age=60' },
    };
  } catch (error) {
    logger.error('Library answer failed', error);
    return {
      status: 500,
      error: 'Answer generation failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
