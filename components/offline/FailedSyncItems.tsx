/**
 * Failed Sync Items Component
 * Displays items that failed to sync after multiple attempts (Dead Letter Queue)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Copy, Trash2, X, CheckCircle } from 'lucide-react';
import { getDeadLetterQueue, type SyncOperation } from '@/lib/services/sync/offlineSync';
import { StorageKeys } from '@/lib/storage/storageRegistry';

interface FailedSyncItemsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FailedSyncItems: React.FC<FailedSyncItemsProps> = ({ isOpen, onClose }) => {
  const [failedItems, setFailedItems] = useState<SyncOperation[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const items = getDeadLetterQueue();
      setFailedItems(items);
    }
  }, [isOpen]);

  const handleCopyItem = (item: SyncOperation) => {
    const text = JSON.stringify(item.data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = failedItems.filter((item) => item.id !== itemId);
    setFailedItems(updatedItems);
    localStorage.setItem(StorageKeys.DEAD_LETTER_QUEUE, JSON.stringify(updatedItems));
  };

  const handleClearAll = () => {
    setFailedItems([]);
    localStorage.removeItem(StorageKeys.DEAD_LETTER_QUEUE);
    setShowConfirmClear(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
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
                  {failedItems.length} item{failedItems.length !== 1 ? 's' : ''} failed to sync
                  after multiple attempts
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-[var(--color-data-fail)] hover:text-[var(--color-data-fail)]/80 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
            {failedItems.length === 0 ? (
              <div className="text-center py-8 text-action-muted">
                <p>No failed sync items</p>
              </div>
            ) : (
              <div className="space-y-4">
                {failedItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-[var(--color-text-primary)]">
                          {item.operation.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="text-xs text-action-muted">
                          Failed after {item.attempts} attempts
                        </div>
                        <div className="text-xs text-action-muted">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopyItem(item)}
                          className="p-2 text-action-muted hover:text-[var(--color-text-primary)] transition-colors relative"
                          title="Copy data to clipboard"
                        >
                          {copiedId === item.id ? (
                            <CheckCircle className="w-4 h-4 text-[var(--color-data-pass)]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-2 text-[var(--color-data-fail)] hover:text-[var(--color-data-fail)]/80 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-primary)]/90 mt-2 p-2 bg-[var(--color-bg-primary)] rounded border border-[var(--color-border)] font-mono overflow-x-auto">
                      <pre>{JSON.stringify(item.data, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {failedItems.length > 0 && (
            <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)]">
              {showConfirmClear ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-[var(--color-data-fail)] font-medium">
                    Are you sure you want to clear all failed items? This cannot be undone.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowConfirmClear(false)}
                      className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="px-4 py-2 bg-[var(--color-data-fail)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-data-fail)]/90 transition-colors"
                    >
                      Yes, Clear All
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-sm text-action-muted">
                    You can copy the data manually or clear these items
                  </p>
                  <button
                    onClick={() => setShowConfirmClear(true)}
                    className="px-4 py-2 bg-[var(--color-data-fail)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-data-fail)]/90 transition-colors"
                  >
                    Clear All
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
