/**
 * POST /api/medical-apis/umls-lookup
 *
 * UMLS terminology validation and crosswalk endpoint.
 * Maps between SNOMED CT, ICD-10-CM, LOINC, MeSH, RxNorm, CPT.
 *
 * Requires UMLS_API_KEY in environment.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { searchUMLS, mapToICD10, batchValidateTerms } from '@/lib/services/medical-apis/umls';

const BodySchema = z.object({
  /** Action to perform */
  action: z.enum(['search', 'icd10', 'validate']),
  /** Term or list of terms */
  term: z.string().min(1).max(500).optional(),
  terms: z.array(z.string().min(1).max(200)).max(20).optional(),
  /** Source vocabulary filter for search */
  sabs: z.string().optional(),
}).refine(
  (data) => {
    if (data.action === 'validate') return !!data.terms;
    return !!data.term;
  },
  { message: 'Provide "term" for search/icd10 or "terms" for validate' }
);

interface Env {
  UMLS_API_KEY?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
  const { request, env, validated } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof BodySchema>;
  };

  const apiKey = env.UMLS_API_KEY;
  if (!apiKey) {
    return { status: 503, error: 'UMLS API key not configured' };
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'default',
    60
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { action, term, terms, sabs } = validated;

    switch (action) {
      case 'search': {
        const result = await searchUMLS(term!, apiKey, { sabs });
        return { data: result };
      }
      case 'icd10': {
        const codes = await mapToICD10(term!, apiKey);
        return { data: { term, icd10Codes: codes } };
      }
      case 'validate': {
        const results = await batchValidateTerms(terms!, apiKey);
        const allValid = results.every((r) => r.isValid);
        return { data: { allValid, results } };
      }
      default:
        return { status: 400, error: 'Unknown action' };
    }
  } catch (err) {
    console.error('[umls-lookup]', err);
    return {
      status: 500,
      error: err instanceof Error ? err.message : 'UMLS lookup failed',
    };
  }
});
