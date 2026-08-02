/**
 * POST /api/embeddings/generate-questions
 *
 * Batch-embeds questions using Gemini gemini-embedding-2 and stores
 * the vectors in the QuestionEmbedding table (pgvector).
 *
 * Designed for batch backfill and incremental embedding of new questions.
 * Rate-limited to prevent Gemini API abuse.
 *
 * Request body:
 *   { questionIds: string[] }  (max 100 per request)
 *
 * Response:
 *   { embedded: number, skipped: number, errors: string[] }
 *
 * @see prisma/migrations/20260407210000_add_question_embeddings
 */

import { z } from 'zod';
import {
  adminAuthenticatedEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_DIMENSIONS = 768;
const MAX_BATCH_SIZE = 100;

const GenerateQuestionsSchema = z.object({
  body: z.object({
    questionIds: z.array(z.string()).min(1).max(MAX_BATCH_SIZE),
  }),
});

type GenerateQuestionsBody = z.infer<typeof GenerateQuestionsSchema>;

/**
 * Extract embeddable text from a question's JSON data.
 * Combines stem + options into a single text string.
 */
function extractEmbeddableText(questionData: any): string {
  const parts: string[] = [];

  // Question stem
  const stem = questionData?.stem || questionData?.questionText || questionData?.question || '';
  if (stem) parts.push(stem);

  // Options (for context)
  const options = questionData?.options;
  if (Array.isArray(options)) {
    for (const opt of options) {
      const text = typeof opt === 'string' ? opt : opt?.text || opt?.option || '';
      if (text) parts.push(text);
    }
  }

  // Explanation (if available, adds semantic richness)
  const explanation = questionData?.explanation || questionData?.rationale || '';
  if (explanation) parts.push(explanation);

  return parts.join(' ').trim();
}

/**
 * Call Gemini embedContent API for a single text.
 */
async function embedText(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: 'SEMANTIC_SIMILARITY',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini embedding API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as { embedding?: { values?: number[] } };
  const values = data?.embedding?.values;

  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Unexpected embedding dimensions: ${values?.length ?? 0}`);
  }

  return values;
}

export const onRequestPost = adminAuthenticatedEndpoint(
  GenerateQuestionsSchema,
  async (context: AuthenticatedContext & ValidatedContext<GenerateQuestionsBody>) => {
    const { questionIds } = context.validated.body;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);
    const apiKey = context.env.GEMINI_API_KEY as string;

    if (!apiKey) {
      return { status: 500, error: 'AI embedding service not configured' };
    }

    try {
      // Fetch questions that need embedding
      const questions = await prisma.preGeneratedQuestion.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, questionData: true, system: true },
      });

      // Check which already have embeddings
      const existing = await prisma.$queryRaw<Array<{ questionId: string }>>`
        SELECT "questionId" FROM "QuestionEmbedding"
        WHERE "questionId" = ANY(${questionIds})
      `;
      const alreadyEmbedded = new Set(existing.map((e) => e.questionId));

      let embedded = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const question of questions) {
        if (alreadyEmbedded.has(question.id)) {
          skipped++;
          continue;
        }

        const text = extractEmbeddableText(question.questionData);
        if (!text || text.length < 10) {
          errors.push(`Question ${question.id}: insufficient text for embedding`);
          continue;
        }

        try {
          const embedding = await embedText(text, apiKey);

          // Serialize to pgvector-compatible string "[0.1,0.2,...]"
          // Prisma tagged templates parameterize values, so we pass
          // the vector as a string and cast it server-side.
          const vectorStr = `[${embedding.join(',')}]`;
          const truncatedText = text.slice(0, 500);

          // Insert via raw SQL (Prisma doesn't support pgvector natively)
          await prisma.$executeRaw`
            INSERT INTO "QuestionEmbedding" ("id", "questionId", "embedding", "model", "embeddedText", "createdAt", "updatedAt")
            VALUES (
              gen_random_uuid()::text,
              ${question.id},
              ${vectorStr}::vector,
              ${EMBEDDING_MODEL},
              ${truncatedText},
              NOW(),
              NOW()
            )
            ON CONFLICT ("questionId") DO UPDATE SET
              "embedding" = ${vectorStr}::vector,
              "model" = ${EMBEDDING_MODEL},
              "embeddedText" = ${truncatedText},
              "updatedAt" = NOW()
          `;

          embedded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Question ${question.id}: ${msg}`);
        }
      }

      return {
        data: {
          embedded,
          skipped,
          errors: errors.slice(0, 10), // Cap error list
          total: questionIds.length,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Embedding generation failed';
      return { status: 500, error: message };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 10 } // Low rate limit — embedding is expensive
);
