/**
 * GET /api/library/search?q=...
 *
 * Hybrid search over Reference Library (MedicalContent): keyword (FTS) + semantic (HNSW)
 * with Reciprocal Rank Fusion. Combines e.g. "MI" (keyword) with "heart attack" (semantic).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { searchMedicalContent } from '@/lib/search';
import type { CloudflareEnv } from '../_shared/types';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(2000),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string };

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  SearchQuerySchema,
  async (context) => {
    const { env, validated } = context as {
      env: Env;
      validated: z.infer<typeof SearchQuerySchema>;
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

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return { status: 500, error: 'GEMINI_API_KEY not configured' };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const { q, limit } = validated;

    try {
      const results = await searchMedicalContent(q, {
        prisma,
        apiKey,
        limit: limit ?? 20,
      });

      return {
        data: { results, count: results.length },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    } catch (error) {
      console.error('[library/search]', error);
      return {
        status: 500,
        error: error instanceof Error ? error.message : 'Hybrid search failed',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
