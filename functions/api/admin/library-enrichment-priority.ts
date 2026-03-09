/**
 * GET /api/admin/library-enrichment-priority
 * Retrieve the prioritized list of missing fields for library enrichment.
 * Admin role required.
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  async (context) => {
    const { env, auth } = context;
    const logger = createEndpointLogger('/api/admin/library-enrichment-priority');

    let prisma = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Check admin role
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to fetch library enrichment priority', {
          userId: auth.userId,
          role: user?.role,
        });
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Read priority file
      const priorityPath = join(process.cwd(), 'data', 'library-enrichment-priority.json');
      let priorityData: any = { priorityList: [] };
      try {
        const content = await readFile(priorityPath, 'utf-8');
        priorityData = JSON.parse(content);
      } catch (err) {
        logger.warn('Could not read library enrichment priority file', { error: String(err) });
        // Return empty list
      }

      return new Response(JSON.stringify(priorityData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Failed to fetch library enrichment priority', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      if (prisma) {
        await safePrismaDisconnect(prisma);
      }
    }
  }
);