import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineSyncIndicator } from '@/components/offline/OfflineSyncIndicator';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
const mockSyncPendingOperations = vi.fn().mockResolvedValue(undefined);
const mockSyncNow = vi.fn().mockResolvedValue(undefined);
const mockProcessLegacyQueue = vi.fn().mockResolvedValue(undefined);
const mockRetryLegacyDeadLetters = vi.fn().mockResolvedValue(0);
const mockDiscardLegacyDeadLetters = vi.fn().mockReturnValue(0);

const syncStatusState = {
  pendingCount: 0,
  lastSyncTime: null as number | null,
  isOffline: false,
};

const legacyQueueStatusState = {
  total: 0,
  pending: 0,
  synced: 0,
  failed: 0,
};

let legacyDeadLetterCount = 0;

const syncManagerState = {
  pendingAnswers: 0,
  pendingPearlActions: 0,
  pendingReviews: 0,
  deadLetteredAnswers: 0,
  deadLetteredPearlActions: 0,
  deadLetteredReviews: 0,
  lastSyncError: null as string | null,
  lastSyncTime: null as number | null,
};

const syncManagerDeadLetters = {
  count: 0,
  retry: vi.fn().mockResolvedValue({ answers: 0, reviews: 0, pearls: 0 }),
  discard: vi.fn().mockReturnValue({ answers: 0, reviews: 0, pearlActions: 0 }),
};

let onlineState = true;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

vi.mock('@/lib/services/offlineSyncService', () => ({
  getSyncStatus: () => ({ ...syncStatusState }),
  syncPendingOperations: (...args: unknown[]) => mockSyncPendingOperations(...args),
  setupAutoSync: () => () => {},
  isOnline: () => onlineState,
}));

vi.mock('@/lib/services/sync/offlineSync', () => ({
  getQueueStatus: () => ({ ...legacyQueueStatusState }),
  getDeadLetterQueue: () =>
    Array.from({ length: legacyDeadLetterCount }, (_, index) => ({
      id: `legacy-${index}`,
      operation: 'save_progress',
      data: {},
      timestamp: Date.now(),
      attempts: 5,
      status: 'failed',
    })),
  processQueue: (...args: unknown[]) => mockProcessLegacyQueue(...args),
  retryDeadLetterQueue: (...args: unknown[]) => mockRetryLegacyDeadLetters(...args),
  discardDeadLetterQueue: () => mockDiscardLegacyDeadLetters(),
}));

vi.mock('@/lib/services/sync/syncManager', () => ({
  useSyncManager: () => ({
    status: { ...syncManagerState },
    syncNow: (...args: unknown[]) => mockSyncNow(...args),
    deadLetteredCount: syncManagerDeadLetters.count,
    retryDeadLettered: (...args: unknown[]) => syncManagerDeadLetters.retry(...args),
    discardDeadLettered: () => syncManagerDeadLetters.discard(),
  }),
}));

describe('OfflineSyncIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('mock-token');
    syncStatusState.pendingCount = 0;
    syncStatusState.lastSyncTime = null;
    syncStatusState.isOffline = false;
    legacyQueueStatusState.total = 0;
    legacyQueueStatusState.pending = 0;
    legacyQueueStatusState.synced = 0;
    legacyQueueStatusState.failed = 0;
    legacyDeadLetterCount = 0;
    syncManagerState.pendingAnswers = 0;
    syncManagerState.pendingPearlActions = 0;
    syncManagerState.pendingReviews = 0;
    syncManagerState.deadLetteredAnswers = 0;
    syncManagerState.deadLetteredPearlActions = 0;
    syncManagerState.deadLetteredReviews = 0;
    syncManagerState.lastSyncError = null;
    syncManagerState.lastSyncTime = null;
    syncManagerDeadLetters.count = 0;
    onlineState = true;
  });

  it('shows offline indicator when offline with pending operations', () => {
    syncStatusState.pendingCount = 2;
    syncStatusState.isOffline = true;
    onlineState = false;

    render(<OfflineSyncIndicator />);

    // Badge label is visible immediately
    expect(screen.getByText(/Offline/i)).toBeTruthy();

    // Dropdown content is revealed after clicking the badge
    fireEvent.click(screen.getByRole('button', { name: /Sync status/i }));
    expect(screen.getByText(/Sync paused/i)).toBeTruthy();
    expect(screen.getByText(/saved locally/i)).toBeTruthy();
  });

  it('shows retry and triggers both sync services when online with pending operations', async () => {
    syncStatusState.pendingCount = 2;
    syncStatusState.isOffline = false;
    syncManagerState.pendingAnswers = 1;
    onlineState = true;

    render(<OfflineSyncIndicator />);

    const retryButton = await screen.findByRole('button', { name: /Retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockSyncPendingOperations).toHaveBeenCalledWith('mock-token');
      expect(mockProcessLegacyQueue).toHaveBeenCalledWith('mock-token');
      expect(mockSyncNow).toHaveBeenCalledWith('mock-token');
    });
  });

  it('surfaces and retries legacy dead-lettered progress writes', async () => {
    legacyDeadLetterCount = 1;
    mockRetryLegacyDeadLetters.mockResolvedValue(1);
    onlineState = true;

    render(<OfflineSyncIndicator />);

    expect(screen.getByText('1 stuck')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Sync status/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Retry$/i }));

    await waitFor(() => {
      expect(mockRetryLegacyDeadLetters).toHaveBeenCalledWith('mock-token');
    });
  });

  it('uses legacy dead-letter count in discard confirmation', () => {
    legacyDeadLetterCount = 2;
    mockDiscardLegacyDeadLetters.mockReturnValue(2);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OfflineSyncIndicator />);

    fireEvent.click(screen.getByRole('button', { name: /Sync status/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Discard$/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Discard 2 stuck items? This cannot be undone and they will not reach the server.'
    );
    expect(mockDiscardLegacyDeadLetters).toHaveBeenCalled();
  });
});
