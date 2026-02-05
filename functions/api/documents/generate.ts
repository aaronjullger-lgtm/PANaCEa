/**
 * POST /api/documents/generate
 * Generate a PDF (or DOCX) from an Adobe Document Generation template + JSON data.
 * Use for Study Guides, Mock Exams, etc. Template must be uploaded to Adobe Assets first;
 * set DOC_GEN_TEMPLATE_ASSET_ID in env or pass templateAssetId in body.
 */

import { z } from 'zod';
import { assertAdobeHostAllowed } from '../_shared/adobeAllowlist';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  getPdfServicesToken,
  pollDocGenJobStatus,
  submitDocumentGenerationJob,
} from '../_shared/pdfServices';
import { createEndpointLogger } from '../_shared/secureLogger';

const PDF_SERVICES_BASE = 'https://pdf-services.adobe.io';
const MAX_POLL_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

const GenerateBodySchema = z.object({
  body: z.object({
    /** Pre-uploaded template asset ID (or use env DOC_GEN_TEMPLATE_ASSET_ID). */
    templateAssetId: z.string().min(1).optional(),
    /** Template key: "study-guide" uses env DOC_GEN_TEMPLATE_ASSET_ID. */
    templateKey: z.enum(['study-guide', 'mock-exam']).optional(),
    /** JSON to merge into template (keys match template tags). */
    jsonDataForMerge: z.record(z.unknown()),
    /** Output format. */
    outputFormat: z.enum(['pdf', 'docx']).optional().default('pdf'),
  }),
});

interface Env {
  ADOBE_CLIENT_ID?: string;
  ADOBE_CLIENT_SECRET?: string;
  DOC_GEN_TEMPLATE_ASSET_ID?: string;
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GenerateBodySchema, async (context) => {
  const { env, auth, validated } = context as {
    env: Env;
    auth: { userId: string };
    validated: z.infer<typeof GenerateBodySchema>;
  };
  const log = createEndpointLogger('/api/documents/generate', auth.userId);

  if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Adobe PDF Services not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const templateAssetId =
    validated.body.templateAssetId ??
    (validated.body.templateKey != null ? env.DOC_GEN_TEMPLATE_ASSET_ID : undefined);

  if (!templateAssetId) {
    return new Response(
      JSON.stringify({
        error:
          'Provide templateAssetId in body or set DOC_GEN_TEMPLATE_ASSET_ID and use templateKey: "study-guide" or "mock-exam"',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const token = await getPdfServicesToken(env);
    const { statusUrl } = await submitDocumentGenerationJob(
      env,
      token,
      templateAssetId,
      validated.body.jsonDataForMerge as Record<string, unknown>,
      validated.body.outputFormat
    );
    assertAdobeHostAllowed(statusUrl);

    const start = Date.now();
    while (Date.now() - start < MAX_POLL_MS) {
      const statusRes = await pollDocGenJobStatus(env, token, statusUrl);

      if (statusRes.status === 'failed') {
        return new Response(
          JSON.stringify({
            error: statusRes.errorMessage ?? 'Document generation failed',
            errorCode: statusRes.errorCode,
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (statusRes.status === 'done' && statusRes.downloadUri) {
        assertAdobeHostAllowed(statusRes.downloadUri);
        const res = await fetch(statusRes.downloadUri);
        if (!res.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to download generated document' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
          );
        }
        const bytes = await res.arrayBuffer();
        const contentType =
          validated.body.outputFormat === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/pdf';
        log.info('Document generated', { outputFormat: validated.body.outputFormat });
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="generated.${validated.body.outputFormat}"`,
          },
        });
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    return new Response(
      JSON.stringify({ error: 'Document generation timeout' }),
      { status: 504, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Document generation failed';
    log.warn('Document generation failed', { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
