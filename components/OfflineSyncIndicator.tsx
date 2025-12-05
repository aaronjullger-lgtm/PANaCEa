/**
 * Offline sync status indicator component
 * Shows sync status and pending operations count
 */

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, CloudOff, Cloud, Loader2 } from 'lucide-react';
import {
  getSyncStatus,
  syncPendingOperations,
  setupAutoSync,
  isOnline as checkOnline,
} from '../lib/services/offlineSyncService';

interface SyncStatus {
  pendingCount: number;
  lastSyncTime: number | null;
  isOffline: boolean;
}

export function OfflineSyncIndicator() {
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
      setStatus(getSyncStatus());
      setIsOnline(checkOnline());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000); // Check every 5 seconds

    // Setup automatic sync
    const cleanup = setupAutoSync();

    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, []);

  // Manual sync trigger
  const handleManualSync = async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    try {
      await syncPendingOperations();
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
          ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100'
          : status.pendingCount > 0
          ? 'bg-blue-900/90 border-blue-700 text-blue-100'
          : 'bg-green-900/90 border-green-700 text-green-100'
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
              Offline Mode
            </>
          ) : status.pendingCount > 0 ? (
            `${status.pendingCount} pending`
          ) : (
            <>
              <Wifi className="inline w-4 h-4 mr-1" />
              All synced
            </>
          )}
        </div>
        {!syncing && status.lastSyncTime && (
          <div className="text-xs opacity-80">
            Last sync: {formatLastSync(status.lastSyncTime)}
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
        <div className="ml-2 text-xs opacity-80 max-w-[200px]">
          Working offline. Changes will sync when connection is restored.
        </div>
      )}
    </div>
  );
}
