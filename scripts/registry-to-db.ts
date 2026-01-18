#!/usr/bin/env tsx
/**
 * Sync conditionRegistry.ts into MedicalContent (database is the single source of truth).
 * - Reads CONDITION_REGISTRY + buildConditionDefinition from the root registry file.
 * - Upserts each entry into MedicalContent, mapping metadata into the JSONB `content` column
 *   and into structured columns (system, subcategory, buzzwords, clinical_pearls, etc.).
 * - Safe for re-runs; preserves existing IDs and updates content.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { pathToFileURL } from 'url';

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

interface RegistryMeta {
  id?: string;
  conditionId?: string;
  condition?: string;
  name?: string;
  system?: string;
  subcategory?: string;
  relatedSystems?: string[];
  aliases?: string[];
  buzzwords?: string[];
  overview?: string;
  keyPoints?: string[];
  redFlags?: string[];
  treatmentPearls?: string[];
  clinicalPearls?: string[] | { text?: string }[];
  clinical_pearls?: unknown;
  gold_standard_dx?: string;
  goldStandardDx?: string;
  mediaIds?: string[];
  [key: string]: any;
}

async function loadRegistry(): Promise<{
  registry: RegistryMeta[];
  buildConditionDefinition: (meta: any) => any;
}> {
  const registryPath = path.resolve(process.cwd(), 'conditionRegistry.ts');
  const registryUrl = pathToFileURL(registryPath).href;
  const mod = await import(registryUrl);
  const registry: RegistryMeta[] = mod.CONDITION_REGISTRY || mod.default?.CONDITION_REGISTRY;
  const buildConditionDefinition = mod.buildConditionDefinition || ((meta: any) => meta);

  if (!Array.isArray(registry)) {
    throw new Error('CONDITION_REGISTRY not found or not an array');
  }

  return { registry, buildConditionDefinition };
}

function toContent(meta: RegistryMeta) {
  return {
    overview: meta.overview,
    keyPoints: meta.keyPoints,
    redFlags: meta.redFlags,
    treatmentPearls: meta.treatmentPearls,
    clinicalPearls: meta.clinical_pearls || meta.clinicalPearls,
    aliases: meta.aliases,
    mediaIds: meta.mediaIds,
  };
}

function pick<T>(value: T | undefined | null): T | undefined {
  return value === undefined || value === null ? undefined : value;
}

async function upsertRegistryEntries() {
  const { registry, buildConditionDefinition } = await loadRegistry();

  const stats = { created: 0, updated: 0, skipped: 0 };

  for (const meta of registry) {
    const def = buildConditionDefinition(meta) || meta;
    const conditionId = (def.id || meta.id || meta.conditionId || '').trim();
    const conditionName = def.condition || meta.condition || def.name || meta.name;
    const system = def.system || meta.system;
    const subcategory = def.subcategory || meta.subcategory || 'General';

    if (!conditionId || !conditionName || !system) {
      console.warn(`[registry-to-db] Skipping entry missing required fields`, {
        conditionId,
        conditionName,
        system,
      });
      stats.skipped++;
      continue;
    }

    const content = toContent(meta);
    const clinicalPearls = meta.clinical_pearls || meta.clinicalPearls || null;
    const goldStandard = meta.gold_standard_dx || meta.goldStandardDx || null;
    const relatedSystems = meta.relatedSystems || def.relatedSystems || [];
    const buzzwords = meta.buzzwords || def.buzzwords || [];

    const payload = {
      system,
      subcategory,
      condition: conditionName,
      relatedSystems,
      buzzwords,
      clinical_pearls: pick(clinicalPearls),
      gold_standard_dx: pick(goldStandard),
      content,
      updatedAt: new Date(),
      updatedBy: 'script:registry-to-db',
      status: 'published' as const,
    };

    try {
      await prisma.medicalContent.upsert({
        where: { conditionId },
        update: payload,
        create: {
          id: conditionId, // keep primary key aligned to conditionId for FK safety
          conditionId,
          system,
          subcategory,
          condition: conditionName,
          relatedSystems,
          buzzwords,
          clinical_pearls: pick(clinicalPearls),
          gold_standard_dx: pick(goldStandard),
          content,
          status: 'published',
          version: 1,
          createdBy: 'script:registry-to-db',
          updatedBy: 'script:registry-to-db',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      stats.updated++;
      console.log(`✓ Upserted ${conditionName} (${conditionId})`);
    } catch (err: any) {
      console.error(`✗ Failed ${conditionId}: ${err.message}`);
      stats.skipped++;
    }
  }

  console.log(`\nSummary: created/updated=${stats.updated}, skipped=${stats.skipped}`);
}

async function main() {
  try {
    await upsertRegistryEntries();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
