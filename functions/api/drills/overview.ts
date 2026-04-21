/**
 * Cloudflare Function: Get Drill Overview
 *
 * Returns drill statistics overview for DrillHub dashboard
 *
 * Endpoint: GET /api/drills/overview
 *
 * Migrated from /api/drill/overview to consolidate all drill endpoints
 * under /api/drills/. Uses authenticatedEndpoint: adds rate limiting
 * (300/min), CORS, structured logging, error handling.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getDrillOverview } from '../../../services/drill/drillSessionManager';

export const onRequestGet = authenticatedEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env, auth } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const overview = await getDrillOverview(prisma, auth.userId);
      return { data: overview };
    } catch (error) {
      console.error('Error fetching drill overview:', error);
      return { status: 500, error: 'Failed to fetch drill overview' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
