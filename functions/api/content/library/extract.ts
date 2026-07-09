/**
 * POST /api/content/library/extract – Start Adobe PDF Extract job.
 * GET /api/content/library/extract?jobId=...&resourceId=... – Poll status; when done, download zip, extract structuredData.json, run ingest.
 */

import { unzipSync } from 'fflate';
import { z } from 'zod';
import { assertAdobeHostAllowed } from '../../_shared/adobeAllowlist';
import { cmsEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
import {
  createPdfAsset,
  downloadResultZip,
  getPdfServicesToken,
  pollExtractJobStatus,
  submitExtractJob,
  uploadToPresignedUri,
} from '../../_shared/pdfServices';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { createEndpointLogger } from '../../_shared/secureLogger';

const RESOURCE_BUCKET = 'educational-resources';
const PDF_SERVICES_BASE = 'https://pdf-services.adobe.io';
const MAX_POLL_MS = 90_000;
const POLL_INTERVAL_MS = 2_000;

const ExtractStartBodySchema = z.object({
  body: z.object({
    resourceId: z.string().min(1),
    pdfUrl: z.string().url(),
  }),
});

interface Env {
  DATABASE_URL: string;
  ADOBE_CLIENT_ID?: string;
  ADOBE_CLIENT_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export const onRequestPost = cmsEndpoint(ExtractStartBodySchema, async (context) => {
  const { env, auth, validated } = context as {
    env: Env;
    auth: { userId: string };
    validated: z.infer<typeof ExtractStartBodySchema>;
  };
  const log = createEndpointLogger('/api/content/library/extract', auth.userId);

  if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
    return fail(ErrorCode.ENV_MISCONFIGURED, {
      message: 'Adobe PDF Services not configured (ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET)',
    });
  }

  const { resourceId, pdfUrl } = validated.body;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  try {
    const resource = await prisma.educationalResource.findUnique({
      where: { id: resourceId },
      select: { id: true },
    });
    if (!resource) {
      return fail(ErrorCode.NOT_FOUND, { message: `Resource not found: ${resourceId}` });
    }
  } finally {
    await safePrismaDisconnect(prisma);
  }

  try {
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) {
      return fail(ErrorCode.UPSTREAM_ERROR, {
        message: `Failed to fetch PDF`,
      });
    }
    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    if (pdfBytes.length > 100 * 1024 * 1024) {
      return fail(ErrorCode.VALIDATION_FAILED, { message: 'PDF exceeds 100MB limit' });
    }

    const token = await getPdfServicesToken(env);
    const { assetID, uploadUri } = await createPdfAsset(env, token, 'application/pdf');
    uploadToPresignedUri(uploadUri, pdfBytes);

    const { jobId, statusUrl } = await submitExtractJob(env, token, assetID);
    const statusPath = new URL(statusUrl).pathname;
    const pollUrl = statusUrl.startsWith('http') ? statusUrl : `${PDF_SERVICES_BASE}${statusPath}`;

    log.info('Extract job started', { resourceId, jobId });
    return ok(
      {
        jobId,
        resourceId,
        statusUrl: pollUrl,
        message: `Poll GET /api/content/library/extract?jobId=${jobId}&resourceId=${resourceId} for status.`,
      },
      { status: 202 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Extract start failed';
    log.warn('Extract start failed', { error: message });
    return fail(ErrorCode.UPSTREAM_ERROR, { message: 'Failed to start PDF extraction' });
  }
});

const ExtractStatusQuerySchema = z.object({
  jobId: z.string().min(1),
  resourceId: z.string().min(1),
});

/** GET ?jobId= & resourceId= – poll until done, then ingest. */
export const onRequestGet = cmsEndpoint(
  ExtractStatusQuerySchema,
  async (context) => {
    const { env, auth, validated } = context as {
      env: Env;
      auth: { userId: string };
      validated: z.infer<typeof ExtractStatusQuerySchema>;
    };
    const log = createEndpointLogger('/api/content/library/extract (status)', auth.userId);
    const { jobId, resourceId } = validated;

    if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
      return fail(ErrorCode.ENV_MISCONFIGURED, { message: 'Adobe PDF Services not configured' });
    }

    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
      ]);
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }

    const statusUrl = `${PDF_SERVICES_BASE}/operation/extractpdf/${encodeURIComponent(jobId)}/status`;
    assertAdobeHostAllowed(statusUrl);

    const token = await getPdfServicesToken(env);
    const start = Date.now();
    let last: { status: string; downloadUri?: string; errorCode?: string; errorMessage?: string } =
      {
        status: 'in progress',
      };

    while (Date.now() - start < MAX_POLL_MS) {
      const statusRes = await pollExtractJobStatus(env, token, statusUrl);
      last = statusRes;

      if (statusRes.status === 'failed') {
        return ok({
          status: 'failed',
          errorCode: statusRes.errorCode,
          errorMessage: 'Extract job failed',
        });
      }

      if (statusRes.status === 'done' && statusRes.downloadUri) {
        const zipBuf = await downloadResultZip(statusRes.downloadUri);
        const zipBytes = new Uint8Array(zipBuf);
        const unzipped = unzipSync(zipBytes);
        const jsonKey = Object.keys(unzipped).find((k) => k.endsWith('structuredData.json'));
        const jsonEntry = jsonKey ? unzipped[jsonKey] : undefined;
        if (!jsonEntry) {
          return ok({ status: 'done', error: 'structuredData.json not found in result zip' });
        }
        const structuredData = JSON.parse(new TextDecoder().decode(jsonEntry)) as Record<
          string,
          unknown
        >;

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
          log.warn('Supabase upload failed after extract', {
            status: uploadRes.status,
            error: errText.slice(0, 200),
          });
          return fail(ErrorCode.UPSTREAM_ERROR, {
            message: 'Failed to upload structuredData to storage',
          });
        }

        const prisma = createEdgePrismaClient(env.DATABASE_URL);
        try {
          await prisma.educationalResource.update({
            where: { id: resourceId },
            data: { adobeDataPath: storagePath, updatedAt: new Date() },
          });
        } finally {
          await safePrismaDisconnect(prisma);
        }

        log.info('Extract completed and ingested', { resourceId, adobeDataPath: storagePath });
        return ok({ status: 'done', adobeDataPath: storagePath });
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    return ok({
      status: 'in progress',
      message: 'Polling timeout; call again to continue polling.',
      lastStatus: last.status,
    });
  },
  { source: 'query' as const }
);
