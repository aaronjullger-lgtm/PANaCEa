import type { DashboardContext } from '../model/DashboardContext';
import type { DashboardWidgetDefinition, SelectedWidget } from '../model/widgetTypes';
import { shouldSuppressForCadence } from './widgetCadence';

export function shouldHardSuppressWidget(
  widget: DashboardWidgetDefinition,
  ctx: DashboardContext,
  selected: SelectedWidget[],
): boolean {
  const score = widget.score(ctx);

  if (widget.suppress?.(ctx, selected)) return true;
  if (shouldSuppressForCadence(widget)) return true;
  if (score.actionability <= 0.05 && !['trust', 'context'].includes(widget.class)) return true;
  if (score.evidenceQuality < 0.18 && widget.class !== 'baseline') return true;
  if (widget.id.includes('calibration') && ctx.userState.dataMaturity < 0.35) return true;
  if (widget.id === 'readiness_pulse' && !ctx.readiness.available) return true;
  if (widget.id === 'blueprint_heatmap' && ctx.mode === 'low_data') return true;

  return false;
}

export function shouldSuppressHandledInsight(ctx: DashboardContext, signalId: string): boolean {
  return ctx.today.handledSignalIds.includes(signalId);
}
