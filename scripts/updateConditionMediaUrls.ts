#!/usr/bin/env tsx
/**
 * Backfill Condition.mediaUrl using existing MediaAsset links.
 * - For each MediaAsset with a conditionId and originalUrl/thumbnailUrl, set Condition.mediaUrl.
 * - Skips when condition already has the same mediaUrl.
 *
 * Usage:
 *   tsx scripts/updateConditionMediaUrls.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function main() {
  const assets = await prisma.mediaAsset.findMany({
    where: {
      conditionId: { not: null },
      OR: [
        { originalUrl: { not: null } },
        { thumbnailUrl: { not: null } },
      ],
    },
    select: {
      id: true,
      conditionId: true,
      originalUrl: true,
      thumbnailUrl: true,
    },
  });

  let updated = 0;
  for (const asset of assets) {
    const mediaUrl = asset.originalUrl ?? asset.thumbnailUrl;
    if (!mediaUrl || !asset.conditionId) continue;

    const condition = await prisma.condition.findUnique({
      where: { id: asset.conditionId },
      select: { mediaUrl: true },
    });

    if (condition?.mediaUrl === mediaUrl) {
      continue;
    }

    await prisma.condition.update({
      where: { id: asset.conditionId },
      data: { mediaUrl, updatedAt: new Date() },
    });
    updated++;
    console.log(`🖼️  Set mediaUrl for condition ${asset.conditionId} -> ${mediaUrl}`);
  }

  console.log(`Done. Updated ${updated} condition(s).`);
}

main()
  .catch((error) => {
    console.error('❌ Failed to update condition media URLs:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
