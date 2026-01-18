/**
 * LabTest Complete Audit
 *
 * Part 1: Find missing FIELDS in existing LabTest records
 * Part 2: Find missing ENTRIES - labs referenced by conditions but not in LabTest table
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 LabTest Complete Audit');
  console.log('============================================================\n');

  try {
    // ========== PART 1: Missing Fields ==========
    console.log('📊 PART 1: Missing Fields Analysis');
    console.log('------------------------------------------------------------\n');

    const total = await prisma.labTest.count();
    console.log(`Total LabTest records: ${total}\n`);

    // Check each field
    const fields = {
      typicalUse: await prisma.labTest.count({
        where: { OR: [{ typicalUse: null }, { typicalUse: '' }] },
      }),
      conventionalRange: await prisma.labTest.count({
        where: { OR: [{ conventionalRange: null }, { conventionalRange: '' }] },
      }),
      siRange: await prisma.labTest.count({ where: { OR: [{ siRange: null }, { siRange: '' }] } }),
      units: await prisma.labTest.count({ where: { OR: [{ units: null }, { units: '' }] } }),
      siUnits: await prisma.labTest.count({ where: { OR: [{ siUnits: null }, { siUnits: '' }] } }),
      sampleType: await prisma.labTest.count({
        where: { OR: [{ sampleType: null }, { sampleType: '' }] },
      }),
      collectionTube: await prisma.labTest.count({
        where: { OR: [{ collectionTube: null }, { collectionTube: '' }] },
      }),
      fastingRequired: await prisma.labTest.count({ where: { fastingRequired: false } }), // check how many are unset
      interpretationSteps: await prisma.labTest.count({
        where: { OR: [{ interpretationSteps: null }, { interpretationSteps: '' }] },
      }),
      falsePosNeg: await prisma.labTest.count({
        where: { OR: [{ falsePosNeg: null }, { falsePosNeg: '' }] },
      }),
      turnaroundTime: await prisma.labTest.count({
        where: { OR: [{ turnaroundTime: null }, { turnaroundTime: '' }] },
      }),
      stability: await prisma.labTest.count({
        where: { OR: [{ stability: null }, { stability: '' }] },
      }),
      specialInstructions: await prisma.labTest.count({
        where: { OR: [{ specialInstructions: null }, { specialInstructions: '' }] },
      }),
      // Arrays
      commonAbnormalities: await prisma.labTest.count({
        where: { commonAbnormalities: { isEmpty: true } },
      }),
      increaseIndicates: await prisma.labTest.count({
        where: { increaseIndicates: { isEmpty: true } },
      }),
      decreaseIndicates: await prisma.labTest.count({
        where: { decreaseIndicates: { isEmpty: true } },
      }),
      whenToOrder: await prisma.labTest.count({ where: { whenToOrder: { isEmpty: true } } }),
      followUpTests: await prisma.labTest.count({ where: { followUpTests: { isEmpty: true } } }),
      relatedTests: await prisma.labTest.count({ where: { relatedTests: { isEmpty: true } } }),
      interferingFactors: await prisma.labTest.count({
        where: { interferingFactors: { isEmpty: true } },
      }),
      // Board prep
      clinicalPearls: await prisma.labTest.count({ where: { clinicalPearls: { isEmpty: true } } }),
      boardYieldFacts: await prisma.labTest.count({
        where: { boardYieldFacts: { isEmpty: true } },
      }),
      testQuestionTips: await prisma.labTest.count({
        where: { testQuestionTips: { isEmpty: true } },
      }),
      commonMistakes: await prisma.labTest.count({ where: { commonMistakes: { isEmpty: true } } }),
      mnemonics: await prisma.labTest.count({ where: { mnemonics: { isEmpty: true } } }),
    };

    console.log('Missing field counts:');
    const sortedFields = Object.entries(fields)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0);

    for (const [field, count] of sortedFields) {
      const pct = ((count / total) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round((count / total) * 20));
      console.log(
        `  ${field.padEnd(22)} ${String(count).padStart(4)}/${total} (${pct.padStart(5)}%) ${bar}`
      );
    }

    // Get sample of most incomplete records
    const incompleteRecords = await prisma.labTest.findMany({
      where: {
        AND: [{ boardYieldFacts: { isEmpty: true } }, { clinicalPearls: { isEmpty: true } }],
      },
      select: { id: true, name: true, category: true },
      take: 20,
    });

    console.log(`\nMost incomplete records (sample):`);
    incompleteRecords.forEach((r) => console.log(`  - ${r.name} (${r.category})`));

    // ========== PART 2: Missing Entries ==========
    console.log('\n\n📊 PART 2: Missing Entries Analysis');
    console.log('------------------------------------------------------------\n');

    // Get all lab test names we have
    const existingLabs = await prisma.labTest.findMany({
      select: { id: true, name: true },
    });
    const existingLabNames = new Set(existingLabs.map((l) => l.name.toLowerCase()));
    const existingLabIds = new Set(existingLabs.map((l) => l.id));

    // Get labs referenced in LabConditionLink with their LabTest info
    const labLinks = await prisma.labConditionLink.findMany({
      select: {
        labTestId: true,
        LabTest: { select: { name: true } },
      },
    });

    // Count unique labs that ARE linked
    const linkedLabIds = new Set(labLinks.map((l) => l.labTestId));
    const linkedLabNames = new Set(labLinks.map((l) => l.LabTest.name));

    // Find labs that exist but have NO condition links
    const labsWithNoLinks = existingLabs.filter((lab) => !linkedLabIds.has(lab.id));

    console.log(`Labs in LabTest table: ${existingLabNames.size}`);
    console.log(`Labs with condition links: ${linkedLabIds.size}`);
    console.log(`Labs with NO condition links: ${labsWithNoLinks.length}`);

    if (labsWithNoLinks.length > 0) {
      console.log(`\n⚠️  Labs with NO condition associations (orphaned):`);
      labsWithNoLinks.slice(0, 20).forEach((lab) => console.log(`  - ${lab.name}`));
      if (labsWithNoLinks.length > 20) {
        console.log(`  ... and ${labsWithNoLinks.length - 20} more`);
      }
    }

    // Also check: What common lab tests are completely missing?
    const commonLabTests = [
      'CBC',
      'Complete Blood Count',
      'BMP',
      'Basic Metabolic Panel',
      'CMP',
      'Comprehensive Metabolic Panel',
      'Hemoglobin A1c',
      'HbA1c',
      'Lipid Panel',
      'TSH',
      'T3',
      'T4',
      'Free T4',
      'Urinalysis',
      'UA',
      'Urine Culture',
      'Blood Culture',
      'PT',
      'PTT',
      'INR',
      'D-Dimer',
      'Fibrinogen',
      'Troponin',
      'BNP',
      'NT-proBNP',
      'CK-MB',
      'AST',
      'ALT',
      'ALP',
      'GGT',
      'Bilirubin',
      'Albumin',
      'BUN',
      'Creatinine',
      'GFR',
      'eGFR',
      'Sodium',
      'Potassium',
      'Chloride',
      'Bicarbonate',
      'CO2',
      'Calcium',
      'Magnesium',
      'Phosphorus',
      'WBC',
      'RBC',
      'Hemoglobin',
      'Hematocrit',
      'Platelets',
      'MCV',
      'MCH',
      'MCHC',
      'RDW',
      'ESR',
      'CRP',
      'Procalcitonin',
      'Glucose',
      'Fasting Glucose',
      'Random Glucose',
      'PSA',
      'AFP',
      'CEA',
      'CA-125',
      'CA 19-9',
      'Ferritin',
      'Iron',
      'TIBC',
      'Transferrin Saturation',
      'Vitamin D',
      'Vitamin B12',
      'Folate',
      'Cortisol',
      'ACTH',
      'Aldosterone',
      'Renin',
      'Lactate',
      'Ammonia',
      'Uric Acid',
      'ABG',
      'Arterial Blood Gas',
      'VBG',
      'CSF Analysis',
      'Synovial Fluid Analysis',
      'Pregnancy Test',
      'hCG',
      'Beta-hCG',
    ];

    const missingCommonLabs = commonLabTests.filter(
      (lab) => !existingLabNames.has(lab.toLowerCase())
    );

    if (missingCommonLabs.length > 0) {
      console.log(`\n⚠️  Common lab tests NOT in database (${missingCommonLabs.length}):`);
      missingCommonLabs.forEach((name) => console.log(`  - ${name}`));
    }

    // ========== SUMMARY ==========
    console.log('\n\n============================================================');
    console.log('📋 SUMMARY & ACTION ITEMS');
    console.log('============================================================\n');

    const recordsNeedingFields = await prisma.labTest.count({
      where: {
        OR: [
          { boardYieldFacts: { isEmpty: true } },
          { clinicalPearls: { isEmpty: true } },
          { OR: [{ conventionalRange: null }, { conventionalRange: '' }] },
        ],
      },
    });

    console.log(`1. FILL MISSING FIELDS: ${recordsNeedingFields} records need field completion`);
    console.log(`2. ORPHANED LABS: ${labsWithNoLinks.length} labs have no condition links`);
    console.log(`3. ADD COMMON LABS: ${missingCommonLabs.length} standard labs not in database`);

    console.log('\nPriority order:');
    console.log('  1. Fill fields in existing 116 incomplete records');
    console.log('  2. Add common labs that are missing');
    console.log('  3. Create condition links for orphaned labs');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
