/**
 * Google Drive API – Content Refinery integration.
 *
 * Service Account auth using GOOGLE_SERVICE_ACCOUNT_JSON (base64-encoded JSON)
 * to avoid filesystem in production/Edge.
 *
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON (required) – base64-encoded service account key JSON.
 */

import { google, drive_v3 } from 'googleapis';
import type { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string | null;
  webViewLink: string | null;
}

let cachedClient: drive_v3.Drive | null = null;

/**
 * Parse credentials from GOOGLE_SERVICE_ACCOUNT_JSON (base64).
 * Throws if env is missing or invalid.
 */
function getCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== 'string') {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is required (base64-encoded service account JSON).'
    );
  }
  try {
    const json = Buffer.from(raw, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Invalid service account JSON: missing client_email or private_key');
    }
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be valid base64-encoded JSON.');
    }
    throw e;
  }
}

/**
 * Returns an authenticated Drive API client (Service Account).
 * Uses GOOGLE_SERVICE_ACCOUNT_JSON for credentials; caches the client.
 */
export function getDriveClient(): drive_v3.Drive {
  if (cachedClient) return cachedClient;
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: credentials as { client_email: string; private_key: string },
    scopes: SCOPES,
  });
  const drive = google.drive({ version: 'v3', auth });
  cachedClient = drive;
  return drive;
}

/**
 * List files in a Drive folder.
 * Returns id, name, mimeType, webViewLink for each file.
 */
export async function listFilesInFolder(folderId: string): Promise<DriveFileInfo[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink)',
    pageSize: 1000,
    orderBy: 'name',
  });
  const files = res.data.files ?? [];
  return files.map((f) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? null,
    webViewLink: f.webViewLink ?? null,
  }));
}

/**
 * Download a file from Drive as a readable stream.
 * Use for piping to storage or processing (e.g. PDF parse).
 */
export async function downloadFileStream(fileId: string): Promise<Readable> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  const stream = res.data as Readable;
  if (!stream || typeof stream.pipe !== 'function') {
    throw new Error('Drive API did not return a readable stream');
  }
  return stream;
}
