// physiologyRegistry.ts
/**
 * Physiology Concept Registry
 *
 * Registry of basic science and physiological concepts that are important
 * for understanding clinical medicine. Examples: preload, afterload,
 * Frank-Starling curve, mRNA, etc.
 */

export interface PhysiologyConceptMeta {
  name: string;
  displayName?: string; // Clean display name with proper capitalization
  aliases?: string[]; // Alternative names for search
  category: string; // Cardiovascular, Respiratory, Renal, Endocrine, Cellular, Genetics, etc.
  description?: string; // Brief description
  relatedConditions?: string[]; // Condition IDs where this concept is relevant
  relatedDrugs?: string[]; // Drug names that interact with this concept
}

// =============================================================================
// CARDIOVASCULAR PHYSIOLOGY
// =============================================================================

export const PHYSIOLOGY_CONCEPTS_CV: PhysiologyConceptMeta[] = [
  {
    name: 'Preload',
    category: 'Cardiovascular',
    description: 'End-diastolic volume; the degree of stretch of the myocardium before contraction',
    relatedConditions: ['Heart Failure', 'Cardiomyopathy'],
    relatedDrugs: ['Furosemide', 'Nitroglycerin'],
  },
  {
    name: 'Afterload',
    category: 'Cardiovascular',
    description:
      'Resistance the heart must overcome to eject blood; primarily determined by systemic vascular resistance',
    relatedConditions: ['Hypertension', 'Aortic Stenosis'],
    relatedDrugs: ['ACE Inhibitors', 'Hydralazine'],
  },
  {
    name: 'Frank-Starling Curve',
    displayName: 'Frank-Starling Mechanism',
    aliases: ["Starling's Law", 'Frank-Starling Law of the Heart'],
    category: 'Cardiovascular',
    description:
      "The heart's intrinsic ability to increase stroke volume in response to increased venous return",
  },
  {
    name: 'Cardiac Output',
    aliases: ['CO'],
    category: 'Cardiovascular',
    description: 'Volume of blood pumped by the heart per minute (CO = HR × SV)',
  },
  {
    name: 'Stroke Volume',
    aliases: ['SV'],
    category: 'Cardiovascular',
    description: 'Volume of blood pumped per heartbeat',
  },
  {
    name: 'Ejection Fraction',
    aliases: ['EF'],
    category: 'Cardiovascular',
    description: 'Percentage of blood ejected from the left ventricle with each contraction',
    relatedConditions: ['Heart Failure'],
  },
  {
    name: 'Mean Arterial Pressure',
    displayName: 'Mean Arterial Pressure',
    aliases: ['MAP'],
    category: 'Cardiovascular',
    description: 'Average arterial pressure during a single cardiac cycle',
  },
];

// =============================================================================
// RESPIRATORY PHYSIOLOGY
// =============================================================================

export const PHYSIOLOGY_CONCEPTS_PULM: PhysiologyConceptMeta[] = [
  {
    name: 'V/Q Mismatch',
    displayName: 'Ventilation-Perfusion Mismatch',
    aliases: ['VQ Mismatch', 'Ventilation Perfusion Mismatch'],
    category: 'Respiratory',
    description: 'Imbalance between ventilation and blood flow in the lungs',
    relatedConditions: ['Pulmonary Embolism', 'COPD', 'Pneumonia'],
  },
  {
    name: 'Dead Space',
    category: 'Respiratory',
    description: "Volume of air that doesn't participate in gas exchange",
  },
  {
    name: 'Shunt',
    category: 'Respiratory',
    description: 'Deoxygenated blood bypassing ventilated alveoli',
  },
  {
    name: 'Oxyhemoglobin Dissociation Curve',
    aliases: ['Oxygen-Hemoglobin Curve', 'O2-Hb Curve'],
    category: 'Respiratory',
    description: 'Relationship between oxygen saturation and partial pressure of oxygen',
  },
];

// =============================================================================
// RENAL PHYSIOLOGY
// =============================================================================

export const PHYSIOLOGY_CONCEPTS_RENAL: PhysiologyConceptMeta[] = [
  {
    name: 'Glomerular Filtration Rate',
    displayName: 'Glomerular Filtration Rate',
    aliases: ['GFR'],
    category: 'Renal',
    description: 'Rate at which blood is filtered by the kidneys',
    relatedConditions: ['Chronic Kidney Disease', 'Acute Kidney Injury'],
  },
  {
    name: 'Renin-Angiotensin-Aldosterone System',
    displayName: 'Renin-Angiotensin-Aldosterone System',
    aliases: ['RAAS', 'RAS'],
    category: 'Renal',
    description: 'Hormone system regulating blood pressure and fluid balance',
    relatedDrugs: ['ACE Inhibitors', 'ARBs', 'Spironolactone'],
  },
  {
    name: 'Tubuloglomerular Feedback',
    category: 'Renal',
    description: 'Autoregulation mechanism of kidney blood flow',
  },
];

// =============================================================================
// CELLULAR & MOLECULAR
// =============================================================================

export const PHYSIOLOGY_CONCEPTS_CELLULAR: PhysiologyConceptMeta[] = [
  {
    name: 'mRNA',
    displayName: 'mRNA',
    aliases: ['Messenger RNA', 'Messenger Ribonucleic Acid'],
    category: 'Cellular Biology',
    description:
      'RNA molecule that carries genetic information from DNA to ribosomes for protein synthesis',
  },
  {
    name: 'DNA',
    displayName: 'DNA',
    aliases: ['Deoxyribonucleic Acid'],
    category: 'Genetics',
    description: 'Molecule carrying genetic instructions for development and function',
  },
  {
    name: 'RNA',
    displayName: 'RNA',
    aliases: ['Ribonucleic Acid'],
    category: 'Cellular Biology',
    description: 'Nucleic acid involved in protein synthesis and gene regulation',
  },
  {
    name: 'ATP',
    displayName: 'ATP',
    aliases: ['Adenosine Triphosphate'],
    category: 'Cellular Biology',
    description: 'Primary energy currency of cells',
  },
  {
    name: 'Action Potential',
    category: 'Neurophysiology',
    description: 'Electrical signal propagated along nerve and muscle cells',
  },
  {
    name: 'Sodium-Potassium Pump',
    displayName: 'Sodium-Potassium Pump',
    aliases: ['Na+/K+ ATPase', 'Na-K Pump'],
    category: 'Cellular Biology',
    description: 'Active transport mechanism maintaining cellular ion gradients',
  },
];

// =============================================================================
// ENDOCRINE
// =============================================================================

export const PHYSIOLOGY_CONCEPTS_ENDO: PhysiologyConceptMeta[] = [
  {
    name: 'Negative Feedback Loop',
    category: 'Endocrine',
    description: 'Regulatory mechanism where output inhibits further production',
  },
  {
    name: 'Positive Feedback Loop',
    category: 'Endocrine',
    description: 'Regulatory mechanism where output stimulates further production',
  },
  {
    name: 'Hypothalamic-Pituitary-Adrenal Axis',
    displayName: 'HPA Axis',
    aliases: ['HPA Axis'],
    category: 'Endocrine',
    description: 'Neuroendocrine system controlling stress response and cortisol',
  },
  {
    name: 'Hypothalamic-Pituitary-Thyroid Axis',
    displayName: 'HPT Axis',
    aliases: ['HPT Axis'],
    category: 'Endocrine',
    description: 'Neuroendocrine system regulating thyroid hormone production',
  },
];

// =============================================================================
// COMBINED REGISTRY
// =============================================================================

export const PHYSIOLOGY_CONCEPT_REGISTRY: PhysiologyConceptMeta[] = [
  ...PHYSIOLOGY_CONCEPTS_CV,
  ...PHYSIOLOGY_CONCEPTS_PULM,
  ...PHYSIOLOGY_CONCEPTS_RENAL,
  ...PHYSIOLOGY_CONCEPTS_CELLULAR,
  ...PHYSIOLOGY_CONCEPTS_ENDO,
];

export function buildPhysiologyConceptId(concept: PhysiologyConceptMeta): string {
  return concept.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
