#!/usr/bin/env tsx
import { v4 as uuidv4 } from 'uuid';
import { FINDING_REGISTRY } from '../src/registries/findingRegistry';
import { prisma, disconnectPrisma } from './helpers/prisma-client';

interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
}

export async function syncAllFindings(): Promise<string> {
  const stats: SyncStats = { created: 0, updated: 0, skipped: 0 };

  for (const finding of FINDING_REGISTRY) {
    try {
      const existing = await prisma.physicalExamFinding.findUnique({
        where: { name: finding.name },
      });

      await prisma.physicalExamFinding.upsert({
        where: { name: finding.name },
        update: {
          system: finding.system,
        },
        create: {
          id: uuidv4(),
          name: finding.name,
          system: finding.system,
          description: null,
          clinicalSignificance: null,
          updatedAt: new Date(),
        },
      });

      if (existing) {
        stats.updated += 1;
      } else {
        stats.created += 1;
      }
    } catch (error) {
      console.error(`Failed to sync physical exam finding: ${finding.name}`, error);
      stats.skipped += 1;
    }
  }

  return `Findings → created: ${stats.created}, updated: ${stats.updated}, skipped: ${stats.skipped}`;
}

if (require.main === module) {
  syncAllFindings()
    .then((summary) => {
      console.log(summary);
      return disconnectPrisma();
    })
    .catch(async (err) => {
      console.error(err);
      await disconnectPrisma();
      process.exit(1);
    });
}
