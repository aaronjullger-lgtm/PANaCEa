import type { DashboardContext } from './DashboardContext';
import type { DashboardLayoutProfile } from './modeProfiles';
import type { DashboardSlots, SelectedWidget, VisualBudget } from './widgetTypes';

export type DashboardViewModel = {
  context: DashboardContext;
  profile: DashboardLayoutProfile;
  visualBudget: VisualBudget;
  slots: DashboardSlots;
  selectedWidgets: SelectedWidget[];
  diagnostics: {
    aboveFoldWidgetCount: number;
    primaryActionCount: number;
    redSurfaceCount: number;
    insightCardCount: number;
    chartCountAboveFold: number;
  };
};
