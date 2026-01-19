/**
 * Seed Normal Lab Values
 *
 * Seeds the NormalLabValue table with comprehensive normal reference ranges
 * for common laboratory tests, including variations by age and sex.
 *
 * Usage: npx tsx scripts/seed/seed-normal-lab-values.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface NormalLabValueSeed {
  labTestName: string;
  category: string;
  normalRangeLow?: number;
  normalRangeHigh?: number;
  normalRangeText?: string;
  units?: string;
  siUnits?: string;
  siRangeLow?: number;
  siRangeHigh?: number;
  conversionFactor?: number;
  sex?: string;
  ageGroup?: string;
  ageRangeLow?: number;
  ageRangeHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  clinicalNotes?: string;
  commonCauses?: string[];
  source?: string;
  isHighYield?: boolean;
  panceRelevance?: number;
}

// =============================================================================
// COMPLETE BLOOD COUNT (CBC)
// =============================================================================
const cbcValues: NormalLabValueSeed[] = [
  // WBC - varies by age
  {
    labTestName: 'White Blood Cell Count (WBC)',
    category: 'CBC',
    normalRangeLow: 4.5,
    normalRangeHigh: 11.0,
    units: 'x10³/µL',
    siUnits: 'x10⁹/L',
    siRangeLow: 4.5,
    siRangeHigh: 11.0,
    conversionFactor: 1,
    sex: 'all',
    ageGroup: 'adult',
    ageRangeLow: 18,
    ageRangeHigh: 65,
    criticalLow: 2.0,
    criticalHigh: 30.0,
    clinicalNotes: 'Leukocytosis >11, Leukopenia <4.5. Stress, infection, steroids can elevate.',
    commonCauses: [
      'Infection (elevated)',
      'Leukemia (elevated)',
      'Bone marrow suppression (low)',
      'Autoimmune (low)',
    ],
    source: "Harrison's Principles of Internal Medicine",
    isHighYield: true,
    panceRelevance: 5,
  },
  {
    labTestName: 'White Blood Cell Count (WBC)',
    category: 'CBC',
    normalRangeLow: 5.0,
    normalRangeHigh: 15.0,
    units: 'x10³/µL',
    sex: 'all',
    ageGroup: 'child',
    ageRangeLow: 2,
    ageRangeHigh: 12,
    clinicalNotes: 'Children have higher normal WBC counts than adults',
    isHighYield: true,
    panceRelevance: 4,
  },
  {
    labTestName: 'White Blood Cell Count (WBC)',
    category: 'CBC',
    normalRangeLow: 9.0,
    normalRangeHigh: 30.0,
    units: 'x10³/µL',
    sex: 'all',
    ageGroup: 'neonate',
    ageRangeLow: 0,
    ageRangeHigh: 1,
    clinicalNotes: 'Neonates have significantly elevated WBC counts normally',
    isHighYield: true,
    panceRelevance: 4,
  },

  // RBC - varies by sex
  {
    labTestName: 'Red Blood Cell Count (RBC)',
    category: 'CBC',
    normalRangeLow: 4.7,
    normalRangeHigh: 6.1,
    units: 'x10⁶/µL',
    siUnits: 'x10¹²/L',
    siRangeLow: 4.7,
    siRangeHigh: 6.1,
    conversionFactor: 1,
    sex: 'male',
    ageGroup: 'adult',
    criticalLow: 2.0,
    criticalHigh: 8.0,
    clinicalNotes: 'Men have higher RBC due to testosterone effect on erythropoiesis',
    commonCauses: [
      'Polycythemia vera (elevated)',
      'Anemia (low)',
      'Dehydration (falsely elevated)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },
  {
    labTestName: 'Red Blood Cell Count (RBC)',
    category: 'CBC',
    normalRangeLow: 4.2,
    normalRangeHigh: 5.4,
    units: 'x10⁶/µL',
    siUnits: 'x10¹²/L',
    siRangeLow: 4.2,
    siRangeHigh: 5.4,
    conversionFactor: 1,
    sex: 'female',
    ageGroup: 'adult',
    criticalLow: 2.0,
    criticalHigh: 8.0,
    clinicalNotes: 'Women have lower RBC due to menstrual blood loss and lower testosterone',
    isHighYield: true,
    panceRelevance: 5,
  },

  // Hemoglobin - varies by sex
  {
    labTestName: 'Hemoglobin (Hgb)',
    category: 'CBC',
    normalRangeLow: 14.0,
    normalRangeHigh: 18.0,
    units: 'g/dL',
    siUnits: 'g/L',
    siRangeLow: 140,
    siRangeHigh: 180,
    conversionFactor: 10,
    sex: 'male',
    ageGroup: 'adult',
    criticalLow: 7.0,
    criticalHigh: 20.0,
    clinicalNotes: 'Anemia defined as Hgb <13.5 in men. Critical <7 may need transfusion.',
    commonCauses: [
      'Iron deficiency (low)',
      'B12/folate deficiency (low)',
      'Polycythemia (high)',
      'Chronic disease (low)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },
  {
    labTestName: 'Hemoglobin (Hgb)',
    category: 'CBC',
    normalRangeLow: 12.0,
    normalRangeHigh: 16.0,
    units: 'g/dL',
    siUnits: 'g/L',
    siRangeLow: 120,
    siRangeHigh: 160,
    conversionFactor: 10,
    sex: 'female',
    ageGroup: 'adult',
    criticalLow: 7.0,
    criticalHigh: 20.0,
    clinicalNotes: 'Anemia defined as Hgb <12 in women. Pregnancy target >11.',
    isHighYield: true,
    panceRelevance: 5,
  },

  // Hematocrit - varies by sex
  {
    labTestName: 'Hematocrit (Hct)',
    category: 'CBC',
    normalRangeLow: 42,
    normalRangeHigh: 52,
    units: '%',
    sex: 'male',
    ageGroup: 'adult',
    criticalLow: 20,
    criticalHigh: 60,
    clinicalNotes:
      'Hct ≈ 3x Hgb. Elevated in dehydration, polycythemia. Low in anemia, overhydration.',
    isHighYield: true,
    panceRelevance: 5,
  },
  {
    labTestName: 'Hematocrit (Hct)',
    category: 'CBC',
    normalRangeLow: 37,
    normalRangeHigh: 47,
    units: '%',
    sex: 'female',
    ageGroup: 'adult',
    criticalLow: 20,
    criticalHigh: 60,
    clinicalNotes:
      'Lower in women due to menstruation. Falls in pregnancy due to plasma expansion.',
    isHighYield: true,
    panceRelevance: 5,
  },

  // Platelets
  {
    labTestName: 'Platelet Count',
    category: 'CBC',
    normalRangeLow: 150,
    normalRangeHigh: 400,
    units: 'x10³/µL',
    siUnits: 'x10⁹/L',
    siRangeLow: 150,
    siRangeHigh: 400,
    conversionFactor: 1,
    sex: 'all',
    ageGroup: 'adult',
    criticalLow: 50,
    criticalHigh: 1000,
    clinicalNotes: '<50 increased bleeding risk. <20 spontaneous bleeding. >1000 thrombotic risk.',
    commonCauses: [
      'ITP (low)',
      'TTP/HUS (low)',
      'Sepsis (low)',
      'Splenomegaly (low)',
      'Reactive thrombocytosis (high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // MCV
  {
    labTestName: 'Mean Corpuscular Volume (MCV)',
    category: 'CBC',
    normalRangeLow: 80,
    normalRangeHigh: 100,
    units: 'fL',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      '<80 microcytic (iron def, thalassemia). >100 macrocytic (B12, folate, alcohol, liver disease).',
    commonCauses: [
      'Iron deficiency (low)',
      'Thalassemia (low)',
      'B12/folate deficiency (high)',
      'Alcoholism (high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // MCH
  {
    labTestName: 'Mean Corpuscular Hemoglobin (MCH)',
    category: 'CBC',
    normalRangeLow: 27,
    normalRangeHigh: 33,
    units: 'pg',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes: 'Low in hypochromic anemias (iron deficiency). Parallels MCV trends.',
    isHighYield: false,
    panceRelevance: 3,
  },

  // MCHC
  {
    labTestName: 'Mean Corpuscular Hemoglobin Concentration (MCHC)',
    category: 'CBC',
    normalRangeLow: 32,
    normalRangeHigh: 36,
    units: 'g/dL',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes: 'Low in hypochromic anemias. High in spherocytosis (cells are densely packed).',
    commonCauses: ['Iron deficiency (low)', 'Hereditary spherocytosis (high)'],
    isHighYield: false,
    panceRelevance: 3,
  },

  // RDW
  {
    labTestName: 'Red Cell Distribution Width (RDW)',
    category: 'CBC',
    normalRangeLow: 11.5,
    normalRangeHigh: 14.5,
    units: '%',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Elevated RDW = anisocytosis. High in iron deficiency (vs thalassemia which has normal RDW).',
    commonCauses: ['Iron deficiency (high)', 'Mixed deficiency (high)', 'Reticulocytosis (high)'],
    isHighYield: true,
    panceRelevance: 4,
  },
];

// =============================================================================
// BASIC METABOLIC PANEL (BMP)
// =============================================================================
const bmpValues: NormalLabValueSeed[] = [
  // Sodium
  {
    labTestName: 'Sodium (Na)',
    category: 'BMP',
    normalRangeLow: 136,
    normalRangeHigh: 145,
    units: 'mEq/L',
    siUnits: 'mmol/L',
    siRangeLow: 136,
    siRangeHigh: 145,
    conversionFactor: 1,
    sex: 'all',
    ageGroup: 'adult',
    criticalLow: 120,
    criticalHigh: 160,
    clinicalNotes:
      '<120 or >160 can cause seizures, coma. Correct slowly to avoid osmotic demyelination.',
    commonCauses: [
      'SIADH (low)',
      'Diuretics (low)',
      'Dehydration (high)',
      'DI (high)',
      'Hyperaldosteronism (high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Potassium
  {
    labTestName: 'Potassium (K)',
    category: 'BMP',
    normalRangeLow: 3.5,
    normalRangeHigh: 5.0,
    units: 'mEq/L',
    siUnits: 'mmol/L',
    siRangeLow: 3.5,
    siRangeHigh: 5.0,
    conversionFactor: 1,
    sex: 'all',
    ageGroup: 'adult',
    criticalLow: 2.5,
    criticalHigh: 6.5,
    clinicalNotes:
      'Cardiac arrhythmias at extremes. ECG changes: hypo (U waves, flat T) vs hyper (peaked T, wide QRS).',
    commonCauses: [
      'Diuretics (low)',
      'Vomiting/diarrhea (low)',
      'Renal failure (high)',
      'ACE-I/ARB (high)',
      'Hemolysis (falsely high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Chloride
  {
    labTestName: 'Chloride (Cl)',
    category: 'BMP',
    normalRangeLow: 98,
    normalRangeHigh: 106,
    units: 'mEq/L',
    siUnits: 'mmol/L',
    siRangeLow: 98,
    siRangeHigh: 106,
    conversionFactor: 1,
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Usually follows sodium. Low in vomiting (loss of HCl). Use for anion gap calculation.',
    isHighYield: false,
    panceRelevance: 3,
  },

  // CO2/Bicarbonate
  {
    labTestName: 'Carbon Dioxide (CO2/HCO3)',
    category: 'BMP',
    normalRangeLow: 22,
    normalRangeHigh: 28,
    units: 'mEq/L',
    siUnits: 'mmol/L',
    siRangeLow: 22,
    siRangeHigh: 28,
    conversionFactor: 1,
    sex: 'all',
    ageGroup: 'adult',
    criticalLow: 10,
    criticalHigh: 40,
    clinicalNotes:
      'Low in metabolic acidosis. High in metabolic alkalosis or respiratory compensation.',
    commonCauses: [
      'DKA (low)',
      'Lactic acidosis (low)',
      'Renal tubular acidosis (low)',
      'Vomiting (high)',
      'Diuretics (high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // BUN
  {
    labTestName: 'Blood Urea Nitrogen (BUN)',
    category: 'BMP',
    normalRangeLow: 7,
    normalRangeHigh: 20,
    units: 'mg/dL',
    siUnits: 'mmol/L',
    siRangeLow: 2.5,
    siRangeHigh: 7.1,
    conversionFactor: 0.357,
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'BUN:Cr >20:1 suggests prerenal azotemia or GI bleed. Affected by protein intake, catabolism.',
    commonCauses: [
      'Prerenal azotemia (high)',
      'GI bleed (high)',
      'High protein diet (high)',
      'Liver failure (low)',
      'Malnutrition (low)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Creatinine - varies by sex
  {
    labTestName: 'Creatinine (Cr)',
    category: 'BMP',
    normalRangeLow: 0.7,
    normalRangeHigh: 1.3,
    units: 'mg/dL',
    siUnits: 'µmol/L',
    siRangeLow: 62,
    siRangeHigh: 115,
    conversionFactor: 88.4,
    sex: 'male',
    ageGroup: 'adult',
    criticalHigh: 10.0,
    clinicalNotes:
      'Reflects muscle mass and GFR. Not elevated until 50% nephron loss. Use for eGFR calculation.',
    commonCauses: ['AKI (high)', 'CKD (high)', 'Rhabdomyolysis (high)', 'Low muscle mass (low)'],
    isHighYield: true,
    panceRelevance: 5,
  },
  {
    labTestName: 'Creatinine (Cr)',
    category: 'BMP',
    normalRangeLow: 0.6,
    normalRangeHigh: 1.1,
    units: 'mg/dL',
    siUnits: 'µmol/L',
    siRangeLow: 53,
    siRangeHigh: 97,
    conversionFactor: 88.4,
    sex: 'female',
    ageGroup: 'adult',
    criticalHigh: 10.0,
    clinicalNotes: 'Lower in women due to less muscle mass.',
    isHighYield: true,
    panceRelevance: 5,
  },

  // Glucose (fasting)
  {
    labTestName: 'Glucose (Fasting)',
    category: 'BMP',
    normalRangeLow: 70,
    normalRangeHigh: 99,
    units: 'mg/dL',
    siUnits: 'mmol/L',
    siRangeLow: 3.9,
    siRangeHigh: 5.5,
    conversionFactor: 0.0555,
    sex: 'all',
    ageGroup: 'adult',
    criticalLow: 40,
    criticalHigh: 400,
    clinicalNotes:
      'Prediabetes 100-125. Diabetes ≥126 (fasting) or ≥200 (random with symptoms). <70 hypoglycemia.',
    commonCauses: [
      'Diabetes (high)',
      'Stress/illness (high)',
      'Insulinoma (low)',
      'Adrenal insufficiency (low)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Calcium
  {
    labTestName: 'Calcium (Total)',
    category: 'BMP',
    normalRangeLow: 8.5,
    normalRangeHigh: 10.5,
    units: 'mg/dL',
    siUnits: 'mmol/L',
    siRangeLow: 2.12,
    siRangeHigh: 2.62,
    conversionFactor: 0.25,
    sex: 'all',
    ageGroup: 'adult',
    criticalLow: 6.0,
    criticalHigh: 14.0,
    clinicalNotes:
      'Correct for albumin: add 0.8 for each 1g/dL albumin below 4. Hypercalcemia: stones, bones, groans, moans.',
    commonCauses: [
      'Hyperparathyroidism (high)',
      'Malignancy (high)',
      'Vitamin D deficiency (low)',
      'Hypoparathyroidism (low)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },
];

// =============================================================================
// LIVER FUNCTION TESTS (LFT)
// =============================================================================
const lftValues: NormalLabValueSeed[] = [
  // AST
  {
    labTestName: 'Aspartate Aminotransferase (AST)',
    category: 'LFT',
    normalRangeLow: 10,
    normalRangeHigh: 40,
    units: 'U/L',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes: 'Also found in heart, muscle. AST:ALT >2:1 suggests alcoholic liver disease.',
    commonCauses: [
      'Hepatitis (high)',
      'Alcoholic liver disease (high)',
      'MI (high)',
      'Rhabdomyolysis (high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // ALT
  {
    labTestName: 'Alanine Aminotransferase (ALT)',
    category: 'LFT',
    normalRangeLow: 7,
    normalRangeHigh: 56,
    units: 'U/L',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes: 'More specific for liver than AST. ALT > AST in viral hepatitis, NAFLD.',
    commonCauses: ['Viral hepatitis (high)', 'NAFLD (high)', 'Drug-induced liver injury (high)'],
    isHighYield: true,
    panceRelevance: 5,
  },

  // ALP
  {
    labTestName: 'Alkaline Phosphatase (ALP)',
    category: 'LFT',
    normalRangeLow: 44,
    normalRangeHigh: 147,
    units: 'U/L',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Elevated in cholestasis, bone disease. Check GGT to differentiate liver vs bone source.',
    commonCauses: [
      'Cholestasis (high)',
      'Bone metastases (high)',
      'Paget disease (high)',
      'Pregnancy (high)',
    ],
    isHighYield: true,
    panceRelevance: 4,
  },

  // GGT
  {
    labTestName: 'Gamma-Glutamyl Transferase (GGT)',
    category: 'LFT',
    normalRangeLow: 0,
    normalRangeHigh: 51,
    units: 'U/L',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Elevated GGT + elevated ALP confirms hepatobiliary source. Very sensitive to alcohol.',
    commonCauses: ['Alcohol use (high)', 'Cholestasis (high)', 'Medications (high)'],
    isHighYield: true,
    panceRelevance: 4,
  },

  // Total Bilirubin
  {
    labTestName: 'Bilirubin (Total)',
    category: 'LFT',
    normalRangeLow: 0.1,
    normalRangeHigh: 1.2,
    units: 'mg/dL',
    siUnits: 'µmol/L',
    siRangeLow: 1.7,
    siRangeHigh: 20.5,
    conversionFactor: 17.1,
    sex: 'all',
    ageGroup: 'adult',
    criticalHigh: 15.0,
    clinicalNotes:
      'Jaundice visible at >2.5. Unconjugated (indirect) vs conjugated (direct) helps localize cause.',
    commonCauses: [
      'Hemolysis (unconjugated)',
      'Gilbert syndrome (unconjugated)',
      'Hepatitis (both)',
      'Obstruction (conjugated)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Direct Bilirubin
  {
    labTestName: 'Bilirubin (Direct/Conjugated)',
    category: 'LFT',
    normalRangeLow: 0,
    normalRangeHigh: 0.3,
    units: 'mg/dL',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Elevated in hepatocellular disease and cholestasis. Water-soluble, excreted in urine.',
    isHighYield: true,
    panceRelevance: 4,
  },

  // Albumin
  {
    labTestName: 'Albumin',
    category: 'LFT',
    normalRangeLow: 3.5,
    normalRangeHigh: 5.0,
    units: 'g/dL',
    siUnits: 'g/L',
    siRangeLow: 35,
    siRangeHigh: 50,
    conversionFactor: 10,
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Marker of synthetic function. Low in chronic liver disease, nephrotic syndrome, malnutrition.',
    commonCauses: [
      'Cirrhosis (low)',
      'Nephrotic syndrome (low)',
      'Malnutrition (low)',
      'Inflammation (low)',
    ],
    isHighYield: true,
    panceRelevance: 4,
  },

  // Total Protein
  {
    labTestName: 'Total Protein',
    category: 'LFT',
    normalRangeLow: 6.0,
    normalRangeHigh: 8.3,
    units: 'g/dL',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Albumin + globulins. Low in liver disease, malnutrition. High in multiple myeloma, chronic infection.',
    isHighYield: false,
    panceRelevance: 3,
  },
];

// =============================================================================
// COAGULATION STUDIES
// =============================================================================
const coagValues: NormalLabValueSeed[] = [
  // PT
  {
    labTestName: 'Prothrombin Time (PT)',
    category: 'Coagulation',
    normalRangeLow: 11,
    normalRangeHigh: 13.5,
    units: 'seconds',
    sex: 'all',
    ageGroup: 'adult',
    criticalHigh: 30,
    clinicalNotes:
      'Tests extrinsic pathway (VII) and common pathway. Prolonged by warfarin, liver disease, vitamin K deficiency.',
    commonCauses: [
      'Warfarin (prolonged)',
      'Liver disease (prolonged)',
      'Vitamin K deficiency (prolonged)',
      'DIC (prolonged)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // INR
  {
    labTestName: 'International Normalized Ratio (INR)',
    category: 'Coagulation',
    normalRangeLow: 0.8,
    normalRangeHigh: 1.1,
    units: 'ratio',
    sex: 'all',
    ageGroup: 'adult',
    criticalHigh: 5.0,
    clinicalNotes:
      'Warfarin target 2-3 for most indications. >4.5 high bleed risk. Used for warfarin monitoring.',
    isHighYield: true,
    panceRelevance: 5,
  },

  // PTT/aPTT
  {
    labTestName: 'Partial Thromboplastin Time (PTT/aPTT)',
    category: 'Coagulation',
    normalRangeLow: 25,
    normalRangeHigh: 35,
    units: 'seconds',
    sex: 'all',
    ageGroup: 'adult',
    criticalHigh: 100,
    clinicalNotes:
      'Tests intrinsic pathway (VIII, IX, XI, XII) and common. Prolonged by heparin, hemophilia, lupus anticoagulant.',
    commonCauses: [
      'Heparin (prolonged)',
      'Hemophilia A/B (prolonged)',
      'von Willebrand disease (prolonged)',
      'Lupus anticoagulant (prolonged)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Fibrinogen
  {
    labTestName: 'Fibrinogen',
    category: 'Coagulation',
    normalRangeLow: 200,
    normalRangeHigh: 400,
    units: 'mg/dL',
    sex: 'all',
    ageGroup: 'adult',
    criticalLow: 100,
    clinicalNotes:
      'Acute phase reactant (elevated in inflammation). Low in DIC, liver failure. Critical for hemostasis.',
    commonCauses: ['DIC (low)', 'Liver failure (low)', 'Inflammation (high)', 'Pregnancy (high)'],
    isHighYield: true,
    panceRelevance: 4,
  },

  // D-dimer
  {
    labTestName: 'D-dimer',
    category: 'Coagulation',
    normalRangeLow: 0,
    normalRangeHigh: 0.5,
    units: 'µg/mL FEU',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'High sensitivity, low specificity for VTE. Negative D-dimer rules out PE/DVT in low probability patients.',
    commonCauses: [
      'PE/DVT (high)',
      'DIC (high)',
      'Surgery/trauma (high)',
      'Pregnancy (high)',
      'Malignancy (high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },
];

// =============================================================================
// LIPID PANEL
// =============================================================================
const lipidValues: NormalLabValueSeed[] = [
  // Total Cholesterol
  {
    labTestName: 'Total Cholesterol',
    category: 'Lipid Panel',
    normalRangeLow: 0,
    normalRangeHigh: 200,
    units: 'mg/dL',
    siUnits: 'mmol/L',
    siRangeLow: 0,
    siRangeHigh: 5.2,
    conversionFactor: 0.0259,
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes: 'Desirable <200. Borderline 200-239. High ≥240. Part of ASCVD risk calculation.',
    isHighYield: true,
    panceRelevance: 4,
  },

  // LDL Cholesterol
  {
    labTestName: 'LDL Cholesterol',
    category: 'Lipid Panel',
    normalRangeLow: 0,
    normalRangeHigh: 100,
    units: 'mg/dL',
    siUnits: 'mmol/L',
    siRangeLow: 0,
    siRangeHigh: 2.6,
    conversionFactor: 0.0259,
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Primary target for statin therapy. Optimal <100. Very high risk patients target <70.',
    isHighYield: true,
    panceRelevance: 5,
  },

  // HDL Cholesterol
  {
    labTestName: 'HDL Cholesterol',
    category: 'Lipid Panel',
    normalRangeLow: 40,
    normalRangeHigh: 999,
    units: 'mg/dL',
    siUnits: 'mmol/L',
    siRangeLow: 1.0,
    siRangeHigh: 999,
    conversionFactor: 0.0259,
    sex: 'male',
    ageGroup: 'adult',
    clinicalNotes:
      'Protective. Men: low <40. Higher is better. Exercise and moderate alcohol increase HDL.',
    isHighYield: true,
    panceRelevance: 4,
  },
  {
    labTestName: 'HDL Cholesterol',
    category: 'Lipid Panel',
    normalRangeLow: 50,
    normalRangeHigh: 999,
    units: 'mg/dL',
    sex: 'female',
    ageGroup: 'adult',
    clinicalNotes:
      'Protective. Women: low <50. Estrogen contributes to higher HDL in premenopausal women.',
    isHighYield: true,
    panceRelevance: 4,
  },

  // Triglycerides
  {
    labTestName: 'Triglycerides',
    category: 'Lipid Panel',
    normalRangeLow: 0,
    normalRangeHigh: 150,
    units: 'mg/dL',
    siUnits: 'mmol/L',
    siRangeLow: 0,
    siRangeHigh: 1.7,
    conversionFactor: 0.0113,
    sex: 'all',
    ageGroup: 'adult',
    criticalHigh: 500,
    clinicalNotes:
      'Fasting preferred. >500 pancreatitis risk. >1000 very high risk. Associated with metabolic syndrome.',
    commonCauses: [
      'Metabolic syndrome (high)',
      'Alcohol (high)',
      'Diabetes (high)',
      'Obesity (high)',
      'Hypothyroidism (high)',
    ],
    isHighYield: true,
    panceRelevance: 4,
  },
];

// =============================================================================
// THYROID PANEL
// =============================================================================
const thyroidValues: NormalLabValueSeed[] = [
  // TSH
  {
    labTestName: 'Thyroid Stimulating Hormone (TSH)',
    category: 'Thyroid',
    normalRangeLow: 0.4,
    normalRangeHigh: 4.0,
    units: 'mIU/L',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Best screening test. Low TSH = hyperthyroid. High TSH = hypothyroid. Inverse relationship with T4.',
    commonCauses: [
      'Graves disease (low)',
      'Toxic nodule (low)',
      'Hashimoto thyroiditis (high)',
      'Primary hypothyroidism (high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Free T4
  {
    labTestName: 'Free T4 (Thyroxine)',
    category: 'Thyroid',
    normalRangeLow: 0.9,
    normalRangeHigh: 1.7,
    units: 'ng/dL',
    siUnits: 'pmol/L',
    siRangeLow: 12,
    siRangeHigh: 22,
    conversionFactor: 12.87,
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Free T4 not affected by protein binding (unlike total T4). Confirms hyper/hypothyroidism.',
    isHighYield: true,
    panceRelevance: 5,
  },

  // Free T3
  {
    labTestName: 'Free T3 (Triiodothyronine)',
    category: 'Thyroid',
    normalRangeLow: 2.0,
    normalRangeHigh: 4.4,
    units: 'pg/mL',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'More metabolically active than T4. Useful in T3 toxicosis (elevated T3 with normal T4).',
    isHighYield: false,
    panceRelevance: 3,
  },
];

// =============================================================================
// CARDIAC MARKERS
// =============================================================================
const cardiacValues: NormalLabValueSeed[] = [
  // Troponin I
  {
    labTestName: 'Troponin I',
    category: 'Cardiac Markers',
    normalRangeLow: 0,
    normalRangeHigh: 0.04,
    units: 'ng/mL',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Gold standard for MI. Rises 3-6 hrs, peaks 12-24 hrs. Also elevated in PE, myocarditis, renal failure.',
    commonCauses: [
      'MI (high)',
      'PE (high)',
      'Myocarditis (high)',
      'Heart failure (high)',
      'Renal failure (high)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Troponin T (high-sensitivity)
  {
    labTestName: 'High-Sensitivity Troponin T',
    category: 'Cardiac Markers',
    normalRangeLow: 0,
    normalRangeHigh: 14,
    units: 'ng/L',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes: 'More sensitive than conventional troponin. Sex-specific cutoffs may apply.',
    isHighYield: true,
    panceRelevance: 5,
  },

  // BNP
  {
    labTestName: 'B-type Natriuretic Peptide (BNP)',
    category: 'Cardiac Markers',
    normalRangeLow: 0,
    normalRangeHigh: 100,
    units: 'pg/mL',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Released by stretched ventricles. <100 essentially rules out HF. >400 highly suggestive of HF.',
    commonCauses: [
      'Heart failure (high)',
      'Renal failure (high)',
      'PE (high)',
      'Obesity (low/falsely normal)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // NT-proBNP
  {
    labTestName: 'NT-proBNP',
    category: 'Cardiac Markers',
    normalRangeLow: 0,
    normalRangeHigh: 125,
    units: 'pg/mL',
    sex: 'all',
    ageGroup: 'adult',
    ageRangeLow: 18,
    ageRangeHigh: 74,
    clinicalNotes: 'Longer half-life than BNP. Age-dependent cutoffs. <300 rules out acute HF.',
    isHighYield: true,
    panceRelevance: 4,
  },
  {
    labTestName: 'NT-proBNP',
    category: 'Cardiac Markers',
    normalRangeLow: 0,
    normalRangeHigh: 450,
    units: 'pg/mL',
    sex: 'all',
    ageGroup: 'elderly',
    ageRangeLow: 75,
    ageRangeHigh: 120,
    clinicalNotes: 'Higher cutoff in elderly due to age-related cardiac changes.',
    isHighYield: true,
    panceRelevance: 4,
  },
];

// =============================================================================
// URINALYSIS
// =============================================================================
const urinalysisValues: NormalLabValueSeed[] = [
  // pH
  {
    labTestName: 'Urine pH',
    category: 'Urinalysis',
    normalRangeLow: 4.5,
    normalRangeHigh: 8.0,
    units: 'pH units',
    normalRangeText: '4.5-8.0 (typically 5.5-6.5)',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Alkaline in UTI with urease-producing organisms. Acidic in metabolic acidosis, high protein diet.',
    isHighYield: false,
    panceRelevance: 3,
  },

  // Specific Gravity
  {
    labTestName: 'Urine Specific Gravity',
    category: 'Urinalysis',
    normalRangeLow: 1.005,
    normalRangeHigh: 1.03,
    units: 'ratio',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Reflects concentrating ability. Fixed at 1.010 in renal failure. Low in DI, high in dehydration.',
    isHighYield: true,
    panceRelevance: 4,
  },

  // Protein
  {
    labTestName: 'Urine Protein',
    category: 'Urinalysis',
    normalRangeText: 'Negative/Trace',
    units: 'qualitative',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Dipstick detects albumin. Positive suggests glomerular disease. Confirm with 24hr urine or spot UPCR.',
    commonCauses: [
      'Glomerulonephritis (positive)',
      'Nephrotic syndrome (positive)',
      'Diabetes nephropathy (positive)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Glucose
  {
    labTestName: 'Urine Glucose',
    category: 'Urinalysis',
    normalRangeText: 'Negative',
    units: 'qualitative',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Positive when serum glucose >180 (exceeds renal threshold). Seen in uncontrolled diabetes.',
    isHighYield: true,
    panceRelevance: 4,
  },

  // Ketones
  {
    labTestName: 'Urine Ketones',
    category: 'Urinalysis',
    normalRangeText: 'Negative',
    units: 'qualitative',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes: 'Positive in DKA, starvation, low-carb diets, alcoholic ketoacidosis.',
    commonCauses: ['DKA (positive)', 'Starvation (positive)', 'Alcoholic ketoacidosis (positive)'],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Blood
  {
    labTestName: 'Urine Blood/Hemoglobin',
    category: 'Urinalysis',
    normalRangeText: 'Negative',
    units: 'qualitative',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Positive with RBCs (hematuria), free hemoglobin (hemolysis), or myoglobin (rhabdomyolysis).',
    commonCauses: [
      'UTI (positive)',
      'Stones (positive)',
      'Glomerulonephritis (positive)',
      'Malignancy (positive)',
    ],
    isHighYield: true,
    panceRelevance: 5,
  },

  // Leukocyte Esterase
  {
    labTestName: 'Leukocyte Esterase',
    category: 'Urinalysis',
    normalRangeText: 'Negative',
    units: 'qualitative',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      'Marker of WBCs. Positive suggests UTI. Combined with nitrites increases UTI probability.',
    isHighYield: true,
    panceRelevance: 5,
  },

  // Nitrites
  {
    labTestName: 'Urine Nitrites',
    category: 'Urinalysis',
    normalRangeText: 'Negative',
    units: 'qualitative',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      "Produced by gram-negative bacteria. Positive = high specificity for UTI. Negative doesn't rule out.",
    isHighYield: true,
    panceRelevance: 5,
  },

  // WBC (microscopic)
  {
    labTestName: 'Urine WBC (Microscopic)',
    category: 'Urinalysis',
    normalRangeLow: 0,
    normalRangeHigh: 5,
    units: 'per HPF',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      '>5 WBCs/HPF = pyuria. Seen in UTI, interstitial nephritis, STI. Sterile pyuria in TB.',
    isHighYield: true,
    panceRelevance: 4,
  },

  // RBC (microscopic)
  {
    labTestName: 'Urine RBC (Microscopic)',
    category: 'Urinalysis',
    normalRangeLow: 0,
    normalRangeHigh: 3,
    units: 'per HPF',
    sex: 'all',
    ageGroup: 'adult',
    clinicalNotes:
      '>3 RBCs/HPF = microscopic hematuria. Dysmorphic RBCs suggest glomerular source.',
    isHighYield: true,
    panceRelevance: 4,
  },
];

// =============================================================================
// MAIN SEEDING FUNCTION
// =============================================================================
async function seedNormalLabValues(): Promise<void> {
  console.log('🧪 Starting Normal Lab Values Seeding...\n');

  const allValues: NormalLabValueSeed[] = [
    ...cbcValues,
    ...bmpValues,
    ...lftValues,
    ...coagValues,
    ...lipidValues,
    ...thyroidValues,
    ...cardiacValues,
    ...urinalysisValues,
  ];

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const value of allValues) {
    try {
      // Try to find existing by unique constraint
      const existing = await prisma.normalLabValue.findFirst({
        where: {
          labTestName: value.labTestName,
          sex: value.sex || null,
          ageGroup: value.ageGroup || null,
        },
      });

      const data = {
        labTestName: value.labTestName,
        category: value.category,
        normalRangeLow: value.normalRangeLow,
        normalRangeHigh: value.normalRangeHigh,
        normalRangeText: value.normalRangeText,
        units: value.units,
        siUnits: value.siUnits,
        siRangeLow: value.siRangeLow,
        siRangeHigh: value.siRangeHigh,
        conversionFactor: value.conversionFactor,
        sex: value.sex,
        ageGroup: value.ageGroup,
        ageRangeLow: value.ageRangeLow,
        ageRangeHigh: value.ageRangeHigh,
        criticalLow: value.criticalLow,
        criticalHigh: value.criticalHigh,
        clinicalNotes: value.clinicalNotes,
        commonCauses: value.commonCauses || [],
        source: value.source,
        isHighYield: value.isHighYield || false,
        panceRelevance: value.panceRelevance,
      };

      if (existing) {
        await prisma.normalLabValue.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await prisma.normalLabValue.create({ data });
        created++;
      }

      console.log(`  ✅ ${value.labTestName} (${value.sex || 'all'}, ${value.ageGroup || 'all'})`);
    } catch (error) {
      errors++;
      console.error(`  ❌ Error seeding ${value.labTestName}:`, error);
    }
  }

  console.log('\n📊 Seeding Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${allValues.length}`);
}

// =============================================================================
// RUN
// =============================================================================
async function main(): Promise<void> {
  try {
    await seedNormalLabValues();

    // Print category summary
    const categories = await prisma.normalLabValue.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    console.log('\n📋 Values by Category:');
    for (const cat of categories) {
      console.log(`   ${cat.category}: ${cat._count.id}`);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
