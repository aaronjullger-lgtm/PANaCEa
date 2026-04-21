/**
 * Fluid & Electrolyte Drill API Endpoint
 *
 * GET /api/drills/fluids
 *
 * Query params:
 *   - count: number of cases to return (default: 1)
 *   - category: filter by category (fena|anion_gap|free_water_deficit|maintenance_fluids)
 *   - difficulty: filter by difficulty (easy|medium|hard)
 *
 * Returns random fluid/electrolyte calculation cases from database.
 *
 * Security: Public reference data endpoint with validation
 */

import { publicEndpoint, ValidatedContext, withCors} from '../_shared/middleware';
import { fluidsQuerySchema } from '../_shared/zodSchemas';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type FluidsQuery = z.infer<typeof fluidsQuerySchema>;

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  fluidsQuerySchema,
  async (context: ValidatedContext<FluidsQuery>) => {
    const { count, category, difficulty } = context.validated;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Build query filter
      const where: any = {};
      if (category) {
        where.category = category;
      }
      if (difficulty) {
        where.difficulty = difficulty;
      }

      // Fetch all matching cases
      const allCases = await prisma.fluidCase.findMany({
        where,
        select: {
          id: true,
          title: true,
          scenario: true,
          labs: true,
          correctAnswer: true,
          unit: true,
          marginOfError: true,
          explanation: true,
          calculationHint: true,
          category: true,
          difficulty: true,
        },
      });

      if (allCases.length === 0) {
        return {
          status: 404,
          data: {
            error: 'No cases found matching criteria',
            filters: { category, difficulty },
          },
        };
      }

      // Fisher-Yates shuffle algorithm for randomization
      const shuffled = [...allCases];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const a = shuffled[i];
        const b = shuffled[j];
        if (a != null && b != null) {
          shuffled[i] = b;
          shuffled[j] = a;
        }
      }

      // Return requested number of cases (or all if fewer available)
      const selectedCases = shuffled.slice(0, Math.min(count, shuffled.length));

      return {
        data: {
          cases: selectedCases,
          total: allCases.length,
          returned: selectedCases.length,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
