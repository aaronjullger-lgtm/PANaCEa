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
  | 'condition_drill';

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
  category: 'core' | 'visual' | 'recall' | 'mastery' | 'pharmacology';
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
    label: 'Clinical Presentation',
    description: 'Synthesize clinical clues to diagnose.',
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
    isComingSoon: false,
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
  'guideline_drill'
];
