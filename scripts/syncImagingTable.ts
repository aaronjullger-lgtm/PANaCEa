#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { IMAGING_REGISTRY } from '../src/registries/imagingRegistry';

config();

// Prisma v7 requires adapter for PostgreSQL
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!directUrl) {
  console.error('❌ DATABASE_URL not set in environment');
  process.exit(1);
}
const pool = new Pool({ connectionString: directUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
}

export async function syncAllImaging(): Promise<string> {
  const stats: SyncStats = { created: 0, updated: 0, skipped: 0 };

  for (const study of IMAGING_REGISTRY) {
    try {
      const existing = await prisma.imagingStudy.findUnique({ where: { name: study.name } });

      await prisma.imagingStudy.upsert({
        where: { name: study.name },
        update: {
          modality: study.modality,
          bodyRegion: study.bodyRegion ?? null,
          usesContrast: Boolean(study.usesContrast),
          usesRadiation: Boolean(study.usesRadiation),
        },
        create: {
          name: study.name,
          modality: study.modality,
          bodyRegion: study.bodyRegion ?? null,
          usesContrast: Boolean(study.usesContrast),
          usesRadiation: Boolean(study.usesRadiation),
          description: null,
          indications: [],
          contraindications: [],
        },
      });

      if (existing) {
        stats.updated += 1;
      } else {
        stats.created += 1;
      }
    } catch (error) {
      console.error(`Failed to sync imaging study: ${study.name}`, error);
      stats.skipped += 1;
    }
  }

  return `Imaging → created: ${stats.created}, updated: ${stats.updated}, skipped: ${stats.skipped}`;
}

if (require.main === module) {
  syncAllImaging()
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
