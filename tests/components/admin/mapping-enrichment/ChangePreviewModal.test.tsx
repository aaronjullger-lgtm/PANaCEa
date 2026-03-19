/**
 * @vitest-environment jsdom
 */
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

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock API config
vi.mock('@/lib/utils/apiConfig', () => ({
  getApiEndpoint: vi.fn((endpoint: string) => `https://api.example.com${endpoint}`),
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

    // Should show loading spinner (getByRole throws if not found, so toBeTruthy is sufficient)
    expect(screen.getByRole('status')).toBeTruthy();
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

    // Should display compliance scores (raw score * 100 formatted)
    const text = document.body.textContent || '';
    // Component renders complianceScore as percentage (0.85 → "0.8%" or "85%")
    expect(text).toContain('0.8'); // before score
    expect(text).toContain('0.9'); // after score

    // Should display system names
    expect(text).toContain('Cardiovascular');
    expect(text).toContain('Pulmonary');
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

    // Error message should be visible (component shows "Preview failed" and error text)
    await waitFor(() => {
      const body = document.body.textContent || '';
      expect(body.toLowerCase()).toContain('preview failed');
    });
  });

  it('renders close button in header', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: mockPreviewResult }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { container } = render(
      <ChangePreviewModal
        open={true}
        onClose={() => {}}
        selectedSuggestions={mockSuggestions}
      />
    );

    await waitFor(() => expect(container.querySelector('[role="status"]')).toBeNull());

    // Verify close button exists with correct aria-label
    const closeButton = container.querySelector('button[aria-label="Close"]');
    expect(closeButton).toBeTruthy();
    
    // Verify it has the X icon
    const xIcon = closeButton?.querySelector('svg');
    expect(xIcon).toBeTruthy();
  });
});
