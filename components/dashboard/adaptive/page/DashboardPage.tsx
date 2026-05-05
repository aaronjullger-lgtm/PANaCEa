import React, { useEffect, useMemo } from 'react';
import type { DashboardContext } from '../model/DashboardContext';
import { resolveDashboardWidgets } from '../engine/resolveDashboardWidgets';
import { recordWidgetExposures } from '../engine/widgetCadence';
import { DashboardShell } from './DashboardShell';

export function AdaptiveDashboardPage({ context }: { context: DashboardContext }) {
  const viewModel = useMemo(() => resolveDashboardWidgets(context), [context]);

  useEffect(() => {
    recordWidgetExposures(viewModel.selectedWidgets);
  }, [viewModel.selectedWidgets]);

  return <DashboardShell viewModel={viewModel} />;
}
