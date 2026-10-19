import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_METRICS,
  DASHBOARD_PREVIEW_VITALS,
  DASHBOARD_READINESS_TIMELINE,
  DIAGNOSTIC_SCROLL_STAGES,
} from '@/components/landing/content';

describe('Synthetic landing readiness display', () => {
  it('shows the difference from the demo target in percentage points across previews', () => {
    const latest = DASHBOARD_READINESS_TIMELINE.at(-1)!;
    const difference = latest.readiness - latest.target;
    const formatted = `+${difference} pp`;
    const readiness = DASHBOARD_PREVIEW_VITALS.find((metric) => metric.label === 'Readiness score')!;
    expect(readiness.numericValue).toBe(latest.readiness);
    expect(readiness.value).toBe(`${latest.readiness}%`);

    for (const metrics of [DASHBOARD_PREVIEW_VITALS, ANALYTICS_METRICS]) {
      const buffer = metrics.find((metric) => metric.label === 'Readiness buffer')!;
      expect(buffer.numericValue).toBe(difference);
      expect(buffer.value).toBe(formatted);
      expect(buffer.formatter(difference)).toBe(formatted);
      expect(buffer.change).toContain('percentage points');
      expect(buffer.accessibleText).toContain(`${difference} percentage points`);
      expect(buffer.accessibleText).toContain('Synthetic demo data');
    }

    const readinessStage = DIAGNOSTIC_SCROLL_STAGES.find((stage) => stage.id === 'readiness')!;
    expect(readinessStage.metricValue).toBe(formatted);
  });
});
