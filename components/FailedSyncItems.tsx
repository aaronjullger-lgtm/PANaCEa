/**
 * Failed Sync Items Component
 * Displays items that failed to sync after multiple attempts (Dead Letter Queue)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Copy, Trash2, X } from 'lucide-react';
import { getDeadLetterQueue } from '../lib/services/sync/offlineSync';
import type { SyncOperation } from '../lib/services/sync/offlineSync';

interface FailedSyncItemsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FailedSyncItems: React.FC<FailedSyncItemsProps> = ({ isOpen, onClose }) => {
  const [failedItems, setFailedItems] = useState<SyncOperation[]>([]);

  useEffect(() => {
    if (isOpen) {
      const items = getDeadLetterQueue();
      setFailedItems(items);
    }
  }, [isOpen]);

  const handleCopyItem = (item: SyncOperation) => {
    const text = JSON.stringify(item.data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      alert('Item data copied to clipboard');
    });
  };

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = failedItems.filter(item => item.id !== itemId);
    setFailedItems(updatedItems);
    localStorage.setItem('panacea_dead_letter_queue', JSON.stringify(updatedItems));
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all failed items? This cannot be undone.')) {
      setFailedItems([]);
      localStorage.removeItem('panacea_dead_letter_queue');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6" />
                  Failed Sync Items
                </h2>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {failedItems.length} item{failedItems.length !== 1 ? 's' : ''} failed to sync after multiple attempts
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
            {failedItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No failed sync items</p>
              </div>
            ) : (
              <div className="space-y-4">
                {failedItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.operation.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Failed after {item.attempts} attempts
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopyItem(item)}
                          className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          title="Copy data to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 font-mono overflow-x-auto">
                      <pre>{JSON.stringify(item.data, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {failedItems.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  You can copy the data manually or clear these items
                </p>
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
