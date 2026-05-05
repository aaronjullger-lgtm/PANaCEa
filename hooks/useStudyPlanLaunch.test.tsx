import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudyPlanLaunch } from './useStudyPlanLaunch';

const mockGetToken = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('useStudyPlanLaunch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetToken.mockResolvedValue('token');
    mockNavigate.mockReset();
    sessionStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'plan-day' } }),
    } as Response);
  });

  it('launches study-plan tasks through the canonical main-session route', async () => {
    const { result } = renderHook(() => useStudyPlanLaunch());

    await act(async () => {
      await result.current.launchTask('2026-05-01', {
        id: '2026-05-01-targeted-review',
        title: 'Due review block',
        kind: 'targeted',
        mode: 'rapid_recall',
        route: '/modes/rapid-recall',
        count: 12,
        conditionIds: ['pulmonary-embolism', 'pneumonia'],
        launchParams: { source: 'study-plan' },
      });
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/study-plan/progress', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planDate: '2026-05-01',
        taskId: '2026-05-01-targeted-review',
        action: 'start',
      }),
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const target = mockNavigate.mock.calls[0]?.[0] as string;
    expect(target).toContain('/study/main-session?');
    expect(target).toContain('source=study-plan');
    expect(target).toContain('taskId=2026-05-01-targeted-review');
    expect(target).toContain('planDate=2026-05-01');
    expect(target).toContain('mode=condition');
    expect(target).toContain('count=12');
    expect(target).toContain('conditionId=pulmonary-embolism');
    expect(target).not.toContain('/modes/rapid-recall');

    expect(sessionStorage.getItem('panacea.study-plan.active-task.v1')).toContain(
      '2026-05-01-targeted-review'
    );
    expect(sessionStorage.getItem('panacea.study-plan.pending-session.v1')).toContain(
      'Due review block'
    );
    const pendingIntent = JSON.parse(
      sessionStorage.getItem('panacea.study-plan.pending-session.v1') ?? '{}'
    );
    expect(pendingIntent.settings).toEqual(
      expect.objectContaining({
        mode: 'targeted',
        focus: 'topic',
        conditionId: 'pulmonary-embolism',
        count: 12,
        questionCount: 12,
      })
    );
  });

  it('preserves true review tasks as review sessions when no condition target exists', async () => {
    const { result } = renderHook(() => useStudyPlanLaunch());

    await act(async () => {
      await result.current.launchTask('2026-05-01', {
        id: '2026-05-01-due-review',
        title: 'Review due material',
        kind: 'review',
        count: 8,
      });
    });

    const pendingIntent = JSON.parse(
      sessionStorage.getItem('panacea.study-plan.pending-session.v1') ?? '{}'
    );
    expect(pendingIntent.settings).toEqual(
      expect.objectContaining({
        mode: 'review',
        focus: 'review',
        count: 8,
        questionCount: 8,
      })
    );
    expect(mockNavigate.mock.calls[0]?.[0]).toContain('mode=review');
  });

  it('does not launch system-only targeted tasks as condition sessions', async () => {
    const { result } = renderHook(() => useStudyPlanLaunch());

    await act(async () => {
      await result.current.launchTask('2026-05-01', {
        id: '2026-05-01-targeted-systems',
        title: 'Targeted systems block',
        kind: 'targeted',
        mode: 'rapid_recall',
        count: 16,
        systems: ['Pulmonary'],
      });
    });

    const target = mockNavigate.mock.calls[0]?.[0] as string;
    expect(target).toContain('/study/main-session?');
    expect(target).toContain('mode=system');
    expect(target).toContain('systems=Pulmonary');
    expect(target).not.toContain('mode=condition');
    expect(target).not.toContain('conditionId=');

    const pendingIntent = JSON.parse(
      sessionStorage.getItem('panacea.study-plan.pending-session.v1') ?? '{}'
    );
    expect(pendingIntent.settings).toEqual(
      expect.objectContaining({
        mode: 'core_adaptive',
        focus: 'all',
        count: 16,
        questionCount: 16,
        systems: ['Pulmonary'],
      })
    );
    expect(pendingIntent.settings.conditionId).toBeUndefined();
  });

  it('does not navigate when the plan start write fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Study plan task not found' }),
    } as Response);
    const { result } = renderHook(() => useStudyPlanLaunch());

    await act(async () => {
      await result.current.launchTask('2026-05-01', {
        id: 'missing-task',
        title: 'Missing task',
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Study plan task not found');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('panacea.study-plan.active-task.v1')).toBeNull();
  });
});
