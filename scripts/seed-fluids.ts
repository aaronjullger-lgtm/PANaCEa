/**
 * Fluid & Electrolyte Case Seeding Script
 *
 * Seeds the FluidCase table with clinical calculation cases
 * for the Fluid & Electrolyte drill mode.
 *
 * Usage:
 *   npx ts-node scripts/seed-fluids.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface FluidCaseSeed {
  title: string;
  scenario: string;
  labs: any; // Complex nested object
  correctAnswer: number;
  unit: string;
  marginOfError: number;
  explanation: string;
  calculationHint?: string;
  category: 'fena' | 'anion_gap' | 'free_water_deficit' | 'maintenance_fluids';
  difficulty?: 'easy' | 'medium' | 'hard';
}

const FLUID_CASES: FluidCaseSeed[] = [
  {
    title: 'AKI Etiology',
    scenario:
      'A 68-year-old man presents with 3 days of decreased urine output. He has a history of heart failure and was started on furosemide 2 days ago. Physical exam shows dry mucous membranes and decreased skin turgor.',
    labs: {
      bmp: {
        sodium: 142,
        potassium: 4.2,
        chloride: 105,
        bicarbonate: 24,
        bun: 48,
        creatinine: 2.1,
        glucose: 98,
      },
      urineNa: 12,
      urineCr: 180,
    },
    correctAnswer: 0.36,
    unit: '%',
    marginOfError: 0.15,
    explanation:
      'FENa = [(Urine Na × Serum Cr) / (Serum Na × Urine Cr)] × 100 = [(12 × 2.1) / (142 × 180)] × 100 = 0.36%. FENa <1% suggests pre-renal AKI (volume depletion in this case).',
    calculationHint: 'FENa = [(UNa × SCr) / (SNa × UCr)] × 100',
    category: 'fena',
    difficulty: 'medium',
  },
  {
    title: 'Maintenance Fluids',
    scenario:
      'A 25 kg 6-year-old is admitted for appendicitis and needs maintenance IV fluids while NPO before surgery.',
    labs: {
      bmp: {
        sodium: 138,
        potassium: 4.0,
        chloride: 103,
        bicarbonate: 24,
        bun: 12,
        creatinine: 0.5,
        glucose: 95,
      },
    },
    correctAnswer: 65,
    unit: 'mL/hr',
    marginOfError: 5,
    explanation:
      'Using 4-2-1 rule: First 10 kg = 4 mL/kg/hr = 40 mL/hr. Next 10 kg = 2 mL/kg/hr = 20 mL/hr. Remaining 5 kg = 1 mL/kg/hr = 5 mL/hr. Total = 65 mL/hr.',
    calculationHint:
      '4-2-1 rule: 4 mL/kg/hr for first 10 kg, 2 mL/kg/hr for next 10 kg, 1 mL/kg/hr for each kg above 20 kg',
    category: 'maintenance_fluids',
    difficulty: 'easy',
  },
  {
    title: 'Anion Gap',
    scenario:
      'A 28-year-old diabetic presents with nausea, vomiting, and confusion. Blood glucose is 450 mg/dL.',
    labs: {
      bmp: {
        sodium: 135,
        potassium: 5.2,
        chloride: 98,
        bicarbonate: 10,
        bun: 28,
        creatinine: 1.2,
        glucose: 450,
      },
    },
    correctAnswer: 27,
    unit: 'mEq/L',
    marginOfError: 2,
    explanation:
      'Anion Gap = Na - (Cl + HCO3) = 135 - (98 + 10) = 27 mEq/L. This is elevated (normal 8-12), consistent with diabetic ketoacidosis causing a high anion gap metabolic acidosis.',
    calculationHint: 'Anion Gap = Na - (Cl + HCO3)',
    category: 'anion_gap',
    difficulty: 'easy',
  },
  {
    title: 'Free Water Deficit',
    scenario:
      'A 70 kg man is found unresponsive at home. He has been without water for several days.',
    labs: {
      bmp: {
        sodium: 160,
        potassium: 4.5,
        chloride: 120,
        bicarbonate: 22,
        bun: 35,
        creatinine: 1.8,
        glucose: 110,
      },
    },
    correctAnswer: 7,
    unit: 'L',
    marginOfError: 1,
    explanation:
      'Free Water Deficit = TBW × [(Serum Na / 140) - 1]. TBW = 0.6 × body weight = 0.6 × 70 = 42 L. Deficit = 42 × [(160/140) - 1] = 42 × 0.143 = 6.0 L. Rounds to approximately 7L including insensible losses.',
    calculationHint: 'Free Water Deficit = TBW × [(Na/140) - 1], where TBW = 0.6 × weight in kg',
    category: 'free_water_deficit',
    difficulty: 'medium',
  },
  {
    title: 'Hyponatremia Correction',
    scenario:
      'A 65-year-old woman with chronic hyponatremia (Na 118) from SIADH needs correction rate calculated.',
    labs: {
      bmp: {
        sodium: 118,
        potassium: 3.8,
        chloride: 88,
        bicarbonate: 24,
        bun: 10,
        creatinine: 0.9,
        glucose: 92,
      },
    },
    correctAnswer: 0.5,
    unit: 'mEq/L/hr',
    marginOfError: 0.1,
    explanation:
      'Safe correction rate for chronic hyponatremia is 0.5 mEq/L/hr or 10-12 mEq/L per day to avoid osmotic demyelination syndrome. Faster correction only for severe symptoms.',
    calculationHint: 'Chronic hyponatremia: max 0.5 mEq/L/hr (10-12 mEq/L/day)',
    category: 'free_water_deficit',
    difficulty: 'hard',
  },
  {
    title: 'Metabolic Alkalosis',
    scenario:
      'A 55-year-old with persistent vomiting for 3 days. Concerned about metabolic alkalosis.',
    labs: {
      bmp: {
        sodium: 140,
        potassium: 2.8,
        chloride: 88,
        bicarbonate: 38,
        bun: 22,
        creatinine: 1.1,
        glucose: 105,
      },
    },
    correctAnswer: 14,
    unit: 'mEq/L',
    marginOfError: 2,
    explanation:
      'Anion Gap = 140 - (88 + 38) = 14 mEq/L. Normal anion gap with elevated bicarbonate indicates non-anion gap metabolic alkalosis from vomiting (loss of HCl).',
    calculationHint: 'Anion Gap = Na - (Cl + HCO3)',
    category: 'anion_gap',
    difficulty: 'medium',
  },
  {
    title: 'Pediatric Dehydration',
    scenario: 'An 8 kg infant with severe gastroenteritis needs fluid resuscitation.',
    labs: {
      bmp: {
        sodium: 145,
        potassium: 3.5,
        chloride: 108,
        bicarbonate: 18,
        bun: 28,
        creatinine: 0.4,
        glucose: 88,
      },
    },
    correctAnswer: 32,
    unit: 'mL/hr',
    marginOfError: 3,
    explanation:
      'Using 4-2-1 rule for 8 kg infant: First 10 kg uses 4 mL/kg/hr. 8 kg × 4 mL/kg/hr = 32 mL/hr maintenance.',
    calculationHint: '4-2-1 rule: 4 mL/kg/hr for first 10 kg',
    category: 'maintenance_fluids',
    difficulty: 'easy',
  },
  {
    title: 'Uremic AKI',
    scenario:
      'A 72-year-old with CKD presents with confusion and decreased urine output. Suspect intrinsic AKI.',
    labs: {
      bmp: {
        sodium: 138,
        potassium: 5.8,
        chloride: 102,
        bicarbonate: 16,
        bun: 88,
        creatinine: 4.5,
        glucose: 102,
      },
      urineNa: 48,
      urineCr: 85,
    },
    correctAnswer: 2.7,
    unit: '%',
    marginOfError: 0.3,
    explanation:
      'FENa = [(48 × 4.5) / (138 × 85)] × 100 = 2.7%. FENa >2% indicates intrinsic AKI (acute tubular necrosis in this case).',
    calculationHint: 'FENa = [(UNa × SCr) / (SNa × UCr)] × 100',
    category: 'fena',
    difficulty: 'medium',
  },
  {
    title: 'DKA Anion Gap',
    scenario:
      'A 19-year-old type 1 diabetic presents with abdominal pain and Kussmaul respirations. Glucose 580.',
    labs: {
      bmp: {
        sodium: 132,
        potassium: 5.4,
        chloride: 95,
        bicarbonate: 8,
        bun: 32,
        creatinine: 1.4,
        glucose: 580,
      },
    },
    correctAnswer: 29,
    unit: 'mEq/L',
    marginOfError: 2,
    explanation:
      'Anion Gap = 132 - (95 + 8) = 29 mEq/L. Severely elevated anion gap with low bicarbonate = DKA (ketoacids causing high anion gap metabolic acidosis).',
    calculationHint: 'Anion Gap = Na - (Cl + HCO3)',
    category: 'anion_gap',
    difficulty: 'easy',
  },
  {
    title: 'Hypernatremia with Dehydration',
    scenario:
      'An 80 kg elderly man admitted from nursing home with altered mental status. Serum Na 155.',
    labs: {
      bmp: {
        sodium: 155,
        potassium: 4.2,
        chloride: 118,
        bicarbonate: 24,
        bun: 42,
        creatinine: 1.6,
        glucose: 98,
      },
    },
    correctAnswer: 5.1,
    unit: 'L',
    marginOfError: 0.5,
    explanation:
      'Free Water Deficit = 0.6 × 80 × [(155/140) - 1] = 48 × 0.107 = 5.1 L. Gradual correction needed over 48 hours to avoid cerebral edema.',
    calculationHint: 'Free Water Deficit = TBW × [(Na/140) - 1], where TBW = 0.6 × weight',
    category: 'free_water_deficit',
    difficulty: 'medium',
  },
];

async function seedFluidCases() {
  console.log('💧 Starting Fluid & Electrolyte case seeding...\n');

  try {
    // Check if cases already exist
    const existingCount = await prisma.fluidCase.count();

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing cases.`);
      console.log('❓ Delete and reseed? (This will remove all existing cases)');
      console.log('   To proceed: Run with --force flag\n');

      // Check for --force flag
      if (!process.argv.includes('--force')) {
        console.log('Seeding cancelled. Use --force to overwrite existing data.');
        return;
      }

      console.log('🗑️  Deleting existing cases...');
      await prisma.fluidCase.deleteMany({});
      console.log('✅ Deleted.\n');
    }

    // Insert cases
    console.log(`📝 Inserting ${FLUID_CASES.length} cases...\n`);

    let insertedCount = 0;
    const categoryStats: Record<string, number> = {};
    const difficultyStats: Record<string, number> = {};

    for (const fluidCase of FLUID_CASES) {
      await prisma.fluidCase.create({
        data: {

          id: uuidv4(),

          updatedAt: new Date(),

          title: fluidCase.title,
          scenario: fluidCase.scenario,
          labs: fluidCase.labs,
          correctAnswer: fluidCase.correctAnswer,
          unit: fluidCase.unit,
          marginOfError: fluidCase.marginOfError,
          explanation: fluidCase.explanation,
          calculationHint: fluidCase.calculationHint,
          category: fluidCase.category,
          difficulty: fluidCase.difficulty || 'medium',
        },
      });

      insertedCount++;
      categoryStats[fluidCase.category] = (categoryStats[fluidCase.category] || 0) + 1;
      difficultyStats[fluidCase.difficulty || 'medium'] =
        (difficultyStats[fluidCase.difficulty || 'medium'] || 0) + 1;

      // Progress indicator
      if (insertedCount % 3 === 0) {
        console.log(`   ✓ ${insertedCount}/${FLUID_CASES.length} cases inserted...`);
      }
    }

    console.log(`\n✅ Successfully seeded ${insertedCount} Fluid & Electrolyte cases!\n`);
    console.log('📊 Breakdown by category:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} cases`);
    });

    console.log('\n📊 Breakdown by difficulty:');
    Object.entries(difficultyStats).forEach(([difficulty, count]) => {
      console.log(`   ${difficulty}: ${count} cases`);
    });

    console.log('\n🎯 Next steps:');
    console.log('   1. Fluid & Electrolyte mode will now use database cases');
    console.log('   2. To add more cases, edit this script and run with --force');
    console.log('   3. Cases are randomly selected each session\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedFluidCases()
  .then(() => {
    console.log('🏁 Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
