import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { DRUG_REGISTRY } from '../../../src/registries/drugRegistry';
import { prisma } from '../../prisma';
import { logger } from '../../logger';

const LOG_SCOPE = 'RegistrySync';
const registrySyncLogger = logger.scope(LOG_SCOPE);

export interface SyncStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

const emptyStats = (): SyncStats => ({
  total: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
});

const normalizeAliases = (aliases?: string | string[]): string[] => {
  if (!aliases || (Array.isArray(aliases) && aliases.length === 0)) return [];
  const arr = Array.isArray(aliases) ? aliases : [aliases];
  const deduped = Array.from(new Set(arr.map((a) => a.trim()).filter(Boolean)));
  return deduped;
};

/**
 * Sync conditions from MedicalContent (database) into the Condition table.
 * - Sources published MedicalContent rows as single source of truth.
 * - Upserts by conditionId; preserves existing content/aliases in Condition when updating.
 */
export async function syncConditions(client: PrismaClient = prisma): Promise<SyncStats> {
  const stats = emptyStats();
  const rows = await client.medicalContent.findMany({
    where: { status: 'published' },
    select: { conditionId: true, condition: true, system: true, relatedSystems: true },
  });
  stats.total = rows.length;

  for (const row of rows) {
    try {
      const existing = await client.condition.findUnique({
        where: { id: row.conditionId },
        select: { id: true },
      });

      if (existing) {
        await client.condition.update({
          where: { id: row.conditionId },
          data: {
            name: row.condition,
            system: row.system,
            displayName: row.condition,
            relatedSystems: row.relatedSystems ?? [],
          },
        });
        stats.updated += 1;
      } else {
        await client.condition.create({
          data: {
            id: row.conditionId,
            name: row.condition,
            system: row.system,
            displayName: row.condition,
            aliases: [],
            relatedSystems: row.relatedSystems ?? [],
            updatedAt: new Date(),
          },
        });
        stats.created += 1;
      }
    } catch (error) {
      registrySyncLogger.error('Condition sync failed', {
        error,
        condition: row.condition,
        system: row.system,
      });
      stats.errors += 1;
    }
  }

  stats.skipped = stats.total - stats.created - stats.updated;
  return stats;
}

/**
 * Sync drugs from the registry into the database.
 * - Upserts by unique genericName.
 */
export async function syncDrugs(client: PrismaClient = prisma): Promise<SyncStats> {
  const stats = emptyStats();
  stats.total = DRUG_REGISTRY.length;

  for (const meta of DRUG_REGISTRY) {
    try {
      const aliases = normalizeAliases(meta.aliases);
      const displayName = meta.displayName || meta.genericName;

      const baseData = {
        genericName: meta.genericName,
        brandName: meta.brandName,
        displayName,
        aliases,
        drugClass: meta.drugClass,
        mechanismOfAction: meta.mechanismOfAction,
        indications: meta.indications || [],
        contraindications: meta.contraindications || [],
        sideEffects: meta.commonSideEffects || [],
        // interactions + dosing not yet represented in registry; leave as-is if present in DB.
        isHighYield: Boolean(meta.isHighYield),
      } as const;

      const result = await client.drug.upsert({
        where: { genericName: meta.genericName },
        update: baseData,
        create: {
          id: uuidv4(),
          ...baseData,
          interactions: [],
          dosing: undefined,
          tags: [],
          updatedAt: new Date(),
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        stats.created += 1;
      } else {
        stats.updated += 1;
      }
    } catch (error) {
      registrySyncLogger.error('Drug sync failed', {
        error,
        genericName: meta.genericName,
      });
      stats.errors += 1;
    }
  }

  stats.skipped = stats.total - stats.created - stats.updated;
  return stats;
}

export async function closeRegistrySync(): Promise<void> {
  await prisma.$disconnect();
}

export function formatSummary(label: string, stats: SyncStats): string {
  return `Synced ${stats.total} ${label} (${stats.created} New, ${stats.updated} Updated, ${stats.errors} Errors)`;
}
