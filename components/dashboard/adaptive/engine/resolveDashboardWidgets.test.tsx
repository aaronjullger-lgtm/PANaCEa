import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { dashboardFixtures } from '../fixtures/dashboardFixtures';
import { resolveDashboardWidgets } from './resolveDashboardWidgets';
import { scoreWidget } from './scoreWidget';
import { DashboardShell } from '../page/DashboardShell';
import { isAboveFoldSlot } from '../model/widgetTypes';
import { recordWidgetExposures, shouldSuppressForCadence } from './widgetCadence';
import type { DashboardWidgetDefinition, SelectedWidget } from '../model/widgetTypes';

describe('adaptive dashboard scoring', () => {
  it('uses the weighted scoring formula', () => {
    const score = scoreWidget({
      urgency: 1,
      goalImpact: 1,
      actionability: 1,
      evidenceQuality: 1,
      novelty: 1,
      userStateFit: 1,
      anxietyCost: 0,
      redundancyPenalty: 0,
      alreadyHandledPenalty: 0,
    });

    expect(score.final).toBeCloseTo(0.88, 3);
  });
});

describe('adaptive dashboard resolver', () => {
  it('keeps the dashboard within visual budget', () => {
    const vm = resolveDashboardWidgets(dashboardFixtures.panceNormal());

    expect(vm.selectedWidgets.length).toBeLessThanOrEqual(vm.profile.maxVisibleWidgets);
    expect(vm.diagnostics.aboveFoldWidgetCount).toBeLessThanOrEqual(vm.visualBudget.maxAboveFoldWidgets);
    expect(vm.diagnostics.primaryActionCount).toBe(1);
    expect(vm.diagnostics.redSurfaceCount).toBeLessThanOrEqual(1);
    expect(vm.diagnostics.insightCardCount).toBeLessThanOrEqual(3);
  });

  it('does not claim review coverage without a planned review task', () => {
    const ctx = dashboardFixtures.reviewDebtWithoutPlanTask();
    const vm = resolveDashboardWidgets(ctx);
    const review = vm.selectedWidgets.find((widget) => widget.id === 'review_coverage');

    expect(ctx.reviewCoverage.coverageSource).toBe('none');
    expect(ctx.reviewCoverage.coveredDanger + ctx.reviewCoverage.coveredOverdue).toBe(0);
    expect((review?.attribution ?? '').toLowerCase()).not.toContain('covered by today');
  });

  it('claims review coverage only when due condition or card identity matches the plan task', () => {
    const ctx = dashboardFixtures.reviewDebtCoveredByConditionTask();
    const vm = resolveDashboardWidgets(ctx);
    const review = vm.selectedWidgets.find((widget) => widget.id === 'review_coverage');

    expect(ctx.reviewCoverage.coverageSource).toBe('plan_tasks');
    expect(ctx.reviewCoverage.coveredDanger).toBe(1);
    expect(ctx.reviewCoverage.coveredOverdue).toBe(1);
    expect(review?.attribution).toContain('covered by today');
  });

  it('selects different widgets for PANCE, EOR, didactic, and PANRE profiles', () => {
    const pance = resolveDashboardWidgets(dashboardFixtures.panceNormal()).selectedWidgets.map((widget) => widget.id);
    const eor = resolveDashboardWidgets(dashboardFixtures.eorInFiveDays()).selectedWidgets.map((widget) => widget.id);
    const didactic = resolveDashboardWidgets(dashboardFixtures.didacticExamSoon()).selectedWidgets.map((widget) => widget.id);
    const panre = resolveDashboardWidgets(dashboardFixtures.panreMaintenance()).selectedWidgets.map((widget) => widget.id);

    expect(pance).toContain('today_command');
    expect(eor).toContain('exam_horizon');
    expect(didactic).toContain('exam_horizon');
    expect(panre).toContain('maintenance_command');
    expect(panre).toContain('maintenance_rhythm');
  });

  it('low-data mode hides fake readiness and uses baseline command', () => {
    const ctx = dashboardFixtures.newUserDayOne();
    const vm = resolveDashboardWidgets(ctx);
    const ids = vm.selectedWidgets.map((widget) => widget.id);

    expect(ctx.mode).toBe('low_data');
    expect(ctx.readiness.available).toBe(false);
    expect(ids).toContain('baseline_command');
    expect(ids).not.toContain('readiness_pulse');
  });

  it('overloaded mode simplifies the dashboard and promotes recovery', () => {
    const ctx = dashboardFixtures.panceOverloaded();
    const vm = resolveDashboardWidgets(ctx);

    expect(ctx.mode).toBe('overloaded');
    expect(vm.selectedWidgets.length).toBeLessThanOrEqual(4);
    expect(vm.selectedWidgets.map((widget) => widget.id)).toContain('load_guardrail');
    expect(vm.profile.visualDensity).toBe('focus');
  });

  it('handled confusion pair renders as reassurance instead of a warning', () => {
    const handled = dashboardFixtures.confusionPairHandled();
    const card = handled.insights.find((insight) => insight.id === 'confusion_pair');

    expect(card?.actionState).toBe('in_plan');
    expect(card?.title.toLowerCase()).toContain('in plan');
    expect(card?.anxietyCost).toBeLessThan(0.1);
  });

  it('unhandled confusion pair can remain actionable', () => {
    const unhandled = dashboardFixtures.confusionPairUnhandled();
    const card = unhandled.insights.find((insight) => insight.id === 'confusion_pair');

    expect(card?.actionState).toBe('needs_action');
  });

  it('keeps above-fold widgets in the fixed slot shell', () => {
    const vm = resolveDashboardWidgets(dashboardFixtures.panceBehind());
    const aboveFold = vm.selectedWidgets.filter((widget) => isAboveFoldSlot(widget.slot));

    expect(aboveFold.map((widget) => widget.slot)).toContain('goal_context');
    expect(aboveFold.map((widget) => widget.slot)).toContain('primary_command');
    expect(aboveFold.map((widget) => widget.slot)).toContain('primary_evidence');
  });
});

describe('adaptive dashboard rendering states', () => {
  it('renders loading, partial failure, and empty-safe states without losing the primary CTA', () => {
    const ctx = dashboardFixtures.partialFailure();
    const vm = resolveDashboardWidgets(ctx);

    render(<DashboardShell viewModel={vm} />);

    expect(screen.getByText(/Study plan fetch failed/i)).toBeTruthy();
    expect(screen.getAllByTestId('primary-study-action')).toHaveLength(1);
    expect(screen.getByText(/Only signals that matter today/i)).toBeTruthy();
  });
});

describe('adaptive dashboard cadence', () => {
  it('suppresses widgets that exceed cadence limits without requiring server state', () => {
    const widget = {
      id: 'cadenced_widget',
      cadence: { maxShowsPerWeek: 1 },
    } as DashboardWidgetDefinition;
    const selected = {
      id: 'cadenced_widget',
      cadence: { maxShowsPerWeek: 1 },
    } as SelectedWidget;

    window.localStorage.clear();
    expect(shouldSuppressForCadence(widget, 1_000_000)).toBe(false);
    recordWidgetExposures([selected], 1_000_000);
    expect(shouldSuppressForCadence(widget, 1_010_000)).toBe(true);
  });
});
