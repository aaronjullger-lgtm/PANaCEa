/**
 * GET /api/study/resources/:id/file
 *
 * Streams the PDF bytes for an approved EducationalResource.
 * Supports Range requests (important for performant PDF viewers/linearization).
 *
 * Intended usage from Adobe PDF Embed API:
 * - Provide this URL as pdfUrl
 * - Pass Authorization header via content.location.headers in previewFile config
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors} from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../../../_shared/env-validation';
import { createEndpointLogger } from '../../../_shared/secureLogger';

const RESOURCE_BUCKET = 'educational-resources';

const ParamsSchema = z.object({
  id: z.string().min(1, 'Missing resource id'),
});

function pickHeader(headers: Headers, key: string): string | undefined {
  const v = headers.get(key);
  return v == null || v === '' ? undefined : v;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ParamsSchema,
  async (context) => {
    const { env, validated, request } = context as {
      env: Record<string, unknown>;
      validated: z.infer<typeof ParamsSchema>;
      request: Request;
    };
    const logger = createEndpointLogger('/api/study/resources/:id/file');
    const prisma = createEdgePrismaClient(env.DATABASE_URL as string);

    try {
      const { id } = validated;
      const resource = await prisma.educationalResource.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          fileUrl: true,
          storagePath: true,
          mimeType: true,
          originalFilename: true,
          approvalStatus: true,
        },
      });

      if (!resource) return { status: 404, error: 'Resource not found' };
      if (resource.approvalStatus !== 'approved')
        return { status: 403, error: 'Resource not approved for use' };

      const range = request.headers.get('Range') ?? undefined;

      // Prefer public fileUrl when available
      let upstream: Response;
      if (resource.fileUrl) {
        upstream = await fetch(resource.fileUrl, {
          headers: range ? { Range: range } : undefined,
        });
      } else {
        // Fall back to Supabase storagePath via service role
        try {
          validateFunctionEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
        } catch (e) {
          if (e instanceof MissingEnvError) return e.toResponse();
          throw e;
        }

        const storagePath = resource.storagePath;
        if (!storagePath) return { status: 404, error: 'Resource has no fileUrl or storagePath' };

        const url = `${env.SUPABASE_URL as string}/storage/v1/object/${RESOURCE_BUCKET}/${storagePath}`;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY as string}`,
        };
        if (range) headers.Range = range;

        upstream = await fetch(url, { headers });
      }

      if (!upstream.ok && upstream.status !== 206) {
        const text = await upstream.text().catch(() => '');
        logger.warn('Upstream PDF fetch failed', {
          id,
          status: upstream.status,
          text: text.slice(0, 200),
        });
        return { status: 502, error: 'Failed to fetch PDF' };
      }

      const outHeaders = new Headers();
      outHeaders.set(
        'Content-Type',
        resource.mimeType || pickHeader(upstream.headers, 'content-type') || 'application/pdf'
      );
      outHeaders.set('Cache-Control', 'private, max-age=0, no-store');

      const contentLength = pickHeader(upstream.headers, 'content-length');
      if (contentLength) outHeaders.set('Content-Length', contentLength);
      const contentRange = pickHeader(upstream.headers, 'content-range');
      if (contentRange) outHeaders.set('Content-Range', contentRange);
      const acceptRanges = pickHeader(upstream.headers, 'accept-ranges');
      if (acceptRanges) outHeaders.set('Accept-Ranges', acceptRanges);
      const etag = pickHeader(upstream.headers, 'etag');
      if (etag) outHeaders.set('ETag', etag);

      // Ensure filename hint for downloads (some viewers may use it)
      const filename = resource.originalFilename || resource.title || 'document.pdf';
      const safeFilename = filename.replaceAll('"', '');
      outHeaders.set('Content-Disposition', `inline; filename="${safeFilename}"`);

      return new Response(upstream.body, {
        status: upstream.status,
        headers: outHeaders,
      });
    } catch (e) {
      logger.error('Failed to stream study resource file', e);
      return { status: 500, error: 'Failed to fetch PDF' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params', requestsPerMinute: 240 }
);
