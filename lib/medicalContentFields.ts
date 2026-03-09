/**
 * Canonical MedicalContent field definitions (source of truth for library and API).
 * Use for normalization, typing, and mapping legacy DB names.
 */

export type MedicalContentFieldType = 'string' | 'string[]' | 'object';

export interface MedicalContentFieldDef {
  /** Canonical name (camelCase for API/frontend) */
  name: string;
  type: MedicalContentFieldType;
  /** Legacy DB or API names that map to this field */
  legacyNames?: string[];
}

/** Canonical list of MedicalContent fields used by the library and content APIs. */
export const MEDICAL_CONTENT_FIELDS: MedicalContentFieldDef[] = [
  // Identity and taxonomy
  { name: 'id', type: 'string' },
  { name: 'conditionId', type: 'string' },
  { name: 'condition', type: 'string' },
  { name: 'system', type: 'string' },
  { name: 'subcategory', type: 'string' },
  { name: 'parent_category', type: 'string' },
  { name: 'relatedSystems', type: 'string[]' },
  { name: 'pance_yield', type: 'string' },
  // List-like (display as bullets; may be stored as JSON/string)
  { name: 'buzzwords', type: 'string[]' },
  { name: 'clinical_pearls', type: 'string[]', legacyNames: ['clinicalPearls'] },
  { name: 'symptoms', type: 'string[]' },
  { name: 'classic_triad', type: 'string[]' },
  { name: 'complications', type: 'string[]' },
  { name: 'synonyms', type: 'string[]' },
  { name: 'signs', type: 'string[]' },
  { name: 'labs_findings', type: 'string[]' },
  { name: 'imaging_findings', type: 'string[]' },
  { name: 'mnemonics', type: 'string[]', legacyNames: ['mnemonic'] },
  { name: 'associations', type: 'string[]' },
  // Text (long copy)
  { name: 'overview', type: 'string' },
  { name: 'pathophysiology', type: 'string' },
  { name: 'treatment', type: 'string' },
  { name: 'etiology', type: 'string' },
  { name: 'epidemiology', type: 'string' },
  { name: 'prognosis', type: 'string' },
  { name: 'prevention', type: 'string' },
  { name: 'patient_education', type: 'string' },
  { name: 'classic_patient', type: 'string' },
  { name: 'physicalExam', type: 'string', legacyNames: ['physical_exam'] },
  { name: 'physical_exam', type: 'string' },
  { name: 'monitoring', type: 'string' },
  { name: 'lifestyle', type: 'string' },
  { name: 'riskFactors', type: 'string', legacyNames: ['risk_factors'] },
  { name: 'risk_factors', type: 'string' },
  { name: 'diagnostics', type: 'string' },
  { name: 'gold_standard_dx', type: 'string' },
  { name: 'first_line_rx', type: 'string' },
  { name: 'best_initial_test', type: 'string' },
  { name: 'differentialDiagnosis', type: 'string' },
  { name: 'guidelines', type: 'string' },
  { name: 'disposition', type: 'string' },
  { name: 'image_query', type: 'string' },
  { name: 'mnemonic', type: 'string' },
  // Object / structured
  { name: 'diagnosis', type: 'object' },
  { name: 'differentials', type: 'object' },
  { name: 'age_demographic', type: 'object' },
  { name: 'content', type: 'object' },
];

/** Field names that should be parsed as list (string[]) for display. */
export const MEDICAL_CONTENT_LIST_FIELDS: string[] = [
  'buzzwords',
  'clinical_pearls',
  'symptoms',
  'signs',
  'risk_factors',
  'labs_findings',
  'imaging_findings',
  'complications',
  'synonyms',
  'classic_triad',
  'mnemonics',
  'associations',
];

/** Field names that should be parsed as single text (string) for display. */
export const MEDICAL_CONTENT_TEXT_FIELDS: string[] = [
  'overview',
  'pathophysiology',
  'treatment',
  'etiology',
  'epidemiology',
  'prognosis',
  'prevention',
  'patient_education',
  'classic_patient',
  'physical_exam',
  'physicalExam',
  'monitoring',
  'lifestyle',
  'riskFactors',
  'diagnostics',
  'gold_standard_dx',
  'first_line_rx',
  'best_initial_test',
  'differentialDiagnosis',
  'guidelines',
  'disposition',
  'image_query',
  'mnemonic',
];

/** Field names that should be parsed as object for display. */
export const MEDICAL_CONTENT_OBJECT_FIELDS: string[] = [
  'diagnosis',
  'differentials',
  'age_demographic',
  'content',
];
