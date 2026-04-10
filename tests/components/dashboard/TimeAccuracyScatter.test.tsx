import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ui/GlassCard', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
  GlassCardHeader: ({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: { text: string } }) => (
    <div data-testid="glass-card-header">
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      {badge && <span>{badge.text}</span>}
    </div>
  ),
}));

vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      {description && <p>{description}</p>}
    </div>
  ),
}));

vi.mock('recharts', () => ({
  ScatterChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scatter-chart">{children}</div>
  ),
  Scatter: () => <div data-testid="scatter" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ZAxis: () => null,
  Cell: () => null,
}));

import { TimeAccuracyScatter } from '@/components/dashboard/TimeAccuracyScatter';
import type { TimeAccuracyPoint } from '@/components/dashboard/TimeAccuracyScatter';

const mockData: TimeAccuracyPoint[] = [
  { system: 'Cardiovascular', avgTimeSec: 45.2, accuracy: 0.72, count: 50 },
  { system: 'Pulmonary', avgTimeSec: 22.1, accuracy: 0.88, count: 30 },
  { system: 'GI', avgTimeSec: 55.0, accuracy: 0.45, count: 40 },
];

describe('TimeAccuracyScatter', () => {
  it('renders loading skeleton', () => {
    const { container } = render(<TimeAccuracyScatter data={[]} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders empty state when no data', () => {
    render(<TimeAccuracyScatter data={[]} />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No timing data yet')).toBeTruthy();
  });

  it('renders chart with data', () => {
    render(<TimeAccuracyScatter data={mockData} />);
    expect(screen.getByText('Time vs Accuracy')).toBeTruthy();
    expect(screen.getByTestId('scatter-chart')).toBeTruthy();
  });

  it('shows inefficiency insight', () => {
    render(<TimeAccuracyScatter data={mockData} />);
    expect(screen.getByText(/GI/)).toBeTruthy();
  });

  it('displays system count badge', () => {
    render(<TimeAccuracyScatter data={mockData} />);
    expect(screen.getByText('3 systems')).toBeTruthy();
  });
});
