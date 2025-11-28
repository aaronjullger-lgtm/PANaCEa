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
  | 'rapid_recall'
  | 'ddx_compare'
  | 'guideline_drill'
  | 'mastery_drill';

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
  category: 'core' | 'visual' | 'recall' | 'mastery';
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
  {
    id: 'photo_drill',
    label: 'Global Photo Mode',
    description: 'ECG, Derm, Imaging pattern recognition.',
    category: 'visual',
    iconName: 'Image',
    theme: 'slate',
    route: '/session/photo-drill',
  },
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
    description: 'Criteria & Standards.',
    category: 'core',
    iconName: 'FileText',
    theme: 'teal',
    route: '/session/guideline-drill',
  },
  {
    id: 'mastery_drill',
    label: 'Streak Challenge',
    description: 'Survival mode.',
    category: 'mastery',
    iconName: 'Flame',
    theme: 'red',
    route: '/session/mastery-drill',
  },
];
