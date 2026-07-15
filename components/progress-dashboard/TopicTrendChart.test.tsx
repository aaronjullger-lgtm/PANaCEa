/**
 * Truthfulness test for TopicTrendChart — it must never fabricate progress.
 * With no data it shows an honest empty state; with real data it renders the chart.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopicTrendChart from './TopicTrendChart';

// recharts ResponsiveContainer uses ResizeObserver, which jsdom lacks.
beforeAll(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe('TopicTrendChart', () => {
  it('shows an honest empty state (no fabricated data) when no data is provided', () => {
    render(<TopicTrendChart topic="Cardiology" />);
    expect(screen.getByText(/No performance-trend data yet for Cardiology/i)).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows the empty state for an explicitly empty dataset', () => {
    render(<TopicTrendChart topic="Pulmonology" data={[]} />);
    expect(screen.getByText(/No performance-trend data yet/i)).toBeTruthy();
  });

  it('renders the trend heading (not the empty state) when real data is provided', () => {
    render(
      <TopicTrendChart
        topic="Cardiology"
        data={[
          { date: 'Apr 1', performance: 62 },
          { date: 'Apr 2', performance: 68 },
        ]}
      />
    );
    expect(screen.getByText('Performance Trend: Cardiology')).toBeTruthy();
    expect(screen.queryByText(/No performance-trend data yet/i)).toBeNull();
  });
});
