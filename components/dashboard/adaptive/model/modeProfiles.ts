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
    secondary: ['blueprint_heatmap', 'review_coverage', 'readiness_pulse'],
    belowFold: ['mastery_urgency_matrix', 'trust_timeline', 'plan_protocol_strip'],
    visualDensity: 'standard',
    maxVisibleWidgets: 8,
  },
  eor: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['exam_horizon', 'load_guardrail'],
    belowFold: ['mastery_urgency_matrix', 'plan_protocol_strip', 'trust_timeline'],
    visualDensity: 'standard',
    maxVisibleWidgets: 6,
  },
  didactic: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['exam_horizon', 'review_coverage'],
    belowFold: ['mastery_urgency_matrix', 'plan_protocol_strip', 'trust_timeline'],
    visualDensity: 'standard',
    maxVisibleWidgets: 6,
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
    belowFold: ['blueprint_heatmap', 'trust_timeline'],
    visualDensity: 'quiet',
    maxVisibleWidgets: 5,
  },
  behind: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['blueprint_heatmap', 'catch_up_plan', 'readiness_pulse'],
    belowFold: ['mastery_urgency_matrix', 'review_coverage', 'trust_timeline'],
    visualDensity: 'standard',
    maxVisibleWidgets: 7,
  },
  ahead: {
    aboveFold: ['goal_context', 'today_command', 'insight_stack'],
    secondary: ['maintenance_rhythm', 'readiness_pulse'],
    belowFold: ['blueprint_heatmap', 'trust_timeline'],
    visualDensity: 'quiet',
    maxVisibleWidgets: 5,
  },
};
