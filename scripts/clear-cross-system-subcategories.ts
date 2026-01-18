import { prisma, disconnectPrisma } from './helpers/prisma-client';

/**
 * Clear subcategories that don't match the condition's system
 * This fixes conditions that were incorrectly assigned cardiovascular subcategories
 */

// System-specific valid subcategories
const SYSTEM_SUBCATEGORIES: Record<string, string[]> = {
  CV: [
    'Acute Coronary Syndrome',
    'Cardiomyopathy',
    'Conduction Disorders / Dysrhythmias',
    'Congenital Heart Disease',
    'Coronary Artery Disease',
    'Heart Failure',
    'Hypertension',
    'Hypotension',
    'Lipid Disorders',
    'Shock',
    'Traumatic, Infectious, and Inflammatory Heart Conditions',
    'Valvular Disorders',
    'Vascular Disease',
    'ECG',
  ],
  PULM: [
    'Infectious Disorders',
    'Obstructive Pulmonary Diseases',
    'Pneumonias',
    'Restrictive Pulmonary Diseases',
    'Vascular Disorders',
  ],
  NEURO: [
    'Cerebrovascular Disorders',
    'Seizure Disorders',
    'Headaches',
    'Movement Disorders',
    'Neuromuscular Disorders',
  ],
  GI: [
    'Hepatic Disorders',
    'Biliary Disorders',
    'Colorectal Disorders',
    'Inflammatory Bowel Disease',
    'Esophageal Disorders',
    'Gastric Disorders',
  ],
  PSYCH: [
    'Depressive Disorders',
    'Anxiety Disorders',
    'Psychotic Disorders',
    'Substance Use Disorders',
    'Eating Disorders',
  ],
};

async function clearCrossSystemSubcategories() {
  try {
    // Get all conditions with subcategories
    const conditions = await prisma.condition.findMany({
      where: {
        subcategory: { not: null },
      },
      select: { id: true, name: true, system: true, subcategory: true, parent_category: true },
    });

    console.log(`Checking ${conditions.length} conditions with subcategories...`);

    const toFix: string[] = [];

    for (const condition of conditions) {
      const validSubcats = SYSTEM_SUBCATEGORIES[condition.system] || [];

      if (condition.subcategory && !validSubcats.includes(condition.subcategory)) {
        toFix.push(condition.id);
        console.log(`  ❌ ${condition.name} (${condition.system})`);
        console.log(`     Current subcategory: ${condition.subcategory}`);
        console.log(
          `     Valid subcategories for ${condition.system}: ${validSubcats.slice(0, 3).join(', ')}...`
        );
      }
    }

    console.log(`\nFound ${toFix.length} conditions with invalid subcategories`);

    if (toFix.length > 0) {
      // Clear subcategory and parent_category for these conditions
      await prisma.condition.updateMany({
        where: { id: { in: toFix } },
        data: {
          subcategory: null,
          parent_category: null,
        },
      });

      await prisma.medicalContent.updateMany({
        where: { conditionId: { in: toFix } },
        data: {
          subcategory: null,
          parent_category: null,
        },
      });

      console.log(`✅ Cleared invalid subcategories and parent categories`);
    }
  } finally {
    await disconnectPrisma();
  }
}

clearCrossSystemSubcategories().catch(console.error);
