/**
 * Training Mode Configuration
 * 
 * ORGANIZATION PHILOSOPHY:
 * Modes are organized by PRIMARY LEARNING ACTIVITY TYPE.
 * 
 * Categories:
 * 1. VISUAL DIAGNOSTICS - Pattern recognition with images/media
 * 2. CLINICAL SIMULATION - Interactive patient scenarios (fluids, vent, etc.)
 * 3. QUESTION PRACTICE - Traditional Q&A including pharm/abx
 * 4. SPECIALTY DRILLS - High-yield focused drills (recall, first-line, wordle, etc.)
 * 
 * Special standalone modes:
 * - CORE ADAPTIVE (main event - front and center)
 * - OSCE (Virtual Patient) - significant standalone feature
 * - GRAND ROUNDS - once-daily community challenge
 * - PANRE-LA - only for practicing PAs (context-aware)
 */

export type TrainingModeId =
  | 'core_adaptive'
  | 'photo_drill'
  | 'ecg_drill'
  | 'derm_drill'
  | 'imaging_drill'
  | 'rapid_recall'
  | 'ddx_compare'
  | 'guideline_drill'
  | 'mini_lab'
  | 'first_line_treatment'
  | 'pharmacology'
  | 'condition_drill'
  | 'system_drill'
  | 'subcategory_drill'
  | 'fluid_electrolyte'
  | 'antibiotic_mode'
  | 'patient_encounter'
  | 'panre_la'
  | 'code_blue_speed'
  | 'grand_rounds'
  | 'cram_mode'
  | 'commuter_mode'
  | 'medical_wordle'
  | 'ventilator_hero'
  | 'polypharmacy_puzzle'
  | 'radiology_scroll'
  | 'physiology_drill';

/**
 * Categories based on learning activity type
 */
export type TrainingCategory =
  | 'visual_diagnostics'
  | 'clinical_simulation' 
  | 'question_practice'
  | 'specialty_drills';

// Modes that count toward ranked stats/FSRS pipelines
export const RANKED_MODES = ['GRAND_ROUNDS', 'SMART_REVIEW', 'PANCE_SIMULATOR'] as const;

export function isRankedMode(mode?: string | null): boolean {
  if (!mode) return false;
  const normalized = mode.replace(/-/g, '_').toUpperCase();
  return RANKED_MODES.includes(normalized as (typeof RANKED_MODES)[number]);
}

export interface TrainingModeConfig {
  id: TrainingModeId;
  label: string;
  description: string;
  category: TrainingCategory;
  iconName: string;
  theme: string;
  route: string;
  isComingSoon?: boolean;
  panreOnly?: boolean;
  estimatedMinutes?: number;
}

export const CATEGORY_INFO: Record<TrainingCategory, {
  label: string;
  description: string;
  iconName: string;
}> = {
  visual_diagnostics: {
    label: 'Visual Diagnostics',
    description: 'Pattern recognition with images and media',
    iconName: 'Eye',
  },
  clinical_simulation: {
    label: 'Clinical Simulation',
    description: 'Interactive patient scenarios and management',
    iconName: 'Stethoscope',
  },
  question_practice: {
    label: 'Question Practice',
    description: 'Board-style questions with explanations',
    iconName: 'BookOpen',
  },
  specialty_drills: {
    label: 'Specialty Drills',
    description: 'Focused high-yield practice',
    iconName: 'Target',
  },
};

// VISUAL DIAGNOSTICS
export const VISUAL_DIAGNOSTICS_MODES: TrainingModeConfig[] = [
  {
    id: 'ecg_drill',
    label: 'ECG Interpretation',
    description: 'Master rhythm strips and 12-lead ECG patterns',
    category: 'visual_diagnostics',
    iconName: 'Activity',
    theme: 'rose',
    route: 'ecg_drill',
    estimatedMinutes: 10,
  },
  {
    id: 'derm_drill',
    label: 'Derm Recognition',
    description: 'Identify skin lesions and dermatological findings',
    category: 'visual_diagnostics',
    iconName: 'Scan',
    theme: 'pink',
    route: 'derm_drill',
    estimatedMinutes: 10,
  },
  {
    id: 'imaging_drill',
    label: 'Imaging Review',
    description: 'X-ray, CT, and MRI pattern recognition',
    category: 'visual_diagnostics',
    iconName: 'Image',
    theme: 'slate',
    route: 'imaging_drill',
    estimatedMinutes: 10,
  },
  {
    id: 'mini_lab',
    label: 'Lab Interpretation',
    description: 'CBC, CMP, and specialty lab panels',
    category: 'visual_diagnostics',
    iconName: 'FlaskConical',
    theme: 'emerald',
    route: 'mini_lab',
    estimatedMinutes: 8,
  },
  {
    id: 'radiology_scroll',
    label: 'Radiology Scroll',
    description: 'Interactive CT/MRI slice viewing',
    category: 'visual_diagnostics',
    iconName: 'Layers',
    theme: 'slate',
    route: 'radiology_scroll',
    isComingSoon: true,
    estimatedMinutes: 15,
  },
];

// CLINICAL SIMULATION
export const CLINICAL_SIMULATION_MODES: TrainingModeConfig[] = [
  {
    id: 'fluid_electrolyte',
    label: 'Fluids & Electrolytes',
    description: 'IVF selection and electrolyte management',
    category: 'clinical_simulation',
    iconName: 'Droplets',
    theme: 'cyan',
    route: 'fluid_electrolyte',
    estimatedMinutes: 10,
  },
  {
    id: 'ventilator_hero',
    label: 'Ventilator Management',
    description: 'Adjust vent settings for ARDS, COPD, critical patients',
    category: 'clinical_simulation',
    iconName: 'Wind',
    theme: 'blue',
    route: 'ventilator_hero',
    isComingSoon: true,
    estimatedMinutes: 15,
  },
  {
    id: 'ddx_compare',
    label: 'DDx Compare',
    description: 'Side-by-side differential diagnosis',
    category: 'clinical_simulation',
    iconName: 'GitCompare',
    theme: 'blue',
    route: 'ddx_compare',
    estimatedMinutes: 10,
  },
  {
    id: 'polypharmacy_puzzle',
    label: 'Polypharmacy Puzzle',
    description: 'Geriatric deprescribing challenge',
    category: 'clinical_simulation',
    iconName: 'PillBottle',
    theme: 'amber',
    route: 'polypharmacy_puzzle',
    isComingSoon: true,
    panreOnly: true,
    estimatedMinutes: 12,
  },
];

// QUESTION PRACTICE (including pharm/abx)
export const QUESTION_PRACTICE_MODES: TrainingModeConfig[] = [
  {
    id: 'pharmacology',
    label: 'Pharmacology',
    description: 'Drug mechanisms, side effects, and interactions',
    category: 'question_practice',
    iconName: 'Beaker',
    theme: 'purple',
    route: 'pharmacology',
    estimatedMinutes: 10,
  },
  {
    id: 'antibiotic_mode',
    label: 'Bug-Drug Mastery',
    description: 'Antibiotic selection by pathogen and resistance',
    category: 'question_practice',
    iconName: 'Pill',
    theme: 'green',
    route: 'antibiotic_mode',
    estimatedMinutes: 8,
  },
  {
    id: 'physiology_drill',
    label: 'Physiology Review',
    description: 'Organ system physiology and pathophysiology',
    category: 'question_practice',
    iconName: 'Heart',
    theme: 'red',
    route: 'physiology_drill',
    isComingSoon: true,
    estimatedMinutes: 12,
  },
  {
    id: 'system_drill',
    label: 'System Drill',
    description: 'Master an entire organ system',
    category: 'question_practice',
    iconName: 'Layers',
    theme: 'indigo',
    route: 'system_drill',
    estimatedMinutes: 15,
  },
  {
    id: 'subcategory_drill',
    label: 'Subcategory Drill',
    description: 'Focus on specific disease categories',
    category: 'question_practice',
    iconName: 'FolderTree',
    theme: 'violet',
    route: 'subcategory_drill',
    estimatedMinutes: 12,
  },
  {
    id: 'condition_drill',
    label: 'Condition Deep Dive',
    description: 'Master individual conditions in detail',
    category: 'question_practice',
    iconName: 'Target',
    theme: 'teal',
    route: 'condition_drill',
    estimatedMinutes: 10,
  },
];

// SPECIALTY DRILLS (rapid recall, first-line, wordle, code blue, guideline, cram)
export const SPECIALTY_DRILL_MODES: TrainingModeConfig[] = [
  {
    id: 'rapid_recall',
    label: 'Rapid Recall',
    description: 'High-yield buzzwords & flashcards',
    category: 'specialty_drills',
    iconName: 'Zap',
    theme: 'amber',
    route: 'rapid_recall',
    estimatedMinutes: 5,
  },
  {
    id: 'first_line_treatment',
    label: 'First-Line Treatments',
    description: 'What is the go-to treatment?',
    category: 'specialty_drills',
    iconName: 'Pill',
    theme: 'cyan',
    route: 'first_line_treatment',
    estimatedMinutes: 8,
  },
  {
    id: 'medical_wordle',
    label: 'Daily Term Challenge',
    description: 'Medical word guessing game',
    category: 'specialty_drills',
    iconName: 'Hash',
    theme: 'green',
    route: 'medical_wordle',
    estimatedMinutes: 3,
  },
  {
    id: 'code_blue_speed',
    label: 'Code Blue Speed',
    description: 'Timed ACLS/PALS rapid-fire',
    category: 'specialty_drills',
    iconName: 'Siren',
    theme: 'red',
    route: 'code_blue_speed',
    estimatedMinutes: 5,
  },
  {
    id: 'guideline_drill',
    label: 'Clinical Guidelines',
    description: 'Scoring systems & clinical criteria',
    category: 'specialty_drills',
    iconName: 'FileCheck',
    theme: 'teal',
    route: 'guideline_drill',
    estimatedMinutes: 8,
  },
  {
    id: 'cram_mode',
    label: 'Cram Session',
    description: '50 highest-yield questions',
    category: 'specialty_drills',
    iconName: 'Clock',
    theme: 'orange',
    route: 'cram_mode',
    estimatedMinutes: 30,
  },
  {
    id: 'commuter_mode',
    label: 'Commuter Mode',
    description: 'Audio-based studying on-the-go',
    category: 'specialty_drills',
    iconName: 'Headphones',
    theme: 'cyan',
    route: 'commuter_mode',
    isComingSoon: true,
    estimatedMinutes: 15,
  },
];

// STANDALONE MODES

export const CORE_ADAPTIVE_MODE: TrainingModeConfig = {
  id: 'core_adaptive',
  label: 'Adaptive Questions',
  description: 'AI-powered adaptive board-style exam practice',
  category: 'question_practice',
  iconName: 'Brain',
  theme: 'slate',
  route: 'core_adaptive',
  estimatedMinutes: 30,
};

export const OSCE_MODE: TrainingModeConfig = {
  id: 'patient_encounter',
  label: 'Virtual OSCE',
  description: 'Full interactive patient encounters with AI scoring',
  category: 'clinical_simulation',
  iconName: 'MessageSquare',
  theme: 'teal',
  route: 'patient_encounter',
  estimatedMinutes: 20,
};

export const GRAND_ROUNDS_MODE: TrainingModeConfig = {
  id: 'grand_rounds',
  label: 'Grand Rounds',
  description: 'Daily challenge - same questions for everyone',
  category: 'specialty_drills',
  iconName: 'Trophy',
  theme: 'amber',
  route: 'grand_rounds',
  estimatedMinutes: 15,
};

export const PANRE_LA_MODE: TrainingModeConfig = {
  id: 'panre_la',
  label: 'PANRE-LA Simulator',
  description: 'Longitudinal assessment format for recertification',
  category: 'question_practice',
  iconName: 'GraduationCap',
  theme: 'indigo',
  route: 'panre_la',
  panreOnly: true,
  estimatedMinutes: 25,
};

// Combined registries
export const MODE_REGISTRY: TrainingModeConfig[] = [
  CORE_ADAPTIVE_MODE,
  ...VISUAL_DIAGNOSTICS_MODES,
  ...CLINICAL_SIMULATION_MODES,
  ...QUESTION_PRACTICE_MODES,
  ...SPECIALTY_DRILL_MODES,
  OSCE_MODE,
  GRAND_ROUNDS_MODE,
  PANRE_LA_MODE,
];

export function getModesByCategory(category: TrainingCategory): TrainingModeConfig[] {
  return MODE_REGISTRY.filter(m => m.category === category);
}

export function getModesForUserContext(isPANREUser: boolean): TrainingModeConfig[] {
  return MODE_REGISTRY.filter(mode => {
    if (mode.panreOnly && !isPANREUser) return false;
    return true;
  });
}

export function getAvailableModes(): TrainingModeConfig[] {
  return MODE_REGISTRY.filter(m => !m.isComingSoon);
}

export function getModeById(id: TrainingModeId): TrainingModeConfig | undefined {
  return MODE_REGISTRY.find(m => m.id === id);
}

export const MODES_WITH_DEDICATED_ROUTES: TrainingModeId[] = MODE_REGISTRY
  .filter(m => m.route !== 'core_adaptive')
  .map(m => m.id);

export const ALL_MINI_MODES: TrainingModeId[] = MODE_REGISTRY
  .filter(m => m.id !== 'core_adaptive')
  .map(m => m.id);
