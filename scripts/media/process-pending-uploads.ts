/**
 * Process Pending Media Uploads (Node only)
 *
 * Fetches pending MediaAsset rows (approvalStatus: 'pending') with originalUrl,
 * runs quality assessment and optional optimization/thumbnail via processUploadedMedia.
 * Run manually or via cron: npx tsx scripts/media/process-pending-uploads.ts
 *
 * Requires: Node (sharp, Gemini), DATABASE_URL, GEMINI_API_KEY, Supabase env.
 */

import { prisma } from '../../lib/prisma';
import { processUploadedMedia } from '../../services/domain/mediaApprovalService';
import { typeToCategory } from '../../lib/mediaTypes';
import type { MediaCategory } from '../../lib/mediaTypes';

const LIMIT = 50;

async function main() {
  const pending = await prisma.mediaAsset.findMany({
    where: {
      approvalStatus: 'pending',
      originalUrl: { not: null },
    },
    select: {
      id: true,
      type: true,
      originalUrl: true,
      filename: true,
    },
    take: LIMIT,
    orderBy: { uploadedAt: 'asc' },
  });

  if (pending.length === 0) {
    console.log('No pending media to process.');
    return;
  }

  console.log(`Processing ${pending.length} pending media asset(s)...`);

  let processed = 0;
  let failed = 0;

  for (const asset of pending) {
    const url = asset.originalUrl!;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ⚠ ${asset.filename}: fetch failed ${res.status}`);
        failed++;
        continue;
      }
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);

      const category = typeToCategory(asset.type) as MediaCategory;
      await processUploadedMedia(asset.id, buffer, category);
      processed++;
      console.log(`  ✓ ${asset.filename} (${category})`);
    } catch (err) {
      console.warn(`  ✗ ${asset.filename}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`Done. Processed: ${processed}, Failed: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
