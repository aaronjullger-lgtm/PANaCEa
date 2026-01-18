#!/usr/bin/env tsx
/**
 * Ingest missing conditions from unmapped-conditions.txt into the Condition table.
 * - Reads one condition per line (underscores are converted to spaces/title case).
 * - Maps each condition to a SystemCode (fallback OTHER when unknown).
 * - Skips any condition already present by id or name/system pair.
 *
 * Usage:
 *   tsx scripts/ingestUnmappedConditions.ts          # executes inserts
 *   tsx scripts/ingestUnmappedConditions.ts --dry-run # no DB writes
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import type { SystemCode } from '../src/types';

config();

const prisma = new PrismaClient();
const INPUT_FILE = path.resolve(process.cwd(), 'unmapped-conditions.txt');
const FALLBACK_SYSTEM: SystemCode = 'OTHER';

// Manual system mapping for each unmapped entry
const SYSTEM_MAP: Record<string, SystemCode> = {
  Acute_Angle_Closure_Glaucoma: 'HEENT',
  Avascular_Necrosis__AVN_: 'MSK',
  Central_Retinal_Vein_Occlusion__CRVO_: 'HEENT',
  Chronic_Lymphocytic_Leukemia__CLL_: 'HEME',
  Crohn_s: 'GI',
  Deep_Vein_Thrombosis__DVT_: 'CV',
  Ethylene_Glycol_Poisoning: 'RENAL',
  Herpes_Zoster__Shingles__Varicella: 'ID',
  'Hyperkalemia_Electrolyte-Volume': 'RENAL',
  Legg_Calve_Perthes: 'MSK',
  Normal_Pressure_Hydrocephalus__NPH_: 'NEURO',
  Normal_Sinus_Rhythm_EKG: 'CV',
  Normal_Sinus_Rhythm_Pituitary: 'CV',
  Pneumonia_Oxygen_Therapy: 'PULM',
  Psoriasis_Vulva_and_Vaginal: 'DERM',
  Second_Degree_AV_Block_Mobitz_I__Wenckebach_: 'CV',
};

function normalizeName(raw: string): string {
  const withSpaces = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  // Title-case words to align with existing registry naming
  return withSpaces
    .split(' ')
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function readUnmappedConditions(): Promise<string[]> {
  const content = await fs.readFile(INPUT_FILE, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function conditionExists(id: string, name: string, system: SystemCode) {
  return prisma.condition.findFirst({
    where: {
      OR: [
        { id },
        {
          AND: [{ name: { equals: name, mode: 'insensitive' } }, { system }],
        },
      ],
    },
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const lines = await readUnmappedConditions();

  const summary = {
    created: 0,
    skipped: 0,
    planned: [] as Array<{ id: string; name: string; system: SystemCode }>,
  };

  for (const raw of lines) {
    const name = normalizeName(raw);
    const system = SYSTEM_MAP[raw] ?? FALLBACK_SYSTEM;
    const id = `${system}__${slugify(name)}`;

    const existing = await conditionExists(id, name, system);
    if (existing) {
      summary.skipped++;
      console.log(`⏭️  Skip (exists): ${name} [${system}]`);
      continue;
    }

    if (dryRun) {
      summary.planned.push({ id, name, system });
      console.log(`🧪 Dry-run would create: ${name} [${system}] (${id})`);
      continue;
    }

    await prisma.condition.create({
      data: {

        id: uuidv4(),

        id,
        name,
        displayName: name,
        system,
        aliases: raw !== name ? [raw] : [],
        relatedSystems: [],
        status: 'draft',
        updatedAt: new Date(),
      },
    });

    summary.created++;
    console.log(`✨ Created: ${name} [${system}] (${id})`);
  }

  console.log('\nSummary');
  console.log(`  Planned (dry-run): ${summary.planned.length}`);
  console.log(`  Created: ${summary.created}`);
  console.log(`  Skipped (existing): ${summary.skipped}`);
}

main()
  .catch((error) => {
    console.error('❌ Ingestion failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
