import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import { AnswerSwitchInsight } from '@/components/dashboard/AnswerSwitchInsight';
import type { AnswerSwitchBySystem } from '@/components/dashboard/AnswerSwitchInsight';

const mockData: AnswerSwitchBySystem[] = [
  { system: 'Cardiovascular', totalQuestions: 50, switchedCount: 12, firstInstinctCorrect: 0.78, switchHurtRate: 0.65 },
  { system: 'Pulmonary', totalQuestions: 30, switchedCount: 3, firstInstinctCorrect: 0.85, switchHurtRate: 0.33 },
];

describe('AnswerSwitchInsight', () => {
  it('renders loading skeleton', () => {
    const { container } = render(<AnswerSwitchInsight data={[]} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders empty state when no data', () => {
    render(<AnswerSwitchInsight data={[]} />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No switch data yet')).toBeTruthy();
  });

  it('renders insight cards with data', () => {
    render(<AnswerSwitchInsight data={mockData} />);
    expect(screen.getByText('Answer Switch Patterns')).toBeTruthy();
    expect(screen.getAllByText('Cardiovascular').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pulmonary').length).toBeGreaterThan(0);
  });

  it('shows switch hurt insight for worst system', () => {
    render(<AnswerSwitchInsight data={mockData} />);
    expect(screen.getAllByText(/65%/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cardiovascular/).length).toBeGreaterThan(0);
  });

  it('shows first instinct accuracy for best system', () => {
    render(<AnswerSwitchInsight data={mockData} />);
    expect(screen.getAllByText(/85%/).length).toBeGreaterThan(0);
  });

  it('displays system count badge', () => {
    render(<AnswerSwitchInsight data={mockData} />);
    expect(screen.getByText('2 systems')).toBeTruthy();
  });
});
