import React, { useState, useEffect } from 'react';
import { InlineSpinner } from '@/components/loading';
import { offlineSyncService } from '../../lib/services/offline/offlineSyncService';

export function OfflineSyncPanel() {
  const [queue, setQueue] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const updateQueue = () => {
      setQueue(offlineSyncService.getQueue());
    };

    updateQueue();
    const interval = setInterval(updateQueue, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleRetryAll = async () => {
    setIsProcessing(true);
    try {
      await offlineSyncService.processQueue();
    } finally {
      setIsProcessing(false);
      setQueue(offlineSyncService.getQueue());
    }
  };

  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 rounded-lg p-4 shadow-lg max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-muted-amber-600 dark:text-muted-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="font-semibold text-[var(--color-data-provisional)]">Sync paused</h3>
        </div>
        <span className="text-sm font-medium text-[var(--color-data-provisional)]">
          {queue.length} pending
        </span>
      </div>

      <p className="text-sm text-[var(--color-data-provisional)] mb-3">
        Your progress is saved locally. {queue.length} {queue.length === 1 ? 'item' : 'items'} will sync automatically when the connection returns.
      </p>

      <button
        onClick={handleRetryAll}
        disabled={isProcessing || !navigator.onLine}
        className="w-full bg-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]/90 disabled:bg-[var(--color-data-provisional)]/60 text-[var(--color-text-inverse)] font-medium py-2 px-4 rounded transition-colors disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <InlineSpinner size="sm" />
            Syncing progress...
          </span>
        ) : (
          <span>Retry sync</span>
        )}
      </button>

      {!navigator.onLine && (
        <p className="text-xs text-[var(--color-data-provisional)] mt-2 text-center">
          You're offline. We'll sync automatically when connected.
        </p>
      )}
    </div>
  );
}
