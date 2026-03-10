#!/usr/bin/env npx tsx
/**
 * Phase 1a: Merge Duplicate Conditions
 *
 * For each duplicate pair:
 * 1. Pick the canonical (better-named) entry
 * 2. Re-point all FK references from duplicate to canonical
 * 3. Merge any unique data from duplicate into canonical
 * 4. Delete the duplicate Condition + MedicalContent rows
 *
 * Usage: npx tsx scripts/fixes/phase1a-merge-duplicates.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';

const DRY_RUN = process.argv.includes('--dry-run');

// Canonical name -> duplicate name(s) to merge INTO the canonical
// The canonical is kept; duplicates are deleted after merging
const DUPLICATE_PAIRS: Array<{ canonical: string; duplicates: string[] }> = [
  { canonical: 'Deep Vein Thrombosis (DVT)', duplicates: ['Deep Vein Thrombosis DVT', 'Deep Venous Thrombosis (DVT)'] },
  { canonical: 'Acute Arterial Occlusion', duplicates: ['Acute Arterial Occlusive Disease'] },
  { canonical: "Boxer's Fracture", duplicates: ['Boxer Fracture', 'Boxer Fracture (5th Metacarpal Neck)'] },
  { canonical: 'Avascular Necrosis (AVN)', duplicates: ['Avascular Necrosis AVN', 'Avascular Necrosis of the Femoral Head'] },
  { canonical: 'Legg-Calve-Perthes Disease', duplicates: ['Legg Calve Perthes', 'Legg-Calvé-Perthes Disease'] },
  { canonical: "Dupuytren's Contracture", duplicates: ['Dupuytren Contracture', 'Dupuytrens Contracture'] },
  { canonical: 'Trigger Finger (Stenosing Tenosynovitis)', duplicates: ['Trigger Finger'] },
  { canonical: 'Second-Degree AV Block (Mobitz I)', duplicates: ['Second Degree AV Block Mobitz I Wenckebach'] },
  { canonical: 'Port-Wine Stain', duplicates: ['Port Wine Stain'] },
  { canonical: 'Infantile Hemangioma', duplicates: ['Strawberry Hemangioma', 'Strawberry Hemangioma (Infantile Hemangioma)'] },
  { canonical: 'Pseudogout (CPPD)', duplicates: ['Pseudogout (Calcium Pyrophosphate Deposition)'] },
  { canonical: 'Epidermal Inclusion Cyst', duplicates: ['Epithelial Inclusion Cyst'] },
  { canonical: "Crohn's Disease", duplicates: ['Crohn S'] },
  { canonical: 'Hand-Foot-and-Mouth Disease', duplicates: ['Hand-Foot-Mouth Disease (HFMD)', 'Hand-Foot-Mouth Disease'] },
  { canonical: 'Herpes Zoster (Shingles)', duplicates: ['Herpes Zoster Shingles Varicella'] },
  { canonical: 'Acute Angle-Closure Glaucoma', duplicates: ['Acute Angle Closure Glaucoma'] },
  { canonical: 'Adjustment Disorders', duplicates: ['Adjustment Disorder'] },
  { canonical: 'Attention-Deficit/Hyperactivity Disorder (ADHD)', duplicates: ['ADHD'] },
  { canonical: 'Binge-Eating Disorder', duplicates: ['Binge Eating Disorder'] },
  { canonical: 'Pneumocystis jirovecii Pneumonia (PCP)', duplicates: ['Pneumocystis jirovecii Pneumonia (PJP)', 'Pneumocystis Pneumonia (PCP)'] },
];

// All junction tables that reference conditionId
const JUNCTION_TABLES_CONDITION = [
  'DrugConditionLink',
  'LabConditionLink',
  'ImagingConditionLink',
  'FindingConditionLink',
  'TreatmentConditionLink',
  'ProcedureConditionLink',
  'ECGConditionLink',
  'AnatomyConditionLink',
  'PhysiologyConditionLink',
  'AntibioticConditionLink',
  'DifferentialConditionLink',
  'ScoringSystemConditionLink',
  'VitalSignConditionLink',
  'PearlConditionLink',
] as const;

// Tables that reference conditionId (not junction)
const OTHER_TABLES_CONDITION = [
  'ClinicalPearl',
  'WeaknessPattern',
  'SavedQuestion',
] as const;

async function findConditionByName(name: string) {
  // Search in Condition table
  const condition = await prisma.condition.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: 'insensitive' as any } },
        { displayName: { equals: name, mode: 'insensitive' as any } },
      ],
    },
  });
  return condition;
}

async function findMedicalContentByConditionName(name: string) {
  const mc = await prisma.medicalContent.findFirst({
    where: {
      OR: [
        { condition: { equals: name, mode: 'insensitive' as any } },
        { conditionId: { contains: name.toLowerCase().replace(/[^a-z0-9]/g, '_') } },
      ],
    },
  });
  return mc;
}

async function mergePair(canonical: string, duplicateNames: string[]) {
  console.log(`\n🔄 Processing: "${canonical}"`);

  // Find the canonical condition
  let canonicalCond = await findConditionByName(canonical);
  let canonicalMC = await findMedicalContentByConditionName(canonical);

  // If canonical doesn't exist by exact name, try first name from all options
  if (!canonicalCond) {
    // Try the canonical name as-is or any duplicate that exists
    for (const name of [canonical, ...duplicateNames]) {
      canonicalCond = await findConditionByName(name);
      if (canonicalCond) {
        console.log(`  Found canonical via name: "${name}" (id: ${canonicalCond.id})`);
        break;
      }
    }
  }

  if (!canonicalCond) {
    console.log(`  ⚠️  Could not find any matching condition for "${canonical}" or its duplicates. Skipping.`);
    return { merged: 0, skipped: 1 };
  }

  if (!canonicalMC) {
    canonicalMC = await prisma.medicalContent.findFirst({
      where: { conditionId: canonicalCond.id },
    });
  }

  console.log(`  Canonical: "${canonicalCond.name}" (id: ${canonicalCond.id})`);

  let mergedCount = 0;

  for (const dupName of duplicateNames) {
    const dupCond = await findConditionByName(dupName);
    if (!dupCond) {
      console.log(`  ⏭️  Duplicate "${dupName}" not found. Skipping.`);
      continue;
    }

    if (dupCond.id === canonicalCond.id) {
      console.log(`  ⏭️  "${dupName}" IS the canonical. Skipping.`);
      continue;
    }

    console.log(`  🗑️  Merging duplicate: "${dupCond.name}" (id: ${dupCond.id}) -> canonical`);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would merge "${dupCond.name}" into "${canonicalCond.name}"`);
      mergedCount++;
      continue;
    }

    // 1. Re-point all junction table FKs
    for (const table of JUNCTION_TABLES_CONDITION) {
      try {
        const result = await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "conditionId" = $1 WHERE "conditionId" = $2 AND NOT EXISTS (SELECT 1 FROM "${table}" t2 WHERE t2."conditionId" = $1 AND t2.id != "${table}".id)`,
          canonicalCond.id,
          dupCond.id
        );
        if (result > 0) console.log(`    Updated ${result} rows in ${table}`);
      } catch {
        // Table might not exist or have different schema; delete orphaned links
        try {
          await prisma.$executeRawUnsafe(
            `DELETE FROM "${table}" WHERE "conditionId" = $1`,
            dupCond.id
          );
        } catch { /* ignore */ }
      }
    }

    // 2. Re-point other tables
    for (const table of OTHER_TABLES_CONDITION) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "conditionId" = $1 WHERE "conditionId" = $2`,
          canonicalCond.id,
          dupCond.id
        );
      } catch { /* ignore */ }
    }

    // 3. Re-point Question.conditionId
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Question" SET "conditionId" = $1 WHERE "conditionId" = $2`,
        canonicalCond.id,
        dupCond.id
      );
    } catch { /* ignore */ }

    // 4. Re-point medicalContentId references if duplicate has a separate MC
    const dupMC = await prisma.medicalContent.findFirst({
      where: { conditionId: dupCond.id },
    });

    if (dupMC && canonicalMC && dupMC.id !== canonicalMC.id) {
      // Merge useful data from duplicate MC into canonical MC
      const fieldsToMerge = [
        'pathophysiology', 'epidemiology', 'etiology', 'symptoms', 'physicalExam',
        'diagnostics', 'treatment', 'complications', 'differentialDiagnosis',
        'prognosis', 'riskFactors', 'overview', 'first_line_rx', 'gold_standard_dx',
        'best_initial_test', 'classic_patient', 'mnemonic',
      ] as const;

      const updateData: Record<string, any> = {};
      for (const field of fieldsToMerge) {
        const canonVal = (canonicalMC as any)[field];
        const dupVal = (dupMC as any)[field];
        if (!canonVal && dupVal) {
          updateData[field] = dupVal;
        }
      }

      // Merge buzzwords arrays
      const canonBuzz = (canonicalMC as any).buzzwords || [];
      const dupBuzz = (dupMC as any).buzzwords || [];
      if (dupBuzz.length > 0) {
        const merged = [...new Set([...canonBuzz, ...dupBuzz])];
        if (merged.length > canonBuzz.length) {
          updateData.buzzwords = merged;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.medicalContent.update({
          where: { id: canonicalMC.id },
          data: updateData,
        });
        console.log(`    Merged ${Object.keys(updateData).length} fields from duplicate MC`);
      }

      // Re-point medicalContentId references
      const mcRefTables = [
        'ContentAuditLog', 'ContentVersion', 'ContentStatistics',
        'Question', 'QuestionSeed', 'PreGeneratedQuestion', 'ReviewLog',
        'UserProgress',
      ];
      for (const table of mcRefTables) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "medicalContentId" = $1 WHERE "medicalContentId" = $2`,
            canonicalMC.id,
            dupMC.id
          );
        } catch { /* ignore */ }
      }

      // Also re-point junction tables that have medicalContentId
      for (const table of JUNCTION_TABLES_CONDITION) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "medicalContentId" = $1 WHERE "medicalContentId" = $2`,
            canonicalMC.id,
            dupMC.id
          );
        } catch { /* ignore */ }
      }

      // Delete duplicate MC
      try {
        await prisma.medicalContent.delete({ where: { id: dupMC.id } });
        console.log(`    Deleted duplicate MedicalContent: ${dupMC.id}`);
      } catch (e: any) {
        console.log(`    ⚠️  Could not delete duplicate MC (may have remaining refs): ${e.message?.substring(0, 100)}`);
      }
    }

    // 5. Merge aliases into canonical condition
    const dupAliases = dupCond.aliases || [];
    const canonAliases = canonicalCond.aliases || [];
    const mergedAliases = [...new Set([...canonAliases, ...dupAliases, dupCond.name])].filter(
      (a) => a !== canonicalCond!.name
    );

    await prisma.condition.update({
      where: { id: canonicalCond.id },
      data: { aliases: mergedAliases },
    });

    // 6. Delete duplicate condition
    try {
      await prisma.condition.delete({ where: { id: dupCond.id } });
      console.log(`    ✅ Deleted duplicate Condition: "${dupCond.name}"`);
      mergedCount++;
    } catch (e: any) {
      console.log(`    ⚠️  Could not delete duplicate Condition (remaining refs): ${e.message?.substring(0, 100)}`);
      // Try to find remaining references
      for (const table of JUNCTION_TABLES_CONDITION) {
        try {
          const count: any[] = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as cnt FROM "${table}" WHERE "conditionId" = $1`,
            dupCond.id
          );
          if (count[0]?.cnt > 0) {
            console.log(`      Still referenced in ${table}: ${count[0].cnt} rows`);
            await prisma.$executeRawUnsafe(
              `DELETE FROM "${table}" WHERE "conditionId" = $1`,
              dupCond.id
            );
            console.log(`      Cleaned up ${table}`);
          }
        } catch { /* ignore */ }
      }
      // Retry delete
      try {
        await prisma.condition.delete({ where: { id: dupCond.id } });
        console.log(`    ✅ Deleted duplicate Condition on retry: "${dupCond.name}"`);
        mergedCount++;
      } catch (e2: any) {
        console.log(`    ❌ FAILED to delete "${dupCond.name}": ${e2.message?.substring(0, 150)}`);
      }
    }

    // Update canonical name if needed
    if (canonicalCond.name !== canonical) {
      await prisma.condition.update({
        where: { id: canonicalCond.id },
        data: { name: canonical, displayName: canonical },
      });
      if (canonicalMC) {
        await prisma.medicalContent.update({
          where: { id: canonicalMC.id },
          data: { condition: canonical },
        });
      }
      console.log(`    Renamed canonical to: "${canonical}"`);
    }
  }

  return { merged: mergedCount, skipped: 0 };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 1a: Merge Duplicate Conditions                     ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  const startCount = await prisma.condition.count();
  console.log(`\nStarting condition count: ${startCount}`);

  let totalMerged = 0;
  let totalSkipped = 0;

  for (const pair of DUPLICATE_PAIRS) {
    const result = await mergePair(pair.canonical, pair.duplicates);
    totalMerged += result.merged;
    totalSkipped += result.skipped;
  }

  const endCount = await prisma.condition.count();
  console.log('\n════════════════════════════════════════');
  console.log(`Total merged: ${totalMerged}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Conditions before: ${startCount}`);
  console.log(`Conditions after: ${endCount}`);
  console.log(`Net removed: ${startCount - endCount}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
