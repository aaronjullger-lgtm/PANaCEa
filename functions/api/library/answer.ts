/**
 * POST /api/library/answer
 *
 * "Answer, don't just list": takes user question, runs semantic search for top K
 * reference cards, feeds excerpts to Gemini 1.5 Flash, returns a 1-sentence answer
 * (SGE style) plus the ranked results.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import type { CloudflareEnv } from '../_shared/types';

const EMBED_MODEL = 'text-embedding-005';
const EMBED_DIMS = 768;
const ANSWER_MODEL = 'gemini-2.0-flash';
const TOP_K = 3;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

const BodySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(10).optional().default(TOP_K),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string };

async function getQueryEmbedding(query: string, apiKey: string): Promise<number[]> {
  const url = `${GEMINI_BASE}/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: query }] },
      outputDimensionality: EMBED_DIMS,
    }),
  });
  if (!res.ok) throw new Error(`Embed API error ${res.status}`);
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) throw new Error('Invalid embedding');
  return values;
}

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

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
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
  if (!apiKey) {
    return { status: 500, error: 'GEMINI_API_KEY not configured' };
  }

  try {
    const embedding = await getQueryEmbedding(query, apiKey);
    const vectorStr = `[${embedding.join(',')}]`;

    type Row = { medicalContentId: string; similarity: number };
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT e."medicalContentId", (1 - (e.embedding <=> $1::vector))::float as similarity
       FROM "MedicalContentEmbedding" e
       ORDER BY e.embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      topK
    );

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

    const excerpts = results.map((r) => buildExcerpt(r)).join('\n\n---\n\n');
    const prompt = `You are a medical reference assistant. Using ONLY the following reference excerpts, answer the user's question in exactly one short sentence. Do not add caveats or "it depends." If the excerpts do not contain the answer, say "Not found in the reference cards."

Reference excerpts:
${excerpts}

User question: ${query}

One-sentence answer:`;

    const genUrl = `${GEMINI_BASE}/v1beta/models/${ANSWER_MODEL}:generateContent?key=${apiKey}`;
    const genRes = await fetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 150,
        },
      }),
    });

    if (!genRes.ok) {
      const err = await genRes.text();
      console.error('[library/answer] Gemini error', genRes.status, err.slice(0, 300));
      return {
        data: { answer: null, results, message: 'Could not generate answer.' },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    }

    const genData = (await genRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = genData.candidates?.[0]?.content?.parts?.[0]?.text;
    const answer = typeof rawText === 'string' ? rawText.trim() : null;

    return {
      data: { answer, results, count: results.length },
      headers: { 'Cache-Control': 'private, max-age=60' },
    };
  } catch (error) {
    console.error('[library/answer]', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Answer generation failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
