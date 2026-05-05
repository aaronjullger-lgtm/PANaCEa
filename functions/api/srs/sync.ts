/**
 * POST /api/srs/sync
 * Legacy SRSItem sync compatibility route.
 *
 * @deprecated SRSItem is legacy (SM-2). The authoritative FSRS stores are
 * UserProgress (condition-level) and UserTopicProgress (condition+taskType).
 * This endpoint is kept only so old clients do not hard-fail. It no longer
 * writes SRSItem rows; authoritative scheduling is handled by drillReviewService
 * through UserProgress/UserTopicProgress and ReviewLog.
 *
 * Security: Authenticated endpoint with Zod validation
 * Sprint: Security Hardening Sprint 3 - Middleware Pattern
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { SRSSyncSchema } from '../_shared/schemas';
import { logger } from '../_shared/secureLogger';

// Handle CORS preflight

// POST handler with authentication + validation
export const onRequestPost = authenticatedEndpoint(SRSSyncSchema, async (context) => {
  const { auth, validated } = context;
  const total = validated.items.length;
  const now = new Date();

  logger.warn('Legacy SRSItem sync ignored', {
    userId: auth.userId,
    total,
    canonicalPath: '/api/srs/submit',
  });

  return {
    status: 200,
    data: {
      success: true,
      deprecated: true,
      synced: 0,
      skipped: total,
      total,
      timestamp: now.toISOString(),
      message:
        'Legacy SRSItem sync is deprecated. Canonical FSRS updates are written by review submissions.',
    },
  };
});
