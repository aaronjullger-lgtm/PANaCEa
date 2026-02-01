/**
 * POST /api/dashboard/daily-triad/review
 * Mark today's daily triad as reviewed by the authenticated user.
 * Minimal implementation: logs the event and returns success.
 * Can be extended later to store reviewed state (e.g. user_daily_triad table).
 */

import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { z } from 'zod';

const ReviewSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  ReviewSchema,
  async ({ auth }) => {
    const log = createEndpointLogger('/api/dashboard/daily-triad/review', auth.userId);

    log.info('Daily triad marked as reviewed', {
      userId: auth.userId,
      date: new Date().toISOString().split('T')[0],
    });

    return {
      success: true,
      data: { reviewed: true },
    };
  },
  { source: 'body' }
);
