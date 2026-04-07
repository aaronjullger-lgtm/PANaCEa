/**
 * POST /api/mapping-enrichment/suggest
 * Triggers batch suggestion generation for unmapped taxonomy nodes.
 * Accepts optional list of taxonomy codes; if omitted, processes all gaps.
 *
 * Migrated to adminAuthenticatedEndpoint: adds rate limiting (30/min for
 * this Gemini-calling endpoint), admin role check, CORS, structured logging,
 * Zod validation.
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { generateSuggestions } from '@/services/domain/mappingEnrichment/suggestionEngine';

const SuggestSchema = z.object({
  body: z.object({
    taxonomyCodes: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = adminAuthenticatedEndpoint(
  SuggestSchema,
  async (context) => {
    const { env, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      if (!env.GEMINI_API_KEY) {
        return { status: 500, error: 'GEMINI_API_KEY environment variable is not set' };
      }

      const { taxonomyCodes, limit } = validated?.body ?? validated;

      // Generate suggestions (may call Gemini API for embeddings)
      const suggestions = await generateSuggestions(taxonomyCodes);
      const limited = suggestions.slice(0, limit);

      // Store suggestions in database
      const storedSuggestions = [];
      for (const suggestion of limited) {
        const stored = await prisma.mappingSuggestion.create({
          data: {
            taxonomyCode: suggestion.taxonomyCode,
            taxonomyName: suggestion.taxonomyName,
            suggestedSystemCode: suggestion.suggestedSystemCode,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
            alternativeSystems: suggestion.alternativeSystems,
          },
        });
        storedSuggestions.push(stored);
      }

      return {
        data: {
          suggestions: storedSuggestions.map((s: any) => ({
            id: s.id,
            taxonomyCode: s.taxonomyCode,
            taxonomyName: s.taxonomyName,
            suggestedSystemCode: s.suggestedSystemCode,
            confidence: s.confidence,
            reason: s.reason,
            alternativeSystems: s.alternativeSystems,
            status: s.status,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          })),
          total: suggestions.length,
          limitApplied: limit,
        },
      };
    } catch (error) {
      console.error('[MappingEnrichmentSuggest]', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);
