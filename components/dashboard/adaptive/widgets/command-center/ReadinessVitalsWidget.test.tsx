import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReadinessVitalsWidget } from './ReadinessVitalsWidget';
import type { DashboardContext } from '../../model/DashboardContext';
import type { ReadinessVitalMetric } from '../../page/commandCenterMockData';

const metric: ReadinessVitalMetric = {
  id: 'accuracy',
  label: 'Accuracy',
  value: '86%',
  status: 'strong',
  context: 'Example accuracy increased.',
  accessibleDescription: 'Accuracy is 86 percent.',
  progress: 86,
  sparkline: [50, 70, 86],
  source: 'mock',
};

// Supplying metrics is the widget's public preview/testing boundary; no
// authenticated context or analytics requests are needed for these states.
const context = {} as DashboardContext;

describe('readiness metric provenance', () => {
  it('does not present a fallback percentage or fabricated trend as student progress', () => {
    const { container } = render(<ReadinessVitalsWidget context={context} metrics={[metric]} />);
    expect(screen.getByText('Not enough data')).toBeTruthy();
    expect(screen.queryByText('86%')).toBeNull();
    expect(screen.queryByText('Example accuracy increased.')).toBeNull();
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe(
      'Accuracy: not enough data yet.'
    );
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('preserves actual measurements, context, and accessible descriptions', () => {
    render(
      <ReadinessVitalsWidget context={context} metrics={[{ ...metric, source: 'analytics' }]} />
    );
    expect(screen.getByText('86%')).toBeTruthy();
    expect(screen.getByText('Example accuracy increased.')).toBeTruthy();
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Accuracy is 86 percent.');
    expect(screen.queryByText('Not enough data')).toBeNull();
  });

  it('shows a loading state without displaying unmeasured scores', () => {
    const { container } = render(
      <ReadinessVitalsWidget context={context} metrics={[metric]} loading />
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText('86%')).toBeNull();
  });
});
