import React, { useCallback, useState } from 'react';
import type { DashboardViewModel } from '../model/DashboardViewModel';
import { DashboardSlot } from './DashboardSlot';
import { WhyThisDrawer } from '../widgets/trust/WhyThisDrawer';
import type { SelectedWidget } from '../model/widgetTypes';

function withShellActions(widgets: SelectedWidget[] | undefined, onOpenWhy: () => void): SelectedWidget[] | undefined {
  return widgets?.map((widget) => {
    if (!['today_command', 'baseline_command', 'maintenance_command'].includes(widget.id)) return widget;
    return {
      ...widget,
      data: {
        ...(typeof widget.data === 'object' && widget.data !== null ? widget.data : {}),
        onOpenWhy,
      },
    };
  });
}

export function DashboardShell({ viewModel }: { viewModel: DashboardViewModel }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const openWhy = useCallback(() => setWhyOpen(true), []);
  const closeWhy = useCallback(() => setWhyOpen(false), []);
  const slots = viewModel.slots;
  const partialMessage = viewModel.context.dataState.partialFailure
    ? viewModel.context.dataState.warnings[0] ?? 'Some analytics are temporarily unavailable; today’s plan still works.'
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-12 pt-3 sm:px-4 lg:px-6">
      <div className="sr-only" aria-live="polite">
        Adaptive dashboard ready. Primary action is {viewModel.context.today.primaryCtaLabel}.
      </div>

      {partialMessage ? (
        <section className="rounded-xl border border-[var(--color-risk-border)] bg-[var(--color-risk-bg)] px-4 py-3 text-sm text-[var(--color-risk-text)]">
          {partialMessage}
        </section>
      ) : null}

      <DashboardSlot widgets={slots.goal_context} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)]">
        <DashboardSlot widgets={withShellActions(slots.primary_command, openWhy)} />
        <DashboardSlot widgets={slots.primary_evidence} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DashboardSlot widgets={slots.secondary_left} />
        <DashboardSlot widgets={slots.secondary_right} />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openWhy}
          className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          Why these widgets?
        </button>
      </div>

      <DashboardSlot widgets={slots.below_fold_primary} />
      <div className="grid gap-5 lg:grid-cols-2">
        <DashboardSlot widgets={slots.below_fold_secondary} className="contents" />
      </div>

      <WhyThisDrawer open={whyOpen} onClose={closeWhy} widgets={viewModel.selectedWidgets} />
    </div>
  );
}
