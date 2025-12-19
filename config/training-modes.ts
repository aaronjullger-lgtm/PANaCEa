/**
 * Training Mode Configuration for the "Training Command Center" dashboard.
 * This file defines the metadata for all available study modes, allowing
 * UI rendering to be driven from configuration rather than hardcoded JSX.
 */

/**
 * Union type of all available training mode identifiers.
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
  | 'mastery_drill'
  | 'mini_lab'
  | 'first_line_treatment'
  | 'pharmacology'
  | 'condition_drill'
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
  | 'triage_tent'
  | 'polypharmacy_puzzle'
  | 'radiology_scroll';

// Modes that count toward ranked stats/FSRS pipelines
export const RANKED_MODES = ['GRAND_ROUNDS', 'SMART_REVIEW', 'PANCE_SIMULATOR'] as const;

/** Helper to check ranked status across legacy/lowercase identifiers */
export function isRankedMode(mode?: string | null): boolean {
  if (!mode) return false;
  const normalized = mode.replace(/-/g, '_').toUpperCase();
  return RANKED_MODES.includes(normalized as (typeof RANKED_MODES)[number]);
}

/**
 * Configuration interface for training mode cards.
 * Defines the metadata needed to render a mode card in the UI.
 */
export interface TrainingModeConfig {
  /** Unique identifier for the training mode */
  id: TrainingModeId;
  /** Display title for the mode card */
  label: string;
  /** Subtext/description displayed below the title */
  description: string;
  /** Category grouping for the mode */
  category: 'core' | 'visual' | 'recall' | 'mastery' | 'pharmacology' | 'clinical';
  /** Icon name (mapped to Lucide-React icons) */
  iconName: string;
  /** Theme color for Tailwind styling */
  theme: string;
  /** Navigation route when the mode is selected */
  route: string;
  /** Flag to indicate if the feature is not yet available */
  isComingSoon?: boolean;
}

/**
 * Central registry of all training modes.
 * Use this to render mode selection cards in the Training Command Center.
 */
export const MODE_REGISTRY: TrainingModeConfig[] = [
  {
    id: 'core_adaptive',
    label: 'Core Adaptive',
    description: 'PANCE-level unique questions based on growth areas.',
    category: 'core',
    iconName: 'Brain',
    theme: 'stone',
    route: '/session/core-adaptive',
  },
  // Visual Drill Modes - Split from Global Photo Mode
  {
    id: 'ecg_drill',
    label: 'ECG Interpretation',
    description: 'Master rhythm strips and 12-lead ECG patterns.',
    category: 'visual',
    iconName: 'Activity',
    theme: 'rose',
    route: '/drill/ecg',
  },
  {
    id: 'derm_drill',
    label: 'Derm Recognition',
    description: 'Identify skin lesions and dermatological findings.',
    category: 'visual',
    iconName: 'Scan',
    theme: 'pink',
    route: '/drill/derm',
  },
  {
    id: 'imaging_drill',
    label: 'Imaging Review',
    description: 'X-ray, CT, and MRI pattern recognition.',
    category: 'visual',
    iconName: 'Image',
    theme: 'slate',
    route: '/drill/imaging',
  },
  {
    id: 'mini_lab',
    label: 'Mini Lab Mode',
    description: 'Diagnose from structured lab results.',
    category: 'visual',
    iconName: 'ClipboardList',
    theme: 'emerald',
    route: '/drill/mini-lab',
  },
  // Recall Modes
  {
    id: 'rapid_recall',
    label: 'Rapid Recall',
    description: 'High-yield buzzwords & flashcards.',
    category: 'recall',
    iconName: 'Zap',
    theme: 'amber',
    route: '/session/rapid-recall',
  },
  {
    id: 'ddx_compare',
    label: 'DDx Compare',
    description: 'Confusion mapping & side-by-side comparison.',
    category: 'recall',
    iconName: 'GitCompare',
    theme: 'blue',
    route: '/session/ddx-compare',
  },
  {
    id: 'guideline_drill',
    label: 'Guideline Mode',
    description: 'Scoring systems & clinical criteria.',
    category: 'recall',
    iconName: 'FileCheck',
    theme: 'teal',
    route: '/guidelines',
    isComingSoon: false,
  },
  {
    id: 'condition_drill',
    label: 'Condition Drill',
    description: '5-stage progressive drills for any condition.',
    category: 'recall',
    iconName: 'Layers',
    theme: 'violet',
    route: '/drill/condition',
    isComingSoon: true,
  },
  // Pharmacology Modes
  {
    id: 'first_line_treatment',
    label: 'First Line Treatment',
    description: 'What is the go-to treatment for each condition?',
    category: 'pharmacology',
    iconName: 'Pill',
    theme: 'cyan',
    route: '/drill/first-line',
    isComingSoon: false,
  },
  {
    id: 'pharmacology',
    label: 'Pharmacology Quiz',
    description: 'Drug mechanisms, side effects, and interactions.',
    category: 'pharmacology',
    iconName: 'Beaker',
    theme: 'purple',
    route: '/drill/pharm',
    isComingSoon: false,
  },
  // Mastery Mode
  {
    id: 'mastery_drill',
    label: 'Streak Challenge',
    description: 'Answer until you miss. How long can you survive?',
    category: 'mastery',
    iconName: 'Flame',
    theme: 'red',
    route: '/session/mastery-drill',
  },
  // Clinical Simulation Modes
  {
    id: 'fluid_electrolyte',
    label: 'Hydro-Mode',
    description: 'Fluid & electrolyte calculations with numeric validation.',
    category: 'clinical',
    iconName: 'Droplets',
    theme: 'cyan',
    route: '/drill/fluid-electrolyte',
    isComingSoon: false,
  },
  {
    id: 'antibiotic_mode',
    label: 'Bug-Drug Mastery',
    description: 'Antibiotic selection with rotating drill types.',
    category: 'clinical',
    iconName: 'Pill',
    theme: 'purple',
    route: '/drill/antibiotic',
    isComingSoon: false,
  },
  {
    id: 'patient_encounter',
    label: 'Virtual OSCE',
    description: 'Interactive patient interviews with scoring.',
    category: 'clinical',
    iconName: 'MessageSquare',
    theme: 'teal',
    route: '/drill/patient-encounter',
    isComingSoon: false,
  },
  {
    id: 'panre_la',
    label: 'PANRE-LA Simulator',
    description: 'Practice longitudinal assessment format with quarterly tracking.',
    category: 'mastery',
    iconName: 'GraduationCap',
    theme: 'indigo',
    route: '/panre-la',
    isComingSoon: false,
  },
  // Phase 7: Engagement & Sticky Features
  {
    id: 'code_blue_speed',
    label: 'Code Blue Speed Mode',
    description: 'Timed ACLS/PALS rapid-fire. 5 seconds per question!',
    category: 'clinical',
    iconName: 'Siren',
    theme: 'red',
    route: '/drill/code-blue',
    isComingSoon: false,
  },
  {
    id: 'grand_rounds',
    label: 'Grand Rounds Live',
    description: 'Weekly live quiz competitions (HQ Trivia style).',
    category: 'mastery',
    iconName: 'Trophy',
    theme: 'amber',
    route: '/drill/grand-rounds',
    isComingSoon: false,
  },
  {
    id: 'cram_mode',
    label: 'Cram Button',
    description: '50 highest-yield questions for rapid review.',
    category: 'core',
    iconName: 'Clock',
    theme: 'orange',
    route: '/drill/cram',
    isComingSoon: false,
  },
  // Phase 8: Accessibility & Commuter Learning
  {
    id: 'commuter_mode',
    label: 'Commuter Mode',
    description: 'Text-to-Speech with voice control for studying on-the-go.',
    category: 'core',
    iconName: 'Headphones',
    theme: 'cyan',
    route: '/drill/commuter',
    isComingSoon: true,
  },
  // Phase 38: Daily Rituals
  {
    id: 'medical_wordle',
    label: 'Daily Term Challenge',
    description: 'Daily medical word guessing game. 6 tries to guess the drug or condition!',
    category: 'recall',
    iconName: 'Hash',
    theme: 'green',
    route: '/drill/medical-wordle',
    isComingSoon: false,
  },
  // Phase 40: High-Fidelity Clinical Simulation
  {
    id: 'ventilator_hero',
    label: 'Ventilator Hero',
    description: 'Adjust vent settings to manage ARDS, COPD, and critical patients.',
    category: 'clinical',
    iconName: 'Wind',
    theme: 'blue',
    route: '/drill/ventilator-hero',
    isComingSoon: true,
  },
  {
    id: 'triage_tent',
    label: 'Triage Tent',
    description: 'Mass casualty triage. Swipe to categorize victims using START protocol.',
    category: 'clinical',
    iconName: 'AlertTriangle',
    theme: 'red',
    route: '/drill/triage-tent',
    isComingSoon: true,
  },
  {
    id: 'polypharmacy_puzzle',
    label: 'Polypharmacy Puzzle',
    description: 'Geriatrics deprescribing challenge. Which meds can be safely stopped?',
    category: 'clinical',
    iconName: 'PillBottle',
    theme: 'amber',
    route: '/drill/polypharmacy',
    isComingSoon: true,
  },
  {
    id: 'radiology_scroll',
    label: 'Radiology Scroll',
    description: 'Interactive DICOM viewer. Scroll through CT/MRI slices to find pathology.',
    category: 'visual',
    iconName: 'Layers',
    theme: 'slate',
    route: '/drill/radiology-scroll',
    isComingSoon: true,
  },
];

/**
 * Mode IDs that have dedicated routes/pages and should not fall back to core session.
 * Export this to maintain a single source of truth across components.
 */
export const MODES_WITH_DEDICATED_ROUTES: TrainingModeId[] = [
  'photo_drill', 
  'ecg_drill',
  'derm_drill',
  'imaging_drill',
  'rapid_recall', 
  'ddx_compare', 
  'mini_lab',
  'pharmacology',
  'first_line_treatment',
  'condition_drill',
  'guideline_drill',
  'fluid_electrolyte',
  'antibiotic_mode',
  'patient_encounter',
  'panre_la',
  'code_blue_speed',
  'grand_rounds',
  'cram_mode',
  'commuter_mode',
  'medical_wordle',
  'ventilator_hero',
  'triage_tent',
  'polypharmacy_puzzle',
  'radiology_scroll'
];

/**
 * All mini mode IDs (excludes core_adaptive and mastery_drill which are special modes).
 * Used for user preferences in settings.
 */
export const ALL_MINI_MODES: TrainingModeId[] = [
  'ecg_drill',
  'derm_drill',
  'imaging_drill',
  'mini_lab',
  'rapid_recall',
  'ddx_compare',
  'guideline_drill',
  'condition_drill',
  'first_line_treatment',
  'pharmacology',
  'fluid_electrolyte',
  'antibiotic_mode',
  'patient_encounter',
  'code_blue_speed',
  'grand_rounds',
  'cram_mode',
  'commuter_mode',
  'medical_wordle',
  'ventilator_hero',
  'triage_tent',
  'polypharmacy_puzzle',
  'radiology_scroll'
];
