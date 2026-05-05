import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineSyncIndicator } from '@/components/offline/OfflineSyncIndicator';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
const mockSyncPendingOperations = vi.fn().mockResolvedValue(undefined);
const mockSyncNow = vi.fn().mockResolvedValue(undefined);

const syncStatusState = {
  pendingCount: 0,
  lastSyncTime: null as number | null,
  isOffline: false,
};

const syncManagerState = {
  pendingAnswers: 0,
  pendingPearlActions: 0,
  pendingReviews: 0,
  lastSyncError: null as string | null,
  lastSyncTime: null as number | null,
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

vi.mock('@/lib/services/sync/syncManager', () => ({
  useSyncManager: () => ({
    status: { ...syncManagerState },
    syncNow: (...args: unknown[]) => mockSyncNow(...args),
  }),
}));

describe('OfflineSyncIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('mock-token');
    syncStatusState.pendingCount = 0;
    syncStatusState.lastSyncTime = null;
    syncStatusState.isOffline = false;
    syncManagerState.pendingAnswers = 0;
    syncManagerState.pendingPearlActions = 0;
    syncManagerState.pendingReviews = 0;
    syncManagerState.lastSyncError = null;
    syncManagerState.lastSyncTime = null;
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
      expect(mockSyncNow).toHaveBeenCalledWith('mock-token');
    });
  });
});
