#!/usr/bin/env tsx
/**
 * Move root-level .jpg files into public/images/ and register/update MediaAsset entries.
 * - Renames/moves files (preserves filename) into public/images
 * - Links to matching Condition by normalized name (case-insensitive)
 * - Creates or updates MediaAsset with the new /images/<file> path
 *
 * Usage:
 *   tsx scripts/moveRootImages.ts           # move + update DB
 *   tsx scripts/moveRootImages.ts --dry-run # report only, no moves/writes
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

config();

const prisma = new PrismaClient();
const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'public', 'images');

type FileMapping = {
  filename: string;
  source: string;
  destination: string;
  publicPath: string;
  conditionName: string;
};

function titleCase(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function conditionNameFromFile(filename: string): string {
  const base = filename.replace(/\.jpg$/i, '');
  const spaced = base.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return titleCase(spaced);
}

async function collectJpgs(): Promise<FileMapping[]> {
  const entries = await fs.readdir(ROOT);
  const jpgs = entries.filter((f) => f.toLowerCase().endsWith('.jpg'));
  await fs.mkdir(TARGET_DIR, { recursive: true });

  return jpgs.map((filename) => {
    const source = path.join(ROOT, filename);
    const destination = path.join(TARGET_DIR, filename);
    const publicPath = `/images/${filename}`;
    const conditionName = conditionNameFromFile(filename);
    return { filename, source, destination, publicPath, conditionName };
  });
}

async function moveFiles(mappings: FileMapping[], dryRun: boolean) {
  for (const mapping of mappings) {
    if (dryRun) {
      console.log(`🧪 Dry-run move: ${mapping.filename} -> ${mapping.destination}`);
      continue;
    }

    await fs.rename(mapping.source, mapping.destination);
    console.log(`📦 Moved ${mapping.filename} -> ${mapping.destination}`);
  }
}

async function upsertMediaAssets(mappings: FileMapping[], dryRun: boolean) {
  for (const mapping of mappings) {
    const condition = await prisma.condition.findFirst({
      where: {
        name: { equals: mapping.conditionName, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });

    const existing = await prisma.mediaAsset.findFirst({
      where: { filename: mapping.filename },
      select: { id: true },
    });

    const data = {
      conditionId: condition?.id,
      type: 'image',
      filename: mapping.filename,
      originalUrl: mapping.publicPath,
      thumbnailUrl: mapping.publicPath,
      mediaType: 'image',
      folder: 'public',
      tags: [] as string[],
      description: `Local image imported from repository root (${mapping.filename})`,
      status: 'pending_review',
      approvalStatus: 'pending',
      uploadedBy: 'script:move-root-images',
      sourceUrl: mapping.publicPath,
      updatedAt: new Date(),
    } as const;

    if (dryRun) {
      console.log(
        `🧪 Dry-run DB ${existing ? 'update' : 'create'}: ${mapping.filename} -> ${mapping.publicPath} (${condition?.name ?? 'unmapped condition'})`
      );
      continue;
    }

    if (existing) {
      await prisma.mediaAsset.update({
        where: { id: existing.id },
        data,
      });
      console.log(`🔄 Updated MediaAsset for ${mapping.filename}`);
    } else {
      await prisma.mediaAsset.create({
        data: {

          updatedAt: new Date(),

          id: randomUUID(),
          ...data,
          createdAt: new Date(),
          uploadedAt: new Date(),
        },
      });
      console.log(`✨ Created MediaAsset for ${mapping.filename}`);
    }

    // If we matched a condition, update its mediaUrl for quick reference
    if (condition) {
      await prisma.condition.update({
        where: { id: condition.id },
        data: { mediaUrl: mapping.publicPath, updatedAt: new Date() },
      });
      console.log(`🖼️  Updated Condition.mediaUrl for ${condition.name}`);
    } else {
      console.warn(
        `⚠️  No condition match for ${mapping.filename}; MediaAsset stored without Condition link`
      );
    }
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const mappings = await collectJpgs();

  if (mappings.length === 0) {
    console.log('No root-level .jpg files found.');
    return;
  }

  console.log(`Found ${mappings.length} image(s) to move.`);
  await moveFiles(mappings, dryRun);
  await upsertMediaAssets(mappings, dryRun);

  console.log('\nDone.');
}

main()
  .catch((error) => {
    console.error('❌ Failed to move images:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
