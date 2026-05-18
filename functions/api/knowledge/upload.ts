/**
 * POST /api/knowledge/upload
 *
 * Upload a file (e.g. PDF) to Gemini Files API for use in context caching.
 * Returns fileUri and name for use in POST /api/knowledge/cache.
 *
 * Body: multipart/form-data with "file" field. Optional "displayName".
 * Max file size: 50MB (Edge limit).
 *
 * Validation model:
 *   - Content-type gate (415) rejects non-multipart requests before formData()
 *     materializes the body.
 *   - Content-Length short-circuit (413) rejects oversized payloads before
 *     materialization. A post-materialization file.size guard remains as
 *     defense-in-depth for requests that omit or misreport Content-Length.
 *   - MIME whitelist (ALLOWED_MIMES) enforces the file-type contract.
 *   - File-level shape checks (presence, non-empty) run after formData().
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIMES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

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

// Uses source:'query' with a permissive schema so the wrapper doesn't consume
// the multipart body before the handler can call request.formData(). Gemini
// env validation stays inside the handler since the canonical wrapper's
// env check covers DATABASE + AUTH but not GEMINI_API_KEY.
export const onRequestPost = aiEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env, request } = context;
    const logger = createEndpointLogger('/api/knowledge/upload');
    try {
      validateFunctionEnv(env as Record<string, unknown>, 'GEMINI');
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }

    // Content-type gate: only multipart/form-data is supported.
    // Rejecting before formData() avoids wasted work on misrouted traffic.
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return fail(ErrorCode.VALIDATION_FAILED, {
        message: 'Unsupported content-type. Expected multipart/form-data with a "file" field.',
        status: 415,
      });
    }

    // Content-Length short-circuit: reject oversized payloads before formData()
    // materializes the whole body into memory. The post-materialization
    // file.size check below remains as a defense-in-depth safety net for
    // requests that omit or misreport Content-Length.
    const contentLength = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE) {
      return fail(ErrorCode.VALIDATION_FAILED, {
        message: `Payload too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        status: 413,
      });
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file || !(file instanceof File)) {
        return fail(ErrorCode.VALIDATION_FAILED, {
          message: 'Missing or invalid "file" in form data',
        });
      }
      if (file.size > MAX_FILE_SIZE) {
        return fail(ErrorCode.VALIDATION_FAILED, {
          message: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          status: 413,
        });
      }
      const mimeType = file.type || 'application/octet-stream';
      if (!ALLOWED_MIMES.includes(mimeType)) {
        return fail(ErrorCode.VALIDATION_FAILED, {
          message: `Unsupported type. Allowed: ${ALLOWED_MIMES.join(', ')}`,
        });
      }
      const fileBytes = await file.arrayBuffer();
      const apiKey = (env as { GEMINI_API_KEY: string }).GEMINI_API_KEY;
      const result = await uploadToGeminiFiles(fileBytes, mimeType, apiKey);
      logger.info('Knowledge upload success', { name: result.name, size: file.size });
      return ok({ fileUri: result.fileUri, name: result.name, mimeType });
    } catch (err) {
      logger.error('Knowledge upload error', err);
      return fail(ErrorCode.UPSTREAM_ERROR, {
        message: 'Failed to upload file to knowledge service',
      });
    }
  },
  { source: 'query', requestsPerMinute: 20 }
);
