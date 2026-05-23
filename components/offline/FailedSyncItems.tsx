/**
 * Failed Sync Items Component
 *
 * Displays dead-lettered sync items from the primary syncManager (Sprint 7).
 * Items here exhausted MAX_SYNC_ATTEMPTS (5) and need user-driven recovery:
 * retry or discard.
 *
 * Previously used a legacy dead-letter queue from offlineSync.ts (Phase 4)
 * which was never populated — rewired to syncManager's live dead-letter system.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Copy, Trash2, X, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSyncManager, type OfflineAnswer, type OfflineReview, type OfflinePearlAction } from '@/lib/services/sync/syncManager';
import { toast } from '@/lib/toast';

// ── Unified display item ────────────────────────────────────────────────────

type DeadLetterKind = 'answer' | 'review' | 'pearl';

interface DeadLetterDisplayItem {
  id: string;
  kind: DeadLetterKind;
  label: string;
  questionId?: string;
  pearlId?: string;
  syncAttempts: number;
  lastSyncError?: string;
  timestamp: number;
  raw: OfflineAnswer | OfflineReview | OfflinePearlAction;
}

function formatDeadLetterItems(
  answers: OfflineAnswer[],
  reviews: OfflineReview[],
  pearlActions: OfflinePearlAction[],
): DeadLetterDisplayItem[] {
  const items: DeadLetterDisplayItem[] = [];

  for (const a of answers) {
    items.push({
      id: a.id,
      kind: 'answer',
      label: `Answer — ${a.questionId}`,
      questionId: a.questionId,
      syncAttempts: a.syncAttempts,
      lastSyncError: a.lastSyncError,
      timestamp: a.timestamp,
      raw: a,
    });
  }

  for (const r of reviews) {
    items.push({
      id: r.id,
      kind: 'review',
      label: `Review — ${r.questionId}`,
      questionId: r.questionId,
      syncAttempts: r.syncAttempts,
      lastSyncError: r.lastSyncError,
      timestamp: r.timestamp,
      raw: r,
    });
  }

  for (const p of pearlActions) {
    items.push({
      id: p.id,
      kind: 'pearl',
      label: `Pearl ${p.action} — ${p.pearlId}`,
      pearlId: p.pearlId,
      syncAttempts: p.syncAttempts,
      lastSyncError: p.lastSyncError,
      timestamp: p.timestamp,
      raw: p,
    });
  }

  return items;
}

// ── Component ────────────────────────────────────────────────────────────────

interface FailedSyncItemsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FailedSyncItems: React.FC<FailedSyncItemsProps> = ({ isOpen, onClose }) => {
  const { getToken } = useAuth();
  const { getDeadLetteredItems, retryDeadLettered, discardDeadLettered } = useSyncManager(getToken);

  const [items, setItems] = useState<DeadLetterDisplayItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [recovering, setRecovering] = useState(false);

  // Refresh dead-lettered items whenever the panel opens
  const refresh = useCallback(() => {
    const dead = getDeadLetteredItems();
    setItems(formatDeadLetterItems(dead.answers, dead.reviews, dead.pearlActions));
  }, [getDeadLetteredItems]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyItem = (item: DeadLetterDisplayItem) => {
    const text = JSON.stringify(item.raw, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRetryAll = async () => {
    if (!navigator.onLine || recovering) return;
    setRecovering(true);
    try {
      const token = await getToken();
      const result = await retryDeadLettered(token ?? undefined);
      const total = result.answers + result.reviews + result.pearls;
      if (total > 0) {
        toast.success(`Retried ${total} stuck item${total === 1 ? '' : 's'}.`);
      }
      refresh();
    } catch {
      toast.warning('Sync retry paused. Your progress is saved locally.');
    } finally {
      setRecovering(false);
    }
  };

  const handleDiscardAll = () => {
    const counts = discardDeadLettered();
    const total = counts.answers + counts.reviews + counts.pearlActions;
    toast.success(`Discarded ${total} stuck item${total === 1 ? '' : 's'}.`);
    setShowConfirmClear(false);
    refresh();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          role="dialog"
          aria-modal="true"
          aria-label="Failed sync items"
          className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-2xl w-full max-h-[80vh] overflow-hidden border border-[var(--color-border)]"
        >
          {/* Header */}
          <div className="bg-[var(--color-data-fail)]/10 border-b border-[var(--color-data-fail)]/30 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-data-fail)] flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6" />
                  Failed Sync Items
                </h2>
                <p className="text-sm text-[var(--color-data-fail)]/90 mt-1">
                  {items.length} item{items.length !== 1 ? 's' : ''} failed to sync after 5 attempts
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-[var(--color-data-fail)] hover:text-[var(--color-data-fail)]/80 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
            {items.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                <p>No stuck sync items</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                            {item.kind}
                          </span>
                          <div className="font-semibold text-[var(--color-text-primary)] text-sm">
                            {item.kind === 'answer' && 'Answer'}
                            {item.kind === 'review' && 'Review'}
                            {item.kind === 'pearl' && `Pearl: ${(item.raw as OfflinePearlAction).action}`}
                          </div>
                        </div>
                        {item.questionId && (
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            Question: {item.questionId}
                          </div>
                        )}
                        {item.pearlId && (
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            Pearl: {item.pearlId}
                          </div>
                        )}
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {item.syncAttempts} attempt{item.syncAttempts === 1 ? '' : 's'}
                          {item.lastSyncError && ` — ${item.lastSyncError}`}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopyItem(item)}
                        className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors relative"
                        title="Copy data to clipboard"
                      >
                        {copiedId === item.id ? (
                          <CheckCircle className="w-4 h-4 text-[var(--color-data-pass)]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-[var(--color-text-primary)]/90 mt-2 p-2 bg-[var(--color-bg-primary)] rounded border border-[var(--color-border)] font-mono overflow-x-auto">
                      <pre>{JSON.stringify(item.raw, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)]">
              {showConfirmClear ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-[var(--color-data-fail)] font-medium">
                    Discard all {items.length} stuck item{items.length === 1 ? '' : 's'}? This cannot be undone and the data will not reach the server.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowConfirmClear(false)}
                      className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDiscardAll}
                      className="px-4 py-2 bg-[var(--color-data-fail)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-data-fail)]/90 transition-colors"
                    >
                      Yes, Discard All
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Retry when connected, or discard if not needed
                    </p>
                    <button
                      onClick={handleRetryAll}
                      disabled={!navigator.onLine || recovering}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 text-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3 h-3 ${recovering ? 'animate-spin' : ''}`} />
                      Retry All
                    </button>
                  </div>
                  <button
                    onClick={() => setShowConfirmClear(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-data-fail)]/10 hover:bg-[var(--color-data-fail)]/20 text-[var(--color-data-fail)] transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Discard All
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
