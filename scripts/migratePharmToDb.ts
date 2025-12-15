/**
 * Data Migration Script: Pharmacology Data → Database
 * 
 * Migrates drug data from pharm/drugData.json to the Drug table.
 * 
 * Run with: npx tsx scripts/migratePharmToDb.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migratePharmData() {
  console.log('💊 Migrating Pharmacology Data to Drug Table...');

  const drugDataPath = path.resolve(process.cwd(), 'pharm/drugData.json');
  
  if (!fs.existsSync(drugDataPath)) {
    console.error('❌ Drug data file not found:', drugDataPath);
    process.exit(1);
  }

  const drugData = JSON.parse(fs.readFileSync(drugDataPath, 'utf-8'));
  const drugs = Object.values(drugData) as any[];
  
  console.log(`Found ${drugs.length} drugs to migrate.`);

  let successCount = 0;
  let errorCount = 0;

  for (const drug of drugs) {
    try {
      const genericName = drug.term;
      
      // Map fields
      const rawClass = drug.class ? (Array.isArray(drug.class) ? drug.class : [drug.class]) : [];
      const rawSubclass = drug.subclass ? (Array.isArray(drug.subclass) ? drug.subclass : [drug.subclass]) : [];
      const drugClass = [...rawClass, ...rawSubclass].flat();
      
      const mechanismOfAction = drug.MOA || null;
      const indications = Array.isArray(drug.indications) ? drug.indications : (drug.indications ? [drug.indications] : []);
      const contraindications = Array.isArray(drug.contraindications) ? drug.contraindications : (drug.contraindications ? [drug.contraindications] : []);
      const sideEffects = Array.isArray(drug.ADEs) ? drug.ADEs : (drug.ADEs ? [drug.ADEs] : []);
      
      const rawInteractions = Array.isArray(drug.interactions) ? drug.interactions : (drug.interactions ? [drug.interactions] : []);
      const interactions = rawInteractions.map((i: any) => {
        if (typeof i === 'object' && i !== null && i.drug && i.effect) {
            return `${i.drug}: ${i.effect}`;
        }
        return String(i);
      });

      const dosing = drug.dosing || null;
      const tags = drug.tags ? (Array.isArray(drug.tags) ? drug.tags.flat() : [drug.tags]) : [];
      
      const metabolism = drug.pharmacokinetics?.metabolism || null;
      const elimination = drug.pharmacokinetics?.elimination || null;
      const clinicalNotes = drug.clinicalNotes || null;
      const antidote = drug.antidote || null;

      // Upsert into Drug table
      await prisma.drug.upsert({
        where: { 
          // We don't have a unique constraint on genericName in the schema yet, 
          // but we should probably use findFirst or assume genericName is unique enough for migration.
          // Actually, the schema has @@index([genericName]), but not @@unique.
          // Let's use findFirst to check existence, then update or create.
          // Ideally we should have a unique constraint on genericName.
          // For now, let's assume we can find by genericName.
          id: (await prisma.drug.findFirst({ where: { genericName } }))?.id || 'new-id'
        },
        update: {
          genericName,
          drugClass,
          mechanismOfAction,
          indications: Array.isArray(indications) ? indications : [indications],
          contraindications: Array.isArray(contraindications) ? contraindications : [contraindications],
          sideEffects: sideEffects, // Json
          interactions: interactions, // Json
          dosing,
          tags: drug.type ? (Array.isArray(drug.type) ? drug.type.flat() : [drug.type]) : [],
          clinicalNotes,
          antidote,
          metabolism,
          elimination,
          updatedAt: new Date(),
        },
        create: {
          genericName,
          drugClass,
          mechanismOfAction,
          indications: Array.isArray(indications) ? indications : [indications],
          contraindications: Array.isArray(contraindications) ? contraindications : [contraindications],
          sideEffects: sideEffects,
          interactions: interactions,
          dosing,
          tags: drug.type ? (Array.isArray(drug.type) ? drug.type.flat() : [drug.type]) : [],
          clinicalNotes,
          antidote,
          metabolism,
          elimination,
        },
      });

      process.stdout.write('.');
      successCount++;
    } catch (error) {
      console.error(`\n❌ Failed to migrate ${drug.term}:`, error);
      errorCount++;
    }
  }

  console.log('\n\n============================================================');
  console.log('📊 PHARMACOLOGY MIGRATION REPORT');
  console.log('============================================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed:     ${errorCount}`);
  console.log('============================================================');
}

migratePharmData()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
