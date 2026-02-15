#!/usr/bin/env npx tsx
/**
 * Phase 1b: Fix Misclassified Subcategories + ECG Misplacements
 *
 * Direct SQL updates on MedicalContent.subcategory and Condition.subcategory
 * for rows that have obviously wrong subcategory assignments.
 *
 * Usage: npx tsx scripts/fixes/phase1b-fix-misclassified.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';

const DRY_RUN = process.argv.includes('--dry-run');

interface SubcategoryFix {
  conditionPattern: string; // SQL LIKE pattern or exact name
  system: string;
  wrongSubcategory: string;
  correctSubcategory: string;
}

const FIXES: SubcategoryFix[] = [
  // HEENT: Anxiety Disorders -> Ear Disorders
  {
    conditionPattern: 'Perforated Tympanic Membrane',
    system: 'HEENT',
    wrongSubcategory: 'Anxiety Disorders',
    correctSubcategory: 'Ear Disorders',
  },
  {
    conditionPattern: 'Tympanic Membrane Perforation',
    system: 'HEENT',
    wrongSubcategory: 'Anxiety Disorders',
    correctSubcategory: 'Ear Disorders',
  },

  // REPRO: Hepatic Disorders -> Obstetric Procedures
  {
    conditionPattern: 'Cesarean Delivery',
    system: 'REPRO',
    wrongSubcategory: 'Hepatic Disorders',
    correctSubcategory: 'Obstetric Procedures',
  },
  {
    conditionPattern: 'Operative Vaginal Delivery',
    system: 'REPRO',
    wrongSubcategory: 'Hepatic Disorders',
    correctSubcategory: 'Obstetric Procedures',
  },

  // MSK: Valvular Disorders -> Spinal Disorders
  {
    conditionPattern: 'Spinal Stenosis',
    system: 'MSK',
    wrongSubcategory: 'Valvular Disorders',
    correctSubcategory: 'Spinal Disorders',
  },

  // GU: Valvular Disorders -> correct
  {
    conditionPattern: 'Pelvic Organ Prolapse',
    system: 'GU',
    wrongSubcategory: 'Valvular Disorders',
    correctSubcategory: 'Pelvic Floor Disorders',
  },
  {
    conditionPattern: 'Urethral Prolapse',
    system: 'GU',
    wrongSubcategory: 'Valvular Disorders',
    correctSubcategory: 'Urethral Disorders',
  },

  // RENAL: Obstructive Pulmonary Diseases -> Obstructive Uropathy
  {
    conditionPattern: 'Obstructive Uropathy',
    system: 'RENAL',
    wrongSubcategory: 'Obstructive Pulmonary Diseases',
    correctSubcategory: 'Obstructive Uropathy',
  },
  {
    conditionPattern: 'Post-Obstructive Diuresis',
    system: 'RENAL',
    wrongSubcategory: 'Obstructive Pulmonary Diseases',
    correctSubcategory: 'Obstructive Uropathy',
  },

  // RENAL: Valvular Disorders -> Renovascular Disorders
  {
    conditionPattern: 'Renal Artery Stenosis',
    system: 'RENAL',
    wrongSubcategory: 'Valvular Disorders',
    correctSubcategory: 'Renovascular Disorders',
  },

  // REPRO: Valvular Disorders -> correct
  {
    conditionPattern: 'Pelvic Organ Prolapse',
    system: 'REPRO',
    wrongSubcategory: 'Valvular Disorders',
    correctSubcategory: 'Pelvic Floor Disorders',
  },
  {
    conditionPattern: 'Umbilical Cord Prolapse',
    system: 'REPRO',
    wrongSubcategory: 'Valvular Disorders',
    correctSubcategory: 'Obstetric Emergencies',
  },
];

// ECG/Electrolyte conditions misplaced in "Acute Coronary Syndrome"
const ECG_MISPLACEMENTS = [
  { conditionPattern: 'Hypercalcemia (ECG)', correctSubcategory: 'ECG / Electrolyte Patterns' },
  { conditionPattern: 'Hyperkalemia (ECG)', correctSubcategory: 'ECG / Electrolyte Patterns' },
  { conditionPattern: 'Hypocalcemia (ECG)', correctSubcategory: 'ECG / Electrolyte Patterns' },
  { conditionPattern: 'Hypokalemia (ECG)', correctSubcategory: 'ECG / Electrolyte Patterns' },
  { conditionPattern: 'Hypothermia', correctSubcategory: 'ECG / Electrolyte Patterns' },
  { conditionPattern: 'Sinus Arrhythmia', correctSubcategory: 'Arrhythmias' },
  { conditionPattern: 'Mitral Regurgitation', correctSubcategory: 'Valvular Disorders' },
  { conditionPattern: 'Mitral Stenosis', correctSubcategory: 'Valvular Disorders' },
];

async function fixSubcategory(fix: SubcategoryFix): Promise<number> {
  // Find matching MedicalContent records
  const records = await prisma.medicalContent.findMany({
    where: {
      condition: { contains: fix.conditionPattern, mode: 'insensitive' },
      system: fix.system,
      subcategory: fix.wrongSubcategory,
    },
    select: { id: true, condition: true, conditionId: true, subcategory: true },
  });

  if (records.length === 0) {
    // Try exact match
    const exact = await prisma.medicalContent.findMany({
      where: {
        condition: fix.conditionPattern,
        system: fix.system,
      },
      select: { id: true, condition: true, conditionId: true, subcategory: true },
    });
    if (exact.length > 0 && exact[0].subcategory !== fix.correctSubcategory) {
      records.push(...exact);
    }
  }

  if (records.length === 0) {
    console.log(
      `  ⏭️  No match for "${fix.conditionPattern}" in ${fix.system} with subcat "${fix.wrongSubcategory}"`
    );
    return 0;
  }

  for (const rec of records) {
    console.log(
      `  📝 "${rec.condition}" (${fix.system}): "${rec.subcategory}" -> "${fix.correctSubcategory}"`
    );

    if (!DRY_RUN) {
      // Update MedicalContent
      await prisma.medicalContent.update({
        where: { id: rec.id },
        data: { subcategory: fix.correctSubcategory },
      });

      // Also update Condition.subcategory if it exists
      try {
        await prisma.condition.update({
          where: { id: rec.conditionId },
          data: { subcategory: fix.correctSubcategory },
        });
      } catch {
        /* Condition might not have subcategory or might not exist */
      }
    }
  }

  return records.length;
}

async function fixECGMisplacements(): Promise<number> {
  let fixed = 0;

  for (const ecg of ECG_MISPLACEMENTS) {
    const records = await prisma.medicalContent.findMany({
      where: {
        condition: { contains: ecg.conditionPattern, mode: 'insensitive' },
        system: 'CV',
        subcategory: 'Acute Coronary Syndrome',
      },
      select: { id: true, condition: true, conditionId: true },
    });

    for (const rec of records) {
      console.log(
        `  📝 ECG fix: "${rec.condition}" (CV): "Acute Coronary Syndrome" -> "${ecg.correctSubcategory}"`
      );

      if (!DRY_RUN) {
        await prisma.medicalContent.update({
          where: { id: rec.id },
          data: { subcategory: ecg.correctSubcategory },
        });
        try {
          await prisma.condition.update({
            where: { id: rec.conditionId },
            data: { subcategory: ecg.correctSubcategory },
          });
        } catch {
          /* ignore */
        }
      }
      fixed++;
    }
  }

  return fixed;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 1b: Fix Misclassified Subcategories               ║');
  console.log(
    `║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`
  );
  console.log('╚════════════════════════════════════════════════════════════╝');

  let totalFixed = 0;

  console.log('\n--- Fixing misclassified subcategories ---');
  for (const fix of FIXES) {
    totalFixed += await fixSubcategory(fix);
  }

  console.log('\n--- Fixing ECG misplacements in CV ---');
  totalFixed += await fixECGMisplacements();

  console.log('\n════════════════════════════════════════');
  console.log(`Total records fixed: ${totalFixed}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
