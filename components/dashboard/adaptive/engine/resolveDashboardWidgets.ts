import { dashboardModeProfiles } from '../model/modeProfiles';
import type { DashboardViewModel } from '../model/DashboardViewModel';
import type { DashboardContext } from '../model/DashboardContext';
import type { DashboardSlot, DashboardWidgetDefinition, SelectedWidget } from '../model/widgetTypes';
import { isAboveFoldSlot } from '../model/widgetTypes';
import { dashboardWidgetRegistry } from '../widgets/registry';
import { shouldHardSuppressWidget } from './suppressWidgets';
import { exceedsVisualBudget, getVisualBudgetForContext, countVisualBudgetUsage } from './visualBudget';

function profileRank(ctx: DashboardContext, id: string): number {
  const profile = dashboardModeProfiles[ctx.mode];
  const all = [...profile.aboveFold, ...profile.secondary, ...profile.belowFold];
  const index = all.indexOf(id);
  return index === -1 ? 999 : index;
}

function preferredSlot(ctx: DashboardContext, widget: DashboardWidgetDefinition, selected: SelectedWidget[]): DashboardSlot | null {
  const profile = dashboardModeProfiles[ctx.mode];
  const occupied = new Set(selected.map((candidate) => candidate.slot));

  if (profile.aboveFold.includes(widget.id)) {
    const slot = widget.allowedSlots.find((candidate) => ['goal_context', 'primary_command', 'primary_evidence'].includes(candidate));
    if (slot && (!occupied.has(slot) || slot === 'below_fold_secondary')) return slot;
  }

  if (profile.secondary.includes(widget.id)) {
    if (widget.allowedSlots.includes('secondary_left') && !occupied.has('secondary_left')) return 'secondary_left';
    if (widget.allowedSlots.includes('secondary_right') && !occupied.has('secondary_right')) return 'secondary_right';
  }

  if (profile.belowFold.includes(widget.id)) {
    if (widget.allowedSlots.includes('below_fold_primary') && !occupied.has('below_fold_primary')) return 'below_fold_primary';
    if (widget.allowedSlots.includes('below_fold_secondary')) return 'below_fold_secondary';
  }

  return widget.allowedSlots.find((slot) => {
    if (slot === 'drawer_only' || slot === 'progress_tab_only') return false;
    return slot === 'below_fold_secondary' || !occupied.has(slot);
  }) ?? null;
}

function instantiate(ctx: DashboardContext, definition: DashboardWidgetDefinition, slot: DashboardSlot): SelectedWidget {
  const data = definition.build(ctx);
  return {
    id: definition.id,
    class: definition.class,
    slot,
    score: definition.score(ctx),
    data,
    visual: definition.visual(data, ctx),
    attribution: definition.attribution(ctx),
    component: definition.component,
    cadence: definition.cadence,
  };
}

function pushIfAllowed(ctx: DashboardContext, selected: SelectedWidget[], definition: DashboardWidgetDefinition, budget = getVisualBudgetForContext(ctx)): void {
  if (selected.some((widget) => widget.id === definition.id)) return;
  if (!definition.eligible(ctx)) return;
  if (shouldHardSuppressWidget(definition, ctx, selected)) return;
  const slot = preferredSlot(ctx, definition, selected);
  if (!slot) return;
  const candidate = instantiate(ctx, definition, slot);
  if (candidate.score.final <= -0.1) return;
  if (exceedsVisualBudget(selected, candidate, budget)) return;
  selected.push(candidate);
}

export function resolveDashboardWidgets(
  ctx: DashboardContext,
  registry: DashboardWidgetDefinition[] = dashboardWidgetRegistry,
): DashboardViewModel {
  const profile = dashboardModeProfiles[ctx.mode];
  const visualBudget = getVisualBudgetForContext(ctx);
  const selected: SelectedWidget[] = [];
  const byId = new Map(registry.map((widget) => [widget.id, widget]));

  for (const id of profile.aboveFold) {
    const definition = byId.get(id);
    if (definition) pushIfAllowed(ctx, selected, definition, visualBudget);
  }

  const ranked = registry
    .filter((definition) => !selected.some((widget) => widget.id === definition.id))
    .filter((definition) => definition.eligible(ctx))
    .sort((left, right) => {
      const rankDelta = profileRank(ctx, left.id) - profileRank(ctx, right.id);
      if (rankDelta !== 0) return rankDelta;
      return right.score(ctx).final - left.score(ctx).final;
    });

  for (const definition of ranked) {
    if (selected.length >= profile.maxVisibleWidgets) break;
    pushIfAllowed(ctx, selected, definition, visualBudget);
  }

  const visible = selected
    .filter((widget) => widget.slot !== 'progress_tab_only' && widget.slot !== 'drawer_only')
    .slice(0, profile.maxVisibleWidgets);

  const slots = visible.reduce<DashboardViewModel['slots']>((acc, widget) => {
    acc[widget.slot] = [...(acc[widget.slot] ?? []), widget];
    return acc;
  }, {});

  const usage = countVisualBudgetUsage(visible);

  return {
    context: ctx,
    profile,
    visualBudget,
    slots,
    selectedWidgets: visible,
    diagnostics: {
      aboveFoldWidgetCount: visible.filter((widget) => isAboveFoldSlot(widget.slot)).length,
      primaryActionCount: usage.primaryActionCount,
      redSurfaceCount: usage.redSurfaceCount,
      insightCardCount: usage.insightCardCount,
      chartCountAboveFold: usage.chartCountAboveFold,
    },
  };
}
