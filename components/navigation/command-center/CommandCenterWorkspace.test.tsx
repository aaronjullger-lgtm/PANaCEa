import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandCenterWorkspace, type CommandCenterHubProps } from './CommandCenterWorkspace';
import type { PerformanceRecord } from '@/types';

const mockUseTodayPlan = vi.hoisted(() => vi.fn());
const mockUseUserProfile = vi.hoisted(() => vi.fn());
const mockUseDashboardAnalytics = vi.hoisted(() => vi.fn());
const mockUseUser = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useTodayPlan', () => ({
  useTodayPlan: mockUseTodayPlan,
}));

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: mockUseUserProfile,
}));

vi.mock('@/hooks/useDashboardAnalytics', () => ({
  useDashboardAnalytics: mockUseDashboardAnalytics,
}));

vi.mock('@clerk/clerk-react', () => ({
  useUser: mockUseUser,
  useAuth: mockUseAuth,
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

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
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
  mockUseAuth.mockReturnValue({ getToken: vi.fn().mockResolvedValue('token') });
  mockUseUserProfile.mockReturnValue({
    profile: {
      firstName: 'Aaron',
      currentRotation: 'Psychiatry',
      examDate: isoDaysFromNow(60),
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
      tasks: [
        {
          id: 'main-readiness',
          kind: 'main',
          mode: 'core_adaptive',
          title: 'Readiness question block',
          count: 20,
          estimatedMinutes: 28,
          reason: 'Focus on Pulmonary based on recent readiness gaps.',
          priority: 'high',
          status: 'pending',
          systemFilter: ['Pulmonary'],
          route: '/study/main-session',
          launchParams: { source: 'study-plan' },
        },
        {
          id: 'targeted-review',
          kind: 'targeted',
          mode: 'rapid_recall',
          title: 'Due review block',
          count: 12,
          estimatedMinutes: 16,
          reason: 'Prioritize due and overdue reviews.',
          priority: 'high',
          status: 'pending',
          conditionIds: ['PE vs pneumonia'],
          route: '/modes/rapid-recall',
          launchParams: { source: 'study-plan' },
        },
      ],
    },
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockUseDashboardAnalytics.mockReturnValue({
    data: {
      overview: {
        attemptsLast7Days: 42,
        accuracyLast7Days: 68,
        accuracyDelta: 4,
        totalAttempts: 120,
        questionsSeen: 90,
        currentStreak: 4,
        activeDays: 18,
        studyMinutesLast7Days: 160,
        avgSessionQuestions: 14,
        dueToday: 12,
        overdueReviews: 2,
        totalActiveReviews: 80,
      },
      trend: Array.from({ length: 14 }, (_, index) => ({
        date: `2026-04-${String(16 + index).padStart(2, '0')}`,
        attempts: 8,
        correct: 5,
        accuracy: 58 + index,
        totalTimeMs: 18 * 60_000,
        sessionCount: 1,
      })),
      heatmap: [],
      weakSystems: [
        {
          system: 'Pulmonary',
          accuracy: 61,
          attempts: 28,
          trend: 'declining',
          gapPercent: -8,
          label: 'needs-accuracy-work',
          score: 48,
        },
      ],
      recentSessions: [],
      reviewForecast: {
        overdue: 2,
        today: 12,
        totalActive: 80,
        dueConditionIds: ['PE vs pneumonia'],
        overdueConditionIds: ['PE vs pneumonia'],
        dueReviewCardIds: [],
        overdueReviewCardIds: [],
        forecast: Array.from({ length: 7 }, (_, index) => ({
          date: isoDaysFromNow(index),
          count: index === 0 ? 12 : 5 + index,
        })),
      },
      blueprintGaps: {
        systems: [
          {
            system: 'Pulmonary',
            targetPercent: 10,
            actualPercent: 5,
            gapPercent: -5,
            totalAttempts: 28,
            correctAttempts: 17,
            accuracy: 61,
          },
        ],
        totalAttempts: 120,
        coverageScore: 74,
      },
      weakConditions: [],
      conditionStats: [],
      confusionPairs: [
        {
          id: 'pair-1',
          correctConditionId: 'pe',
          selectedConditionId: 'pneumonia',
          system: 'Pulmonary',
          frequency: 6,
          lastSeen: new Date().toISOString(),
          correctConditionName: 'PE',
          selectedConditionName: 'Pneumonia',
        },
      ],
      recommendations: [],
      warnings: [],
      hasMeaningfulData: true,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe('CommandCenterWorkspace clinical briefing', () => {
  it('renders the four briefing zones with one primary study action', () => {
    renderDashboard();

    expect(screen.getByText(/Today's session/i)).toBeTruthy();
    expect(screen.getByText(/Adaptive insight stack/i)).toBeTruthy();
    expect(screen.getAllByText(/Review coverage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PE vs pneumonia/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Start today’s session/i })).toBeTruthy();
    expect(screen.getAllByTestId('primary-study-action')).toHaveLength(1);
    expect(screen.queryByText(/Daily Pilot|Data Scientist/i)).toBeNull();
  }, 10_000);

  it('does not render manual confidence controls or prompts', () => {
    renderDashboard();

    expect(
      screen.queryByText(/confidence rating|confidence selector|confidence slider|how confident are you/i)
    ).toBeNull();
  });

  it('uses a baseline action when there is not enough performance signal', () => {
    mockUseDashboardAnalytics.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderDashboard({ performanceData: [] });

    expect(screen.getByText(/Baseline calibration block/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start baseline block/i })).toBeTruthy();
  });

  it('uses the urgent review debt state when reviews are the highest-value move', () => {
    renderDashboard({ dueCount: 18 });

    expect(screen.getAllByText(/Review coverage/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Riskiest reviews protected first/i)).toBeTruthy();
    expect(screen.getAllByTestId('primary-study-action')).toHaveLength(1);
  });

  it('does not claim review protection when today plan has no review task', () => {
    mockUseTodayPlan.mockReturnValue({
      data: {
        recommendedMainCount: 20,
        recommendedTargetedCount: 12,
        mainSystems: ['Pulmonary'],
        targetedConditions: ['PE vs pneumonia'],
        readinessPriority: 72,
        retentionPriority: 44,
        recommendedSplit: 'main_heavy',
        reasonSummary: 'Pulmonary is the highest-value readiness signal.',
        generatedAt: new Date().toISOString(),
        tasks: [],
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderDashboard({ dueCount: 18 });

    expect(screen.getByText(/Review load needs a queue pass/i)).toBeTruthy();
    expect(screen.queryByText(/Riskiest reviews protected first/i)).toBeNull();
  });

  it('opens and closes the attribution drawer from the Today card', () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: /^Why this\?$/i }));
    expect(screen.getByRole('dialog', { name: /Why this is shown/i })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Why this is shown/i })).toBeNull();
  });

  it('uses the exam-soon state when the exam is inside the risk window', () => {
    mockUseUserProfile.mockReturnValue({
      profile: {
        firstName: 'Aaron',
        currentRotation: 'Emergency Medicine',
        examDate: isoDaysFromNow(10),
        eorTestDate: null,
      },
    });

    renderDashboard({ dueCount: 2 });

    expect(screen.getAllByText(/Exam horizon/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('primary-study-action')).toHaveLength(1);
  });

  it('uses the limited-time state without exposing the other states', () => {
    renderDashboard({ availableMinutes: 15, dueCount: 2 });

    expect(screen.getByText(/Minimum useful plan/i)).toBeTruthy();
    expect(screen.getAllByText(/15 min/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('primary-study-action')).toHaveLength(1);
  });

  it('shows calm recovery copy when recommendations are unavailable', () => {
    mockUseTodayPlan.mockReturnValue({
      data: null,
      isLoading: false,
      error: 'Study plan fetch failed',
      refresh: vi.fn(),
    });

    renderDashboard();

    expect(screen.getByText(/Study plan fetch failed/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start today’s session/i })).toBeTruthy();
  });
});
