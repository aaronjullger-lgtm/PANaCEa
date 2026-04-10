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
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Legend: () => null,
}));

import { ConfidenceCalibrationTracker } from '@/components/dashboard/ConfidenceCalibrationTracker';
import type { CalibrationDataPoint } from '@/components/dashboard/ConfidenceCalibrationTracker';

const mockData: CalibrationDataPoint[] = [
  { date: 'Mar 24', predictedAccuracy: 0.80, actualAccuracy: 0.55 },
  { date: 'Mar 31', predictedAccuracy: 0.72, actualAccuracy: 0.68 },
  { date: 'Apr 7', predictedAccuracy: 0.70, actualAccuracy: 0.65 },
];

describe('ConfidenceCalibrationTracker', () => {
  it('renders loading skeleton', () => {
    const { container } = render(<ConfidenceCalibrationTracker data={[]} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders empty state when no data', () => {
    render(<ConfidenceCalibrationTracker data={[]} />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No calibration data yet')).toBeTruthy();
  });

  it('renders chart with data', () => {
    render(<ConfidenceCalibrationTracker data={mockData} />);
    expect(screen.getByText('Confidence Calibration')).toBeTruthy();
    expect(screen.getByTestId('line-chart')).toBeTruthy();
  });

  it('shows calibration improving message', () => {
    render(<ConfidenceCalibrationTracker data={mockData} />);
    expect(screen.getByText(/improving/)).toBeTruthy();
    expect(screen.getByText(/70%/)).toBeTruthy();
    expect(screen.getByText(/65%/)).toBeTruthy();
  });

  it('shows overconfident badge when applicable', () => {
    const overconfidentData: CalibrationDataPoint[] = [
      { date: 'Mar 24', predictedAccuracy: 0.90, actualAccuracy: 0.60 },
      { date: 'Mar 31', predictedAccuracy: 0.85, actualAccuracy: 0.65 },
    ];
    render(<ConfidenceCalibrationTracker data={overconfidentData} />);
    expect(screen.getByText('Overconfident')).toBeTruthy();
  });

  it('shows underconfident badge when applicable', () => {
    const underconfidentData: CalibrationDataPoint[] = [
      { date: 'Mar 24', predictedAccuracy: 0.50, actualAccuracy: 0.80 },
      { date: 'Mar 31', predictedAccuracy: 0.55, actualAccuracy: 0.82 },
    ];
    render(<ConfidenceCalibrationTracker data={underconfidentData} />);
    expect(screen.getByText('Underconfident')).toBeTruthy();
  });

  it('shows On Target badge when well calibrated', () => {
    const calibratedData: CalibrationDataPoint[] = [
      { date: 'Mar 24', predictedAccuracy: 0.72, actualAccuracy: 0.70 },
      { date: 'Mar 31', predictedAccuracy: 0.75, actualAccuracy: 0.73 },
    ];
    render(<ConfidenceCalibrationTracker data={calibratedData} />);
    expect(screen.getByText('On Target')).toBeTruthy();
  });
});
