/**
 * POST /api/content/library/ingest
 *
 * Store Adobe PDF Extract structuredData.json for an EducationalResource.
 * Call this after running PDFServices.extractPDF (e.g. in a Node/offline job);
 * the job uploads the JSON here, we store it in Supabase and set adobeDataPath.
 *
 * Body: { resourceId: string, structuredData: object }
 * - structuredData: Adobe Extract JSON (Text, Tables, Figures); will be stored as-is.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { createEndpointLogger } from '../../_shared/secureLogger';

const RESOURCE_BUCKET = 'educational-resources';

const IngestBodySchema = z.object({
  body: z.object({
    resourceId: z.string().min(1),
    structuredData: z.record(z.string(), z.unknown()),
  }),
});

interface Env {
  DATABASE_URL: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export const onRequestPost = authenticatedEndpoint(IngestBodySchema, async (context) => {
  const { env, auth, validated } = context as {
    env: Env;
    auth: { userId: string };
    validated: z.infer<typeof IngestBodySchema>;
  };
  const log = createEndpointLogger('/api/content/library/ingest', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  try {
    const { resourceId, structuredData } = validated.body;

    const resource = await prisma.educationalResource.findUnique({
      where: { id: resourceId },
      select: { id: true, title: true, approvalStatus: true },
    });
    if (!resource) {
      return fail(ErrorCode.NOT_FOUND, { message: `Resource not found: ${resourceId}` });
    }

    const storagePath = `extracts/${resourceId}/structuredData.json`;
    const jsonBytes = new TextEncoder().encode(JSON.stringify(structuredData));

    const uploadUrl = `${env.SUPABASE_URL}/storage/v1/object/${RESOURCE_BUCKET}/${storagePath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: jsonBytes,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      log.warn('Supabase storage upload failed', {
        status: uploadRes.status,
        error: errText.slice(0, 200),
      });
      return fail(ErrorCode.UPSTREAM_ERROR, {
        message: 'Failed to upload structuredData to storage',
        details: errText.slice(0, 300),
      });
    }

    await prisma.educationalResource.update({
      where: { id: resourceId },
      data: { adobeDataPath: storagePath, updatedAt: new Date() },
    });

    log.info('Library ingest completed', { resourceId, storagePath });
    return ok({ resourceId, adobeDataPath: storagePath });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
