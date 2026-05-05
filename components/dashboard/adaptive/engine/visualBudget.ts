import { quietVisualBudget, standardVisualBudget } from '../model/visualTokens';
import type { DashboardContext } from '../model/DashboardContext';
import type { SelectedWidget, VisualBudget } from '../model/widgetTypes';
import { isAboveFoldSlot } from '../model/widgetTypes';

export function getVisualBudgetForContext(ctx: DashboardContext): VisualBudget {
  if (ctx.mode === 'low_data' || ctx.mode === 'overloaded' || ctx.mode === 'panre' || ctx.mode === 'ahead') {
    return quietVisualBudget;
  }
  return standardVisualBudget;
}

export function countVisualBudgetUsage(selected: SelectedWidget[]) {
  const aboveFold = selected.filter((widget) => isAboveFoldSlot(widget.slot));
  return {
    aboveFoldWidgetCount: aboveFold.length,
    primaryActionCount: aboveFold.filter((widget) => widget.class === 'command' || widget.class === 'baseline').length,
    redSurfaceCount: aboveFold.filter((widget) => widget.visual.tone === 'critical').length,
    insightCardCount: selected.reduce((count, widget) => {
      if (widget.id !== 'insight_stack') return count;
      const data = widget.data as { cards?: unknown[] };
      return count + (Array.isArray(data.cards) ? data.cards.length : 0);
    }, 0),
    chartCountAboveFold: aboveFold.filter((widget) => widget.class === 'forecast' || widget.class === 'protection').length,
    animatedElementCount: aboveFold.filter((widget) => widget.visual.motion !== 'none').length,
    medicalMotifCount: aboveFold.filter((widget) => widget.visual.motif !== 'none').length,
  };
}

export function exceedsVisualBudget(selected: SelectedWidget[], candidate: SelectedWidget, budget: VisualBudget): boolean {
  const usage = countVisualBudgetUsage([...selected, candidate]);
  if (isAboveFoldSlot(candidate.slot) && usage.aboveFoldWidgetCount > budget.maxAboveFoldWidgets) return true;
  if (usage.primaryActionCount > budget.maxPrimaryActions) return true;
  if (usage.redSurfaceCount > budget.maxRedSurfaces) return true;
  if (usage.chartCountAboveFold > budget.maxChartsAboveFold) return true;
  if (usage.animatedElementCount > budget.maxAnimatedElements) return true;
  if (usage.medicalMotifCount > budget.maxTotalMedicalMotifs) return true;
  if (candidate.id === 'insight_stack' && usage.insightCardCount > budget.maxInsightCards) return true;
  return false;
}
