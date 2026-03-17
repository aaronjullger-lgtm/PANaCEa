import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GoalsDashboard from '@/components/Goals/GoalsDashboard';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('GoalsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('mock-token');
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  it('loads and shows empty state when no goals exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ goals: [] }),
    });

    render(<GoalsDashboard />);

    expect(screen.getByText(/Loading goals/i)).toBeTruthy();
    await screen.findByText(/No goals yet/i);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/goals?status=active',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
      })
    );
  });

  it('refetches goals when status filter changes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ goals: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ goals: [] }),
      });

    render(<GoalsDashboard />);
    await screen.findByText(/No goals yet/i);

    const statusSelect = screen.getAllByRole('combobox')[0]!;
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user/goals?status=completed',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
        })
      );
    });
  });
});
