import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CONDITION_REGISTRY, type ConditionMeta } from '../../../config/conditionRegistry';
import { DRUG_REGISTRY, type DrugMeta } from '../../../src/registries/drugRegistry';

const prisma = new PrismaClient();

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
 * Sync conditions from the registry into the database.
 * - Upserts by (name + system) match.
 * - Preserves existing `content` field in DB (never overwritten).
 */
export async function syncConditions(client: PrismaClient = prisma): Promise<SyncStats> {
  const stats = emptyStats();
  stats.total = CONDITION_REGISTRY.length;

  for (const meta of CONDITION_REGISTRY) {
    try {
      const aliases: string[] = normalizeAliases(meta.aliases);

      const existing = await client.condition.findFirst({
        where: { name: meta.condition, system: meta.system },
        select: { id: true },
      });

      if (existing) {
        await client.condition.update({
          where: { id: existing.id },
          data: {
            name: meta.condition,
            system: meta.system,
            displayName: meta.condition,
            aliases,
          },
        });
        stats.updated += 1;
      } else {
        await client.condition.create({
          data: {
            id: uuidv4(),
            name: meta.condition,
            system: meta.system,
            displayName: meta.condition,
            aliases,
          },
        });
        stats.created += 1;
      }
    } catch (error) {
      console.error(`❌ Condition sync failed for ${meta.condition} (${meta.system}):`, error);
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
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        stats.created += 1;
      } else {
        stats.updated += 1;
      }
    } catch (error) {
      console.error(`❌ Drug sync failed for ${meta.genericName}:`, error);
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