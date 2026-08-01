import type { DashboardMode } from './widgetTypes';

export type DashboardLayoutProfile = {
  aboveFold: string[];
  secondary: string[];
  belowFold: string[];
  visualDensity: 'quiet' | 'standard' | 'rich' | 'focus';
  maxVisibleWidgets: number;
};

export const dashboardModeProfiles: Record<DashboardMode, DashboardLayoutProfile> = {
  pance: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['weakness_drill', 'study_streak', 'blueprint_heatmap', 'review_coverage', 'readiness_pulse'],
    belowFold: ['targeted_conditions', 'mastery_urgency_matrix', 'fsrs_health', 'recent_sessions', 'trust_timeline', 'plan_protocol_strip'],
    visualDensity: 'standard',
    maxVisibleWidgets: 9,
  },
  eor: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['exam_horizon', 'load_guardrail', 'weakness_drill', 'study_streak'],
    belowFold: ['mastery_urgency_matrix', 'fsrs_health', 'recent_sessions', 'plan_protocol_strip', 'trust_timeline'],
    visualDensity: 'standard',
    maxVisibleWidgets: 8,
  },
  didactic: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['exam_horizon', 'review_coverage', 'weakness_drill', 'study_streak'],
    belowFold: ['targeted_conditions', 'mastery_urgency_matrix', 'fsrs_health', 'recent_sessions', 'plan_protocol_strip', 'trust_timeline'],
    visualDensity: 'standard',
    maxVisibleWidgets: 8,
  },
  overloaded: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['load_guardrail', 'review_coverage'],
    belowFold: ['trust_timeline'],
    visualDensity: 'focus',
    maxVisibleWidgets: 4,
  },
  low_data: {
    aboveFold: ['goal_context', 'baseline_command', 'insight_stack'],
    secondary: [],
    belowFold: ['trust_timeline'],
    visualDensity: 'quiet',
    maxVisibleWidgets: 3,
  },
  panre: {
    aboveFold: ['goal_context', 'maintenance_command', 'insight_stack'],
    secondary: ['maintenance_rhythm', 'readiness_pulse'],
    belowFold: ['blueprint_heatmap', 'study_streak', 'fsrs_health', 'recent_sessions', 'trust_timeline'],
    visualDensity: 'quiet',
    maxVisibleWidgets: 7,
  },
  behind: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['weakness_drill', 'blueprint_heatmap', 'catch_up_plan', 'readiness_pulse'],
    belowFold: ['targeted_conditions', 'mastery_urgency_matrix', 'fsrs_health', 'recent_sessions', 'review_coverage', 'trust_timeline'],
    visualDensity: 'standard',
    maxVisibleWidgets: 8,
  },
  ahead: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['maintenance_rhythm', 'readiness_pulse'],
    belowFold: ['blueprint_heatmap', 'study_streak', 'recent_sessions', 'trust_timeline'],
    visualDensity: 'quiet',
    maxVisibleWidgets: 6,
  },
};
