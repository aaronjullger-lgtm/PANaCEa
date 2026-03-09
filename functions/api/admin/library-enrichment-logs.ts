/**
 * GET /api/admin/library-enrichment-logs
 * Retrieve library enrichment logs from the JSON log file.
 * Admin role required.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { readFile } from 'fs/promises';
import { join } from 'path';

const LibraryEnrichmentLogsQuerySchema = z.object({
  query: z.object({
    entityType: z.enum(['Condition', 'Drug']).optional(),
    status: z.enum(['success', 'failure', 'skipped']).optional(),
    limit: z.coerce.number().int().positive().max(200).default(100),
    offset: z.coerce.number().int().nonnegative().default(0),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  LibraryEnrichmentLogsQuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const query = validated.query;
    const logger = createEndpointLogger('/api/admin/library-enrichment-logs');

    let prisma = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Check admin role
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to fetch library enrichment logs', {
          userId: auth.userId,
          role: user?.role,
        });
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Read log file
      const logPath = join(process.cwd(), 'data', 'library-enrichment-log.json');
      let rawLogs: any[] = [];
      try {
        const content = await readFile(logPath, 'utf-8');
        rawLogs = JSON.parse(content);
      } catch (err) {
        logger.warn('Could not read library enrichment log file', { error: String(err) });
        // Return empty array
      }

      // Apply filters
      let filtered = rawLogs;
      if (query.entityType) {
        filtered = filtered.filter(log => log.entityType === query.entityType);
      }
      if (query.status) {
        filtered = filtered.filter(log => log.status === query.status);
      }

      const total = filtered.length;
      // Paginate
      const logs = filtered.slice(query.offset, query.offset + query.limit);

      return new Response(JSON.stringify({ logs, total }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Failed to fetch library enrichment logs', { error: error instanceof Error ? error.message : String(error) });
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