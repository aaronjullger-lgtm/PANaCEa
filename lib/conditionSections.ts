/**
 * Shared condition section configuration (source of truth)
 *
 * Used by:
 * - Dedicated condition page (pages/conditions/[id].tsx) for section order and merging
 * - Library slide-over (ConditionMasterEmbedded) for consistent section labels/categories
 *
 * ConditionEntry.sections keys are merged per logical section.
 * MedicalContentDisplay field names are listed for Library alignment.
 */

export type SectionCategory =
  | 'overview'
  | 'background'
  | 'clinical'
  | 'workup'
  | 'treatment'
  | 'outcomes'
  | 'pearls';

export interface ConditionSectionConfig {
  /** Unique id for TOC, expand state, scroll target */
  id: string;
  /** Display title */
  title: string;
  /** Logical category for grouping and styling */
  category: SectionCategory;
  /**
   * Keys in ConditionEntry.sections (dedicated page).
   * Content from these keys is merged into one block for this section.
   */
  conditionEntryKeys: string[];
  /**
   * Field names in MedicalContentDisplay (Library/API).
   * For reference when aligning Library detail view.
   */
  medicalContentFields?: string[];
}

/** Default section ids to expand on load (overview + clinical + workup + management) */
export const DEFAULT_EXPANDED_SECTION_IDS = new Set([
  'overview',
  'clinicalPresentation',
  'diagnostics',
  'management',
]);

/**
 * Consolidated section config: 10 PA-school-friendly sections.
 * Overlapping ConditionEntry keys are merged into single sections.
 */
export const CONDITION_SECTION_CONFIG: ConditionSectionConfig[] = [
  {
    id: 'overview',
    title: 'Overview',
    category: 'overview',
    conditionEntryKeys: ['overview', 'keyPoints'],
    medicalContentFields: ['overview'],
  },
  {
    id: 'pathophysiology',
    title: 'Pathophysiology & Etiology',
    category: 'background',
    conditionEntryKeys: [
      'etiologyPathophysiology',
      'etiology',
      'epidemiology',
      'riskFactors',
    ],
    medicalContentFields: ['pathophysiology', 'etiology', 'epidemiology', 'riskFactors'],
  },
  {
    id: 'clinicalPresentation',
    title: 'Clinical Presentation (Signs & Symptoms)',
    category: 'clinical',
    conditionEntryKeys: ['clinicalPresentation', 'symptoms', 'physicalExam', 'examFindings'],
    medicalContentFields: ['symptoms', 'physicalExam', 'physical_exam', 'signs', 'classic_patient'],
  },
  {
    id: 'diagnostics',
    title: 'Diagnosis (Labs, Imaging, Special Tests)',
    category: 'workup',
    conditionEntryKeys: ['diagnostics'],
    medicalContentFields: ['diagnostics', 'gold_standard_dx', 'best_initial_test', 'labs', 'imaging'],
  },
  {
    id: 'differentialDiagnosis',
    title: 'Differential Diagnosis',
    category: 'workup',
    conditionEntryKeys: ['differentialDiagnosis'],
    medicalContentFields: ['differentialDiagnosis'],
  },
  {
    id: 'management',
    title: 'Treatment & Management',
    category: 'treatment',
    conditionEntryKeys: ['management', 'treatment', 'treatmentPearls'],
    medicalContentFields: [
      'treatment',
      'first_line_rx',
      'rx_mechanism',
      'rx_side_effects',
      'patient_education',
    ],
  },
  {
    id: 'complications',
    title: 'Complications & Red Flags',
    category: 'outcomes',
    conditionEntryKeys: ['complications', 'redFlags'],
    medicalContentFields: ['complications'],
  },
  {
    id: 'prognosis',
    title: 'Prognosis',
    category: 'outcomes',
    conditionEntryKeys: ['prognosis'],
    medicalContentFields: ['prognosis', 'disposition'],
  },
  {
    id: 'preventionEducation',
    title: 'Prevention & Education',
    category: 'outcomes',
    conditionEntryKeys: ['preventionEducation'],
    medicalContentFields: ['prevention'],
  },
  {
    id: 'pearls',
    title: 'Pearls (High-Yield for Exams)',
    category: 'pearls',
    conditionEntryKeys: ['pearls'],
    medicalContentFields: ['clinical_pearls', 'buzzwords', 'mnemonic', 'classic_triad'],
  },
];

/**
 * Section titles for Library slide-over (ConditionMasterEmbedded).
 * Keys match the Library's internal section ids (clinical, workup, treatment, outcomes, background).
 * Use for consistent labels between dedicated condition page and Library.
 */
export const LIBRARY_SECTION_TITLES: Record<string, string> = {
  clinical: 'Clinical Presentation (Signs & Symptoms)',
  workup: 'Workup & Diagnostics',
  treatment: 'Treatment & Management',
  outcomes: 'Outcomes & Prognosis',
  background: 'Pathophysiology & Etiology',
};
