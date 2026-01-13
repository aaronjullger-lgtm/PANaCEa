#!/usr/bin/env npx tsx
/**
 * Database Cleanup & Consolidation Script
 * 
 * Performs:
 * 1. Subcategory consolidations based on AI recommendations
 * 2. Removal of misclassified conditions (screenings, normals, therapies)
 * 3. Duplicate merging
 * 4. Null subcategory assignment
 */

import { prisma } from './helpers/prisma-client';

// Subcategory consolidation mappings based on AI recommendations
const SUBCATEGORY_CONSOLIDATIONS: Record<string, Record<string, string>> = {
  Psychiatry: {
    'Substance Use - Opioids': 'Substance Use Disorders',
    'Substance Use - Stimulants': 'Substance Use Disorders',
  },
  Hematology: {
    'Immune Hemolytic Anemia': 'Anemias & Hemoglobinopathies',
    'Acquired Hemolytic Anemia': 'Anemias & Hemoglobinopathies',
    'Normocytic Anemia': 'Anemias & Hemoglobinopathies',
    'Complication of Sickle Cell Disease': 'Anemias & Hemoglobinopathies',
  },
  Dermatology: {
    'Infectious (Bacterial) / Systemic with Cutaneous Manifestations': 'Infectious Dermatology',
    'Infectious (Bacterial)': 'Infectious Dermatology',
    'Infectious (Fungal)': 'Infectious Dermatology',
    'Infectious (Viral) / Childhood Exanthem': 'Infectious Dermatology',
    'Infectious - Bacterial': 'Infectious Dermatology',
    'Bullous': 'Hereditary & Autoimmune Skin Disorders',
    'Genetic': 'Hereditary & Autoimmune Skin Disorders',
  },
  Gastrointestinal: {
    'Esophagus': 'Esophageal Disorders',
    'Esophageal': 'Esophageal Disorders',
    'Pancreas': 'Hepatobiliary & Pancreatic Disorders',
    'Hepatic': 'Hepatobiliary & Pancreatic Disorders',
    'Small Bowel / Vascular': 'Intestinal & Colorectal Disorders',
    'Obstruction': 'Intestinal & Colorectal Disorders',
    'Colon': 'Intestinal & Colorectal Disorders',
    'Large Bowel / Acute Abdomen': 'Intestinal & Colorectal Disorders',
  },
  Cardiovascular: {
    'Arrhythmia': 'Arrhythmias & Conduction Disorders',
    'Channelopathy': 'Arrhythmias & Conduction Disorders',
    'Inflammatory Cardiac Conditions': 'Inflammatory & Pericardial Conditions',
    'Pericardial Disease': 'Inflammatory & Pericardial Conditions',
  },
  Neurological: {
    'Infectious': 'Infectious & Inflammatory Neurologic Disorders',
    'Infections of the CNS / Peripheral Neuropathy / Cranial Neuropathy': 'Infectious & Inflammatory Neurologic Disorders',
    'Spinal Cord Disorders / Demyelinating Disease': 'Infectious & Inflammatory Neurologic Disorders',
    'Headache / Iatrogenic Condition': 'Headache Disorders',
    'Cranial Nerve': 'Peripheral Nerve & Neuromuscular Disorders',
    'Neuromuscular': 'Peripheral Nerve & Neuromuscular Disorders',
  },
  HEENT: {
    'Eye/Orbital/Systemic': 'Ophthalmologic Conditions',
    'Eye - Trauma': 'Ophthalmologic Conditions',
    'Eye - Conjunctiva': 'Ophthalmologic Conditions',
    'Cornea/Anterior Segment': 'Ophthalmologic Conditions',
    'Eye/Surface': 'Ophthalmologic Conditions',
    'Eye - Lacrimal': 'Ophthalmologic Conditions',
    'Nose': 'Ear, Nose, & Throat Disorders',
    'Vertigo': 'Ear, Nose, & Throat Disorders',
  },
  Endocrine: {
    'Pituitary / ADH Disorders': 'Pituitary Disorders',
  },
  Musculoskeletal: {
    'Trauma/Fracture': 'Trauma - Fractures',
    'Pediatric/Inflammatory': 'Pediatric Orthopedic Disorders',
  },
  'Infectious Disease': {
    'Viral': 'Viral Infections',
    'Viral Infections': 'Viral Infections',
  },
  Pulmonary: {
    'Genetic Lung Disease / COPD Etiology': 'Obstructive',
  },
  Reproductive: {
    'Menopause / Vulvovaginal Disorders': 'Vulvar/Vaginal Disorders',
  }
};

// Default subcategory mappings for null values (based on system)
const DEFAULT_SUBCATEGORIES: Record<string, string> = {
  Dermatology: 'Inflammatory & Papulosquamous',
  Endocrine: 'Metabolic Disorders',
  Gastrointestinal: 'General Gastrointestinal',
  Genitourinary: 'Urologic Disorders',
  HEENT: 'General HEENT',
  Hematology: 'Blood Disorders',
  'Infectious Disease': 'Systemic Infections',
  Musculoskeletal: 'General Musculoskeletal',
  Neurological: 'Central Nervous System Disorders',
  Psychiatry: 'Mental Health Disorders',
  Renal: 'Renal & Electrolyte Disorders',
  Reproductive: 'Reproductive Health',
  Cardiovascular: 'Cardiac Disorders',
  Pulmonary: 'Respiratory Disorders',
  OTHER: 'General Medicine',
};

// Conditions to remove (screenings, normals, therapies)
const CONDITIONS_TO_REMOVE = [
  'Lung Cancer Screening',
  'Abdominal Aortic Aneurysm Screening',
  'Colorectal Cancer Screening',
  'Osteoporosis Screening',
  'Pneumonia Oxygen Therapy',
  'Normal Sinus Rhythm EKG',
  'Normal Sinus Rhythm Pituitary',
  'Normal Sinus Rhythm (NSR)',
];

// Duplicate pairs to merge (keep first, remove second)
const DUPLICATES_TO_MERGE = [
  ['MSK__pediatric__osgood_schlatter', 'MSK__pediatrics__osgoodschlatter_disease'],
  ['MSK__trauma__bakers_cyst', 'MSK__soft_tissue__bakers_cyst'],
  ['HEENT__eye__retina__central_retinal_vein_occlusion_crvo', 'HEENT__central_retinal_vein_occlusion_crvo'],
  ['HEME__leukemia__chronic_lymphocytic_leukemia_cll', 'HEME__chronic_lymphocytic_leukemia_cll'],
  ['NEURO__cognitive__normal_pressure_hydrocephalus_nph', 'NEURO__normal_pressure_hydrocephalus_nph'],
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🧹 PANaCEa Database Cleanup\n');
  console.log(dryRun ? '⚠️  DRY RUN MODE - No changes will be made\n' : '✅ LIVE MODE - Changes will be applied\n');
  console.log('='.repeat(80) + '\n');
  
  // 1. Consolidate subcategories
  await consolidateSubcategories(dryRun);
  
  // 2. Remove misclassified conditions
  await removeMisclassified(dryRun);
  
  // 3. Merge duplicates
  await mergeDuplicates(dryRun);
  
  // 4. Assign null subcategories
  await assignNullSubcategories(dryRun);
  
  console.log('\n' + '='.repeat(80));
  console.log(dryRun ? '\n✅ Dry run complete - run without --dry-run to apply changes' : '\n✅ Cleanup complete!');
}

async function consolidateSubcategories(dryRun: boolean) {
  console.log('📊 CONSOLIDATING SUBCATEGORIES\n');
  
  let updated = 0;
  
  for (const [system, mappings] of Object.entries(SUBCATEGORY_CONSOLIDATIONS)) {
    for (const [oldSubcat, newSubcat] of Object.entries(mappings)) {
      const conditions = await prisma.condition.findMany({
        where: { system, subcategory: oldSubcat },
        select: { id: true, name: true }
      });
      
      if (conditions.length > 0) {
        console.log(`  ${system}: "${oldSubcat}" → "${newSubcat}" (${conditions.length} condition${conditions.length > 1 ? 's' : ''})`);
        
        if (!dryRun) {
          await prisma.condition.updateMany({
            where: { system, subcategory: oldSubcat },
            data: { subcategory: newSubcat }
          });
          updated += conditions.length;
        }
      }
    }
  }
  
  console.log(`\n✅ ${dryRun ? 'Would update' : 'Updated'} ${updated} conditions`);
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function removeMisclassified(dryRun: boolean) {
  console.log('🗑️  REMOVING MISCLASSIFIED CONDITIONS\n');
  
  for (const name of CONDITIONS_TO_REMOVE) {
    const condition = await prisma.condition.findFirst({
      where: { name: { contains: name, mode: 'insensitive' } },
      select: { id: true, name: true, system: true }
    });
    
    if (condition) {
      console.log(`  • ${condition.name} [${condition.system}]`);
      
      if (!dryRun) {
        // Delete associated MedicalContent first
        await prisma.medicalContent.deleteMany({
          where: { conditionId: condition.id }
        });
        
        // Delete condition
        await prisma.condition.delete({
          where: { id: condition.id }
        });
      }
    }
  }
  
  console.log(`\n✅ ${dryRun ? 'Would remove' : 'Removed'} ${CONDITIONS_TO_REMOVE.length} misclassified conditions`);
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function mergeDuplicates(dryRun: boolean) {
  console.log('🔄 MERGING DUPLICATES\n');
  
  let merged = 0;
  
  for (const [keepId, removeId] of DUPLICATES_TO_MERGE) {
    const keep = await prisma.condition.findUnique({ where: { id: keepId } });
    const remove = await prisma.condition.findUnique({ where: { id: removeId } });
    
    if (!keep || !remove) {
      console.log(`  ⚠️  Skipping ${keepId} / ${removeId} - not found`);
      continue;
    }
    
    console.log(`  • Merging: ${remove.name}`);
    console.log(`    Keep: ${keep.id}`);
    console.log(`    Remove: ${remove.id}`);
    
    if (!dryRun) {
      // Update all MedicalContent references
      const medicalContent = await prisma.medicalContent.findUnique({
        where: { conditionId: removeId }
      });
      
      if (medicalContent) {
        // If keep already has MedicalContent, delete the duplicate
        const keepMedicalContent = await prisma.medicalContent.findUnique({
          where: { conditionId: keepId }
        });
        
        if (keepMedicalContent) {
          await prisma.medicalContent.delete({
            where: { conditionId: removeId }
          });
        } else {
          // Otherwise, update the reference
          await prisma.medicalContent.update({
            where: { conditionId: removeId },
            data: { conditionId: keepId, id: `mc_${keepId}` }
          });
        }
      }
      
      // Delete duplicate condition
      await prisma.condition.delete({
        where: { id: removeId }
      });
      
      merged++;
    }
  }
  
  console.log(`\n✅ ${dryRun ? 'Would merge' : 'Merged'} ${merged} duplicate pairs`);
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function assignNullSubcategories(dryRun: boolean) {
  console.log('📝 ASSIGNING NULL SUBCATEGORIES\n');
  
  const nullConditions = await prisma.condition.findMany({
    where: { subcategory: null },
    select: { id: true, system: true }
  });
  
  if (nullConditions.length === 0) {
    console.log('✅ No null subcategories found');
    return;
  }
  
  const bySystem = nullConditions.reduce((acc, c) => {
    acc[c.system] = (acc[c.system] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Will assign default subcategories:\n');
  Object.entries(bySystem).forEach(([system, count]) => {
    const defaultSubcat = DEFAULT_SUBCATEGORIES[system] || 'General';
    console.log(`  • ${system}: ${count} conditions → "${defaultSubcat}"`);
  });
  
  if (!dryRun) {
    for (const [system, defaultSubcat] of Object.entries(DEFAULT_SUBCATEGORIES)) {
      await prisma.condition.updateMany({
        where: { system, subcategory: null },
        data: { subcategory: defaultSubcat }
      });
    }
  }
  
  console.log(`\n✅ ${dryRun ? 'Would assign' : 'Assigned'} ${nullConditions.length} null subcategories`);
  console.log('\n' + '-'.repeat(80) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
