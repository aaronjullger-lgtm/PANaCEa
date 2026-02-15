/**
 * Offline sync status indicator component
 * Shows sync status and pending operations count
 */

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, CloudOff, Cloud, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  getSyncStatus,
  syncPendingOperations,
  setupAutoSync,
  isOnline as checkOnline,
} from '@/lib/services/offlineSyncService';

interface SyncStatus {
  pendingCount: number;
  lastSyncTime: number | null;
  isOffline: boolean;
}

export function OfflineSyncIndicator() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({
    pendingCount: 0,
    lastSyncTime: null,
    isOffline: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(checkOnline());

  // Update status periodically
  useEffect(() => {
    const updateStatus = () => {
      const newStatus = getSyncStatus();
      const newIsOnline = checkOnline();

      // Only update state if values actually changed to prevent infinite loops
      setStatus((prev) => {
        if (
          prev.pendingCount !== newStatus.pendingCount ||
          prev.lastSyncTime !== newStatus.lastSyncTime ||
          prev.isOffline !== newStatus.isOffline
        ) {
          return newStatus;
        }
        return prev;
      });

      setIsOnline((prev) => (prev !== newIsOnline ? newIsOnline : prev));
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000); // Check every 5 seconds

    // Setup automatic sync with token from Clerk
    const cleanup = setupAutoSync(async () => {
      try {
        return await getToken();
      } catch (error) {
        console.error('[OfflineSyncIndicator] Failed to get token:', error);
        return null;
      }
    });

    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [getToken]);

  // Manual sync trigger
  const handleManualSync = async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    try {
      // Get fresh token from Clerk before syncing
      const token = await getToken();
      await syncPendingOperations(token || undefined);
      setStatus(getSyncStatus());
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Format last sync time
  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Don't show indicator if everything is synced and online
  if (!status.isOffline && status.pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border transition-all ${
        status.isOffline
          ? 'bg-[var(--color-data-provisional)]/90 border-[var(--color-data-provisional)]/70 text-[var(--color-text-inverse)]'
          : status.pendingCount > 0
            ? 'bg-[var(--color-accent)]/90 border-[var(--color-accent)]/70 text-[var(--color-text-inverse)]'
            : 'bg-[var(--color-data-pass)]/90 border-[var(--color-data-pass)]/70 text-[var(--color-text-inverse)]'
      }`}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0">
        {syncing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : status.isOffline ? (
          <CloudOff className="w-5 h-5" />
        ) : status.pendingCount > 0 ? (
          <Cloud className="w-5 h-5" />
        ) : (
          <Cloud className="w-5 h-5" />
        )}
      </div>

      {/* Status Text */}
      <div className="flex flex-col text-sm">
        <div className="font-medium">
          {syncing ? (
            'Syncing...'
          ) : status.isOffline ? (
            <>
              <WifiOff className="inline w-4 h-4 mr-1" />
              You're offline
            </>
          ) : status.pendingCount > 0 ? (
            `${status.pendingCount} pending`
          ) : (
            <>
              <Wifi className="inline w-4 h-4 mr-1" />
              Up to date
            </>
          )}
        </div>
        {!syncing && status.lastSyncTime && (
          <div className="text-xs opacity-80">
            {status.pendingCount > 0
              ? 'Will sync when ready'
              : `Synced ${formatLastSync(status.lastSyncTime)}`}
          </div>
        )}
      </div>

      {/* Manual Sync Button */}
      {!status.isOffline && status.pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="ml-2 px-3 py-1 text-xs font-medium rounded bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sync Now
        </button>
      )}

      {/* Info message when offline */}
      {status.isOffline && (
        <div className="ml-2 text-xs opacity-80 max-w-[220px]">
          Changes will sync when connection is restored.
        </div>
      )}
    </div>
  );
}
