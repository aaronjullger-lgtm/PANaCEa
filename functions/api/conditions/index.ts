/**
 * GET /api/conditions
 *
 * PUBLIC endpoint - Fetches all published conditions from database
 * Groups by system for efficient frontend rendering
 * Condition metadata is public curriculum content
 */

import { publicEndpoint } from '../_shared/middleware';
import { ContentService } from '../../../lib/services/content/contentService';
import { z } from 'zod';

const ConditionsListSchema = z.object({
  query: z.object({
    system: z.string().optional(),
    includeContent: z.enum(['true', 'false']).optional(),
  }),
});

export const onRequestGet = publicEndpoint(ConditionsListSchema, async ({ env, validated }) => {
  const contentService = new ContentService(env.DATABASE_URL);

  try {
    const { system, includeContent } = validated.query;
    const shouldIncludeContent = includeContent === 'true';

    // Use ContentService to fetch conditions
    const conditions = await contentService.getAllConditions({
      system: system,
      includeContent: shouldIncludeContent,
    });

    // Group by system for frontend convenience
    const bySystem: Record<string, typeof conditions> = {};
    for (const condition of conditions) {
      if (!bySystem[condition.system]) {
        bySystem[condition.system] = [];
      }
      bySystem[condition.system].push(condition);
    }

    return {
      data: {
        conditions,
        bySystem,
        total: conditions.length,
        systems: Object.keys(bySystem),
      },
    };
  } finally {
    await contentService.disconnect();
  }
});