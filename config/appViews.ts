/**
 * App view state type and shared animation config
 */

import type { TrainingModeId } from './training-modes';

export type View =
  | 'menu'
  | 'command_center'
  | 'quiz'
  | 'custom_study'
  | 'integrations'
  | 'photo_drill'
  | 'ecg_drill'
  | 'derm_drill'
  | 'imaging_drill'
  | 'rapid_recall'
  | 'ddx_compare'
  | 'mini_lab'
  | 'pharmacology'
  | 'first_line_treatment'
  | 'condition_drill'
  | 'system_drill'
  | 'subcategory_drill'
  | 'guideline_drill'
  | 'fluid_electrolyte'
  | 'antibiotic_mode'
  | 'patient_encounter'
  | 'panre_la'
  | 'code_blue_speed'
  | 'grand_rounds'
  | 'ventilator_hero'
  | 'physiology_drill'
  | 'anatomy_review'
  | 'admin_media'
  | 'social_dashboard'
  | 'toolkit'
  | 'gap_analysis'
  | 'clinical_profile'
  | 'training_menu'
  | 'simulation_page'
  | 'command_center_page'
  | 'reference_library'
  | 'pearl_deck'
  | 'my_library'
  | 'tutor_chat'
  | 'study_companion';

/** Drill mode IDs with dedicated view implementations */
export const DRILL_MODE_IDS = {
  PHOTO: 'photo_drill' as TrainingModeId,
  ECG: 'ecg_drill' as TrainingModeId,
  DERM: 'derm_drill' as TrainingModeId,
  IMAGING: 'imaging_drill' as TrainingModeId,
  RAPID_RECALL: 'rapid_recall' as TrainingModeId,
  DDX_COMPARE: 'ddx_compare' as TrainingModeId,
  MINI_LAB: 'mini_lab' as TrainingModeId,
  PHARMACOLOGY: 'pharmacology' as TrainingModeId,
  FIRST_LINE: 'first_line_treatment' as TrainingModeId,
  CONDITION: 'condition_drill' as TrainingModeId,
  SYSTEM: 'system_drill' as TrainingModeId,
  SUBCATEGORY: 'subcategory_drill' as TrainingModeId,
  GUIDELINE: 'guideline_drill' as TrainingModeId,
  FLUID_ELECTROLYTE: 'fluid_electrolyte' as TrainingModeId,
  ANTIBIOTIC: 'antibiotic_mode' as TrainingModeId,
  PATIENT_ENCOUNTER: 'patient_encounter' as TrainingModeId,
  CODE_BLUE: 'code_blue_speed' as TrainingModeId,
  GRAND_ROUNDS: 'grand_rounds' as TrainingModeId,
  VENTILATOR: 'ventilator_hero' as TrainingModeId,
  PHYSIOLOGY: 'physiology_drill' as TrainingModeId,
  ANATOMY: 'anatomy_review' as TrainingModeId,
} as const;

/** Static animation variants for view transitions */
export const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};
