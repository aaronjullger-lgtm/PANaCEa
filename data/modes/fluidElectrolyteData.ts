import type { FluidElectrolyteCase, UrineChemistryData } from '@/types/drill-modes';

/**
 * Urine Chemistry Reference Table
 */
export const URINE_CHEMISTRY_REFERENCE: UrineChemistryData = {
  reference: [
    {
      parameter: 'Sodium (Na)',
      normalRange: '40-220',
      unit: 'mEq/L',
      interpretation: 'Varies with dietary intake'
    },
    {
      parameter: 'Potassium (K)',
      normalRange: '25-125',
      unit: 'mEq/L',
      interpretation: 'Reflects dietary intake'
    },
    {
      parameter: 'Chloride (Cl)',
      normalRange: '110-250',
      unit: 'mEq/L'
    },
    {
      parameter: 'Creatinine',
      normalRange: '20-320',
      unit: 'mg/dL',
      interpretation: 'Used in FENa calculation'
    },
    {
      parameter: 'Osmolality',
      normalRange: '50-1200',
      unit: 'mOsm/kg',
      interpretation: 'Reflects concentrating ability'
    },
    {
      parameter: 'Specific Gravity',
      normalRange: '1.002-1.030',
      unit: '',
      interpretation: 'Correlates with osmolality'
    }
  ]
};

/**
 * Mock case data for Fluid & Electrolyte drills
 */
export const FLUID_ELECTROLYTE_CASES: FluidElectrolyteCase[] = [
  {
    id: 'fe-001',
    title: 'AKI Etiology',
    vignette: 'A 68-year-old man presents with 3 days of decreased urine output. He has a history of heart failure and was started on furosemide 2 days ago. Physical exam shows dry mucous membranes and decreased skin turgor.',
    labs: {
      bmp: {
        sodium: 142,
        potassium: 4.2,
        chloride: 105,
        bicarbonate: 24,
        bun: 48,
        creatinine: 2.1,
        glucose: 98
      },
      urineNa: 12,
      urineCr: 180
    },
    question: 'Calculate the Fractional Excretion of Sodium (FENa) to determine if this is pre-renal or intrinsic AKI.',
    correctAnswer: 0.36,
    unit: '%',
    marginOfError: 0.15,
    explanation: 'FENa = [(Urine Na × Serum Cr) / (Serum Na × Urine Cr)] × 100 = [(12 × 2.1) / (142 × 180)] × 100 = 0.36%. FENa <1% suggests pre-renal AKI (volume depletion in this case).',
    calculationHint: 'FENa = [(UNa × SCr) / (SNa × UCr)] × 100',
    category: 'fena'
  },
  {
    id: 'fe-002',
    title: 'Maintenance Fluids',
    vignette: 'A 25 kg 6-year-old is admitted for appendicitis and needs maintenance IV fluids while NPO before surgery.',
    labs: {
      bmp: {
        sodium: 138,
        potassium: 4.0,
        chloride: 103,
        bicarbonate: 24,
        bun: 12,
        creatinine: 0.5,
        glucose: 95
      }
    },
    question: 'Calculate the hourly maintenance fluid rate using the 4-2-1 rule (mL/hr).',
    correctAnswer: 65,
    unit: 'mL/hr',
    marginOfError: 5,
    explanation: 'Using 4-2-1 rule: First 10 kg = 4 mL/kg/hr = 40 mL/hr. Next 10 kg = 2 mL/kg/hr = 20 mL/hr. Remaining 5 kg = 1 mL/kg/hr = 5 mL/hr. Total = 65 mL/hr.',
    calculationHint: '4-2-1 rule: 4 mL/kg/hr for first 10 kg, 2 mL/kg/hr for next 10 kg, 1 mL/kg/hr for each kg above 20 kg',
    category: 'maintenance_fluids'
  },
  {
    id: 'fe-003',
    title: 'Anion Gap',
    vignette: 'A 28-year-old diabetic presents with nausea, vomiting, and confusion. Blood glucose is 450 mg/dL.',
    labs: {
      bmp: {
        sodium: 135,
        potassium: 5.2,
        chloride: 98,
        bicarbonate: 10,
        bun: 28,
        creatinine: 1.2,
        glucose: 450
      }
    },
    question: 'Calculate the anion gap.',
    correctAnswer: 27,
    unit: 'mEq/L',
    marginOfError: 2,
    explanation: 'Anion Gap = Na - (Cl + HCO3) = 135 - (98 + 10) = 27 mEq/L. This is elevated (normal 8-12), consistent with diabetic ketoacidosis causing a high anion gap metabolic acidosis.',
    calculationHint: 'Anion Gap = Na - (Cl + HCO3)',
    category: 'anion_gap'
  },
  {
    id: 'fe-004',
    title: 'Free Water Deficit',
    vignette: 'A 70 kg man is found unresponsive at home. He has been without water for several days.',
    labs: {
      bmp: {
        sodium: 160,
        potassium: 4.5,
        chloride: 120,
        bicarbonate: 22,
        bun: 35,
        creatinine: 1.8,
        glucose: 110
      }
    },
    question: 'Calculate the free water deficit (in liters).',
    correctAnswer: 7,
    unit: 'L',
    marginOfError: 1,
    explanation: 'Free Water Deficit = TBW × [(Serum Na / 140) - 1]. TBW = 0.6 × body weight = 0.6 × 70 = 42 L. Deficit = 42 × [(160/140) - 1] = 42 × 0.143 = 6.0 L. Rounds to approximately 7L including insensible losses.',
    calculationHint: 'Free Water Deficit = TBW × [(Na/140) - 1], where TBW = 0.6 × weight in kg',
    category: 'free_water_deficit'
  }
];

/**
 * Get a random fluid/electrolyte case
 */
export function getRandomFluidCase(): FluidElectrolyteCase {
  return FLUID_ELECTROLYTE_CASES[Math.floor(Math.random() * FLUID_ELECTROLYTE_CASES.length)];
}

/**
 * Validate user's numeric answer against the correct answer with margin of error
 */
export function validateNumericAnswer(
  userAnswer: number,
  correctAnswer: number,
  marginOfError: number
): { isCorrect: boolean; difference: number } {
  const difference = Math.abs(userAnswer - correctAnswer);
  const isCorrect = difference <= marginOfError;
  
  return { isCorrect, difference };
}
