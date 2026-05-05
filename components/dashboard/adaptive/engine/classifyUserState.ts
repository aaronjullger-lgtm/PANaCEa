import type { DashboardMode } from '../model/widgetTypes';
import type { DashboardGoal, DashboardUserState } from '../model/DashboardContext';

export function classifyDashboardMode(goal: DashboardGoal, userState: DashboardUserState): DashboardMode {
  if (userState.lowData) return 'low_data';
  if (userState.overloaded) return 'overloaded';
  if (userState.behind) return 'behind';
  if (userState.panre) return 'panre';
  if (userState.ahead) return 'ahead';
  return goal.baseMode;
}

export function getGoalStatusLabel(status: DashboardGoal['status']): string {
  switch (status) {
    case 'on_pace':
      return 'On pace';
    case 'catch_up':
      return 'Catch-up';
    case 'behind':
      return 'Recovery window';
    case 'calibrating':
      return 'Calibrating';
    case 'comfortable':
      return 'Comfortable';
    default:
      return 'Tracking';
  }
}
