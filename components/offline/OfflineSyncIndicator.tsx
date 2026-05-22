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
import { WifiOff, CloudOff, Cloud, AlertCircle, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
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
  const {
    status: syncManagerStatus,
    syncNow,
    deadLetteredCount,
    retryDeadLettered,
    discardDeadLettered,
  } = useSyncManager(getToken);
  // Lazy initializer reads current sync state immediately, avoiding a flash of "nothing to show"
  // on the first render when offline or with pending items.
  const [offlineStatus, setOfflineStatus] = useState<SyncStatus>(() => getSyncStatus());
  const [syncing, setSyncing] = useState(false);
  const [recovering, setRecovering] = useState(false);
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
  const hasDeadLettered = deadLetteredCount > 0;

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
      toast.error('Sync paused. Your progress is saved locally.');
    } finally {
      setSyncing(false);
    }
  };

  // Sprint S1: retry dead-lettered items (resets attempts + re-runs sync)
  const handleRetryDeadLettered = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOnline || recovering) return;

    setRecovering(true);
    try {
      const token = await getToken();
      const result = await retryDeadLettered(token ?? undefined);
      const total = result.answers + result.reviews + result.pearls;
      if (total > 0) {
        toast.success(`Recovered ${total} stuck item${total === 1 ? '' : 's'}.`);
      }
    } catch (error) {
      console.error('Dead-letter retry failed:', error);
      toast.warning('Sync retry paused. Your progress is saved locally.');
    } finally {
      setRecovering(false);
    }
  };

  // Sprint S1: permanently discard dead-lettered items (after explicit user confirmation)
  const handleDiscardDeadLettered = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recovering) return;

    const message =
      deadLetteredCount === 1
        ? 'Discard 1 stuck item? This cannot be undone and it will not reach the server.'
        : `Discard ${deadLetteredCount} stuck items? This cannot be undone and they will not reach the server.`;

    if (!window.confirm(message)) return;

    try {
      const counts = discardDeadLettered();
      const total = counts.answers + counts.reviews + counts.pearlActions;
      toast.success(`Discarded ${total} stuck item${total === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('Dead-letter discard failed:', error);
      toast.error('Discard unavailable. Try again when you are ready.');
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

  // Don't show indicator if everything is synced and online with no stuck items
  if (!offlineStatus.isOffline && totalPending === 0 && !hasSyncError && !hasDeadLettered) {
    return null;
  }

  const lastSync = syncManagerStatus.lastSyncTime ?? offlineStatus.lastSyncTime;

  // Determine badge style — dead-letter takes precedence over offline/error because
  // it represents stuck data that needs user-driven recovery.
  const isOfflineState = offlineStatus.isOffline;
  const badgeColorClass = hasDeadLettered
    ? 'bg-[var(--color-data-fail)]/15 border-[var(--color-data-fail)]/30 text-[var(--color-data-fail)]'
    : isOfflineState
      ? 'bg-[var(--color-data-provisional)]/15 border-[var(--color-data-provisional)]/30 text-[var(--color-data-provisional)]'
      : hasSyncError
        ? 'bg-[var(--color-data-fail)]/15 border-[var(--color-data-fail)]/30 text-[var(--color-data-fail)]'
        : 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/30 text-[var(--color-accent)]';

  const badgeIcon = syncing || recovering ? (
    <InlineSpinner size="sm" />
  ) : hasDeadLettered ? (
    <AlertTriangle className="w-3.5 h-3.5" />
  ) : isOfflineState ? (
    <CloudOff className="w-3.5 h-3.5" />
  ) : hasSyncError ? (
    <AlertCircle className="w-3.5 h-3.5" />
  ) : (
    <Cloud className="w-3.5 h-3.5" />
  );

  const badgeLabel = syncing
    ? 'Syncing…'
    : recovering
      ? 'Recovering…'
      : hasDeadLettered
        ? `${deadLetteredCount} stuck`
        : isOfflineState
          ? 'Offline'
          : hasSyncError
            ? 'Sync paused'
            : `${totalPending} pending`;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Compact badge — retry button is a sibling, not nested inside */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium transition-colors ${badgeColorClass}`}
          aria-label="Sync status"
          aria-expanded={dropdownOpen}
        >
          {badgeIcon}
          <span>{badgeLabel}</span>
        </button>
        {(totalPending > 0 || hasSyncError) && !isOfflineState && !syncing && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            className="rounded-full p-0.5 hover:bg-[var(--color-bg-tertiary)]/50 dark:hover:bg-[var(--color-bg-primary)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Retry sync"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown detail panel */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg shadow-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 text-sm">
          <div className="flex items-center gap-2 mb-2">
            {isOfflineState ? (
              <>
                <WifiOff className="w-4 h-4 text-[var(--color-data-provisional)]" />
                <span className="font-medium text-[var(--color-text-primary)]">Sync paused</span>
              </>
            ) : hasSyncError ? (
              <>
                <AlertCircle className="w-4 h-4 text-[var(--color-data-fail)]" />
                <span className="font-medium text-[var(--color-text-primary)]">Sync paused</span>
              </>
            ) : syncing ? (
              <>
                <InlineSpinner size="sm" className="text-[var(--color-accent)]" />
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
              ? "Your progress is saved locally. We'll sync automatically when the connection returns."
              : hasSyncError
                ? "Your progress is saved locally. We'll retry automatically, or you can retry now."
                : 'Your progress will sync when ready.'}
          </p>

          {/* Sprint S1: dead-letter recovery panel — shows when items exhausted retries */}
          {hasDeadLettered && (
            <div
              role="alert"
              className="mb-3 rounded-md border border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10 p-2.5"
            >
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--color-data-fail)]" />
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {deadLetteredCount} item{deadLetteredCount === 1 ? '' : 's'} need attention
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Retry when connected, or discard only if you do not need these saved.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetryDeadLettered}
                  disabled={!isOnline || recovering}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 text-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3 h-3 ${recovering ? 'animate-spin' : ''}`} />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDeadLettered}
                  disabled={recovering}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-data-fail)]/10 hover:bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3 h-3" />
                  Discard
                </button>
              </div>
            </div>
          )}

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
