/**
 * Debug: God Mode — User count and basic diagnostics (admin only)
 *
 * GET /api/debug/god-mode
 * Returns { ok, userCount, timestamp }.
 *
 * Feature-gated: Set ENABLE_DEBUG_ENDPOINTS=true in environment to activate.
 * When disabled (default in production), returns 404 — endpoint effectively
 * does not exist. This prevents accidental exposure of diagnostic data.
 *
 * Security stack:
 * - Environment gate: ENABLE_DEBUG_ENDPOINTS must be 'true'
 * - Auth via withAuth() + withAdminRole() (no duplicated logic)
 * - Rate limited: 30 req/min (debug endpoint)
 * - Structured logging & audit trail
 * - CORS, error handling, env validation
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';

const logger = createEndpointLogger('/api/debug/god-mode');

export const onRequestGet = adminAuthenticatedEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env, auth } = context;

    // ─── Feature Gate ──────────────────────────────────────────────
    const debugEnabled = (env as Record<string, string>).ENABLE_DEBUG_ENDPOINTS === 'true';
    if (!debugEnabled) {
      return { status: 404, error: 'Not found' };
    }

    auditLog('admin_debug_god_mode', {
      adminClerkId: auth.userId,
    });

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const userCount = await prisma.user.count();

      logger.info('God-mode diagnostics retrieved', {
        userCount,
        adminClerkId: auth.userId,
      });

      return {
        data: {
          ok: true,
          userCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('God-mode diagnostics failed', { error: message });
      return {
        status: 500,
        error: message,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);
