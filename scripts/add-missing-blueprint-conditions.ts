#!/usr/bin/env tsx
/**
 * Add Missing PANCE Blueprint Conditions
 *
 * Adds all conditions explicitly listed in the PANCE Blueprint but missing from the database.
 * Maintains dual-table sync between Condition and MedicalContent.
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';
import { v4 as uuidv4 } from 'uuid';

interface NewCondition {
  // Optional because IDs are derived when not provided
  id?: string;
  name: string;
  system: string;
  subcategory: string;
  parent_category?: string | null;
}

// Generate condition ID from system, subcategory, and name
function generateConditionId(system: string, subcategory: string, name: string): string {
  const cleanSubcat = subcategory.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${system}__${cleanSubcat}__${cleanName}`;
}

const MISSING_CONDITIONS: NewCondition[] = [
  // Cardiovascular System
  {
    name: 'Patent Foramen Ovale',
    system: 'CV',
    subcategory: 'Congenital Heart Disease',
    parent_category: null,
  },
  {
    name: 'Non-ST-Segment Elevation Myocardial Infarction (NSTEMI)',
    system: 'CV',
    subcategory: 'Acute Coronary Syndrome',
    parent_category: 'Coronary Artery Disease',
  },
  { name: 'Cardiogenic Shock', system: 'CV', subcategory: 'Shock', parent_category: null },
  { name: 'Distributive Shock', system: 'CV', subcategory: 'Shock', parent_category: null },
  { name: 'Hypovolemic Shock', system: 'CV', subcategory: 'Shock', parent_category: null },
  { name: 'Obstructive Shock', system: 'CV', subcategory: 'Shock', parent_category: null },
  {
    name: 'Arteriovenous Malformation',
    system: 'CV',
    subcategory: 'Vascular Disease',
    parent_category: null,
  },
  {
    name: 'Arterial Embolism',
    system: 'CV',
    subcategory: 'Vascular Disease',
    parent_category: null,
  },
  {
    name: 'Phlebitis / Thrombophlebitis',
    system: 'CV',
    subcategory: 'Vascular Disease',
    parent_category: null,
  },

  // Dermatologic System
  { name: 'Lacerations', system: 'DERM', subcategory: 'Skin Integrity', parent_category: null },
  {
    name: 'Cellulitis',
    system: 'DERM',
    subcategory: 'Infectious Diseases',
    parent_category: 'Infectious - Bacterial',
  },
  {
    name: 'Envenomations / Arthropod Bite Reactions',
    system: 'DERM',
    subcategory: 'Bites and Stings',
    parent_category: null,
  },

  // Endocrine System
  { name: 'Goiter', system: 'ENDO', subcategory: 'Thyroid Disorders', parent_category: null },
  { name: 'Dwarfism', system: 'ENDO', subcategory: 'Pituitary Disorders', parent_category: null },
  {
    name: 'Neoplastic Syndrome (Paraneoplastic)',
    system: 'ENDO',
    subcategory: 'Neoplasms',
    parent_category: null,
  },

  // Eyes, Ears, Nose, and Throat (HEENT)
  { name: 'Blowout Fracture', system: 'HEENT', subcategory: 'Trauma', parent_category: null },
  {
    name: 'Nystagmus',
    system: 'HEENT',
    subcategory: 'Eye - Neuro-ophthalmologic',
    parent_category: 'Eye Disorders',
  },
  {
    name: 'Dacryostenosis',
    system: 'HEENT',
    subcategory: 'Eye - Lacrimal',
    parent_category: 'Eye Disorders',
  },
  {
    name: 'Presbyopia',
    system: 'HEENT',
    subcategory: 'Eye - Vision Abnormalities',
    parent_category: 'Eye Disorders',
  },
  {
    name: 'Eustachian Tube Dysfunction',
    system: 'HEENT',
    subcategory: 'Ear - Inner',
    parent_category: 'Ear Disorders',
  },
  {
    name: 'Conductive Hearing Impairment',
    system: 'HEENT',
    subcategory: 'Ear - Inner',
    parent_category: 'Ear Disorders',
  },
  {
    name: 'Sensorineural Hearing Impairment',
    system: 'HEENT',
    subcategory: 'Ear - Inner',
    parent_category: 'Ear Disorders',
  },
  {
    name: 'Deep Neck Infection',
    system: 'HEENT',
    subcategory: 'Oropharyngeal - Infectious/Inflammatory',
    parent_category: 'Oropharyngeal Disorders',
  },
  {
    name: 'Dental Caries',
    system: 'HEENT',
    subcategory: 'Oropharyngeal - Infectious/Inflammatory',
    parent_category: 'Oropharyngeal Disorders',
  },
  {
    name: 'Gingivitis',
    system: 'HEENT',
    subcategory: 'Oropharyngeal - Infectious/Inflammatory',
    parent_category: 'Oropharyngeal Disorders',
  },

  // Gastrointestinal System / Nutrition
  {
    name: 'Constipation',
    system: 'GI',
    subcategory: 'Colorectal Disorders',
    parent_category: null,
  },
  { name: 'Diarrhea', system: 'GI', subcategory: 'Colorectal Disorders', parent_category: null },
  {
    name: 'Rectal Prolapse',
    system: 'GI',
    subcategory: 'Colorectal Disorders',
    parent_category: null,
  },
  {
    name: 'Fatty Liver (Non-Alcoholic Fatty Liver Disease)',
    system: 'GI',
    subcategory: 'Hepatic Disorders',
    parent_category: null,
  },
  {
    name: 'Gastrointestinal Bleeding',
    system: 'GI',
    subcategory: 'Gastrointestinal Disorders',
    parent_category: null,
  },
  { name: 'Food Allergies', system: 'GI', subcategory: 'Nutrition', parent_category: null },
  { name: 'Food Sensitivities', system: 'GI', subcategory: 'Nutrition', parent_category: null },
  { name: 'Obesity', system: 'GI', subcategory: 'Nutrition', parent_category: null },

  // Genitourinary System
  { name: 'Prostate Cancer', system: 'GU', subcategory: 'Neoplasms', parent_category: null },
  {
    name: 'Overactive Bladder',
    system: 'GU',
    subcategory: 'Bladder Disorders',
    parent_category: null,
  },
  {
    name: 'Hydronephrosis',
    system: 'GU',
    subcategory: 'Congenital/Structural Renal Disorders',
    parent_category: null,
  },

  // Hematologic System
  { name: 'Leukopenia', system: 'HEME', subcategory: 'Cytopenias', parent_category: null },
  {
    name: 'Thrombocytosis (Reactive/Secondary)',
    system: 'HEME',
    subcategory: 'Cytoses',
    parent_category: null,
  },

  // Infectious Diseases
  {
    name: 'Methicillin-Resistant Staphylococcus Aureus (MRSA) Infection',
    system: 'ID',
    subcategory: 'Bacterial Diseases',
    parent_category: null,
  },
  {
    name: 'Polio (Poliomyelitis)',
    system: 'ID',
    subcategory: 'Viral Diseases',
    parent_category: null,
  },

  // Musculoskeletal System
  {
    name: 'Chest Wall Deformities',
    system: 'MSK',
    subcategory: 'Chest/Rib Disorders',
    parent_category: null,
  },
  {
    name: 'Rib Fractures',
    system: 'MSK',
    subcategory: 'Chest/Rib Disorders',
    parent_category: null,
  },
  {
    name: 'Thoracic Outlet Syndrome',
    system: 'MSK',
    subcategory: 'Upper Extremity Disorders',
    parent_category: null,
  },
  {
    name: 'Spinal Sprain / Strain',
    system: 'MSK',
    subcategory: 'Spinal Disorders',
    parent_category: 'Spinal - Lumbar',
  },

  // Neurologic System
  {
    name: 'Cerebral Aneurysm',
    system: 'NEURO',
    subcategory: 'Cerebrovascular Disorders',
    parent_category: null,
  },
  {
    name: 'Coma',
    system: 'NEURO',
    subcategory: 'Cerebrovascular Disorders',
    parent_category: null,
  },
  {
    name: 'Postconcussion Syndrome',
    system: 'NEURO',
    subcategory: 'Trauma',
    parent_category: null,
  },
  {
    name: 'Tardive Dyskinesia',
    system: 'NEURO',
    subcategory: 'Movement Disorders',
    parent_category: null,
  },
  {
    name: 'Cognitive Impairment (Mild Cognitive Impairment)',
    system: 'NEURO',
    subcategory: 'Cognitive Disorders',
    parent_category: null,
  },
  {
    name: 'Spinal Cord Injury (Traumatic)',
    system: 'NEURO',
    subcategory: 'Trauma',
    parent_category: null,
  },

  // Psychiatry / Behavioral Science
  {
    name: 'Dissociative Disorders',
    system: 'PSYCH',
    subcategory: 'Dissociative Disorders',
    parent_category: null,
  },
  {
    name: 'Intimate Partner Violence',
    system: 'PSYCH',
    subcategory: 'Abuse and Neglect',
    parent_category: null,
  },
  { name: 'Elder Abuse', system: 'PSYCH', subcategory: 'Abuse and Neglect', parent_category: null },
  {
    name: 'Bereavement',
    system: 'PSYCH',
    subcategory: 'Adjustment Disorders',
    parent_category: null,
  },

  // Pulmonary System
  {
    name: 'Acute Bronchitis',
    system: 'PULM',
    subcategory: 'Infectious Disorders',
    parent_category: null,
  },
  {
    name: 'Pulmonary Edema',
    system: 'PULM',
    subcategory: 'Pulmonary Circulation',
    parent_category: null,
  },
  {
    name: "Pneumoconiosis (Coal Worker's Pneumoconiosis)",
    system: 'PULM',
    subcategory: 'Restrictive Pulmonary Diseases',
    parent_category: null,
  },

  // Renal System
  {
    name: 'Hypervolemia (Fluid Overload)',
    system: 'RENAL',
    subcategory: 'Fluid and Electrolyte Imbalances',
    parent_category: null,
  },
  {
    name: 'Hypovolemia (Fluid Deficit)',
    system: 'RENAL',
    subcategory: 'Fluid and Electrolyte Imbalances',
    parent_category: null,
  },

  // Reproductive System
  { name: 'Breech Presentation', system: 'REPRO', subcategory: 'Pregnancy', parent_category: null },
  { name: 'Fetal Distress', system: 'REPRO', subcategory: 'Pregnancy', parent_category: null },
  {
    name: 'Rh Incompatibility (Maternal Alloimmunization)',
    system: 'REPRO',
    subcategory: 'Pregnancy',
    parent_category: null,
  },
];

async function addMissingConditions() {
  console.log('🔄 Adding Missing PANCE Blueprint Conditions\n');

  try {
    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const condition of MISSING_CONDITIONS) {
      const id = generateConditionId(condition.system, condition.subcategory, condition.name);

      // Check if condition already exists
      const existing = await prisma.condition.findUnique({ where: { id } });
      if (existing) {
        console.log(`⏭️  Skipped (exists): ${condition.name}`);
        skippedCount++;
        continue;
      }

      try {
        // Create condition in both tables atomically
        const now = new Date();
        await prisma.$transaction([
          prisma.condition.create({
            data: {

              id: uuidv4(),

              id,
              name: condition.name,
              system: condition.system,
              subcategory: condition.subcategory,
              parent_category: condition.parent_category,
              updatedAt: now,
            },
          }),
          prisma.medicalContent.create({
            data: {

              updatedAt: new Date(),

              id: `content_${id}`,
              conditionId: id,
              condition: condition.name,
              system: condition.system,
              subcategory: condition.subcategory,
              parent_category: condition.parent_category,
              content: {},
              overview: `Clinical overview of ${condition.name}`,
              createdBy: 'system',
              updatedBy: 'system',
              updatedAt: now,
            },
          }),
        ]);

        console.log(`✅ Added: ${condition.name} (${condition.system} → ${condition.subcategory})`);
        addedCount++;
      } catch (error) {
        const errorMsg = `Failed to add ${condition.name}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`  ✅ Added: ${addedCount} conditions`);
    console.log(`  ⏭️  Skipped: ${skippedCount} (already exist)`);
    console.log(`  ❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Error Details:');
      errors.forEach((err) => console.log(`  ${err}`));
    }

    // Verify sync
    console.log('\n🔍 Verifying table sync...');
    const conditionCount = await prisma.condition.count();
    const contentCount = await prisma.medicalContent.count();
    console.log(`  Condition table: ${conditionCount} records`);
    console.log(`  MedicalContent table: ${contentCount} records`);

    if (conditionCount === contentCount) {
      console.log('  ✅ Tables are in sync');
    } else {
      console.log('  ❌ Tables are out of sync!');
    }

    // Show new totals by system
    console.log('\n📈 Updated System Distribution:');
    const systemStats = await prisma.condition.groupBy({
      by: ['system'],
      _count: { id: true },
    });
    const sorted = systemStats.sort((a, b) => b._count.id - a._count.id);
    sorted.forEach(({ system, _count }) => {
      console.log(`  ${system}: ${_count.id} conditions`);
    });
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

// Run the script
addMissingConditions().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
