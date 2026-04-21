/**
 * GET /api/study/resources/:id
 *
 * Fetch metadata for a single approved EducationalResource.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const ParamsSchema = z.object({
  id: z.string().min(1, 'Missing resource id'),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ParamsSchema,
  async (context) => {
    const { env, validated } = context as {
      env: { DATABASE_URL: string };
      validated: z.infer<typeof ParamsSchema>;
    };
    const logger = createEndpointLogger('/api/study/resources/:id');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { id } = validated;
      const resource = await prisma.educationalResource.findUnique({
        where: { id },
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
          approvalStatus: true,
          updatedAt: true,
        },
      });

      if (!resource) return { status: 404, error: 'Resource not found' };
      if (resource.approvalStatus !== 'approved')
        return { status: 403, error: 'Resource not approved for use' };

      return { data: { resource } };
    } catch (e) {
      logger.error('Failed to fetch study resource meta', e);
      return { status: 500, error: 'Failed to fetch resource' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params', requestsPerMinute: 120 }
);
