import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MappingEnrichmentDashboard } from '@/components/admin/MappingEnrichmentDashboard';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

// Mock heavy child components to isolate the dashboard's own loading/error states
vi.mock('@/components/admin/SuggestionTable', () => ({
  SuggestionTable: () => <div data-testid="suggestion-table-mock">SuggestionTable</div>,
}));
vi.mock('@/components/admin/mapping-enrichment/AuditLogTable', () => ({
  AuditLogTable: () => <div data-testid="audit-log-table-mock">AuditLogTable</div>,
}));
vi.mock('@/components/admin/mapping-enrichment/ChangePreviewModal', () => ({
  ChangePreviewModal: () => null,
}));
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

// Mock Clerk useAuth
const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

// Mock API config
vi.mock('@/lib/utils/apiConfig', () => ({
  getApiEndpoint: vi.fn((endpoint) => `https://api.example.com${endpoint}`),
  API_ENDPOINTS: {
    MAPPING_ENRICHMENT_SUGGESTIONS: '/api/mapping-enrichment/suggestions',
    MAPPING_ENRICHMENT_GAPS: '/api/mapping-enrichment/gaps',
    MAPPING_ENRICHMENT_SUGGEST: '/api/mapping-enrichment/suggest',
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MappingEnrichmentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockFetch.mockImplementation((url) => {
      if (url.includes('suggestions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [],
            pagination: { total: 0, totalPages: 0 },
          }),
        });
      }
      if (url.includes('gaps')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ gaps: [] }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  it('renders loading state initially', () => {
    render(<MappingEnrichmentDashboard />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders dashboard with stats after loading', async () => {
    // Mock successful data
    mockFetch.mockImplementation((url) => {
      if (url.includes('suggestions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [
              {
                id: '1',
                taxonomyCode: 'CV',
                taxonomyName: 'Cardiovascular',
                taxonomyDescription: 'Diseases of the heart and blood vessels',
                taxonomyIsActive: true,
                suggestedSystemCode: 'CV',
                confidence: 0.95,
                reason: 'Keyword overlap and embedding similarity',
                alternativeSystems: [],
                status: 'PENDING',
                reviewedBy: null,
                reviewedAt: null,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
                reviewedByUser: null,
              },
              {
                id: '2',
                taxonomyCode: 'PUL',
                taxonomyName: 'Pulmonary',
                taxonomyDescription: 'Diseases of the respiratory system',
                taxonomyIsActive: true,
                suggestedSystemCode: 'PUL',
                confidence: 0.87,
                reason: 'Keyword overlap and embedding similarity',
                alternativeSystems: [],
                status: 'APPROVED',
                reviewedBy: 'user-123',
                reviewedAt: '2025-01-02T00:00:00Z',
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-02T00:00:00Z',
                reviewedByUser: {
                  id: 'user-123',
                  email: 'admin@example.com',
                  firstName: 'Admin',
                  lastName: 'User',
                },
              },
            ],
            pagination: { total: 2, totalPages: 1 },
          }),
        });
      }
      if (url.includes('gaps')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            gaps: [
              {
                taxonomyCode: 'GI',
                taxonomyName: 'Gastrointestinal',
                description: 'Digestive system',
                weight: 8,
                isActive: true,
                missingMappingsCount: 1,
                exampleUnmappedSubcategories: ['Gastroesophageal reflux disease'],
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<MappingEnrichmentDashboard />);

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });

    // Check stat card labels are displayed
    expect(screen.getByText('Pending Suggestions')).toBeTruthy();
    expect(screen.getByText('Approved Mappings')).toBeTruthy();
    expect(screen.getByText('Active Gaps')).toBeTruthy();

    // Check numeric counts (1 PENDING, 1 APPROVED, 1 active gap)
    expect(screen.getByText('2 total suggestions')).toBeTruthy();
    expect(screen.getByText('1 total gaps')).toBeTruthy();
  });

  it('handles error state', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<MappingEnrichmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/error loading dashboard/i)).toBeTruthy();
    });
  });

  it('triggers gap detection', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('suggestions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            suggestions: [],
            pagination: { total: 0, totalPages: 0 },
          }),
        });
      }
      if (url.includes('gaps')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ gaps: [] }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<MappingEnrichmentDashboard />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });

    const detectGapsButton = screen.getByRole('button', { name: /detect gaps/i });
    fireEvent.click(detectGapsButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mapping-enrichment/gaps'),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  it('triggers suggestion generation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    });

    render(<MappingEnrichmentDashboard />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });

    const generateButton = screen.getByRole('button', { name: /generate suggestions/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mapping-enrichment/suggest'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});