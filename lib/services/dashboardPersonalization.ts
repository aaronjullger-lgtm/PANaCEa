/**
 * Dashboard Personalization Engine
 *
 * Maps learner stage to dashboard configuration — which widgets to show,
 * which training modes to surface, what language to use, and what metrics
 * to emphasize.
 *
 * Five distinct experiences:
 *   1. DIDACTIC EARLY (Semester 1-2): Coverage focus, gated systems
 *   2. DIDACTIC LATE (Semester 3-4): Accuracy focus, all systems
 *   3. CLINICAL ROTATION: EOR focus, blended weight context
 *   4. PANCE PREP: Mastery focus, full blueprint gaps
 *   5. PANRE: Retention focus, low-pressure maintenance
 *
 * @module lib/services/dashboardPersonalization
 */

import type { LearnerStage } from './learnerStageBlueprint';
import type { TrainingModeId } from '@/config/training-modes';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WidgetId =
  | 'daily_triad'
  | 'exam_countdown'
  | 'eor_countdown'
  | 'retention_forecast'
  | 'calibration_quadrant'
  | 'calibration_chart'
  | 'system_performance'
  | 'blueprint_gaps'
  | 'rotation_context'
  | 'decay_curve'
  | 'stability_pyramid'
  | 'algorithm_status'
  | 'circadian_insight'
  | 'confusion_pairs'
  | 'overlearning_alert'
  | 'wellness_status';

export interface DashboardConfig {
  stage: LearnerStage;

  /** Widgets for the "Today/Pilot" view — ordered by priority */
  pilotWidgets: WidgetId[];

  /** Widgets for the "Analytics/Data" view — ordered by priority */
  dataWidgets: WidgetId[];

  /** Training modes to show (others are hidden). Uses TrainingModeId from config. */
  visibleModes: TrainingModeId[];

  /** Language & framing */
  examLabel: string;
  readinessLabel: string;
  sessionCTA: string;
  greetingSuffix: string;

  /** Metrics emphasis */
  primaryMetric: 'accuracy' | 'retention' | 'coverage' | 'mastery';

  /** Feature flags */
  showBlueprintGaps: boolean;
  showEorCountdown: boolean;
  showPanceCountdown: boolean;
  showRotationContext: boolean;
  showStreakPressure: boolean;
  showCalibrationQuadrant: boolean;
  showConfusionPairs: boolean;

  /** Default session size */
  defaultSessionSize: number;
}

// ─── Stage Configurations ────────────────────────────────────────────────────

const DIDACTIC_EARLY_CONFIG: DashboardConfig = {
  stage: 'didactic_early',
  pilotWidgets: [
    'daily_triad',
    'wellness_status',
    'circadian_insight',
  ],
  dataWidgets: [
    'system_performance',
    'calibration_quadrant',
    'decay_curve',
  ],
  visibleModes: [
    'core_adaptive',
    'system_drill',
    'condition_drill',
    'contrastive_drill',
    'rapid_recall',
    'pharmacology',
    'first_line_treatment',
  ],
  examLabel: 'Unit Exam',
  readinessLabel: 'Your Progress',
  sessionCTA: 'Continue Studying',
  greetingSuffix: 'Ready to build your foundation?',
  primaryMetric: 'coverage',
  showBlueprintGaps: false,
  showEorCountdown: false,
  showPanceCountdown: false,
  showRotationContext: false,
  showStreakPressure: true,
  showCalibrationQuadrant: false,
  showConfusionPairs: true,
  defaultSessionSize: 20,
};

const DIDACTIC_LATE_CONFIG: DashboardConfig = {
  stage: 'didactic_late',
  pilotWidgets: [
    'daily_triad',
    'blueprint_gaps',
    'wellness_status',
    'circadian_insight',
  ],
  dataWidgets: [
    'system_performance',
    'calibration_quadrant',
    'calibration_chart',
    'confusion_pairs',
    'decay_curve',
    'stability_pyramid',
  ],
  visibleModes: [
    'core_adaptive',
    'system_drill',
    'condition_drill',
    'ddx_compare',
    'pharmacology',
    'contrastive_drill',
    'imaging_drill',
    'ecg_drill',
    'mini_lab',
    'rapid_recall',
    'first_line_treatment',
    'guideline_drill',
  ],
  examLabel: 'PANCE Blueprint',
  readinessLabel: 'PANCE Readiness',
  sessionCTA: 'Start Session',
  greetingSuffix: 'Keep building momentum.',
  primaryMetric: 'accuracy',
  showBlueprintGaps: true,
  showEorCountdown: false,
  showPanceCountdown: false,
  showRotationContext: false,
  showStreakPressure: true,
  showCalibrationQuadrant: true,
  showConfusionPairs: true,
  defaultSessionSize: 20,
};

const CLINICAL_ROTATION_CONFIG: DashboardConfig = {
  stage: 'clinical_rotation',
  pilotWidgets: [
    'daily_triad',
    'eor_countdown',
    'rotation_context',
    'retention_forecast',
    'wellness_status',
  ],
  dataWidgets: [
    'system_performance',
    'calibration_quadrant',
    'calibration_chart',
    'blueprint_gaps',
    'confusion_pairs',
    'decay_curve',
  ],
  visibleModes: [
    'core_adaptive',
    'system_drill',
    'condition_drill',
    'ddx_compare',
    'pharmacology',
    'contrastive_drill',
    'imaging_drill',
    'ecg_drill',
    'mini_lab',
    'patient_encounter',
    'rapid_recall',
    'anatomy_review',
    'grand_rounds',
    'first_line_treatment',
    'guideline_drill',
    'physiology_drill',
  ],
  examLabel: 'EOR + PANCE',
  readinessLabel: 'EOR Readiness',
  sessionCTA: 'Start Session',
  greetingSuffix: 'Stay sharp on rotation.',
  primaryMetric: 'retention',
  showBlueprintGaps: true,
  showEorCountdown: true,
  showPanceCountdown: false,
  showRotationContext: true,
  showStreakPressure: true,
  showCalibrationQuadrant: true,
  showConfusionPairs: true,
  defaultSessionSize: 20,
};

const PANCE_PREP_CONFIG: DashboardConfig = {
  stage: 'pance_prep',
  pilotWidgets: [
    'daily_triad',
    'exam_countdown',
    'blueprint_gaps',
    'overlearning_alert',
    'wellness_status',
    'circadian_insight',
  ],
  dataWidgets: [
    'system_performance',
    'calibration_quadrant',
    'calibration_chart',
    'confusion_pairs',
    'retention_forecast',
    'decay_curve',
    'stability_pyramid',
    'algorithm_status',
  ],
  visibleModes: [
    'core_adaptive',
    'system_drill',
    'condition_drill',
    'ddx_compare',
    'pharmacology',
    'contrastive_drill',
    'imaging_drill',
    'ecg_drill',
    'derm_drill',
    'mini_lab',
    'patient_encounter',
    'rapid_recall',
    'anatomy_review',
    'grand_rounds',
    'first_line_treatment',
    'guideline_drill',
    'physiology_drill',
    'pance_simulator',
    'cram_mode',
  ],
  examLabel: 'PANCE',
  readinessLabel: 'PANCE Readiness',
  sessionCTA: 'Start Practice',
  greetingSuffix: 'Every session counts.',
  primaryMetric: 'mastery',
  showBlueprintGaps: true,
  showEorCountdown: false,
  showPanceCountdown: true,
  showRotationContext: false,
  showStreakPressure: true,
  showCalibrationQuadrant: true,
  showConfusionPairs: true,
  defaultSessionSize: 30,
};

const PANRE_CONFIG: DashboardConfig = {
  stage: 'panre',
  pilotWidgets: [
    'daily_triad',
    'retention_forecast',
    'overlearning_alert',
    'wellness_status',
    'circadian_insight',
  ],
  dataWidgets: [
    'system_performance',
    'decay_curve',
    'stability_pyramid',
  ],
  visibleModes: [
    'core_adaptive',
    'system_drill',
    'condition_drill',
    'pharmacology',
    'rapid_recall',
    'first_line_treatment',
    'panre_la',
  ],
  examLabel: 'PANRE-LA',
  readinessLabel: 'Knowledge Maintenance',
  sessionCTA: 'Quick Check-In',
  greetingSuffix: 'Keeping your knowledge sharp.',
  primaryMetric: 'retention',
  showBlueprintGaps: false,
  showEorCountdown: false,
  showPanceCountdown: false,
  showRotationContext: false,
  showStreakPressure: false, // No streak pressure for practicing PAs
  showCalibrationQuadrant: false,
  showConfusionPairs: false,
  defaultSessionSize: 15,
};

const GENERAL_CONFIG: DashboardConfig = {
  stage: 'general',
  pilotWidgets: [
    'daily_triad',
    'retention_forecast',
    'wellness_status',
  ],
  dataWidgets: [
    'system_performance',
    'decay_curve',
    'calibration_quadrant',
    'calibration_chart',
  ],
  visibleModes: [
    'core_adaptive',
    'system_drill',
    'condition_drill',
    'ddx_compare',
    'pharmacology',
    'contrastive_drill',
    'rapid_recall',
    'first_line_treatment',
    'guideline_drill',
    'mini_lab',
  ],
  examLabel: 'PANCE',
  readinessLabel: 'Study Progress',
  sessionCTA: 'Start Studying',
  greetingSuffix: 'Let\'s get to work.',
  primaryMetric: 'accuracy',
  showBlueprintGaps: true,
  showEorCountdown: false,
  showPanceCountdown: false,
  showRotationContext: false,
  showStreakPressure: true,
  showCalibrationQuadrant: true,
  showConfusionPairs: true,
  defaultSessionSize: 20,
};

// ─── Resolver ────────────────────────────────────────────────────────────────

const STAGE_CONFIGS: Record<LearnerStage, DashboardConfig> = {
  didactic_early: DIDACTIC_EARLY_CONFIG,
  didactic_late: DIDACTIC_LATE_CONFIG,
  clinical_rotation: CLINICAL_ROTATION_CONFIG,
  pance_prep: PANCE_PREP_CONFIG,
  panre: PANRE_CONFIG,
  general: GENERAL_CONFIG,
};

/**
 * Get the dashboard configuration for a learner stage.
 */
export function getDashboardConfig(stage: LearnerStage): DashboardConfig {
  return STAGE_CONFIGS[stage] ?? GENERAL_CONFIG;
}

/**
 * Check if a specific widget should be shown for a stage.
 */
export function shouldShowWidget(stage: LearnerStage, widget: WidgetId): boolean {
  const config = getDashboardConfig(stage);
  return config.pilotWidgets.includes(widget) || config.dataWidgets.includes(widget);
}

/**
 * Check if a training mode should be visible for a stage.
 */
export function shouldShowMode(stage: LearnerStage, mode: TrainingModeId): boolean {
  const config = getDashboardConfig(stage);
  return config.visibleModes.includes(mode);
}
