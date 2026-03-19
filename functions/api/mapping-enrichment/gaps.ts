/**
 * GET /api/mapping-enrichment/gaps
 * Returns a list of MedicalTaxonomy nodes that have no corresponding SystemMapping entries.
 */

import { getCorsHeaders, getCorsConfig } from '../_shared/cors';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { detectGaps } from '@/services/domain/mappingEnrichment/gapDetector';

export const onRequestOptions = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request, corsConfig) ?? {},
  });
};

export const onRequestGet = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  const cors = getCorsHeaders(context?.request, corsConfig) ?? {};
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' };

  // Require authentication — admin endpoint
  const auth = await authenticateRequest(context.request, context.env ?? {});
  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: jsonHeaders }
    );
  }

  let prisma = null;
  try {
    // Validate environment
    const env = context?.env ?? {};
    if (!env.DATABASE_URL) {
      return new Response(
        JSON.stringify({ error: 'DATABASE_URL environment variable is not set' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);
    // Optionally include inactive taxonomies based on query param
    const url = new URL(context.request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const gaps = await detectGaps(includeInactive);

    return new Response(JSON.stringify({ gaps }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[MappingEnrichmentGaps]', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: jsonHeaders }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};