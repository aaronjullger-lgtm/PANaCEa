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

    expect(screen.getByText(/3 items selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve selected/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject selected/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ignore selected/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear selection/i })).toBeInTheDocument();
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

    const clearButton = screen.getByRole('button', { name: /clear selection/i });
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

    const approveButton = screen.getByRole('button', { name: /approve selected/i });
    const rejectButton = screen.getByRole('button', { name: /reject selected/i });
    const ignoreButton = screen.getByRole('button', { name: /ignore selected/i });

    expect(approveButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();
    expect(ignoreButton).toBeDisabled();
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

    const approveButton = screen.getByRole('button', { name: /approve selected/i });
    fireEvent.click(approveButton);

    // Check API call
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
          reason: undefined,
        }),
      })
    );

    // Wait for loading to finish
    await waitFor(() => {
      expect(mockOnActionComplete).toHaveBeenCalled();
    });
  });

  it('handles API error and shows error message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

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
      expect(screen.getByText(/failed to process bulk action/i)).toBeInTheDocument();
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

    const approveButton = screen.getByRole('button', { name: /approve selected/i });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText(/successfully processed 3 suggestions/i)).toBeInTheDocument();
    });
  });

  it('toggles advanced options', () => {
    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /advanced options/i });
    expect(screen.queryByText(/reason for action/i)).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByText(/reason for action/i)).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByText(/reason for action/i)).not.toBeInTheDocument();
  });

  it('includes reason in payload when provided', async () => {
    render(
      <BulkApprovalPanel
        selectedIds={mockSelectedIds}
        totalCount={10}
        onClearSelection={mockOnClearSelection}
        onActionComplete={mockOnActionComplete}
      />
    );

    // Open advanced options
    const toggleButton = screen.getByRole('button', { name: /advanced options/i });
    fireEvent.click(toggleButton);

    const reasonInput = screen.getByPlaceholderText(/optional reason/i);
    fireEvent.change(reasonInput, { target: { value: 'Test reason for approval' } });

    const approveButton = screen.getByRole('button', { name: /approve selected/i });
    fireEvent.click(approveButton);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          suggestionIds: mockSelectedIds,
          action: 'APPROVE',
          reason: 'Test reason for approval',
        }),
      })
    );
  });
});