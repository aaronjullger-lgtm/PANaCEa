import React, { useState, useEffect } from 'react';
import { InlineSpinner } from '@/components/loading';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { offlineSyncService } from '../../lib/services/offline/offlineSyncService';

interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
  attempts: number;
  lastError?: string;
  deadLettered?: boolean;
}

export function OfflineSyncPanel() {
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  const [deadLetter, setDeadLetter] = useState<QueuedRequest[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setQueue(offlineSyncService.getQueue());
      setDeadLetter(offlineSyncService.getDeadLetter());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

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

  const totalItems = queue.length + deadLetter.length;

  if (totalItems === 0) {
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
          {queue.length} pending{deadLetter.length > 0 ? `, ${deadLetter.length} stuck` : ''}
        </span>
      </div>

      <p className="text-sm text-[var(--color-data-provisional)] mb-3">
        Your progress is saved locally. {queue.length > 0 && `${queue.length} ${queue.length === 1 ? 'item' : 'items'} will sync automatically when the connection returns.`}
        {deadLetter.length > 0 && ` ${deadLetter.length} ${deadLetter.length === 1 ? 'item has' : 'items have'} exhausted retries and need attention.`}
      </p>

      {/* Dead-lettered items */}
      {deadLetter.length > 0 && (
        <div className="mb-3 rounded-md border border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10 p-2.5">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--color-data-fail)]" />
            <p className="text-xs text-[var(--color-text-primary)]">
              {deadLetter.length} item{deadLetter.length === 1 ? '' : 's'} failed after 5 attempts. Discard if unneeded.
            </p>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {deadLetter.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span className="truncate max-w-[200px]" title={item.url}>
                  {item.url}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    offlineSyncService.removeDeadLetter(item.id);
                    setDeadLetter(offlineSyncService.getDeadLetter());
                  }}
                  className="p-1 hover:text-[var(--color-data-fail)] transition-colors"
                  aria-label="Discard stuck item"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              offlineSyncService.clearDeadLetter();
              setDeadLetter([]);
            }}
            className="mt-2 text-xs text-[var(--color-data-fail)] hover:underline"
          >
            Discard all stuck items
          </button>
        </div>
      )}

      {queue.length > 0 && (
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
      )}

      {!navigator.onLine && (
        <p className="text-xs text-[var(--color-data-provisional)] mt-2 text-center">
          You're offline. We'll sync automatically when connected.
        </p>
      )}
    </div>
  );
}
