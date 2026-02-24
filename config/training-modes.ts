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
  | 'reasoning_tutor'
  | 'photo_drill'
  | 'ecg_drill'
  | 'derm_drill'
  | 'imaging_drill'
  | 'rapid_recall'
  | 'ddx_compare'
  | 'contrastive_drill'
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
  | 'ventilator_hero'
  | 'polypharmacy_puzzle'
  | 'physiology_drill'
  | 'anatomy_review'
  | 'medical_wordle'
  | 'cram_mode'
  | 'pance_simulator'
  | 'radiology_scroll' // Future mode - not yet in MODE_REGISTRY
  | 'commuter_mode';

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
  const normalized = mode.replaceAll('-', '_').toUpperCase();
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
  /** When true, hide from Practicing PAs (declutter didactic-only tools like Anatomy Review) */
  didacticOnly?: boolean;
  estimatedMinutes?: number;
}

export const CATEGORY_INFO: Record<
  TrainingCategory,
  {
    label: string;
    description: string;
    iconName: string;
  }
> = {
  visual_diagnostics: {
    label: 'Visual Diagnostics',
    description: 'Image-based drills only — ECG, derm, radiology (no text scenarios)',
    iconName: 'Eye',
  },
  clinical_simulation: {
    label: 'Clinical Simulation',
    description: 'Text-based scenarios — fluids, labs, cases (no image interpretation)',
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
    theme: 'stone',
    route: '/core-adaptive',
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
    route: '/modes/ecg-drill',
    estimatedMinutes: 10,
  },
  {
    id: 'derm_drill',
    label: 'Derm Recognition',
    description: 'Identify skin lesions and rashes',
    category: 'visual_diagnostics',
    iconName: 'Image',
    theme: 'pink',
    route: '/modes/derm-drill',
    estimatedMinutes: 10,
  },
  {
    id: 'imaging_drill',
    label: 'Radiology Review',
    description: 'X-ray, CT, and MRI pattern recognition',
    category: 'visual_diagnostics',
    iconName: 'Scan',
    theme: 'slate',
    route: '/modes/imaging-drill',
    estimatedMinutes: 10,
  },
  {
    id: 'photo_drill',
    label: 'Photo Drill',
    description: 'General image recognition and clinical photo interpretation',
    category: 'visual_diagnostics',
    iconName: 'Image',
    theme: 'amber',
    route: '/modes/photo-drill',
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
    route: '/modes/fluid-electrolyte',
    estimatedMinutes: 10,
  },
  {
    id: 'reasoning_tutor',
    label: 'Reasoning Tutor',
    description: 'Chat-based differential diagnosis and tutoring with your weak spots in mind',
    category: 'clinical_simulation',
    iconName: 'Brain',
    theme: 'slate',
    route: '/modes/reasoning-tutor',
    estimatedMinutes: 15,
  },
  {
    id: 'mini_lab',
    label: 'Lab Interpretation',
    description: 'CBC, CMP, and specialty lab analysis',
    category: 'clinical_simulation',
    iconName: 'ClipboardList',
    theme: 'emerald',
    route: '/modes/mini-lab',
    estimatedMinutes: 8,
  },
  {
    id: 'ventilator_hero',
    label: 'Ventilator Management',
    description: 'Adjust vent settings',
    category: 'clinical_simulation',
    iconName: 'Wind',
    theme: 'blue',
    route: '/modes/ventilator-hero',
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
    route: '/modes/pharmacology',
    estimatedMinutes: 10,
  },
  {
    id: 'physiology_drill',
    label: 'Physiology Review',
    description: 'Organ system physiology',
    category: 'question_practice',
    iconName: 'Flame',
    theme: 'red',
    route: '/modes/physiology-drill',
    estimatedMinutes: 12,
  },
  {
    id: 'anatomy_review',
    label: 'Anatomy Review',
    description: 'Regional anatomy',
    category: 'question_practice',
    iconName: 'Hash',
    theme: 'stone',
    route: '/modes/anatomy-review',
    estimatedMinutes: 15,
    didacticOnly: true,
  },
  {
    id: 'system_drill',
    label: 'System Drill',
    description: 'Master an entire organ system',
    category: 'question_practice',
    iconName: 'Layers',
    theme: 'indigo',
    route: '/modes/system-drill',
    estimatedMinutes: 15,
  },
  {
    id: 'subcategory_drill',
    label: 'Subcategory Drill',
    description: 'Focus on specific disease groups',
    category: 'question_practice',
    iconName: 'FileText',
    theme: 'violet',
    route: '/modes/subcategory-drill',
    estimatedMinutes: 12,
  },
  {
    id: 'condition_drill',
    label: 'Condition Deep Dive',
    description: 'Master individual conditions',
    category: 'question_practice',
    iconName: 'AlertTriangle',
    theme: 'teal',
    route: '/modes/condition-drill',
    estimatedMinutes: 10,
  },
  // --- SPECIALTY DRILLS ---
  {
    id: 'rapid_recall',
    label: 'Rapid Recall',
    description: 'High-intensity rapid-fire questions with buzzwords & associations',
    category: 'specialty_drills',
    iconName: 'Zap',
    theme: 'amber',
    route: '/modes/rapid-recall',
    estimatedMinutes: 15,
  },
  {
    id: 'antibiotic_mode',
    label: 'Bug-Drug Mastery',
    description: 'Antibiotic selection by organism',
    category: 'specialty_drills',
    iconName: 'Pill',
    theme: 'green',
    route: '/modes/antibiotic-mode',
    estimatedMinutes: 8,
  },
  {
    id: 'first_line_treatment',
    label: 'First-Line Treatments',
    description: '"Go-to" treatment selection',
    category: 'specialty_drills',
    iconName: 'PillBottle',
    theme: 'cyan',
    route: '/modes/first-line-treatment',
    estimatedMinutes: 8,
  },
  {
    id: 'guideline_drill',
    label: 'Clinical Guidelines',
    description: 'Scoring systems & clinical criteria',
    category: 'specialty_drills',
    iconName: 'FileCheck',
    theme: 'teal',
    route: '/modes/guideline-drill',
    estimatedMinutes: 8,
  },
  {
    id: 'ddx_compare',
    label: 'Differential Diagnosis',
    description: 'Side-by-side comparison & fine distinctions between similar conditions',
    category: 'specialty_drills',
    iconName: 'GitCompare',
    theme: 'blue',
    route: '/modes/ddx-compare',
    estimatedMinutes: 12,
  },
  {
    id: 'contrastive_drill',
    label: 'Contrastive Learning',
    description: 'One symptom, many causes - master distinguishing features',
    category: 'specialty_drills',
    iconName: 'Target',
    theme: 'violet',
    route: '/modes/contrastive-drill',
    estimatedMinutes: 10,
  },
  {
    id: 'code_blue_speed',
    label: 'Code Blue Speed',
    description: 'Timed ACLS/PALS rapid-fire scenarios',
    category: 'specialty_drills',
    iconName: 'Siren',
    theme: 'red',
    route: '/modes/code-blue-speed',
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
    route: '/modes/patient-encounter',
    estimatedMinutes: 20,
  },
  {
    id: 'grand_rounds',
    label: 'Grand Rounds',
    description: 'Daily challenge - same questions for everyone',
    category: 'specialty_drills',
    iconName: 'Trophy',
    theme: 'amber',
    route: '/modes/grand-rounds',
    estimatedMinutes: 15,
  },
  {
    id: 'commuter_mode',
    label: 'Commuter Mode',
    description: 'Hands‑free voice‑driven question practice for driving, commuting, or low‑visibility contexts',
    category: 'question_practice',
    iconName: 'Headphones',
    theme: 'indigo',
    route: '/modes/commuter-mode',
    estimatedMinutes: 10,
  },
  {
    id: 'panre_la',
    label: 'PANRE-LA Simulator',
    description: 'Longitudinal assessment format for recertification',
    category: 'question_practice',
    iconName: 'GraduationCap',
    theme: 'indigo',
    route: '/modes/panre-la',
    panreOnly: true,
    estimatedMinutes: 25,
  },
  {
    id: 'pance_simulator',
    label: 'PANCE Simulator',
    description: 'Strict, high-contrast, timed exam simulation with zero feedback loops and fatigue tracking',
    category: 'question_practice',
    iconName: 'Monitor',
    theme: 'slate',
    route: '/modes/pance-simulator',
    estimatedMinutes: 60,
  },

  // --- ADDITIONAL MODES FOR COVERAGE ---
  // cram_mode removed – merged into rapid_recall (see training-modes.test.ts)
  {
    id: 'polypharmacy_puzzle',
    label: 'Polypharmacy Puzzle',
    description: 'Manage complex med lists - identify interactions and optimize therapy',
    category: 'clinical_simulation',
    iconName: 'Pill',
    theme: 'emerald',
    route: '/modes/polypharmacy-puzzle',
    estimatedMinutes: 12,
  },
  {
    id: 'medical_wordle',
    label: 'Medical Wordle',
    description: 'Daily medical term puzzle - guess in 6 tries',
    category: 'specialty_drills',
    iconName: 'Grid3x3',
    theme: 'violet',
    route: '/modes/medical-wordle',
    estimatedMinutes: 5,
  },
];

// ============================================================================
// Derived mode arrays by category
// ============================================================================

// Standalone modes that have their own dedicated tabs (NOT in training menu categories)
const STANDALONE_MODE_IDS: readonly string[] = [
  'core_adaptive',
  'patient_encounter',
  'grand_rounds',
  'commuter_mode',
];

// Filter modes by category, EXCLUDING standalone modes that have their own tabs
export const VISUAL_DIAGNOSTICS_MODES = TRAINING_MODES.filter(
  (m) => m.category === 'visual_diagnostics' && !STANDALONE_MODE_IDS.includes(m.id)
);

export const CLINICAL_SIMULATION_MODES = TRAINING_MODES.filter(
  (m) => m.category === 'clinical_simulation' && !STANDALONE_MODE_IDS.includes(m.id)
);

export const QUESTION_PRACTICE_MODES = TRAINING_MODES.filter(
  (m) => m.category === 'question_practice' && !STANDALONE_MODE_IDS.includes(m.id)
);

export const SPECIALTY_DRILL_MODES = TRAINING_MODES.filter(
  (m) => m.category === 'specialty_drills' && !STANDALONE_MODE_IDS.includes(m.id)
);

// Individual standalone mode references
export const CORE_ADAPTIVE_MODE = TRAINING_MODES.find((m) => m.id === 'core_adaptive')!;
export const OSCE_MODE = TRAINING_MODES.find((m) => m.id === 'patient_encounter')!;
export const GRAND_ROUNDS_MODE = TRAINING_MODES.find((m) => m.id === 'grand_rounds')!;
export const PANRE_LA_MODE = TRAINING_MODES.find((m) => m.id === 'panre_la')!;

// ============================================================================
// Combined registries
// ============================================================================

// MODE_REGISTRY is simply all TRAINING_MODES - the grouped arrays are just convenience exports
export const MODE_REGISTRY: TrainingModeConfig[] = TRAINING_MODES;

export function getModesByCategory(category: TrainingCategory): TrainingModeConfig[] {
  return MODE_REGISTRY.filter((m) => m.category === category);
}

export function getModesForUserContext(isPANREUser: boolean): TrainingModeConfig[] {
  return MODE_REGISTRY.filter((mode) => {
    if (mode.panreOnly && !isPANREUser) return false;
    if (mode.didacticOnly && isPANREUser) return false;
    return true;
  });
}

export function getAvailableModes(): TrainingModeConfig[] {
  return MODE_REGISTRY.filter((m) => !m.isComingSoon);
}

export function getModeById(id: TrainingModeId): TrainingModeConfig | undefined {
  return MODE_REGISTRY.find((m) => m.id === id);
}

export const MODES_WITH_DEDICATED_ROUTES: TrainingModeId[] = MODE_REGISTRY.filter(
  (m) => m.route !== 'core_adaptive'
).map((m) => m.id);

export const ALL_MINI_MODES: TrainingModeId[] = MODE_REGISTRY.filter(
  (m) => m.id !== 'core_adaptive'
).map((m) => m.id);

// ============================================================================
// Outcome-based grouping (for "What do you want to focus on?" — reduce decision paralysis)
// Group by goal, not by format (Drill vs Quiz).
// ============================================================================

export type StudyOutcomeId = 'learn' | 'test' | 'fix';

export const STUDY_OUTCOME_GROUPS: Record<
  StudyOutcomeId,
  { label: string; description: string; modeIds: TrainingModeId[] }
> = {
  learn: {
    label: 'Learn New Material',
    description: 'Physiology, anatomy, reasoning',
    modeIds: ['physiology_drill', 'anatomy_review', 'reasoning_tutor'],
  },
  test: {
    label: 'Test My Knowledge',
    description: 'Drills, sims, and practice questions',
    modeIds: [
      'system_drill',
      'subcategory_drill',
      'condition_drill',
      'rapid_recall',
      'ecg_drill',
      'derm_drill',
      'imaging_drill',
      'photo_drill',
      'fluid_electrolyte',
      'mini_lab',
      'guideline_drill',
      'pharmacology',
      'first_line_treatment',
      'antibiotic_mode',
      'ddx_compare',
      'contrastive_drill',
      'code_blue_speed',
      'ventilator_hero',
    ],
  },
  fix: {
    label: 'Fix My Weaknesses',
    description: 'Focus on areas that need review',
    modeIds: [], // Handled as special CTA: start session focused on weak areas
  },
};
