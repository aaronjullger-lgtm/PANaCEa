import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuggestionTable } from '@/components/admin/SuggestionTable';
import type { MappingSuggestion } from '@/components/admin/SuggestionTable';

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
    MAPPING_ENRICHMENT_SUGGESTIONS: '/api/mapping-enrichment/suggestions',
    MAPPING_ENRICHMENT_SUGGESTION: (id: string) => `/api/mapping-enrichment/suggestions/${id}`,
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSuggestions: MappingSuggestion[] = [
  {
    id: '1',
    taxonomyCode: 'CV',
    taxonomyName: 'Cardiovascular',
    taxonomyDescription: 'Heart and blood vessels',
    taxonomyIsActive: true,
    suggestedSystemCode: 'CV',
    confidence: 0.95,
    reason: 'High similarity with cardiovascular keywords',
    alternativeSystems: [
      { systemCode: 'PUL', confidence: 0.3, reason: 'Some overlap' },
    ],
    status: 'PENDING',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2025-02-01T12:00:00Z',
    updatedAt: '2025-02-01T12:00:00Z',
    reviewedByUser: null,
  },
  {
    id: '2',
    taxonomyCode: 'PUL',
    taxonomyName: 'Pulmonary',
    taxonomyDescription: 'Lungs and respiratory',
    taxonomyIsActive: true,
    suggestedSystemCode: 'PUL',
    confidence: 0.87,
    reason: 'Strong keyword matches',
    alternativeSystems: [],
    status: 'APPROVED',
    reviewedBy: 'user-123',
    reviewedAt: '2025-02-02T10:30:00Z',
    createdAt: '2025-02-01T12:00:00Z',
    updatedAt: '2025-02-02T10:30:00Z',
    reviewedByUser: {
      id: 'user-123',
      email: 'admin@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
  },
  {
    id: '3',
    taxonomyCode: 'GI',
    taxonomyName: 'Gastrointestinal',
    taxonomyDescription: 'Digestive system',
    taxonomyIsActive: true,
    suggestedSystemCode: 'GI',
    confidence: 0.65,
    reason: 'Moderate similarity',
    alternativeSystems: [
      { systemCode: 'MSK', confidence: 0.2, reason: 'Weak overlap' },
      { systemCode: 'GU', confidence: 0.15, reason: 'Weak overlap' },
    ],
    status: 'REJECTED',
    reviewedBy: 'user-456',
    reviewedAt: '2025-02-03T14:20:00Z',
    createdAt: '2025-02-01T12:00:00Z',
    updatedAt: '2025-02-03T14:20:00Z',
    reviewedByUser: {
      id: 'user-456',
      email: 'reviewer@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    },
  },
];

describe('SuggestionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: mockSuggestions, total: mockSuggestions.length }),
    });
  });

  it('renders loading state initially', () => {
    render(<SuggestionTable />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders suggestions after loading', async () => {
    render(<SuggestionTable />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Check that suggestion rows are present
    expect(screen.getByText('Cardiovascular')).toBeInTheDocument();
    expect(screen.getByText('Pulmonary')).toBeInTheDocument();
    expect(screen.getByText('Gastrointestinal')).toBeInTheDocument();

    // Check status badges
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();

    // Check confidence displayed as percentage
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('applies status filter', async () => {
    render(<SuggestionTable initialStatus="PENDING" />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Only pending suggestion should be visible
    expect(screen.getByText('Cardiovascular')).toBeInTheDocument();
    expect(screen.queryByText('Pulmonary')).not.toBeInTheDocument();
    expect(screen.queryByText('Gastrointestinal')).not.toBeInTheDocument();
  });

  it('handles selection when selectable is true', async () => {
    const onSelectionChange = vi.fn();
    render(<SuggestionTable selectable onSelectionChange={onSelectionChange} />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is the header select-all, second is first row
    fireEvent.click(checkboxes[1]);

    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });

  it('calls update endpoint when action button clicked', async () => {
    // Mock individual PUT request
    mockFetch.mockImplementation((url, options) => {
      if (url.includes('/api/mapping-enrichment/suggestions/1') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      // Default for GET suggestions
      return Promise.resolve({
        ok: true,
        json: async () => ({ suggestions: mockSuggestions, total: mockSuggestions.length }),
      });
    });

    const onSuggestionUpdated = vi.fn();
    render(<SuggestionTable onSuggestionUpdated={onSuggestionUpdated} />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Find the approve button for the first suggestion (pending row)
    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    fireEvent.click(approveButtons[0]);

    // Wait for the PUT call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/mapping-enrichment/suggestions/1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.any(Object),
          body: JSON.stringify({ status: 'APPROVED' }),
        })
      );
    });

    // Callback should have been called
    expect(onSuggestionUpdated).toHaveBeenCalledWith('1', 'APPROVED');
  });

  it('shows error message when fetch fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<SuggestionTable />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load suggestions/i)).toBeInTheDocument();
    });
  });
});