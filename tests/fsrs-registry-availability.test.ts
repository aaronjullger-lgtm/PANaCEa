import { describe, expect, it } from 'vitest';
import { dashboardWidgetRegistry } from '../components/dashboard/adaptive/widgets/registry';
import type { DashboardContext } from '../components/dashboard/adaptive/model/DashboardContext';

const health = dashboardWidgetRegistry.find((widget) => widget.id === 'fsrs_health');
if (!health) throw new Error('FSRS health widget must be registered');

describe('FSRS registry availability', () => {
  it('keeps populated retention and optimizer values intact', () => {
    const ctx = { raw: { dashboardAnalytics: { fsrs: {
      reviewCount: 120, retentionPercent: 93, averageStability: 8.4,
      averageDifficulty: 4.1, optimizer: { eligible: true, progressPercent: 40 },
    } } } } as DashboardContext;
    expect(health.build(ctx)).toEqual({ reviewCount: 120, retentionPercent: 93,
      averageStability: 8.4, averageDifficulty: 4.1, optimizerEligible: true,
      optimizerProgress: 40, interpretation: 'Excellent retention' });
  });
  it('builds a stable empty result when analytics are unavailable', () => {
    const ctx = { raw: { dashboardAnalytics: undefined } } as DashboardContext;
    expect(health.build(ctx)).toEqual({ reviewCount: 0, retentionPercent: 0,
      averageStability: 0, averageDifficulty: 0, optimizerEligible: null,
      optimizerProgress: null, interpretation: 'Retention below target — review more' });
  });
});
