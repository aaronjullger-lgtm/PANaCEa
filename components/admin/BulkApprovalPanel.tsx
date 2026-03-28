/**
 * BulkApprovalPanel Component
 * Provides bulk actions (approve/reject/ignore) for selected mapping suggestions.
 * Integrates with POST /api/mapping-enrichment/bulk-approve endpoint.
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  EyeOff,
  Loader2,
  AlertTriangle,
  CheckSquare,
  Square,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { API_ENDPOINTS } from '@/lib/utils/apiConfig';

export interface BulkApprovalPanelProps {
  /** Array of selected suggestion IDs */
  selectedIds: string[];
  /** Total number of suggestions in current view (for "Select all filtered") */
  totalCount: number;
  /** Callback when selection is cleared */
  onClearSelection: () => void;
  /** Callback after a bulk action completes (should trigger data refresh) */
  onActionComplete: () => void;
  /** Optional loading state from parent */
  isLoading?: boolean;
  /** Whether to show "Select all filtered" option */
  enableSelectAllFiltered?: boolean;
  /** Count of filtered suggestions (if different from totalCount) */
  filteredCount?: number;
}

type BulkAction = 'APPROVE' | 'REJECT' | 'IGNORE';

const ACTION_CONFIG: Record<BulkAction, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  APPROVE: {
    label: 'Approve Selected',
    icon: CheckCircle2,
    color: 'text-data-pass',
    bgColor: 'bg-data-pass/20 hover:bg-data-pass/30',
  },
  REJECT: {
    label: 'Reject Selected',
    icon: XCircle,
    color: 'text-data-fail',
    bgColor: 'bg-data-fail/20 hover:bg-data-fail/30',
  },
  IGNORE: {
    label: 'Ignore Selected',
    icon: EyeOff,
    color: 'text-[var(--color-text-muted)]',
    bgColor: 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80',
  },
};

export function BulkApprovalPanel({
  selectedIds,
  totalCount,
  onClearSelection,
  onActionComplete,
  isLoading: externalLoading,
  enableSelectAllFiltered = true,
  filteredCount,
}: BulkApprovalPanelProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleBulkAction = async (action: BulkAction) => {
    if (selectedIds.length === 0) {
      setError('No suggestions selected');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.MAPPING_ENRICHMENT_BULK_APPROVE), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionIds: selectedIds,
          action,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bulk action failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      setSuccess(`${selectedIds.length} suggestions ${action.toLowerCase()}d successfully`);
      onActionComplete();
      // Clear selection after successful action
      onClearSelection();
    } catch (err) {
      console.error('Bulk action error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAllFiltered = () => {
    // This is a placeholder - actual implementation depends on parent component
    // Typically parent would have a function to select all filtered items
    // We'll emit an event or call a prop if provided.
    // For now, we'll just show a message.
    toast.info('Select all filtered is not yet available.');
  };

  const isLoading = externalLoading || loading;

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Selection summary */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Bulk Actions</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {selectedIds.length} suggestion{selectedIds.length !== 1 ? 's' : ''} selected
                {enableSelectAllFiltered && filteredCount && filteredCount > selectedIds.length && (
                  <span className="ml-2">
                    (<button
                      className="text-[var(--color-accent)] hover:underline"
                      onClick={handleSelectAllFiltered}
                      disabled={isLoading}
                    >
                      Select all {filteredCount} filtered
                    </button>)
                  </span>
                )}
              </p>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={onClearSelection}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              disabled={isLoading}
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {(Object.entries(ACTION_CONFIG) as [BulkAction, typeof ACTION_CONFIG[BulkAction]][]).map(([action, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={action}
                onClick={() => handleBulkAction(action)}
                disabled={selectedIds.length === 0 || isLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${config.bgColor} ${config.color} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                {config.label}
              </button>
            );
          })}

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Advanced
          </button>
        </div>
      </div>

      {/* Advanced options */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-4 pt-4 border-t border-[var(--color-border)]"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-data-provisional" />
                  <h4 className="font-medium text-[var(--color-text-primary)]">High-confidence approve</h4>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  Automatically approve suggestions with confidence {'>'} 85%
                </p>
                <button
                  className="w-full px-3 py-2 bg-data-provisional/20 text-data-provisional rounded-lg hover:bg-data-provisional/30 transition-colors text-sm font-medium"
                  disabled={isLoading}
                  onClick={() => toast.info('High-confidence approve is coming soon.')}
                >
                  Run auto-approval
                </button>
              </div>
              <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-data-fail" />
                  <h4 className="font-medium text-[var(--color-text-primary)]">Batch reject low confidence</h4>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  Reject suggestions with confidence {'<'} 30% and send for manual review
                </p>
                <button
                  className="w-full px-3 py-2 bg-data-fail/20 text-data-fail rounded-lg hover:bg-data-fail/30 transition-colors text-sm font-medium"
                  disabled={isLoading}
                  onClick={() => toast.info('Batch reject is coming soon.')}
                >
                  Reject low confidence
                </button>
              </div>
              <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <EyeOff className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <h4 className="font-medium text-[var(--color-text-primary)]">Ignore duplicates</h4>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  Ignore suggestions where taxonomy already has a mapping
                </p>
                <button
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/80 transition-colors text-sm font-medium"
                  disabled={isLoading}
                  onClick={() => toast.info('Ignore duplicates is coming soon.')}
                >
                  Ignore duplicates
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status messages */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4"
          >
            {error && (
              <div className="p-3 bg-data-fail/10 border border-data-fail/30 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-data-fail" />
                <div className="flex-1">
                  <p className="font-medium text-data-fail">Bulk action failed</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                  ✕
                </button>
              </div>
            )}
            {success && (
              <div className="p-3 bg-data-pass/10 border border-data-pass/30 rounded-lg flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-data-pass" />
                <div className="flex-1">
                  <p className="font-medium text-data-pass">Success</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{success}</p>
                </div>
                <button onClick={() => setSuccess(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                  ✕
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}