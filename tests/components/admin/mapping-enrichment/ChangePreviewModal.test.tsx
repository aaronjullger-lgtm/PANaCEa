import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChangePreviewModal } from '@/components/admin/mapping-enrichment/ChangePreviewModal';
import type { MappingSuggestion } from '@/components/admin/mapping-enrichment/ChangePreviewModal';
import type { PreviewResult } from '@/services/domain/mappingEnrichment/previewService';

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
    MAPPING_ENRICHMENT_PREVIEW: '/api/mapping-enrichment/preview',
  },
}));

// Mock audit logger
vi.mock('@/services/domain/audit/mappingAuditLogger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSuggestions: MappingSuggestion[] = [
  {
    id: '1',
    taxonomyCode: 'CV',
    taxonomyName: 'Cardiovascular',
    suggestedSystemCode: 'CV',
    confidence: 0.95,
    reason: 'High similarity with cardiovascular keywords',
    status: 'PENDING' as const,
  },
  {
    id: '2',
    taxonomyCode: 'PUL',
    taxonomyName: 'Pulmonary',
    suggestedSystemCode: 'PUL',
    confidence: 0.87,
    reason: 'Matches pulmonary system',
    status: 'PENDING' as const,
  },
];

const mockPreviewResult: PreviewResult = {
  before: {
    complianceScore: 0.85,
    systems: [
      { system: 'CV', targetPercent: 11, actualPercent: 9.5, deviation: -1.5, status: 'under' },
      { system: 'PUL', targetPercent: 9, actualPercent: 10.2, deviation: 1.2, status: 'over' },
      { system: 'GI', targetPercent: 8, actualPercent: 8.0, deviation: 0, status: 'met' },
    ],
    systemsMet: 1,
    systemsUnder: 1,
    systemsOver: 1,
    totalMappedTaxonomies: 3,
    analyzedAt: '2026-03-03T20:45:00.000Z',
    topDeviations: [],
    recommendations: ['Increase cardiovascular content', 'Maintain pulmonary coverage'],
  },
  after: {
    complianceScore: 0.92,
    systems: [
      { system: 'CV', targetPercent: 11, actualPercent: 10.8, deviation: -0.2, status: 'met' },
      { system: 'PUL', targetPercent: 9, actualPercent: 9.5, deviation: 0.5, status: 'met' },
      { system: 'GI', targetPercent: 8, actualPercent: 8.0, deviation: 0, status: 'met' },
    ],
    systemsMet: 3,
    systemsUnder: 0,
    systemsOver: 0,
    totalMappedTaxonomies: 3,
    analyzedAt: '2026-03-03T20:45:00.000Z',
    topDeviations: [],
    recommendations: ['Excellent balance achieved'],
  },
  changes: [
    { taxonomyCode: 'CV', taxonomyName: 'Cardiovascular', systemCode: 'CV', previousSystemCode: null },
    { taxonomyCode: 'PUL', taxonomyName: 'Pulmonary', systemCode: 'PUL', previousSystemCode: null },
  ],
};

describe('ChangePreviewModal', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
  });

  it('renders nothing when not open', () => {
    const { container } = render(
      <ChangePreviewModal
        open={false}
        onClose={() => {}}
        selectedSuggestions={mockSuggestions}
      />
    );
    // Modal should not be in the document
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows loading state when fetching preview', async () => {
    mockFetch.mockImplementationOnce(() =>
      new Promise((resolve) => setTimeout(() => resolve(new Response(
        JSON.stringify({ data: mockPreviewResult }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )), 100))
    );

    render(
      <ChangePreviewModal
        open={true}
        onClose={() => {}}
        selectedSuggestions={mockSuggestions}
      />
    );

    // Should show loading spinner
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/computing preview/i)).toBeInTheDocument();
  });

  it('displays preview data after successful fetch', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: mockPreviewResult }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <ChangePreviewModal
        open={true}
        onClose={() => {}}
        selectedSuggestions={mockSuggestions}
      />
    );

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());

    // Should display before/after sections
    expect(screen.getByText(/^before$/i)).toBeInTheDocument();
    expect(screen.getByText(/^after$/i)).toBeInTheDocument();

    // Should display system rows
    expect(screen.getAllByText('CV').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PUL').length).toBeGreaterThan(0);

    // Should display recommendations
    expect(screen.getByText(/excellent balance achieved/i)).toBeInTheDocument();
    expect(screen.getByText(/excellent balance achieved/i)).toBeInTheDocument();

    // Should display changes table
    expect(screen.getByText('Cardiovascular')).toBeInTheDocument();
    expect(screen.getByText('Pulmonary')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <ChangePreviewModal
        open={true}
        onClose={() => {}}
        selectedSuggestions={mockSuggestions}
      />
    );

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());

    expect(screen.getByText(/invalid request/i)).toBeInTheDocument();
    expect(screen.getByText(/preview failed/i)).toBeInTheDocument();
  });

  it('calls onApprovePreview when "Proceed to Approval" clicked', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: mockPreviewResult }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const mockOnApprove = vi.fn();

    render(
      <ChangePreviewModal
        open={true}
        onClose={() => {}}
        selectedSuggestions={mockSuggestions}
        onApprovePreview={mockOnApprove}
      />
    );

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());

    const approveButton = screen.getAllByRole('button', { name: /proceed to approval/i })[0];
    fireEvent.click(approveButton);

    expect(mockOnApprove).toHaveBeenCalledTimes(1);
    expect(mockOnApprove).toHaveBeenCalledWith(mockPreviewResult);
  });

  it('calls onClose when close button clicked', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: mockPreviewResult }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const mockOnClose = vi.fn();

    render(
      <ChangePreviewModal
        open={true}
        onClose={mockOnClose}
        selectedSuggestions={mockSuggestions}
      />
    );

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());

    const closeButton = screen.getAllByRole('button', { name: /close/i })[0];
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('logs audit event on successful preview', async () => {
    const { logAuditEvent } = await import('@/services/domain/audit/mappingAuditLogger');
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: mockPreviewResult }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(
      <ChangePreviewModal
        open={true}
        onClose={() => {}}
        selectedSuggestions={mockSuggestions}
      />
    );

    await waitFor(() => expect(logAuditEvent).toHaveBeenCalledTimes(1));
    expect(logAuditEvent).toHaveBeenCalledWith({
      action: 'PREVIEW',
      taxonomyCodes: ['CV', 'PUL'],
      systemCodes: ['CV', 'PUL'],
      metadata: { previewId: 'generated' },
    });
  });
});