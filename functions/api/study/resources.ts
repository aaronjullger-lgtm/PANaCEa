/**
 * GET /api/study/resources
 *
 * List approved EducationalResources for the Study Companion UI.
 * Note: actual PDF bytes are served via /api/study/resources/:id/file (auth required).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const QuerySchema = z.object({
  resourceType: z.string().optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  QuerySchema,
  async (context) => {
    const { env, validated } = context as {
      env: { DATABASE_URL: string };
      validated: z.infer<typeof QuerySchema>;
    };
    const logger = createEndpointLogger('/api/study/resources');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const resourceType = validated?.resourceType;
      const where: Record<string, unknown> = { approvalStatus: 'approved' };
      if (resourceType && resourceType.trim()) where.resourceType = resourceType.trim();

      const resources = await prisma.educationalResource.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          resourceType: true,
          originalFilename: true,
          mimeType: true,
          fileSize: true,
          fileUrl: true,
          storagePath: true,
          adobeDataPath: true,
          updatedAt: true,
        },
        take: 200,
      });

      return { data: { resources } };
    } catch (e) {
      logger.error('Failed to list study resources', e);
      return { status: 500, error: 'Failed to list resources' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query', requestsPerMinute: 60 }
);
