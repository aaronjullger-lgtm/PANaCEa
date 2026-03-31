/**
 * Offline sync status indicator component
 * Shows sync status and pending operations count.
 * Combines:
 * - offlineSyncService (general API queue)
 * - syncManager (answers, pearl actions, reviews)
 *
 * Renders a compact badge in the nav bar when offline or pending.
 * On click, opens a dropdown with full detail.
 */

import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, CloudOff, Cloud, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/lib/toast';
import {
  getSyncStatus,
  syncPendingOperations,
  setupAutoSync,
  isOnline as checkOnline,
} from '@/lib/services/offlineSyncService';
import { useSyncManager } from '@/lib/services/sync/syncManager';

interface SyncStatus {
  pendingCount: number;
  lastSyncTime: number | null;
  isOffline: boolean;
}

export function OfflineSyncIndicator() {
  const { getToken } = useAuth();
  const { status: syncManagerStatus, syncNow } = useSyncManager(getToken);
  // Lazy initializer reads current sync state immediately, avoiding a flash of "nothing to show"
  // on the first render when offline or with pending items.
  const [offlineStatus, setOfflineStatus] = useState<SyncStatus>(() => getSyncStatus());
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(checkOnline());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Combined pending from both systems
  const managerPending =
    syncManagerStatus.pendingAnswers +
    syncManagerStatus.pendingPearlActions +
    syncManagerStatus.pendingReviews;
  const totalPending = offlineStatus.pendingCount + managerPending;
  const hasSyncError = !!syncManagerStatus.lastSyncError;

  // Update offline status periodically
  useEffect(() => {
    const updateStatus = () => {
      const newStatus = getSyncStatus();
      const newIsOnline = checkOnline();

      setOfflineStatus((prev) => {
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
    const interval = setInterval(updateStatus, 5000);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Manual sync trigger – syncs both systems
  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOnline || syncing) return;

    setSyncing(true);
    try {
      const token = await getToken();
      await syncPendingOperations(token || undefined);
      await syncNow(token ?? undefined);
      setOfflineStatus(getSyncStatus());
    } catch (error) {
      console.error('Manual sync failed:', error);
      toast.error('Sync failed. Check your connection and try again.');
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
  if (!offlineStatus.isOffline && totalPending === 0 && !hasSyncError) {
    return null;
  }

  const lastSync = syncManagerStatus.lastSyncTime ?? offlineStatus.lastSyncTime;

  // Determine badge style
  const isOfflineState = offlineStatus.isOffline;
  const badgeColorClass = isOfflineState
    ? 'bg-[var(--color-data-provisional)]/15 border-[var(--color-data-provisional)]/30 text-[var(--color-data-provisional)]'
    : hasSyncError
      ? 'bg-[var(--color-data-fail)]/15 border-[var(--color-data-fail)]/30 text-[var(--color-data-fail)]'
      : 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/30 text-[var(--color-accent)]';

  const badgeIcon = syncing ? (
    <Loader2 className="w-3.5 h-3.5 animate-spin" />
  ) : isOfflineState ? (
    <CloudOff className="w-3.5 h-3.5" />
  ) : hasSyncError ? (
    <AlertCircle className="w-3.5 h-3.5" />
  ) : (
    <Cloud className="w-3.5 h-3.5" />
  );

  const badgeLabel = syncing
    ? 'Syncing…'
    : isOfflineState
      ? 'Offline'
      : hasSyncError
        ? 'Sync error'
        : `${totalPending} pending`;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Compact badge */}
      <button
        type="button"
        onClick={() => setDropdownOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium transition-colors ${badgeColorClass}`}
        aria-label="Sync status"
        aria-expanded={dropdownOpen}
      >
        {badgeIcon}
        <span>{badgeLabel}</span>
        {(totalPending > 0 || hasSyncError) && !isOfflineState && !syncing && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Retry sync"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </button>

      {/* Dropdown detail panel */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg shadow-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 text-sm">
          <div className="flex items-center gap-2 mb-2">
            {isOfflineState ? (
              <>
                <WifiOff className="w-4 h-4 text-[var(--color-data-provisional)]" />
                <span className="font-medium text-[var(--color-text-primary)]">You're offline</span>
              </>
            ) : hasSyncError ? (
              <>
                <AlertCircle className="w-4 h-4 text-[var(--color-data-fail)]" />
                <span className="font-medium text-[var(--color-text-primary)]">Sync failed</span>
              </>
            ) : syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                <span className="font-medium text-[var(--color-text-primary)]">Syncing…</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 text-[var(--color-accent)]" />
                <span className="font-medium text-[var(--color-text-primary)]">
                  {totalPending} pending
                  {managerPending > 0 && ` (${syncManagerStatus.pendingReviews} reviews)`}
                </span>
              </>
            )}
          </div>

          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            {isOfflineState
              ? 'Changes will sync when connection is restored.'
              : hasSyncError
                ? (syncManagerStatus.lastSyncError ?? 'An error occurred during sync.')
                : 'Will sync when ready.'}
          </p>

          <div className="flex items-center justify-between">
            {lastSync && (
              <span className="text-xs text-[var(--color-text-muted)]">
                Last synced: {formatLastSync(lastSync)}
              </span>
            )}
            {(totalPending > 0 || hasSyncError) && !isOfflineState && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 text-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
