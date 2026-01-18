#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { TREATMENT_REGISTRY } from '../src/registries/treatmentRegistry';

config();
const prisma = new PrismaClient();

interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
}

export async function syncAllTreatments(): Promise<string> {
  const stats: SyncStats = { created: 0, updated: 0, skipped: 0 };

  for (const treatment of TREATMENT_REGISTRY) {
    try {
      const existing = await prisma.treatment.findUnique({ where: { name: treatment.name } });

      await prisma.treatment.upsert({
        where: { name: treatment.name },
        update: {
          category: treatment.category,
        },
        create: {
          name: treatment.name,
          displayName: treatment.displayName ?? treatment.name,
          category: treatment.category,
          type: null,
          description: null,
          indications: [],
          contraindications: [],
          complications: [],
        },
      });

      if (existing) {
        stats.updated += 1;
      } else {
        stats.created += 1;
      }
    } catch (error) {
      console.error(`Failed to sync treatment: ${treatment.name}`, error);
      stats.skipped += 1;
    }
  }

  return `Treatments → created: ${stats.created}, updated: ${stats.updated}, skipped: ${stats.skipped}`;
}

if (require.main === module) {
  syncAllTreatments()
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
