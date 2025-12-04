import { useState, useCallback, useMemo, useRef } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents a single lab value with reference range
 */
export interface LabValue {
  /** Name of the lab test */
  name: string;
  /** Patient's value */
  value: string;
  /** Unit of measurement */
  unit: string;
  /** Normal reference range */
  referenceRange: string;
  /** Whether this value is abnormal */
  isAbnormal: boolean;
  /** Whether this is a critical value */
  isCritical?: boolean;
  /** Whether value is high or low (for styling) */
  abnormalDirection?: 'high' | 'low';
}

/**
 * Represents a lab panel (group of related tests)
 */
export interface LabPanel {
  /** Panel name (e.g., "Complete Blood Count", "Metabolic Panel") */
  name: string;
  /** Array of lab values in this panel */
  values: LabValue[];
}

/**
 * Represents a complete lab case for diagnosis
 */
export interface LabCase {
  /** Unique identifier */
  id: string;
  /** Brief clinical context */
  clinicalContext: string;
  /** Patient age */
  patientAge: number;
  /** Patient sex */
  patientSex: 'M' | 'F';
  /** Array of lab panels */
  panels: LabPanel[];
  /** The correct diagnosis */
  correctDiagnosis: string;
  /** Key abnormalities explanation */
  keyFindings: string[];
  /** Educational explanation */
  explanation: string;
  /** Category for filtering */
  category: LabCategory;
  /** Optional: Additional orderable tests that can be revealed */
  orderableTests?: LabPanel[];
  /** Optional: Tests that have been ordered by the user */
  orderedTests?: string[];
}

/**
 * Lab case categories
 */
export type LabCategory = 
  | 'hematology'
  | 'metabolic'
  | 'endocrine'
  | 'renal'
  | 'hepatic'
  | 'cardiac'
  | 'random';

/**
 * Game status states
 */
export type MiniLabGameStatus = 'landing' | 'menu' | 'playing' | 'feedback' | 'summary';

// ============================================================================
// MASTER DIAGNOSIS LIST FOR MINI LAB MODE
// ============================================================================

export const MINI_LAB_DIAGNOSES: string[] = [
  // Hematology
  'Iron Deficiency Anemia',
  'Vitamin B12 Deficiency',
  'Folate Deficiency',
  'Hemolytic Anemia',
  'Sickle Cell Crisis',
  'Thalassemia',
  'Polycythemia Vera',
  'Thrombocytopenia',
  'Leukemia',
  'Aplastic Anemia',
  // Metabolic
  'Diabetic Ketoacidosis',
  'Hyperosmolar Hyperglycemic State',
  'Hypoglycemia',
  'Metabolic Acidosis',
  'Metabolic Alkalosis',
  'Respiratory Acidosis',
  'Respiratory Alkalosis',
  // Endocrine
  'Hypothyroidism',
  'Hyperthyroidism',
  'Addison Disease',
  'Cushing Syndrome',
  'Hyperparathyroidism',
  'Hypoparathyroidism',
  'SIADH',
  'Diabetes Insipidus',
  // Renal
  'Acute Kidney Injury',
  'Chronic Kidney Disease',
  'Nephrotic Syndrome',
  'Glomerulonephritis',
  'Hyperkalemia',
  'Hypokalemia',
  'Hypernatremia',
  'Hyponatremia',
  // Hepatic
  'Acute Hepatitis',
  'Cirrhosis',
  'Cholestatic Liver Disease',
  'Alcoholic Liver Disease',
  'Drug-Induced Liver Injury',
  // Cardiac
  'Myocardial Infarction',
  'Heart Failure',
  'Pulmonary Embolism',
];

// ============================================================================
// LAB CASE DATABASE
// ============================================================================

const LAB_CASES: LabCase[] = [
  {
    id: 'lab-dka-001',
    clinicalContext: 'A 28-year-old with Type 1 diabetes presents with nausea, vomiting, and abdominal pain. Patient reports missing insulin doses.',
    patientAge: 28,
    patientSex: 'F',
    panels: [
      {
        name: 'Basic Metabolic Panel',
        values: [
          { name: 'Glucose', value: '485', unit: 'mg/dL', referenceRange: '70-100', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
          { name: 'Sodium', value: '128', unit: 'mEq/L', referenceRange: '136-145', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'Potassium', value: '5.8', unit: 'mEq/L', referenceRange: '3.5-5.0', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Chloride', value: '92', unit: 'mEq/L', referenceRange: '98-106', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'CO2', value: '12', unit: 'mEq/L', referenceRange: '22-28', isAbnormal: true, isCritical: true, abnormalDirection: 'low' },
          { name: 'BUN', value: '32', unit: 'mg/dL', referenceRange: '7-20', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Creatinine', value: '1.4', unit: 'mg/dL', referenceRange: '0.7-1.3', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
      {
        name: 'Complete Blood Count',
        values: [
          { name: 'WBC', value: '14.2', unit: 'k/μL', referenceRange: '4.5-11.0', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Hemoglobin', value: '15.1', unit: 'g/dL', referenceRange: '12.0-16.0', isAbnormal: false },
          { name: 'Hematocrit', value: '45.3', unit: '%', referenceRange: '36-46', isAbnormal: false },
          { name: 'Platelets', value: '285', unit: 'k/μL', referenceRange: '150-400', isAbnormal: false },
        ],
      },
      {
        name: 'Liver Function Tests',
        values: [
          { name: 'AST', value: '28', unit: 'U/L', referenceRange: '10-40', isAbnormal: false },
          { name: 'ALT', value: '32', unit: 'U/L', referenceRange: '7-56', isAbnormal: false },
          { name: 'Alkaline Phosphatase', value: '78', unit: 'U/L', referenceRange: '44-147', isAbnormal: false },
          { name: 'Total Bilirubin', value: '0.8', unit: 'mg/dL', referenceRange: '0.1-1.2', isAbnormal: false },
          { name: 'Albumin', value: '4.2', unit: 'g/dL', referenceRange: '3.5-5.0', isAbnormal: false },
        ],
      },
    ],
    orderableTests: [
      {
        name: 'Arterial Blood Gas',
        values: [
          { name: 'pH', value: '7.18', unit: '', referenceRange: '7.35-7.45', isAbnormal: true, isCritical: true, abnormalDirection: 'low' },
          { name: 'pCO2', value: '22', unit: 'mmHg', referenceRange: '35-45', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'HCO3', value: '8', unit: 'mEq/L', referenceRange: '22-26', isAbnormal: true, isCritical: true, abnormalDirection: 'low' },
        ],
      },
      {
        name: 'Ketones',
        values: [
          { name: 'Beta-hydroxybutyrate', value: '5.2', unit: 'mmol/L', referenceRange: '<0.6', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
          { name: 'Anion Gap', value: '24', unit: 'mEq/L', referenceRange: '8-12', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
        ],
      },
      {
        name: 'Urinalysis',
        values: [
          { name: 'Ketones in Urine', value: 'Large', unit: '', referenceRange: 'Negative', isAbnormal: true },
          { name: 'Glucose in Urine', value: '1000', unit: 'mg/dL', referenceRange: 'Negative', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
    ],
    correctDiagnosis: 'Diabetic Ketoacidosis',
    keyFindings: [
      'Markedly elevated glucose (>250 mg/dL)',
      'High anion gap metabolic acidosis (AG=24)',
      'Elevated ketones (beta-hydroxybutyrate)',
      'pH <7.3 with low bicarbonate',
    ],
    explanation: 'This patient presents with classic DKA triad: hyperglycemia, ketosis, and metabolic acidosis. The elevated anion gap (24) reflects ketoacid accumulation. Initial hyperkalemia is common despite total body potassium depletion due to transcellular shift from acidosis.',
    category: 'metabolic',
  },
  {
    id: 'lab-ida-001',
    clinicalContext: 'A 35-year-old woman presents with fatigue, pallor, and shortness of breath on exertion. She reports heavy menstrual bleeding.',
    patientAge: 35,
    patientSex: 'F',
    panels: [
      {
        name: 'Complete Blood Count',
        values: [
          { name: 'Hemoglobin', value: '8.2', unit: 'g/dL', referenceRange: '12.0-16.0', isAbnormal: true, isCritical: true, abnormalDirection: 'low' },
          { name: 'Hematocrit', value: '26', unit: '%', referenceRange: '36-46', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'MCV', value: '68', unit: 'fL', referenceRange: '80-100', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'MCH', value: '24', unit: 'pg', referenceRange: '27-33', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'MCHC', value: '30', unit: 'g/dL', referenceRange: '32-36', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'RDW', value: '18.5', unit: '%', referenceRange: '11.5-14.5', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Platelets', value: '420', unit: 'K/uL', referenceRange: '150-400', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
      {
        name: 'Basic Metabolic Panel',
        values: [
          { name: 'Sodium', value: '140', unit: 'mEq/L', referenceRange: '136-145', isAbnormal: false },
          { name: 'Potassium', value: '4.2', unit: 'mEq/L', referenceRange: '3.5-5.0', isAbnormal: false },
          { name: 'Chloride', value: '102', unit: 'mEq/L', referenceRange: '98-106', isAbnormal: false },
          { name: 'Bicarbonate', value: '24', unit: 'mEq/L', referenceRange: '22-28', isAbnormal: false },
          { name: 'BUN', value: '15', unit: 'mg/dL', referenceRange: '7-20', isAbnormal: false },
          { name: 'Creatinine', value: '0.9', unit: 'mg/dL', referenceRange: '0.7-1.3', isAbnormal: false },
          { name: 'Glucose', value: '92', unit: 'mg/dL', referenceRange: '70-100', isAbnormal: false },
        ],
      },
      {
        name: 'Liver Function Tests',
        values: [
          { name: 'AST', value: '22', unit: 'U/L', referenceRange: '10-40', isAbnormal: false },
          { name: 'ALT', value: '18', unit: 'U/L', referenceRange: '7-56', isAbnormal: false },
          { name: 'Alkaline Phosphatase', value: '65', unit: 'U/L', referenceRange: '44-147', isAbnormal: false },
          { name: 'Total Bilirubin', value: '0.6', unit: 'mg/dL', referenceRange: '0.1-1.2', isAbnormal: false },
          { name: 'Albumin', value: '4.0', unit: 'g/dL', referenceRange: '3.5-5.0', isAbnormal: false },
        ],
      },
    ],
    orderableTests: [
      {
        name: 'Iron Studies',
        values: [
          { name: 'Serum Iron', value: '28', unit: 'µg/dL', referenceRange: '60-170', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'TIBC', value: '450', unit: 'µg/dL', referenceRange: '250-370', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Ferritin', value: '8', unit: 'ng/mL', referenceRange: '20-200', isAbnormal: true, isCritical: true, abnormalDirection: 'low' },
          { name: 'Transferrin Sat', value: '6', unit: '%', referenceRange: '20-50', isAbnormal: true, abnormalDirection: 'low' },
        ],
      },
      {
        name: 'Reticulocyte Count',
        values: [
          { name: 'Reticulocyte Count', value: '0.5', unit: '%', referenceRange: '0.5-1.5', isAbnormal: false },
        ],
      },
    ],
    correctDiagnosis: 'Iron Deficiency Anemia',
    keyFindings: [
      'Microcytic, hypochromic anemia (low MCV, MCH, MCHC)',
      'Elevated RDW (anisocytosis)',
      'Low ferritin (definitive for iron deficiency)',
      'Low serum iron with high TIBC',
      'Reactive thrombocytosis',
    ],
    explanation: 'Classic iron deficiency anemia pattern: microcytic, hypochromic RBCs with elevated RDW. Iron studies show the characteristic low iron, high TIBC, and depleted ferritin. Reactive thrombocytosis is common in chronic blood loss.',
    category: 'hematology',
  },
  {
    id: 'lab-hypo-001',
    clinicalContext: 'A 55-year-old woman presents with fatigue, weight gain, constipation, and cold intolerance. Physical exam reveals dry skin and delayed reflexes.',
    patientAge: 55,
    patientSex: 'F',
    panels: [
      {
        name: 'Thyroid Function Tests',
        values: [
          { name: 'TSH', value: '45.2', unit: 'mIU/L', referenceRange: '0.4-4.0', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
          { name: 'Free T4', value: '0.4', unit: 'ng/dL', referenceRange: '0.8-1.8', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'Free T3', value: '1.8', unit: 'pg/mL', referenceRange: '2.3-4.2', isAbnormal: true, abnormalDirection: 'low' },
        ],
      },
      {
        name: 'Metabolic Panel',
        values: [
          { name: 'Sodium', value: '132', unit: 'mEq/L', referenceRange: '136-145', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'Total Cholesterol', value: '285', unit: 'mg/dL', referenceRange: '<200', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'LDL', value: '175', unit: 'mg/dL', referenceRange: '<100', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
      {
        name: 'Complete Blood Count',
        values: [
          { name: 'Hemoglobin', value: '10.8', unit: 'g/dL', referenceRange: '12.0-16.0', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'MCV', value: '102', unit: 'fL', referenceRange: '80-100', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
    ],
    correctDiagnosis: 'Hypothyroidism',
    keyFindings: [
      'Markedly elevated TSH with low free T4',
      'Low free T3',
      'Hyponatremia (dilutional)',
      'Hyperlipidemia',
      'Macrocytic anemia',
    ],
    explanation: 'Primary hypothyroidism shows elevated TSH with low T4/T3. Associated findings include dilutional hyponatremia, hyperlipidemia (decreased LDL receptor expression), and macrocytic anemia (impaired erythropoiesis).',
    category: 'endocrine',
  },
  {
    id: 'lab-aki-001',
    clinicalContext: 'A 68-year-old man with diabetes and hypertension presents with decreased urine output after recently starting an NSAID for knee pain.',
    patientAge: 68,
    patientSex: 'M',
    panels: [
      {
        name: 'Renal Function Panel',
        values: [
          { name: 'BUN', value: '68', unit: 'mg/dL', referenceRange: '7-20', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
          { name: 'Creatinine', value: '4.8', unit: 'mg/dL', referenceRange: '0.7-1.3', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
          { name: 'BUN/Cr Ratio', value: '14', unit: '', referenceRange: '10-20', isAbnormal: false },
          { name: 'eGFR', value: '12', unit: 'mL/min/1.73m²', referenceRange: '>60', isAbnormal: true, isCritical: true, abnormalDirection: 'low' },
        ],
      },
      {
        name: 'Electrolytes',
        values: [
          { name: 'Potassium', value: '6.2', unit: 'mEq/L', referenceRange: '3.5-5.0', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
          { name: 'Phosphorus', value: '6.8', unit: 'mg/dL', referenceRange: '2.5-4.5', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Calcium', value: '7.8', unit: 'mg/dL', referenceRange: '8.5-10.5', isAbnormal: true, abnormalDirection: 'low' },
        ],
      },
      {
        name: 'Urinalysis',
        values: [
          { name: 'Specific Gravity', value: '1.012', unit: '', referenceRange: '1.005-1.030', isAbnormal: false },
          { name: 'FENa', value: '2.8', unit: '%', referenceRange: '<1', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Urine Sodium', value: '45', unit: 'mEq/L', referenceRange: '<20', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
    ],
    correctDiagnosis: 'Acute Kidney Injury',
    keyFindings: [
      'Acute rise in creatinine (baseline was 1.1)',
      'FENa >2% suggests intrinsic renal cause',
      'Hyperkalemia (dangerous)',
      'Hyperphosphatemia with hypocalcemia',
      'NSAID-induced likely etiology',
    ],
    explanation: 'This patient has intrinsic AKI (FENa >2%) likely from NSAID-induced acute tubular necrosis. NSAIDs inhibit prostaglandin-mediated afferent arteriole dilation, reducing renal blood flow. The hyperkalemia requires urgent management.',
    category: 'renal',
  },
  {
    id: 'lab-cirrhosis-001',
    clinicalContext: 'A 52-year-old man with history of alcohol use disorder presents with confusion, jaundice, and abdominal distension.',
    patientAge: 52,
    patientSex: 'M',
    panels: [
      {
        name: 'Liver Function Tests',
        values: [
          { name: 'AST', value: '156', unit: 'U/L', referenceRange: '10-40', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'ALT', value: '72', unit: 'U/L', referenceRange: '7-56', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'AST/ALT Ratio', value: '2.2', unit: '', referenceRange: '<1', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Alkaline Phosphatase', value: '185', unit: 'U/L', referenceRange: '44-147', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Total Bilirubin', value: '8.5', unit: 'mg/dL', referenceRange: '0.1-1.2', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
          { name: 'Direct Bilirubin', value: '5.2', unit: 'mg/dL', referenceRange: '0-0.3', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Albumin', value: '2.4', unit: 'g/dL', referenceRange: '3.5-5.0', isAbnormal: true, abnormalDirection: 'low' },
        ],
      },
      {
        name: 'Coagulation',
        values: [
          { name: 'PT', value: '22', unit: 'seconds', referenceRange: '11-13.5', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'INR', value: '2.1', unit: '', referenceRange: '0.8-1.1', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
        ],
      },
      {
        name: 'Complete Blood Count',
        values: [
          { name: 'Platelets', value: '68', unit: 'K/uL', referenceRange: '150-400', isAbnormal: true, isCritical: true, abnormalDirection: 'low' },
          { name: 'Hemoglobin', value: '9.8', unit: 'g/dL', referenceRange: '14.0-18.0', isAbnormal: true, abnormalDirection: 'low' },
          { name: 'MCV', value: '108', unit: 'fL', referenceRange: '80-100', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
      {
        name: 'Additional Labs',
        values: [
          { name: 'Ammonia', value: '125', unit: 'µmol/L', referenceRange: '15-45', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
        ],
      },
    ],
    correctDiagnosis: 'Cirrhosis',
    keyFindings: [
      'AST:ALT ratio >2:1 (classic for alcoholic liver disease)',
      'Synthetic dysfunction (low albumin, elevated INR)',
      'Conjugated hyperbilirubinemia',
      'Thrombocytopenia from portal hypertension',
      'Elevated ammonia with encephalopathy',
    ],
    explanation: 'Decompensated alcoholic cirrhosis with hepatic encephalopathy. Key features: AST:ALT >2 (alcohol), synthetic failure (low albumin, high INR), portal hypertension (thrombocytopenia), and hyperammonemia causing confusion.',
    category: 'hepatic',
  },
  {
    id: 'lab-mi-001',
    clinicalContext: 'A 62-year-old man with hypertension presents with crushing chest pain radiating to his left arm for the past 2 hours. ECG shows ST elevation in leads V1-V4.',
    patientAge: 62,
    patientSex: 'M',
    panels: [
      {
        name: 'Cardiac Biomarkers',
        values: [
          { name: 'Troponin I', value: '12.8', unit: 'ng/mL', referenceRange: '<0.04', isAbnormal: true, isCritical: true, abnormalDirection: 'high' },
          { name: 'CK-MB', value: '85', unit: 'ng/mL', referenceRange: '0-5', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'BNP', value: '520', unit: 'pg/mL', referenceRange: '<100', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
      {
        name: 'Basic Metabolic Panel',
        values: [
          { name: 'Glucose', value: '185', unit: 'mg/dL', referenceRange: '70-100', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'Potassium', value: '4.2', unit: 'mEq/L', referenceRange: '3.5-5.0', isAbnormal: false },
          { name: 'Creatinine', value: '1.1', unit: 'mg/dL', referenceRange: '0.7-1.3', isAbnormal: false },
        ],
      },
      {
        name: 'Lipid Panel',
        values: [
          { name: 'Total Cholesterol', value: '268', unit: 'mg/dL', referenceRange: '<200', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'LDL', value: '165', unit: 'mg/dL', referenceRange: '<100', isAbnormal: true, abnormalDirection: 'high' },
          { name: 'HDL', value: '32', unit: 'mg/dL', referenceRange: '>40', isAbnormal: true, abnormalDirection: 'low' },
        ],
      },
      {
        name: 'Complete Blood Count',
        values: [
          { name: 'WBC', value: '14.2', unit: 'K/uL', referenceRange: '4.5-11.0', isAbnormal: true, abnormalDirection: 'high' },
        ],
      },
    ],
    correctDiagnosis: 'Myocardial Infarction',
    keyFindings: [
      'Markedly elevated troponin (diagnostic)',
      'Elevated CK-MB',
      'Elevated BNP (myocardial stress)',
      'Stress hyperglycemia',
      'Leukocytosis (inflammatory response)',
      'Dyslipidemia (risk factor)',
    ],
    explanation: 'Acute STEMI with significantly elevated cardiac biomarkers. Troponin I is highly specific for myocardial injury. The elevated BNP suggests ventricular wall stress. Stress hyperglycemia and leukocytosis are common in acute MI.',
    category: 'cardiac',
  },
];

// ============================================================================
// CATEGORY-SPECIFIC CASE FILTERING
// ============================================================================

function getCasesByCategory(category: LabCategory): LabCase[] {
  if (category === 'random') {
    return LAB_CASES;
  }
  return LAB_CASES.filter(c => c.category === category);
}

function getDiagnosesByCategory(category: LabCategory): string[] {
  const cases = getCasesByCategory(category);
  return [...new Set(cases.map(c => c.correctDiagnosis))];
}

// ============================================================================
// RANDOM CASE GENERATOR
// ============================================================================

let labCaseCounter = 0;

/**
 * Random variation multipliers to make lab values feel different each time
 */
function applyVariation(value: string, direction: 'high' | 'low' | undefined): string {
  // Try to parse the value as a number
  const numMatch = value.match(/^([\d.]+)/);
  if (!numMatch) return value;
  
  const num = parseFloat(numMatch[1]);
  if (isNaN(num)) return value;
  
  // Apply a small random variation (±10%)
  const variation = 0.9 + Math.random() * 0.2;
  const newNum = Math.round(num * variation * 10) / 10;
  
  // Replace the number in the original string
  return value.replace(numMatch[1], newNum.toString());
}

/**
 * Randomize patient demographics
 */
function randomizePatient(originalAge: number, originalSex: 'M' | 'F'): { age: number; sex: 'M' | 'F' } {
  // Add some age variation
  const ageVariation = Math.floor(Math.random() * 10) - 5;
  const newAge = Math.max(18, Math.min(90, originalAge + ageVariation));
  
  return {
    age: newAge,
    sex: originalSex,
  };
}

function generateRandomLabCase(category: LabCategory, recentDiagnoses?: Set<string>): LabCase {
  const availableCases = getCasesByCategory(category);
  
  // Try to find a case with a diagnosis we haven't seen recently
  let attempts = 0;
  let randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
  
  if (recentDiagnoses && recentDiagnoses.size > 0) {
    while (recentDiagnoses.has(randomCase.correctDiagnosis) && attempts < 10) {
      randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
      attempts++;
    }
  }
  
  labCaseCounter++;
  
  // Apply variations to lab values to make each case feel different
  const variedPanels = randomCase.panels.map(panel => ({
    ...panel,
    values: panel.values.map(val => ({
      ...val,
      value: val.isAbnormal ? applyVariation(val.value, val.abnormalDirection) : val.value,
    })),
  }));
  
  const { age, sex } = randomizePatient(randomCase.patientAge, randomCase.patientSex);
  
  return {
    ...randomCase,
    id: `lab-${Date.now()}-${labCaseCounter}`,
    patientAge: age,
    patientSex: sex,
    panels: variedPanels,
  };
}

// ============================================================================
// HOOK: useMiniLabDrill
// ============================================================================

export interface UseMiniLabDrillReturn {
  /** Current lab case */
  currentCase: LabCase | null;
  /** Current score */
  score: number;
  /** Current streak */
  streak: number;
  /** User's submitted answer */
  userAnswer: string | null;
  /** Whether the last answer was correct */
  isCorrect: boolean | null;
  /** Game status */
  status: MiniLabGameStatus;
  /** Selected category */
  selectedCategory: LabCategory;
  /** Valid diagnoses for type-ahead search */
  validDiagnoses: string[];
  /** Submit an answer */
  submitAnswer: (answer: string) => void;
  /** Move to next case */
  nextCase: () => void;
  /** Reset the game */
  reset: () => void;
  /** Start a new session */
  startSession: (category: LabCategory) => void;
  /** Exit to landing page */
  exitToMenu: () => void;
  /** Show category selection menu */
  showCategoryMenu: () => void;
  /** Order additional tests */
  orderTest: (testName: string) => void;
  /** Available orderable tests for current case */
  availableTests: string[];
}

const INITIAL_QUEUE_SIZE = 3;
const MAX_RECENT_DIAGNOSES = 10; // Track last 10 diagnoses to avoid repetition

export function useMiniLabDrill(): UseMiniLabDrillReturn {
  const [selectedCategory, setSelectedCategory] = useState<LabCategory>('random');
  const [queue, setQueue] = useState<LabCase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<MiniLabGameStatus>('landing');
  
  // Track recently used diagnoses to avoid repetition
  const recentDiagnosesRef = useRef<Set<string>>(new Set());

  const currentCase = queue[currentIndex] ?? null;
  
  // Get available orderable tests for the current case
  const availableTests = useMemo(() => {
    if (!currentCase || !currentCase.orderableTests) return [];
    const alreadyOrdered = new Set(currentCase.orderedTests || []);
    return currentCase.orderableTests
      .map(panel => panel.name)
      .filter(name => !alreadyOrdered.has(name));
  }, [currentCase]);

  const validDiagnoses = useMemo(() => {
    if (selectedCategory === 'random') {
      return MINI_LAB_DIAGNOSES;
    }
    return getDiagnosesByCategory(selectedCategory);
  }, [selectedCategory]);

  const generateNewCase = useCallback((category: LabCategory): LabCase => {
    const labCase = generateRandomLabCase(category, recentDiagnosesRef.current);
    
    // Add to recent diagnoses and maintain max size
    recentDiagnosesRef.current.add(labCase.correctDiagnosis);
    if (recentDiagnosesRef.current.size > MAX_RECENT_DIAGNOSES) {
      const firstItem = recentDiagnosesRef.current.values().next().value;
      if (firstItem) recentDiagnosesRef.current.delete(firstItem);
    }
    
    return labCase;
  }, []);

  const startSession = useCallback((category: LabCategory) => {
    setSelectedCategory(category);
    recentDiagnosesRef.current.clear(); // Clear history on new session
    
    const initialQueue: LabCase[] = [];
    for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
      initialQueue.push(generateNewCase(category));
    }
    
    setQueue(initialQueue);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [generateNewCase]);

  const showCategoryMenu = useCallback(() => {
    setStatus('menu');
  }, []);

  const exitToMenu = useCallback(() => {
    setStatus('landing');
    setQueue([]);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);
  }, []);

  const submitAnswer = useCallback((answer: string) => {
    if (!currentCase || status !== 'playing') return;

    setUserAnswer(answer);
    
    const correct = answer.toLowerCase().trim() === currentCase.correctDiagnosis.toLowerCase().trim();
    setIsCorrect(correct);

    if (correct) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
    }

    setStatus('feedback');
  }, [currentCase, status]);

  const nextCase = useCallback(() => {
    const newCase = generateNewCase(selectedCategory);
    setQueue(prev => [...prev, newCase]);
    setCurrentIndex(prev => prev + 1);
    setUserAnswer(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory, generateNewCase]);

  const reset = useCallback(() => {
    recentDiagnosesRef.current.clear(); // Clear history on reset
    const newQueue: LabCase[] = [];
    for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
      newQueue.push(generateNewCase(selectedCategory));
    }
    
    setQueue(newQueue);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory, generateNewCase]);
  
  const orderTest = useCallback((testName: string): boolean => {
    if (!currentCase || !currentCase.orderableTests) {
      console.warn('Cannot order test: no current case or orderable tests available');
      return false;
    }
    
    // Find the test panel
    const testPanel = currentCase.orderableTests.find(panel => panel.name === testName);
    if (!testPanel) {
      console.warn(`Cannot order test: test "${testName}" not found in orderable tests`);
      return false;
    }
    
    // Update the queue with the ordered test
    setQueue(prev => {
      const newQueue = [...prev];
      const updatedCase = { ...newQueue[currentIndex] };
      
      // Add to panels
      updatedCase.panels = [...updatedCase.panels, testPanel];
      
      // Track ordered tests
      updatedCase.orderedTests = [...(updatedCase.orderedTests || []), testName];
      
      newQueue[currentIndex] = updatedCase;
      return newQueue;
    });
    
    return true;
  }, [currentCase, currentIndex]);

  return {
    currentCase,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    selectedCategory,
    validDiagnoses,
    submitAnswer,
    nextCase,
    reset,
    startSession,
    exitToMenu,
    showCategoryMenu,
    orderTest,
    availableTests,
  };
}
