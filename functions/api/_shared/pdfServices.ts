/**
 * Adobe PDF Services API helpers (token, assets, extract job).
 * Uses pdf-services.adobe.io (allowlist: docs/deployment/ADOBE_ALLOWLIST.md).
 */

import { assertAdobeHostAllowed } from './adobeAllowlist';

const PDF_SERVICES_BASE = 'https://pdf-services.adobe.io';
const PDF_SERVICES_TOKEN = `${PDF_SERVICES_BASE}/token`;

function resolveLocationUrl(location: string): string {
  if (location.startsWith('http')) return location;
  const prefix = location.startsWith('/') ? '' : '/';
  return `${PDF_SERVICES_BASE}${prefix}${location}`;
}
const PDF_SERVICES_ASSETS = `${PDF_SERVICES_BASE}/assets`;
const PDF_SERVICES_EXTRACT = `${PDF_SERVICES_BASE}/operation/extractpdf`;
const PDF_SERVICES_DOC_GEN = `${PDF_SERVICES_BASE}/operation/documentgeneration`;

export interface PdfServicesEnv {
  ADOBE_CLIENT_ID?: string;
  ADOBE_CLIENT_SECRET?: string;
}

/** Get PDF Services access token (not IMS). */
export async function getPdfServicesToken(env: PdfServicesEnv): Promise<string> {
  if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
    throw new Error('ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET required for PDF Services');
  }
  assertAdobeHostAllowed(PDF_SERVICES_TOKEN);
  const body = new URLSearchParams({
    client_id: env.ADOBE_CLIENT_ID,
    client_secret: env.ADOBE_CLIENT_SECRET,
  });
  const res = await fetch(PDF_SERVICES_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PDF Services token failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('No access_token in PDF Services token response');
  return data.access_token;
}

export interface CreateAssetResult {
  assetID: string;
  uploadUri: string;
}

/** Create asset and get uploadUri + assetID. */
export async function createPdfAsset(
  env: PdfServicesEnv,
  token: string,
  mediaType: string
): Promise<CreateAssetResult> {
  assertAdobeHostAllowed(PDF_SERVICES_ASSETS);
  const res = await fetch(PDF_SERVICES_ASSETS, {
    method: 'POST',
    headers: {
      'X-API-Key': env.ADOBE_CLIENT_ID ?? '',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mediaType }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PDF Services create asset failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { assetID?: string; uploadUri?: string };
  if (!data.assetID || !data.uploadUri) {
    throw new Error('Missing assetID or uploadUri in create asset response');
  }
  return { assetID: data.assetID, uploadUri: data.uploadUri };
}

/** Upload PDF bytes to the given uploadUri (S3). */
export async function uploadToPresignedUri(uploadUri: string, pdfBytes: Uint8Array): Promise<void> {
  try {
    const url = new URL(uploadUri);
    if (!url.hostname) throw new Error('Invalid uploadUri');
    // Allowlist includes dcplatformstorageservice-prod-us-east-1.s3-accelerate.amazonaws.com
    const res = await fetch(uploadUri, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdfBytes,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload to presigned URI failed: ${res.status} ${text.slice(0, 200)}`);
    }
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error('Upload to presigned URI failed');
  }
}

/** Submit Extract PDF job. Returns job status URL (poll until done). */
export async function submitExtractJob(
  env: PdfServicesEnv,
  token: string,
  assetID: string,
  elementsToExtract: string[] = ['text', 'tables']
): Promise<{ jobId: string; statusUrl: string }> {
  assertAdobeHostAllowed(PDF_SERVICES_EXTRACT);
  const res = await fetch(PDF_SERVICES_EXTRACT, {
    method: 'POST',
    headers: {
      'X-API-Key': env.ADOBE_CLIENT_ID ?? '',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ assetID, elementsToExtract }),
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`Extract job submit failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const location = res.headers.get('location');
  if (!location) throw new Error('No Location header in extract job response');
  const match = /\/operation\/extractpdf\/([^/]+)\/status/.exec(location);
  const jobId = match?.[1] ?? location;
  const statusUrl = resolveLocationUrl(location).replace(/^https?:\/\//, 'https://');
  return { jobId, statusUrl };
}

export type ExtractJobStatus = 'in progress' | 'done' | 'failed';

export interface ExtractJobStatusResponse {
  status: ExtractJobStatus;
  downloadUri?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** Poll Extract PDF job status. */
export async function pollExtractJobStatus(
  env: PdfServicesEnv,
  token: string,
  statusUrl: string
): Promise<ExtractJobStatusResponse> {
  assertAdobeHostAllowed(statusUrl);
  const res = await fetch(statusUrl, {
    method: 'GET',
    headers: {
      'X-API-Key': env.ADOBE_CLIENT_ID ?? '',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Extract job status failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    status?: ExtractJobStatus;
    downloadUri?: string;
    errorCode?: string;
    errorMessage?: string;
  };
  return {
    status: data.status ?? 'failed',
    downloadUri: data.downloadUri,
    errorCode: data.errorCode,
    errorMessage: data.errorMessage,
  };
}

/** Download result zip from downloadUri (allowlisted S3). */
export async function downloadResultZip(downloadUri: string): Promise<ArrayBuffer> {
  assertAdobeHostAllowed(downloadUri);
  const res = await fetch(downloadUri);
  if (!res.ok) throw new Error(`Download result failed: ${res.status}`);
  return res.arrayBuffer();
}

/** Submit Document Generation job. Returns job status URL. */
export async function submitDocumentGenerationJob(
  env: PdfServicesEnv,
  token: string,
  templateAssetID: string,
  jsonDataForMerge: Record<string, unknown>,
  outputFormat: 'pdf' | 'docx' = 'pdf'
): Promise<{ jobId: string; statusUrl: string }> {
  assertAdobeHostAllowed(PDF_SERVICES_DOC_GEN);
  const res = await fetch(PDF_SERVICES_DOC_GEN, {
    method: 'POST',
    headers: {
      'X-API-Key': env.ADOBE_CLIENT_ID ?? '',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assetID: templateAssetID,
      outputFormat,
      jsonDataForMerge,
    }),
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`Document Generation submit failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const location = res.headers.get('location');
  if (!location) throw new Error('No Location header in document generation response');
  const match = /\/operation\/documentgeneration\/([^/]+)\/status/.exec(location);
  const jobId = match?.[1] ?? location;
  const statusUrl = resolveLocationUrl(location).replace(/^https?:\/\//, 'https://');
  return { jobId, statusUrl };
}

/** Poll Document Generation job status (same shape as Extract). */
export async function pollDocGenJobStatus(
  env: PdfServicesEnv,
  token: string,
  statusUrl: string
): Promise<ExtractJobStatusResponse> {
  return pollExtractJobStatus(env, token, statusUrl);
}
