/**
 * Training Mode Configuration
 * 
 * ORGANIZATION PHILOSOPHY:
 * Modes are organized by PRIMARY LEARNING ACTIVITY TYPE.
 * 
 * Categories:
 * 1. VISUAL DIAGNOSTICS - Pattern recognition with images/media (3 modes - 1 row)
 * 2. CLINICAL SIMULATION - Interactive patient scenarios (6 modes - 2 rows)
 * 3. QUESTION PRACTICE - Traditional Q&A including pharm/abx, cram, rapid recall (9 modes - 3 rows)
 * 4. SPECIALTY DRILLS - High-yield focused drills (6 modes - 2 rows)
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
  | 'medical_wordle'
  | 'ventilator_hero'
  | 'polypharmacy_puzzle'
  | 'radiology_scroll'
  | 'physiology_drill'
  | 'anatomy_review';

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
    description: 'High-yield focused drills for specific areas',
    iconName: 'Target',
  },
};

export interface StudyPreset {
  id: string;
  label: string;
  description: string;
  iconName: string;
  settings: {
    count: number;
    difficulty: 'same' | 'easier' | 'harder';
    focus: 'all' | 'unseen' | 'incorrect' | 'bookmarked';
    systems?: string[];
    durationMinutes: number;
  };
}

export const STUDY_PRESETS: StudyPreset[] = [
  {
    id: 'quick_review',
    label: 'Quick 10-Min Review',
    description: 'A fast-paced review of 10 questions from your weak areas.',
    iconName: 'Zap',
    settings: {
      count: 10,
      difficulty: 'same',
      focus: 'incorrect',
      durationMinutes: 10,
    },
  },
  {
    id: 'cardiology_deep_dive',
    label: 'Cardiology Deep Dive',
    description: 'A focused 30-minute session on cardiovascular topics.',
    iconName: 'HeartPulse',
    settings: {
      count: 25,
      difficulty: 'same',
      focus: 'all',
      systems: ['Cardiovascular'],
      durationMinutes: 30,
    },
  },
  {
    id: 'weakest_topics_drill',
    label: 'Weakest Topics Drill',
    description: 'Tackle 20 questions from topics you struggle with the most.',
    iconName: 'TrendingDown',
    settings: {
      count: 20,
      difficulty: 'harder',
      focus: 'incorrect',
      durationMinutes: 25,
    },
  },
  {
    id: 'unseen_marathon',
    label: 'Unseen Marathon',
    description: 'A comprehensive block of 50 new questions.',
    iconName: 'Sparkles',
    settings: {
      count: 50,
      difficulty: 'same',
      focus: 'unseen',
      durationMinutes: 60,
    },
  },
];

export const TRAINING_MODES: TrainingModeConfig[] = [
  // --- CORE ADAPTIVE (MAIN EVENT) ---
  {
    id: 'core_adaptive',
    label: 'Adaptive Questions',
    description: 'AI-powered adaptive board-style exam practice',
    category: 'question_practice',
    iconName: 'Brain',
    theme: 'slate',
    route: 'core_adaptive',
    estimatedMinutes: 30,
  },
  // --- VISUAL DIAGNOSTICS ---
  {
    id: 'ecg_drill',
    label: 'ECG Interpretation',
    description: 'Rhythm strips and 12-lead mastery',
    category: 'visual_diagnostics',
    iconName: 'Activity',
    theme: 'rose',
    route: 'ecg_drill',
    estimatedMinutes: 10,
  },
  {
    id: 'derm_drill',
    label: 'Derm Recognition',
    description: 'Identify skin lesions and rashes',
    category: 'visual_diagnostics',
    iconName: 'Scan',
    theme: 'pink',
    route: 'derm_drill',
    estimatedMinutes: 10,
  },
  {
    id: 'imaging_drill',
    label: 'Radiology Review',
    description: 'X-ray, CT, and MRI pattern recognition',
    category: 'visual_diagnostics',
    iconName: 'Image',
    theme: 'slate',
    route: 'imaging_drill',
    estimatedMinutes: 10,
  },
  // --- CLINICAL SIMULATION ---
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
    id: 'mini_lab',
    label: 'Lab Interpretation',
    description: 'CBC, CMP, and specialty lab analysis',
    category: 'clinical_simulation',
    iconName: 'FlaskConical',
    theme: 'emerald',
    route: 'mini_lab',
    estimatedMinutes: 8,
  },
  {
    id: 'ventilator_hero',
    label: 'Ventilator Management',
    description: 'Adjust vent settings',
    category: 'clinical_simulation',
    iconName: 'Wind',
    theme: 'blue',
    route: 'ventilator_hero',
    estimatedMinutes: 15,
  },
  // --- QUESTION PRACTICE ---
  {
    id: 'pharmacology',
    label: 'Pharmacology Quiz',
    description: 'Drug mechanisms, side effects',
    category: 'question_practice',
    iconName: 'Beaker',
    theme: 'purple',
    route: 'pharmacology',
    estimatedMinutes: 10,
  },
  {
    id: 'physiology_drill',
    label: 'Physiology Review',
    description: 'Organ system physiology',
    category: 'question_practice',
    iconName: 'Heart',
    theme: 'red',
    route: 'physiology_drill',
    estimatedMinutes: 12,
  },
  {
    id: 'anatomy_review',
    label: 'Anatomy Review',
    description: 'Regional anatomy',
    category: 'question_practice',
    iconName: 'Bone',
    theme: 'stone',
    route: 'anatomy_review',
    estimatedMinutes: 15,
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
    description: 'Focus on specific disease groups',
    category: 'question_practice',
    iconName: 'FolderTree',
    theme: 'violet',
    route: 'subcategory_drill',
    estimatedMinutes: 12,
  },
  {
    id: 'condition_drill',
    label: 'Condition Deep Dive',
    description: 'Master individual conditions',
    category: 'question_practice',
    iconName: 'Target',
    theme: 'teal',
    route: 'condition_drill',
    estimatedMinutes: 10,
  },
  // --- SPECIALTY DRILLS ---
  {
    id: 'rapid_recall',
    label: 'Rapid Recall',
    description: 'High-yield buzzwords & associations',
    category: 'specialty_drills',
    iconName: 'Zap',
    theme: 'amber',
    route: 'rapid_recall',
    estimatedMinutes: 5,
  },
  {
    id: 'antibiotic_mode',
    label: 'Bug-Drug Mastery',
    description: 'Antibiotic selection by organism',
    category: 'specialty_drills',
    iconName: 'Pill',
    theme: 'green',
    route: 'antibiotic_mode',
    estimatedMinutes: 8,
  },
  {
    id: 'first_line_treatment',
    label: 'First-Line Treatments',
    description: '"Go-to" treatment selection',
    category: 'specialty_drills',
    iconName: 'Pill',
    theme: 'cyan',
    route: 'first_line_treatment',
    estimatedMinutes: 8,
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
    id: 'ddx_compare',
    label: 'DDx Compare',
    description: 'Side-by-side differential diagnosis builder',
    category: 'specialty_drills',
    iconName: 'GitCompare',
    theme: 'blue',
    route: 'ddx_compare',
    estimatedMinutes: 10,
  },
  {
    id: 'code_blue_speed',
    label: 'Code Blue Speed',
    description: 'Timed ACLS/PALS rapid-fire scenarios',
    category: 'specialty_drills',
    iconName: 'Siren',
    theme: 'red',
    route: 'code_blue_speed',
    estimatedMinutes: 5,
  },
  // --- STANDALONE MODES ---
  {
    id: 'patient_encounter',
    label: 'Virtual OSCE',
    description: 'Full interactive patient encounters with AI scoring',
    category: 'clinical_simulation',
    iconName: 'MessageSquare',
    theme: 'teal',
    route: 'patient_encounter',
    estimatedMinutes: 20,
  },
  {
    id: 'grand_rounds',
    label: 'Grand Rounds',
    description: 'Daily challenge - same questions for everyone',
    category: 'specialty_drills',
    iconName: 'Trophy',
    theme: 'amber',
    route: 'grand_rounds',
    estimatedMinutes: 15,
  },
  {
    id: 'panre_la',
    label: 'PANRE-LA Simulator',
    description: 'Longitudinal assessment format for recertification',
    category: 'question_practice',
    iconName: 'GraduationCap',
    theme: 'indigo',
    route: 'panre_la',
    panreOnly: true,
    estimatedMinutes: 25,
  },
];

// ============================================================================
// Derived mode arrays by category
// ============================================================================

// Standalone modes that have their own dedicated tabs (NOT in training menu categories)
const STANDALONE_MODE_IDS = ['core_adaptive', 'patient_encounter', 'grand_rounds'] as const;

// Filter modes by category, EXCLUDING standalone modes that have their own tabs
export const VISUAL_DIAGNOSTICS_MODES = TRAINING_MODES.filter(
  m => m.category === 'visual_diagnostics' && !STANDALONE_MODE_IDS.includes(m.id as typeof STANDALONE_MODE_IDS[number])
);

export const CLINICAL_SIMULATION_MODES = TRAINING_MODES.filter(
  m => m.category === 'clinical_simulation' && !STANDALONE_MODE_IDS.includes(m.id as typeof STANDALONE_MODE_IDS[number])
);

export const QUESTION_PRACTICE_MODES = TRAINING_MODES.filter(
  m => m.category === 'question_practice' && !STANDALONE_MODE_IDS.includes(m.id as typeof STANDALONE_MODE_IDS[number])
);

export const SPECIALTY_DRILL_MODES = TRAINING_MODES.filter(
  m => m.category === 'specialty_drills' && !STANDALONE_MODE_IDS.includes(m.id as typeof STANDALONE_MODE_IDS[number])
);

// Individual standalone mode references
export const CORE_ADAPTIVE_MODE = TRAINING_MODES.find(m => m.id === 'core_adaptive')!;
export const OSCE_MODE = TRAINING_MODES.find(m => m.id === 'patient_encounter')!;
export const GRAND_ROUNDS_MODE = TRAINING_MODES.find(m => m.id === 'grand_rounds')!;
export const PANRE_LA_MODE = TRAINING_MODES.find(m => m.id === 'panre_la')!;

// ============================================================================
// Combined registries
// ============================================================================

// MODE_REGISTRY is simply all TRAINING_MODES - the grouped arrays are just convenience exports
export const MODE_REGISTRY: TrainingModeConfig[] = TRAINING_MODES;

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
