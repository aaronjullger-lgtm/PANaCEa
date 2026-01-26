import React, { useState, useEffect } from 'react';
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
    <div className="fixed bottom-4 right-4 bg-muted-amber-50 dark:bg-muted-amber-900/20 border border-muted-amber-300 dark:border-muted-amber-700 rounded-lg p-4 shadow-lg max-w-sm">
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
          <h3 className="font-semibold text-muted-amber-900 dark:text-muted-amber-100">Offline Requests</h3>
        </div>
        <span className="text-sm font-medium text-muted-amber-700 dark:text-muted-amber-300">
          {queue.length} pending
        </span>
      </div>

      <p className="text-sm text-muted-amber-800 dark:text-muted-amber-200 mb-3">
        {queue.length} {queue.length === 1 ? 'request' : 'requests'} will be synced when you're back
        online.
      </p>

      <button
        onClick={handleRetryAll}
        disabled={isProcessing || !navigator.onLine}
        className="w-full bg-muted-amber-600 hover:bg-muted-amber-700 disabled:bg-muted-amber-400 dark:bg-muted-amber-700 dark:hover:bg-muted-amber-600 text-white font-medium py-2 px-4 rounded transition-colors disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Syncing...
          </span>
        ) : (
          <span>Retry All Now</span>
        )}
      </button>

      {!navigator.onLine && (
        <p className="text-xs text-muted-amber-700 dark:text-muted-amber-300 mt-2 text-center">
          You're offline. Requests will auto-sync when connected.
        </p>
      )}
    </div>
  );
}
