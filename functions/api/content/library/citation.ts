/**
 * GET /api/content/library/citation
 *
 * Citation search: given resourceId and query, load the Adobe Extract structuredData
 * from Supabase and return matching path(s) and bounds for Smart Overlay / gotoLocation.
 *
 * Query params: resourceId, query (e.g. "dose", "treatment", "contraindications")
 * Response: { path, pageNumber, bounds?, text? }[] — JSON object(s) for citation overlay.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { createEndpointLogger } from '../../_shared/secureLogger';

const RESOURCE_BUCKET = 'educational-resources';

const CitationQuerySchema = z.object({
  resourceId: z.string().min(1),
  query: z.string().min(1).max(500),
});

interface Env {
  DATABASE_URL: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

/** Recursively search JSON for nodes containing the query string; return path, bounds, text */
function searchStructuredData(
  obj: unknown,
  queryLower: string,
  path: string = '',
  results: Array<{ path: string; pageNumber?: number; bounds?: Record<string, number>; text?: string }> = []
): typeof results {
  if (results.length >= 20) return results;

  if (obj === null || obj === undefined) return results;

  if (typeof obj === 'string') {
    if (obj.toLowerCase().includes(queryLower)) {
      results.push({ path: path || '/', text: obj.slice(0, 500) });
    }
    return results;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      searchStructuredData(item, queryLower, path ? `${path}[${i}]` : `[${i}]`, results);
    });
    return results;
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    let text: string | undefined;
    let bounds: Record<string, number> | undefined;
    let pageNumber: number | undefined;

    if (typeof record.Text === 'string' && record.Text.toLowerCase().includes(queryLower)) {
      text = record.Text;
    }
    if (record.bounds && typeof record.bounds === 'object') {
      bounds = record.bounds as Record<string, number>;
    }
    if (typeof record.Page === 'number') pageNumber = record.Page;
    if (typeof record.pageNumber === 'number') pageNumber = record.pageNumber;

    if (text || (bounds && (record.Text || record.Path))) {
      results.push({
        path: path || '/',
        pageNumber,
        bounds,
        text: text ?? (typeof record.Text === 'string' ? record.Text.slice(0, 500) : undefined),
      });
    }

    for (const [key, value] of Object.entries(record)) {
      const childPath = path ? `${path}.${key}` : key;
      searchStructuredData(value, queryLower, childPath, results);
    }
  }

  return results;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  CitationQuerySchema,
  async (context) => {
    const { env, validated } = context as {
      env: Env;
      validated: z.infer<typeof CitationQuerySchema>;
    };
    const log = createEndpointLogger('/api/content/library/citation');

    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      const { resourceId, query } = validated;

      const resource = await prisma.educationalResource.findUnique({
        where: { id: resourceId },
        select: { id: true, adobeDataPath: true, approvalStatus: true },
      });

      if (!resource?.adobeDataPath) {
        return new Response(
          JSON.stringify({ error: 'Resource not found or no Adobe Extract data', resourceId }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const url = `${env.SUPABASE_URL}/storage/v1/object/${RESOURCE_BUCKET}/${resource.adobeDataPath}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      });

      if (!res.ok) {
        log.warn('Failed to fetch structuredData', { status: res.status, resourceId });
        return new Response(
          JSON.stringify({ error: 'Failed to load structured data for citation search' }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const structuredData = (await res.json()) as unknown;
      const queryLower = query.trim().toLowerCase();
      const citations = searchStructuredData(structuredData, queryLower);

      return new Response(
        JSON.stringify({
          data: { resourceId, query, citations },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
