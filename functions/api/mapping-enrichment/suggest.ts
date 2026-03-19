/**
 * POST /api/mapping-enrichment/suggest
 * Triggers batch suggestion generation for unmapped taxonomy nodes.
 * Accepts optional list of taxonomy codes; if omitted, processes all gaps.
 */

import { getCorsHeaders, getCorsConfig } from '../_shared/cors';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { generateSuggestions } from '@/services/domain/mappingEnrichment/suggestionEngine';

export const onRequestOptions = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request, corsConfig) ?? {},
  });
};

export const onRequestPost = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  const cors = getCorsHeaders(context?.request, corsConfig) ?? {};
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' };

  // Require authentication — this endpoint triggers Gemini API calls
  const auth = await authenticateRequest(context.request, context.env ?? {});
  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: jsonHeaders }
    );
  }

  let prisma = null;
  try {
    const env = context?.env ?? {};
    if (!env.DATABASE_URL) {
      return new Response(
        JSON.stringify({ error: 'DATABASE_URL environment variable is not set' }),
        { status: 500, headers: jsonHeaders }
      );
    }
    if (!env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not set' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const requestBody = await context.request.json().catch(() => ({}));
    const taxonomyCodes: string[] | undefined = requestBody.taxonomyCodes;
    // Optional limit to avoid excessive processing
    const limit = requestBody.limit ? Math.min(Number(requestBody.limit), 50) : 10;

    // Generate suggestions (this may call Gemini API for embeddings)
    const suggestions = await generateSuggestions(taxonomyCodes);
    // Apply limit
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
          // status defaults to PENDING
        },
      });
      storedSuggestions.push(stored);
    }

    return new Response(
      JSON.stringify({
        suggestions: storedSuggestions.map(s => ({
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
        note: 'Suggestions are based on semantic similarity and keyword matching. Confidence scores range 0-1.',
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    console.error('[MappingEnrichmentSuggest]', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: jsonHeaders }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};