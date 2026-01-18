#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { LAB_TEST_REGISTRY } from '../src/registries/labTestRegistry';

config();
const prisma = new PrismaClient();

interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
}

export async function syncAllLabs(): Promise<string> {
  const stats: SyncStats = { created: 0, updated: 0, skipped: 0 };

  for (const test of LAB_TEST_REGISTRY) {
    try {
      const existing = await prisma.labTest.findUnique({ where: { name: test.name } });

      await prisma.labTest.upsert({
        where: { name: test.name },
        update: {
          // Preserve AI/handwritten content; only update lightweight metadata
          category: test.category,
        },
        create: {
          name: test.name,
          category: test.category,
          commonAbnormalities: [],
          typicalUse: null,
        },
      });

      if (existing) {
        stats.updated += 1;
      } else {
        stats.created += 1;
      }
    } catch (error) {
      console.error(`Failed to sync lab test: ${test.name}`, error);
      stats.skipped += 1;
    }
  }

  return `Labs → created: ${stats.created}, updated: ${stats.updated}, skipped: ${stats.skipped}`;
}

if (require.main === module) {
  syncAllLabs()
    .then((summary) => {
      console.log(summary);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
