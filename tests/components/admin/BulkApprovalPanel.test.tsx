import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkApprovalPanel } from '@/components/admin/BulkApprovalPanel';

// Mock Clerk useAuth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

// Mock API config
vi.mock('@/lib/utils/apiConfig', () => ({
  getApiEndpoint: vi.fn((endpoint) => `https://api.example.com${endpoint}`),
  API_ENDPOINTS: {
    MAPPING_ENRICHMENT_BULK_APPROVE: '/api/mapping-enrichment/bulk-approve',
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BulkApprovalPanel', () => {
  const mockSelectedIds = ['1', '2', '3'];
  const mockOnClearSelection = vi.fn();
  const mockOnActionComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, processed: mockSelectedIds.length }),
    });
  });

  it('renders with selected count', () => {
    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    expect(screen.getByText(/3 suggestions selected/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /approve selected/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reject selected/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /ignore selected/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /clear selection/i })).toBeTruthy();
  });

  it('calls onClearSelection when clear button clicked', () => {
    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    const clearButton = screen.getAllByRole('button', { name: /clear selection/i })[0];
    fireEvent.click(clearButton);

    expect(mockOnClearSelection).toHaveBeenCalled();
  });

  it('disables action buttons when no items selected', () => {
    render(
      <BulkApprovalPanel
        selectedIds={[]}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    const approveButton = screen.getAllByRole('button', { name: /approve selected/i })[0];
    const rejectButton = screen.getAllByRole('button', { name: /reject selected/i })[0];
    const ignoreButton = screen.getAllByRole('button', { name: /ignore selected/i })[0];

    expect((approveButton as HTMLButtonElement).disabled).toBe(true);
    expect((rejectButton as HTMLButtonElement).disabled).toBe(true);
    expect((ignoreButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls bulk-approve endpoint when approve action is triggered', async () => {
    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    const approveButton = screen.getAllByRole('button', { name: /approve selected/i })[0];
    fireEvent.click(approveButton);

    // Check API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/mapping-enrichment/bulk-approve',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer mock-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            suggestionIds: mockSelectedIds,
            action: 'APPROVE',
          }),
        })
      );
    });

    // Wait for loading to finish
    await waitFor(() => {
      expect(mockOnActionComplete).toHaveBeenCalled();
    });
    expect(mockOnClearSelection).toHaveBeenCalled();
  });

  it('handles API error and shows error message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Internal server error',
    });

    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    const approveButton = screen.getAllByRole('button', { name: /approve selected/i })[0];
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getAllByText(/bulk action failed/i).length).toBeGreaterThan(0);
    });
    // onActionComplete should NOT be called on error
    expect(mockOnActionComplete).not.toHaveBeenCalled();
  });

  it('shows success message after successful action', async () => {
    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    const approveButton = screen.getAllByRole('button', { name: /approve selected/i })[0];
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText(/3 suggestions approved successfully/i)).toBeTruthy();
    });
  });

  it('toggles advanced options', async () => {
    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /advanced/i });
    expect(screen.queryByText(/high-confidence approve/i)).toBeNull();

    fireEvent.click(toggleButton);
    expect(screen.getByText(/high-confidence approve/i)).toBeTruthy();

    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(screen.queryByText(/high-confidence approve/i)).toBeNull();
    });
  });

  it('sends payload without optional reason field', async () => {
    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve selected/i });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            suggestionIds: mockSelectedIds,
            action: 'APPROVE',
          }),
        })
      );
    });
  });
});