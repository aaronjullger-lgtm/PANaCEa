#!/usr/bin/env npx ts-node

/**
 * Delete Unreviewed Images Script
 *
 * Removes all images from the database that don't have AI analysis (no description).
 * These were uploaded without proper verification.
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

const prisma = new PrismaClient();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deleteUnreviewedImages() {
  console.log('🗑️ Deleting unreviewed images (no AI analysis)...\n');

  // Get all images without description
  const unreviewed = await prisma.mediaAsset.findMany({
    where: { OR: [{ description: null }, { description: '' }] },
    select: { id: true, originalUrl: true, thumbnailUrl: true, filename: true },
  });

  console.log(`Found ${unreviewed.length} unreviewed images to delete\n`);

  if (unreviewed.length === 0) {
    console.log('✅ No unreviewed images to delete');
    await prisma.$disconnect();
    return;
  }

  let deleted = 0;
  let storageDeleted = 0;
  let errors = 0;

  for (const img of unreviewed) {
    try {
      // Delete from storage if URL exists
      if (img.originalUrl) {
        const match = img.originalUrl.match(/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        if (match) {
          const [, bucket, filePath] = match;
          const { error } = await supabase.storage.from(bucket).remove([filePath]);
          if (!error) storageDeleted++;
        }
      }

      // Delete from database
      await prisma.mediaAsset.delete({ where: { id: img.id } });
      deleted++;

      if (deleted % 100 === 0) {
        console.log(`  Deleted ${deleted} / ${unreviewed.length}`);
      }
    } catch (e) {
      errors++;
    }
  }

  console.log('\n=== DELETION COMPLETE ===');
  console.log(`Database records deleted: ${deleted}`);
  console.log(`Storage files deleted: ${storageDeleted}`);
  console.log(`Errors: ${errors}`);

  // Show remaining count
  const remaining = await prisma.mediaAsset.count();
  console.log(`\nRemaining images in DB: ${remaining}`);

  await prisma.$disconnect();
}

deleteUnreviewedImages().catch(console.error);
