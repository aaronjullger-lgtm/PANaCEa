/**
 * GET /api/mapping-enrichment/gaps
 * Returns MedicalTaxonomy nodes that have no corresponding SystemMapping entries.
 *
 * Migrated to adminAuthenticatedEndpoint: adds rate limiting (60/min),
 * admin role check, CORS, structured logging, error handling.
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { detectGaps } from '@/services/domain/mappingEnrichment/gapDetector';

const GapsSchema = z.object({
  query: z
    .object({
      includeInactive: z.enum(['true', 'false']).optional().default('false'),
    })
    .optional()
    .default({}),
});

export const onRequestGet = adminAuthenticatedEndpoint(
  GapsSchema,
  async (context) => {
    try {
      const url = new URL(context.request.url);
      const includeInactive = url.searchParams.get('includeInactive') === 'true';

      const gaps = await detectGaps(includeInactive);

      return { data: { gaps } };
    } catch (error) {
      console.error('[MappingEnrichmentGaps]', error);
      return { status: 500, error: 'Internal server error' };
    }
  },
  { source: 'query' }
);
