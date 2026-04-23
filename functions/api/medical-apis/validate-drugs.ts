/**
 * POST /api/medical-apis/validate-drugs
 *
 * Validates drug names against the NLM RxNorm API and checks for interactions.
 * No external API key required — RxNorm is a free public API.
 *
 * Request body: { drugs: string[] }
 * Response: { allValid, results, interactions }
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { validateQuestionDrugs } from '@/lib/services/medical-apis/rxnorm';

const ValidateDrugsSchema = z.object({
  drugs: z.array(z.string().min(1).max(200)).min(1).max(20),
});

export const onRequestPost = authenticatedEndpoint(
  ValidateDrugsSchema,
  async (context) => {
    const { validated } = context;

    try {
      const result = await validateQuestionDrugs(validated.drugs);

      return {
        data: {
          allValid: result.allValid,
          results: result.results.map((r) => ({
            drug: r.drug,
            isValid: r.validation.isValid,
            normalizedName: r.validation.normalizedName,
            rxcui: r.validation.rxcui,
            suggestions: r.validation.suggestions,
            termType: r.validation.tty,
          })),
          interactions: result.interactions
            ? {
                hasInteractions: result.interactions.hasInteractions,
                drugCount: result.interactions.drugCount,
                interactions: result.interactions.interactions.map((i) => ({
                  drug1: i.drug1,
                  drug2: i.drug2,
                  severity: i.severity,
                  description: i.description,
                  source: i.source,
                })),
              }
            : null,
        },
      };
    } catch (error) {
      console.error('[validate-drugs]', error);
      return {
        status: 500,
        error: error instanceof Error ? error.message : 'Drug validation failed',
      };
    }
  },
  { requestsPerMinute: 120 }
);
