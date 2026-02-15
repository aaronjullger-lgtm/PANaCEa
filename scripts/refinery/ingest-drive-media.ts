/**
 * Visual Ingestion Engine — Drive → Raw Vault → Database Draft
 *
 * Pipeline: List images in Drive folder → download → hash (SHA-256) → upload to
 * Supabase raw-source-vault → create SourceMaterial + MediaAsset (pending, unverified).
 *
 * Usage:
 *   npx tsx scripts/refinery/ingest-drive-media.ts --folderId=DRIVE_FOLDER_ID [--licenseType=CC-BY-SA] [--sourceName="Personal Drive Archive"]
 *
 * Requires: GOOGLE_SERVICE_ACCOUNT_JSON, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           DIRECT_DATABASE_URL or DATABASE_URL
 */

import { config } from 'dotenv';
config();

import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';
import { listFilesInFolder, downloadFileStream } from '../../lib/google-drive';
import { supabaseAdmin } from '../../lib/supabase/admin';
import { prisma, disconnect } from '../_shared/db';
import { SourceMaterialType } from '@prisma/client';

const BUCKET = 'raw-source-vault';
const DEFAULT_LICENSE = 'PROPRIETARY_REFERENCE';
const IMAGE_MIME_PREFIX = 'image/';

type Args = { folderId: string | null; licenseType: string; sourceName: string };

function parseArgs(argv: string[]): Args {
  const get = (key: string, def: string): string => {
    const arg = argv.find((a) => a.startsWith(`--${key}=`));
    if (!arg) return def;
    return arg.split('=')[1]?.trim() ?? def;
  };
  return {
    folderId: get('folderId', '') || null,
    licenseType: get('licenseType', DEFAULT_LICENSE),
    sourceName: get('sourceName', 'Personal Drive Archive'),
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\]/g, '-').replace(/\s+/g, '_') || 'file';
}

function storagePathFor(filename: string, driveFileId: string): string {
  const yyyyMm = new Date().toISOString().slice(0, 7);
  const base = sanitizeFileName(filename);
  const suffix = driveFileId.slice(0, 8);
  return `drive-imports/${yyyyMm}/${base}_${suffix}`;
}

/**
 * Consume stream into buffer and compute SHA-256 in one pass.
 */
async function streamToBufferAndHash(stream: Readable): Promise<{ buffer: Buffer; hash: string }> {
  const hasher = createHash('sha256');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hasher.update(b);
    chunks.push(b);
  }
  const buffer = Buffer.concat(chunks);
  const hash = hasher.digest('hex');
  return { buffer, hash };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.folderId) {
    console.error(
      'Usage: npx tsx scripts/refinery/ingest-drive-media.ts --folderId=DRIVE_FOLDER_ID [--licenseType=CC-BY-SA] [--sourceName="Personal Drive Archive"]'
    );
    process.exit(1);
  }

  const { folderId, licenseType, sourceName } = args;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
  }

  console.log('Listing files in Drive folder...');
  const allFiles = await listFilesInFolder(folderId);
  const imageFiles = allFiles.filter((f) => f.mimeType?.startsWith(IMAGE_MIME_PREFIX));
  console.log(`Found ${imageFiles.length} image(s) (${allFiles.length} total files).`);

  if (imageFiles.length === 0) {
    console.log('No images to ingest.');
    await disconnect();
    return;
  }

  const sourceUrl = `https://drive.google.com/drive/folders/${folderId}`;
  let sourceMaterial = await prisma.sourceMaterial.findFirst({
    where: { sourceName, sourceUrl },
  });
  if (!sourceMaterial) {
    sourceMaterial = await prisma.sourceMaterial.create({
      data: {
        sourceType: SourceMaterialType.USER_UPLOAD,
        sourceName,
        sourceUrl,
        licenseType,
        processed: false,
      },
    });
    console.log('Created SourceMaterial:', sourceMaterial.id);
  }

  let ingested = 0;
  let skipped = 0;

  for (const file of imageFiles) {
    const filename = file.name || file.id;
    const existing = await prisma.mediaAsset.findFirst({
      where: {
        filename,
        sourceMaterialId: sourceMaterial.id,
      },
    });
    if (existing) {
      console.log(`Skip (already in DB): ${filename}`);
      skipped++;
      continue;
    }

    try {
      const stream = await downloadFileStream(file.id);
      const { buffer, hash } = await streamToBufferAndHash(stream);
      const storagePath = storagePathFor(filename, file.id);
      const contentType = file.mimeType || 'application/octet-stream';

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error(`Upload failed for ${filename}:`, uploadError.message);
        continue;
      }

      const now = new Date();
      const assetId = uuidv4();
      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          type: 'reference',
          filename,
          mimeType: file.mimeType ?? null,
          fileSize: buffer.length,
          status: 'pending',
          approvalStatus: 'pending',
          provenanceStatus: 'unverified',
          rawStoragePath: storagePath,
          contentHash: hash,
          isClassicPortrayal: false,
          licenseType,
          sourceMaterialId: sourceMaterial.id,
          originalUrl: file.webViewLink ?? null,
          sourceUrl: file.webViewLink ?? null,
          updatedAt: now,
          tags: [],
        },
      });

      console.log(`Ingested ${filename}. Ready for Triage.`);
      ingested++;
    } catch (e) {
      console.error(`Failed ${filename}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log('');
  console.log(`Done. Ingested: ${ingested}, Skipped: ${skipped}.`);
  await disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
