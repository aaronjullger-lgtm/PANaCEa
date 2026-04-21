/**
 * GET /api/content/textbook-retrieve
 *
 * Retrieves textbook chunks for RAG (e.g. OpenStax).
 */

import { z } from 'zod';
import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const TextbookRetrieveSchema = z.object({
  system: z.string().optional(),
  query: z.string().optional(),
  source: z.string().optional(),
  limit: z.string().optional(),
});

export const onRequestGet = publicEndpoint(
  TextbookRetrieveSchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/content/textbook-retrieve');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const limit = Math.min(Math.max(parseInt(validated.limit || '5', 10), 1), 10);
      const query = validated.query?.trim();
      const system = validated.system?.trim();
      const source = validated.source?.trim();

      const where: {
        systemCodes?: { has: string };
        source?: string;
        OR?: { text?: { contains: string; mode: 'insensitive' } }[];
      } = {};

      if (system) {
        where.systemCodes = { has: system };
      }

      if (source) {
        where.source = source;
      }

      if (query) {
        where.OR = [
          { text: { contains: query, mode: 'insensitive' } },
          { text: { contains: query.toLowerCase(), mode: 'insensitive' } },
        ];
      }

      const chunks = await prisma.textbookChunk.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          source: true,
          bookTitle: true,
          chapter: true,
          section: true,
          text: true,
          systemCodes: true,
        },
      });

      logger.info('Textbook retrieval completed', {
        count: chunks.length,
        system,
        source,
      });

      return {
        data: { chunks, count: chunks.length },
        headers: { 'Cache-Control': 'public, max-age=300' },
      };
    } catch (error) {
      logger.error('Error retrieving textbook chunks', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to retrieve textbook chunks');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
