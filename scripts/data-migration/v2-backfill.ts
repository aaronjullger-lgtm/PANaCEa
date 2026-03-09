#!/usr/bin/env tsx
/**
 * V2 Schema Data Migration Script
 * 
 * This script backfills the new normalized tables and fields introduced in V2:
 * - Alias table (from existing aliases arrays)
 * - DrugSideEffect table (from sideEffects string arrays)
 * - MedicalContentStructured (from parsed content)
 * - sideEffectsJsonb, interactionsJsonb (structured JSON from strings)
 * - AnatomyModel links
 * 
 * Run after applying the V2 schema migrations.
 * Ensure you have a backup before running.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillAliases() {
  console.log('Backfilling Aliases...');
  
  // Drug aliases
  const drugs = await prisma.drug.findMany({
    select: { id: true, aliases: true }
  });
  for (const drug of drugs) {
    for (const alias of drug.aliases) {
      await prisma.alias.upsert({
        where: {
          entityType_entityId_alias: {
            entityType: 'Drug',
            entityId: drug.id,
            alias
          }
        },
        update: {},
        create: {
          entityType: 'Drug',
          entityId: drug.id,
          alias,
          language: 'en',
          isPrimary: false
        }
      });
    }
  }
  console.log(`  Processed ${drugs.length} drugs`);

  // Condition aliases (if Condition model has aliases field)
  // Note: Condition model currently does not have aliases field; skip.
  
  // AnatomyStructure aliases
  const anatomyStructures = await prisma.anatomyStructure.findMany({
    select: { id: true, aliases: true }
  });
  for (const as of anatomyStructures) {
    for (const alias of as.aliases) {
      await prisma.alias.upsert({
        where: {
          entityType_entityId_alias: {
            entityType: 'AnatomyStructure',
            entityId: as.id,
            alias
          }
        },
        update: {},
        create: {
          entityType: 'AnatomyStructure',
          entityId: as.id,
          alias,
          language: 'en',
          isPrimary: false
        }
      });
    }
  }
  console.log(`  Processed ${anatomyStructures.length} anatomy structures`);
  
  // MedicalContent aliases (if any)
  // Not yet implemented.
  
  console.log('Alias backfill complete.');
}

async function backfillDrugSideEffects() {
  console.log('Backfilling DrugSideEffect table...');
  // This is a placeholder; actual parsing of sideEffects strings into structured data
  // requires NLP or manual mapping. For now, we create placeholder entries.
  const drugs = await prisma.drug.findMany({
    select: { id: true, sideEffects: true }
  });
  for (const drug of drugs) {
    for (const se of drug.sideEffects) {
      // Simple heuristic: if contains severity keywords
      let severity = 'common';
      if (se.toLowerCase().includes('serious') || se.toLowerCase().includes('severe')) severity = 'serious';
      if (se.toLowerCase().includes('rare')) severity = 'rare';
      
      const system = 'other'; // unknown
      await prisma.drugSideEffect.create({
        data: {
          drugId: drug.id,
          name: se,
          severity,
          system,
          description: null,
          visualization: null
        }
      });
    }
  }
  console.log(`  Created side effect records for ${drugs.length} drugs`);
}

async function backfillSideEffectsJsonb() {
  console.log('Converting sideEffects strings to JSONB...');
  // For each drug, transform sideEffects string array into structured JSONB
  // This is a stub; you should implement proper parsing.
  const drugs = await prisma.drug.findMany({
    select: { id: true, sideEffects: true }
  });
  for (const drug of drugs) {
    const jsonb = drug.sideEffects.map(se => ({
      name: se,
      severity: 'common',
      system: 'other'
    }));
    await prisma.drug.update({
      where: { id: drug.id },
      data: { sideEffectsJsonb: jsonb }
    });
  }
  console.log(`  Updated ${drugs.length} drugs`);
}

async function backfillMedicalContentStructured() {
  console.log('Backfilling MedicalContentStructured...');
  // This requires parsing medical content fields (clinical_pearls, etc.) from Markdown.
  // For now, we can create empty entries to establish the relationship.
  const medicalContents = await prisma.medicalContent.findMany({
    select: { id: true }
  });
  for (const mc of medicalContents) {
    await prisma.medicalContentStructured.upsert({
      where: { medicalContentId: mc.id },
      update: {},
      create: {
        medicalContentId: mc.id,
        clinical_pearls: [],
        history_key_features: [],
        physical_exam_findings: [],
        diagnostic_labs: [],
        gold_standard: null,
        treatment_first_line: null,
        parsedAt: new Date(),
        parserVersion: 'manual',
        confidence: null
      }
    });
  }
  console.log(`  Created/updated ${medicalContents.length} structured entries`);
}

async function main() {
  console.log('Starting V2 data migration...');
  try {
    await backfillAliases();
    await backfillDrugSideEffects();
    await backfillSideEffectsJsonb();
    await backfillMedicalContentStructured();
    console.log('V2 data migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export {};