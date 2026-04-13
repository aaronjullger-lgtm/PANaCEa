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
  | 'agent_chat'
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
  | 'calibration_dashboard'
  | 'illness_script';

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

/** Static animation variants for view transitions — cinematic feel */
export const pageVariants = {
  initial: { y: 16, opacity: 0, filter: 'blur(4px)' },
  animate: { y: 0, opacity: 1, filter: 'blur(0px)' },
  exit: { y: -10, opacity: 0, filter: 'blur(2px)' },
};

/** Stagger config for list/card entrance animations */
export const staggerContainer = {
  hidden: {},
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

/** Spring presets — from Disney's 12 Principles */
export const springs = {
  /** Gentle entrance — modals, overlays, content reveals */
  gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
  /** Snappy settle — buttons, toggles, tab switches */
  snappy: { type: 'spring' as const, stiffness: 400, damping: 28 },
  /** Bouncy overshoot — success states, notifications, badges */
  bouncy: { type: 'spring' as const, stiffness: 600, damping: 20 },
  /** Wobbly — error shake, attention-grab */
  wobbly: { type: 'spring' as const, stiffness: 180, damping: 10 },
  /** Stiff precision — cards, panels, layout shifts */
  stiff: { type: 'spring' as const, stiffness: 700, damping: 40 },
};

export const staggerItem = {
  hidden: { y: 20, opacity: 0, filter: 'blur(4px)' },
  animate: {
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: springs.snappy,
  },
};

/** Legacy alias */
export const springTransition = springs.snappy;

/** Card hover with 3D tilt + gold glow (use with motion.div onMouseMove) */
export const cardHoverVariants = {
  rest: {
    scale: 1,
    boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.3)',
  },
  hover: {
    scale: 1.015,
    y: -3,
    boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.4), 0 0 20px -4px rgba(196, 183, 138, 0.12)',
    transition: springs.snappy,
  },
  tap: {
    scale: 0.98,
    y: 0,
    transition: { duration: 0.1 },
  },
};

/** Correct/incorrect answer reveal */
export const answerRevealVariants = {
  correct: {
    scale: [1, 1.04, 1],
    boxShadow: [
      '0 0 0 0 rgba(34, 197, 94, 0)',
      '0 0 24px 4px rgba(34, 197, 94, 0.35)',
      '0 0 12px 2px rgba(34, 197, 94, 0.15)',
    ],
    transition: { duration: 0.5, times: [0, 0.35, 1] },
  },
  incorrect: {
    x: [0, -6, 6, -4, 4, 0],
    boxShadow: [
      '0 0 0 0 rgba(239, 68, 68, 0)',
      '0 0 20px 4px rgba(239, 68, 68, 0.3)',
      '0 0 20px 4px rgba(239, 68, 68, 0.3)',
      '0 0 20px 4px rgba(239, 68, 68, 0.3)',
      '0 0 20px 4px rgba(239, 68, 68, 0.3)',
      '0 0 8px 2px rgba(239, 68, 68, 0.1)',
    ],
    transition: { duration: 0.45, times: [0, 0.15, 0.35, 0.55, 0.75, 1] },
  },
};

/** Widget entrance for dashboard — staggered fade-up with blur */
export const widgetEntrance = {
  hidden: { y: 24, opacity: 0, filter: 'blur(6px)' },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: {
      delay: i * 0.06,
      ...springs.snappy,
    },
  }),
};

// ============================================================================
// Advanced Animation Variants — Disney's 12 Principles Applied
// ============================================================================

/**
 * Modal entrance — scale overshoot (squash & stretch) + blur dissolve
 * Uses bouncy spring for the "pop" feel, exits faster (70% duration)
 */
export const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 12,
    filter: 'blur(8px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      ...springs.bouncy,
      opacity: { duration: 0.2 },
      filter: { duration: 0.25 },
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 8,
    filter: 'blur(4px)',
    transition: {
      duration: 0.18,
      ease: [0.32, 0, 0.67, 0],
    },
  },
};

/** Modal overlay — simple fade with blur */
export const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
};

/**
 * List item entrance — staggered with follow-through
 * Each item slightly overshoots, then settles (anticipation → follow-through)
 */
export const listItemVariants = {
  hidden: { opacity: 0, x: -16, filter: 'blur(4px)' },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: {
      delay: i * 0.05,
      ...springs.snappy,
      opacity: { delay: i * 0.05, duration: 0.2 },
    },
  }),
  exit: {
    opacity: 0,
    x: 12,
    filter: 'blur(2px)',
    transition: { duration: 0.15, ease: [0.32, 0, 0.67, 0] },
  },
};

/**
 * Notification entrance — slides in from top-right with arc motion + bounce
 * Uses bouncy spring for attention-grab
 */
export const notificationVariants = {
  hidden: { opacity: 0, y: -24, x: 16, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    scale: 1,
    transition: {
      ...springs.bouncy,
      opacity: { duration: 0.2 },
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    x: 24,
    scale: 0.95,
    transition: { duration: 0.2, ease: [0.32, 0, 0.67, 0] },
  },
};

/**
 * Success feedback — celebratory pulse with gold glow
 * Exaggeration principle: scale overshoot + glow bloom
 */
export const successVariants = {
  initial: { scale: 1 },
  celebrate: {
    scale: [1, 1.06, 0.97, 1.02, 1],
    boxShadow: [
      '0 0 0 0 rgba(196, 183, 138, 0)',
      '0 0 32px 8px rgba(196, 183, 138, 0.35)',
      '0 0 16px 4px rgba(196, 183, 138, 0.2)',
      '0 0 24px 6px rgba(196, 183, 138, 0.25)',
      '0 0 8px 2px rgba(196, 183, 138, 0.1)',
    ],
    transition: {
      duration: 0.6,
      times: [0, 0.2, 0.45, 0.7, 1],
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/**
 * Error feedback — exaggerated shake + red glow bloom
 * 3-4x more pronounced than standard shake (exaggeration principle)
 */
export const errorShakeVariants = {
  initial: { x: 0 },
  shake: {
    x: [0, -10, 10, -8, 8, -4, 2, 0],
    transition: {
      duration: 0.5,
      times: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
    },
  },
};

/**
 * Button press — anticipation (micro-dip) → action → follow-through
 * Staging principle: draws attention before the action happens
 */
export const buttonPressVariants = {
  idle: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -1,
    transition: springs.snappy,
  },
  tap: {
    scale: 0.96,
    y: 1,
    transition: { duration: 0.08, ease: 'easeIn' },
  },
};

/**
 * Skeleton shimmer — cinematic gold-tinted sweep
 * For loading states; the shimmer travels left-to-right with warm gold highlight
 */
export const skeletonShimmer = {
  initial: { x: '-100%' },
  animate: {
    x: '100%',
    transition: {
      repeat: Infinity,
      duration: 1.6,
      ease: [0.4, 0, 0.2, 1],
      repeatDelay: 0.4,
    },
  },
};

/**
 * Skeleton line entrance — staggered blur-dissolve for multi-line skeletons
 * Lines fade in sequentially with spring physics
 */
export const skeletonLineVariants = {
  hidden: { opacity: 0, scaleX: 0.7, originX: 0, filter: 'blur(4px)' },
  visible: (i: number) => ({
    opacity: 1,
    scaleX: 1,
    filter: 'blur(0px)',
    transition: {
      delay: i * 0.08,
      ...springs.gentle,
      opacity: { delay: i * 0.08, duration: 0.3 },
    },
  }),
};

/**
 * Content reveal — skeleton-to-content morphing transition
 * Blur dissolves out as real content fades in
 */
export const contentRevealVariants = {
  skeleton: { opacity: 1, filter: 'blur(0px)' },
  revealing: {
    opacity: 0,
    filter: 'blur(6px)',
    scale: 0.98,
    transition: { duration: 0.25, ease: [0.32, 0, 0.67, 0] },
  },
};

export const contentAppearVariants = {
  hidden: { opacity: 0, filter: 'blur(8px)', y: 8 },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: {
      ...springs.snappy,
      opacity: { duration: 0.3 },
    },
  },
};

/**
 * Accordion/expandable — smooth height with spring + content stagger
 */
export const expandVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.32, 0, 0.67, 0] },
      opacity: { duration: 0.12 },
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { ...springs.snappy },
      opacity: { duration: 0.2, delay: 0.05 },
    },
  },
};

/**
 * Tab content — slide + blur with direction awareness
 * Secondary action principle: content moves while fading
 */
export const tabContentVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 24 : -24,
    opacity: 0,
    filter: 'blur(4px)',
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: springs.snappy,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -16 : 16,
    opacity: 0,
    filter: 'blur(2px)',
    transition: { duration: 0.18, ease: [0.32, 0, 0.67, 0] },
  }),
};

/**
 * Card flip/reveal — for drill answer reveals
 * Perspective-based 3D flip with gold glow on completion
 */
export const cardRevealVariants = {
  face: {
    rotateY: 0,
    transition: springs.gentle,
  },
  flipped: {
    rotateY: 180,
    transition: springs.gentle,
  },
};

/** Custom easing curves — perceptually tuned */
export const easings = {
  /** Content entering view — decelerating */
  enter: [0.0, 0.0, 0.2, 1] as const,
  /** Content leaving view — accelerating */
  exit: [0.32, 0, 0.67, 0] as const,
  /** Repositioning — slight overshoot */
  move: [0.22, 1.2, 0.36, 1] as const,
  /** Emphasis/attention — quick snap */
  snap: [0.16, 1, 0.3, 1] as const,
  /** Smooth linear-ish for progress bars */
  linear: [0.4, 0, 0.2, 1] as const,
};
