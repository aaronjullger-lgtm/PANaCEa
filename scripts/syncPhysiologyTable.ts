#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { PHYSIOLOGY_CONCEPT_REGISTRY } from '../physiologyRegistry';

config();
const prisma = new PrismaClient();

interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
}

export async function syncAllPhysiology(): Promise<string> {
  const stats: SyncStats = { created: 0, updated: 0, skipped: 0 };

  for (const concept of PHYSIOLOGY_CONCEPT_REGISTRY) {
    try {
      const existing = await prisma.physiologyConcept.findUnique({ where: { name: concept.name } });

      await prisma.physiologyConcept.upsert({
        where: { name: concept.name },
        update: {
          category: concept.category,
          system: concept.category ?? null,
          aliases: concept.aliases ?? [],
          description: concept.description ?? null,
          relatedConditions: concept.relatedConditions ?? [],
          relatedDrugs: concept.relatedDrugs ?? [],
          displayName: concept.displayName ?? concept.name,
          mechanism: null,
          clinicalSignificance: null,
        },
        create: {
          name: concept.name,
          displayName: concept.displayName ?? concept.name,
          aliases: concept.aliases ?? [],
          category: concept.category,
          system: concept.category ?? null,
          description: concept.description ?? null,
          mechanism: null,
          clinicalSignificance: null,
          relatedConditions: concept.relatedConditions ?? [],
          relatedDrugs: concept.relatedDrugs ?? [],
        },
      });

      if (existing) {
        stats.updated += 1;
      } else {
        stats.created += 1;
      }
    } catch (error) {
      console.error(`Failed to sync physiology concept: ${concept.name}`, error);
      stats.skipped += 1;
    }
  }

  return `Physiology → created: ${stats.created}, updated: ${stats.updated}, skipped: ${stats.skipped}`;
}

if (require.main === module) {
  syncAllPhysiology()
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
