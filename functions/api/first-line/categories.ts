/**
 * First Line Treatment Categories Endpoint
 * GET /api/first-line/categories
 *
 * Retrieves all unique categories for first-line treatments
 * Public endpoint - no authentication required
 *
 * Security: publicEndpoint with Zod validation
 */

import { publicEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

const CategoriesQuerySchema = z.object({
  query: z.object({}),
});

// ============================================================================
// OPTIONS HANDLER
// ============================================================================

// ============================================================================
// GET HANDLER
// ============================================================================

export const onRequestGet = publicEndpoint(CategoriesQuerySchema, async ({ env }) => {
  const log = createEndpointLogger('/api/first-line/categories');
  let prisma: EdgePrismaClient | null = null;

  try {
    if (!env.DATABASE_URL) {
      return {
        status: 500,
        error: 'Database not configured',
      };
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const categories = await prisma.firstLineTreatment.groupBy({
      by: ['category'],
      orderBy: { category: 'asc' },
    });

    // Type for groupBy result
    type CategoryGroup = { category: string };
    const categoryList = categories.map((c: CategoryGroup) => c.category);

    log.info('First line categories fetched', { count: categoryList.length });

    return { data: categoryList };
  } catch (error) {
    log.error('Error fetching first line categories', error);
    return {
      status: 500,
      error: 'Failed to fetch categories',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
