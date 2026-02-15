/**
 * POST /api/knowledge/upload
 *
 * Upload a file (e.g. PDF) to Gemini Files API for use in context caching.
 * Returns fileUri and name for use in POST /api/knowledge/cache.
 *
 * Body: multipart/form-data with "file" field. Optional "displayName".
 * Max file size: 50MB (Edge limit).
 */

import {
  withCors,
  withMiddleware,
  withAuth,
  withErrorHandling,
  withRateLimit,
  withLogging,
  withEnvCheck,
  type AuthenticatedContext,
} from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIMES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const onRequestOptions = withCors();

async function uploadToGeminiFiles(
  fileBytes: ArrayBuffer,
  mimeType: string,
  apiKey: string
): Promise<{ fileUri: string; name: string }> {
  const size = fileBytes.byteLength;
  const startRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'library' } }),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Gemini upload start failed: ${startRes.status} ${text}`);
  }
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini did not return upload URL');
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: fileBytes,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Gemini upload failed: ${uploadRes.status} ${text}`);
  }
  const data = (await uploadRes.json()) as { file?: { uri?: string; name?: string } };
  const fileUri = data.file?.uri;
  const name = data.file?.name;
  if (!fileUri || !name) throw new Error('Gemini response missing file.uri or file.name');
  return { fileUri, name };
}

export const onRequestPost = withMiddleware(
  withCors(),
  withErrorHandling(),
  withEnvCheck('FULL_STACK'),
  withAuth(),
  withRateLimit({ requestsPerMinute: 20, endpointType: 'api' }),
  withLogging(),
  async (context: AuthenticatedContext) => {
    const { env, request } = context;
    const logger = createEndpointLogger('/api/knowledge/upload');
    try {
      validateFunctionEnv(env as Record<string, unknown>, 'GEMINI');
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file || !(file instanceof File)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid "file" in form data' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (file.size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const mimeType = file.type || 'application/octet-stream';
      if (!ALLOWED_MIMES.includes(mimeType)) {
        return new Response(
          JSON.stringify({ error: `Unsupported type. Allowed: ${ALLOWED_MIMES.join(', ')}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const fileBytes = await file.arrayBuffer();
      const apiKey = (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY;
      const result = await uploadToGeminiFiles(fileBytes, mimeType, apiKey);
      logger.info('Knowledge upload success', { name: result.name, size: file.size });
      return new Response(
        JSON.stringify({
          fileUri: result.fileUri,
          name: result.name,
          mimeType,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      logger.error('Knowledge upload error', err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
);
