/**
 * App view state type and shared animation config
 */

import type { TrainingModeId } from './training-modes';

export type View =
  | 'menu'
  | 'command_center'
  | 'quiz'
  | 'session_runner'
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
  | 'pance_simulator'
  | 'full_sit_down_test'
  | 'code_blue_speed'
  | 'grand_rounds'
  | 'ventilator_hero'
  | 'physiology_drill'
  | 'anatomy_review'
  | 'contrastive_drill'
  | 'reasoning_tutor'
  | 'cram_mode'
  | 'polypharmacy_puzzle'
  | 'medical_wordle'
  | 'diagnostic_puzzle'
  | 'admin_media'
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
  | 'study_companion'
  | 'srs_review'
  | 'medical_database'
  | 'commuter_mode'
  | 'study_path_dashboard'
  | 'live_collaboration'
  | 'cross_system_explorer'
  | 'core_adaptive'
  | 'elaboration_drill'
  | 'icd_coding_drill'
  | 'teach_back_drill'
  | 'calibration_dashboard';

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
  CONTRASTIVE: 'contrastive_drill' as TrainingModeId,
  CRAM: 'cram_mode' as TrainingModeId,
  POLYPHARMACY: 'polypharmacy_puzzle' as TrainingModeId,
  MEDICAL_WORDLE: 'medical_wordle' as TrainingModeId,
  DIAGNOSTIC_PUZZLE: 'diagnostic_puzzle' as TrainingModeId,
  COMMUTER: 'commuter_mode' as TrainingModeId,
  FULL_SIT_DOWN_TEST: 'full_sit_down_test' as TrainingModeId,
  CORE_ADAPTIVE: 'core_adaptive' as TrainingModeId,
  ELABORATION: 'elaboration_drill' as TrainingModeId,
  ICD_CODING: 'icd_coding_drill' as TrainingModeId,
  TEACH_BACK: 'teach_back_drill' as TrainingModeId,
} as const;

/** Static animation variants for view transitions */
export const pageVariants = {
  initial: { y: 12 },
  animate: { y: 0 },
  exit: { y: -8 },
};

/** Stagger config for list/card entrance animations */
export const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
};

export const staggerItem = {
  initial: { y: 12 },
  animate: { y: 0 },
};

/** Spring config for snappy, premium feel */
export const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};
