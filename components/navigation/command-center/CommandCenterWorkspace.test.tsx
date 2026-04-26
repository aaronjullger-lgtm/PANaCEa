import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandCenterWorkspace, type CommandCenterHubProps } from './CommandCenterWorkspace';
import type { PerformanceRecord } from '@/types';

const mockUseTodayPlan = vi.hoisted(() => vi.fn());
const mockUseUserProfile = vi.hoisted(() => vi.fn());
const mockUseUser = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useTodayPlan', () => ({
  useTodayPlan: mockUseTodayPlan,
}));

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: mockUseUserProfile,
}));

vi.mock('@clerk/clerk-react', () => ({
  useUser: mockUseUser,
}));

function makePerformanceData(): PerformanceRecord[] {
  const now = Date.now();
  return Array.from({ length: 8 }, (_, index) => ({
    timestamp: now - index * 60_000,
    system: index % 2 === 0 ? 'PULM' : 'CV',
    subcategory: null,
    conditionId: `condition-${index}`,
    condition: index % 2 === 0 ? 'Asthma' : 'ACS',
    topic: index % 2 === 0 ? 'PULM' : 'CV',
    isCorrect: index % 3 !== 0,
    focus: 'all',
  }));
}

function renderDashboard(overrides: Partial<CommandCenterHubProps> = {}) {
  const props: CommandCenterHubProps = {
    performanceData: makePerformanceData(),
    missedQuestions: [],
    flaggedQuestions: [],
    growthAreas: ['Pulmonary'],
    dueCount: 3,
    examLabel: 'PANCE',
    onStartSession: vi.fn(),
    onNavigateToDrillMode: vi.fn(),
    onNavigateToToolkit: vi.fn(),
    onNavigateToGapAnalysis: vi.fn(),
    ...overrides,
  };

  return render(
    <MemoryRouter>
      <CommandCenterWorkspace {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseUser.mockReturnValue({ user: { firstName: 'Aaron' } });
  mockUseUserProfile.mockReturnValue({
    profile: {
      firstName: 'Aaron',
      currentRotation: 'Psychiatry',
      examDate: '2026-06-01',
      eorTestDate: null,
    },
  });
  mockUseTodayPlan.mockReturnValue({
    data: {
      recommendedMainCount: 20,
      recommendedTargetedCount: 12,
      mainSystems: ['Pulmonary'],
      targetedConditions: ['PE vs pneumonia'],
      readinessPriority: 72,
      retentionPriority: 44,
      recommendedSplit: 'main_heavy',
      reasonSummary:
        'Pulmonary is the highest-value readiness signal and reviews are not first right now.',
      generatedAt: new Date().toISOString(),
    },
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  });
});

describe('CommandCenterWorkspace clinical briefing', () => {
  it('renders the four briefing zones with one primary study action', () => {
    renderDashboard();

    expect(screen.getByText(/Start here/i)).toBeTruthy();
    expect(screen.getByText(/Tonight's plan/i)).toBeTruthy();
    expect(screen.getByText(/Quiet signals/i)).toBeTruthy();
    expect(screen.getByText(/Details when you want them/i)).toBeTruthy();
    expect(screen.getAllByText(/PE vs pneumonia/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/12 questions · 28 min · High impact/i)).toBeTruthy();
    expect(screen.getAllByTestId('primary-study-action')).toHaveLength(1);
  });

  it('does not render manual confidence controls or prompts', () => {
    renderDashboard();

    expect(
      screen.queryByText(/confidence rating|confidence selector|confidence slider|how confident are you/i)
    ).toBeNull();
  });

  it('uses a baseline action when there is not enough performance signal', () => {
    renderDashboard({ performanceData: [] });

    expect(screen.getByText(/Set your baseline/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start 10-question baseline/i })).toBeTruthy();
  });

  it('shows calm recovery copy when recommendations are unavailable', () => {
    mockUseTodayPlan.mockReturnValue({
      data: null,
      isLoading: false,
      error: 'Study plan fetch failed',
      refresh: vi.fn(),
    });

    renderDashboard();

    expect(screen.getByText('Recommendations unavailable.')).toBeTruthy();
    expect(screen.getAllByText(/Your progress is safe/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Start focused block/i })).toBeTruthy();
  });
});
