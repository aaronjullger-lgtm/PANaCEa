// src/conditionRegistry.ts
import type { ConditionDefinition, SystemCode } from './types';

// Turn strings into a consistent id segment
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const makeId = (system: SystemCode, subcategory: string, condition: string) =>
  `${system}__${slug(subcategory)}__${slug(condition)}`;

/**
 * MASTER condition registry
 *
 * system      = PANCE blueprint bucket (CV, PULM, RENAL, GU, etc.)
 * subcategory = mid-level grouping (CAD, Emergency, Pediatrics, Oncology…)
 * condition   = specific thing (STEMI, Pulmonary Embolism, etc.)
 *
 * Special rules:
 * - Emergency / Pediatrics / Geriatrics → system = organ system, subcategory = "Emergency"/"Pediatrics"/"Geriatrics"
 * - Oncology → system = organ system, subcategory = "Oncology"
 * - OTHER → internal only, for truly system-agnostic stuff – you can hide it from the heatmap.
 */

export const CONDITION_REGISTRY: ConditionDefinition[] = [
  //
  // CARDIOVASCULAR (Cardiovascular System)
  //
  {
    id: makeId('CV', 'Coronary Artery Disease', 'Stable Angina'),
    system: 'CV',
    subcategory: 'Coronary Artery Disease',
    condition: 'Stable Angina',
    sourceUnit: 'Cardiovascular',
  },
  {
    id: makeId('CV', 'Coronary Artery Disease', 'Unstable Angina'),
    system: 'CV',
    subcategory: 'Coronary Artery Disease',
    condition: 'Unstable Angina',
    sourceUnit: 'Cardiovascular',
  },
  {
    id: makeId('CV', 'Arrhythmias', 'Atrial Fibrillation'),
    system: 'CV',
    subcategory: 'Arrhythmias',
    condition: 'Atrial Fibrillation',
    sourceUnit: 'Cardiovascular',
  },

  //
  // PULMONARY (Pulmonary System)
  //
  {
    id: makeId('PULM', 'Asthma', 'Acute Exacerbation of Asthma'),
    system: 'PULM',
    subcategory: 'Asthma',
    condition: 'Acute Exacerbation of Asthma',
    sourceUnit: 'Pulmonary',
  },
  {
    id: makeId('PULM', 'COPD', 'Acute Exacerbation of COPD'),
    system: 'PULM',
    subcategory: 'COPD',
    condition: 'Acute Exacerbation of COPD',
    sourceUnit: 'Pulmonary',
  },

  //
  // GI (Gastrointestinal/Nutritional System)
  //
  {
    id: makeId('GI', 'Esophagus', 'GERD'),
    system: 'GI',
    subcategory: 'Esophagus',
    condition: 'GERD',
    sourceUnit: 'Gastrointestinal',
  },
  {
    id: makeId('GI', 'Inflammatory Bowel Disease', 'Crohn Disease'),
    system: 'GI',
    subcategory: 'Inflammatory Bowel Disease',
    condition: 'Crohn Disease',
    sourceUnit: 'Gastrointestinal',
  },

  //
  // RENAL vs GU (GU/Renal unit)
  //
  {
    id: makeId('RENAL', 'Renal Diseases', 'Acute Kidney Injury'),
    system: 'RENAL',
    subcategory: 'Renal Diseases',
    condition: 'Acute Kidney Injury',
    sourceUnit: 'GU/Renal',
  },
  {
    id: makeId('RENAL', 'Electrolyte & Acid/Base Disorders', 'Hyponatremia'),
    system: 'RENAL',
    subcategory: 'Electrolyte & Acid/Base Disorders',
    condition: 'Hyponatremia',
    sourceUnit: 'GU/Renal',
  },
  {
    id: makeId('GU', 'Benign Conditions', 'Benign Prostatic Hyperplasia'),
    system: 'GU',
    subcategory: 'Benign Conditions',
    condition: 'Benign Prostatic Hyperplasia',
    sourceUnit: 'GU/Renal',
  },
  {
    id: makeId('GU', 'Infections', 'Acute Cystitis'),
    system: 'GU',
    subcategory: 'Infections',
    condition: 'Acute Cystitis',
    sourceUnit: 'GU/Renal',
  },

  //
  // REPRODUCTIVE (Female + Male)
  //
  {
    id: makeId('REPRO', 'Obstetrics', 'Ectopic Pregnancy'),
    system: 'REPRO',
    subcategory: 'Obstetrics',
    condition: 'Ectopic Pregnancy',
    sourceUnit: 'Female Reproductive',
  },
  {
    id: makeId('REPRO', 'Gynecology', 'Polycystic Ovary Syndrome'),
    system: 'REPRO',
    subcategory: 'Gynecology',
    condition: 'Polycystic Ovary Syndrome',
    sourceUnit: 'Female Reproductive',
  },
  {
    id: makeId('REPRO', 'Male Reproductive', 'Testicular Torsion'),
    system: 'REPRO',
    subcategory: 'Male Reproductive',
    condition: 'Testicular Torsion',
    sourceUnit: 'GU/Renal',
  },

  //
  // ONCOLOGY examples
  // "Oncology Renal Renal Cell Carcinoma" → RENAL + Oncology
  // "Oncology Solid Tumors Renal Cell Carcinoma" → same mapping
  //
  {
    id: makeId('RENAL', 'Oncology', 'Renal Cell Carcinoma'),
    system: 'RENAL',
    subcategory: 'Oncology',
    condition: 'Renal Cell Carcinoma',
    sourceUnit: 'Oncology',
  },
  {
    id: makeId('PULM', 'Oncology', 'Small Cell Lung Cancer'),
    system: 'PULM',
    subcategory: 'Oncology',
    condition: 'Small Cell Lung Cancer',
    sourceUnit: 'Oncology',
  },

  //
  // EMERGENCY MED examples
  // "Emergency Medicine Pulmonary Pulmonary Embolism"
  // → system: PULM, subcategory: Emergency, condition: Pulmonary Embolism
  //
  {
    id: makeId('PULM', 'Emergency', 'Pulmonary Embolism'),
    system: 'PULM',
    subcategory: 'Emergency',
    condition: 'Pulmonary Embolism',
    sourceUnit: 'Emergency Medicine',
  },
  {
    id: makeId('CV', 'Emergency', 'Acute Coronary Syndrome'),
    system: 'CV',
    subcategory: 'Emergency',
    condition: 'Acute Coronary Syndrome',
    sourceUnit: 'Emergency Medicine',
  },

  //
  // PEDIATRICS / GERIATRICS examples
  //
  {
    id: makeId('PULM', 'Pediatrics', 'Bronchiolitis'),
    system: 'PULM',
    subcategory: 'Pediatrics',
    condition: 'Bronchiolitis',
    sourceUnit: 'Pediatrics',
  },
  {
    id: makeId('CV', 'Pediatrics', 'Kawasaki Disease'),
    system: 'CV',
    subcategory: 'Pediatrics',
    condition: 'Kawasaki Disease',
    sourceUnit: 'Pediatrics',
  },
  {
    id: makeId('NEURO', 'Geriatrics', 'Delirium'),
    system: 'NEURO',
    subcategory: 'Geriatrics',
    condition: 'Delirium',
    sourceUnit: 'Geriatrics',
  },

  //
  // PROFESSIONAL PRACTICE examples
  //
  {
    id: makeId('PRO', 'Professional Practice', 'Informed Consent'),
    system: 'PRO',
    subcategory: 'Professional Practice',
    condition: 'Informed Consent',
    sourceUnit: 'Professional Practice',
  },

  //
  // OTHER – truly system-agnostic things (doesn't appear on heatmap)
  //
  {
    id: makeId('OTHER', 'Surgery', 'Wound Healing'),
    system: 'OTHER',
    subcategory: 'Surgery',
    condition: 'Wound Healing',
    sourceUnit: 'Surgery',
  },
];

/** Optional helpers we can use later */
export const CONDITIONS_BY_ID: Record<string, ConditionDefinition> =
  CONDITION_REGISTRY.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<string, ConditionDefinition>);

export const CONDITIONS_BY_SYSTEM: Record<SystemCode, ConditionDefinition[]> =
  CONDITION_REGISTRY.reduce((acc, c) => {
    if (!acc[c.system]) acc[c.system] = [];
    acc[c.system].push(c);
    return acc;
  }, {} as Record<SystemCode, ConditionDefinition[]>);
