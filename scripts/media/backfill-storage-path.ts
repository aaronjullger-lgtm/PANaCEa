/**
 * Backfill MediaAsset.storagePath from originalUrl
 *
 * Sets storagePath for rows where it is null by parsing the bucket path from originalUrl.
 * Run after adding storagePath: npx tsx scripts/media/backfill-storage-path.ts
 *
 * Usage: npx tsx scripts/media/backfill-storage-path.ts [--dry-run] [--limit N]
 */

import { prisma } from '../../lib/prisma';

const MEDIA_BUCKET = 'medical-images';

function extractStoragePathFromUrl(originalUrl: string): string | null {
  try {
    const url = new URL(originalUrl);
    const bucketSegment = `${MEDIA_BUCKET}/`;
    const idx = url.pathname.indexOf(bucketSegment);
    if (idx >= 0) {
      return url.pathname.slice(idx + bucketSegment.length);
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join('/');
    }
  } catch {
    // ignore
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '500', 10) : 500;

  const toUpdate = await prisma.mediaAsset.findMany({
    where: {
      storagePath: null,
      originalUrl: { not: null },
    },
    select: { id: true, originalUrl: true, filename: true },
    take: limit,
  });

  if (toUpdate.length === 0) {
    console.log('No MediaAsset rows need storagePath backfill.');
    return;
  }

  console.log(`Found ${toUpdate.length} row(s) to backfill. Dry run: ${dryRun}`);

  let updated = 0;
  let skipped = 0;

  for (const row of toUpdate) {
    const path = extractStoragePathFromUrl(row.originalUrl!);
    if (!path) {
      skipped++;
      continue;
    }
    if (!dryRun) {
      await prisma.mediaAsset.update({
        where: { id: row.id },
        data: { storagePath: path, updatedAt: new Date() },
      });
    }
    updated++;
  }

  console.log(`Updated: ${updated}, Skipped (no path): ${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
