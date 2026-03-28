/**
 * RecentConditionsPanel - Displays recently viewed conditions
 *
 * Shows last 10 viewed conditions for quick access
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronRight, X, Trash2 } from 'lucide-react';

/**
 * Simple relative time formatter (avoids date-fns dependency)
 */
function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

interface RecentCondition {
  id: string;
  condition: string;
  system?: string;
  subcategory?: string;
  viewedAt: string;
}

interface RecentConditionsPanelProps {
  conditions: RecentCondition[];
  onConditionClick: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export const RecentConditionsPanel: React.FC<RecentConditionsPanelProps> = ({
  conditions,
  onConditionClick,
  onRemove,
  onClearAll,
}) => {
  if (conditions.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <Clock className="w-8 h-8 mx-auto text-[var(--color-text-muted)] opacity-50 mb-2" />
        <p className="text-xs text-[var(--color-text-muted)]">No recently viewed conditions</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Recent
        </span>
        <button
          onClick={onClearAll}
          className="text-xs text-[var(--color-text-muted)] hover:text-data-fail transition-colors flex items-center gap-1"
          title="Clear all recent"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Recent conditions list */}
      <AnimatePresence>
        {conditions.map((condition, index) => (
          <motion.div
            key={condition.id}
            initial={{ x: -10 }}
            animate={{ x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ delay: index * 0.05 }}
            className="group"
          >
            <button
              onClick={() => onConditionClick(condition.id)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-bg-secondary)]/80 transition-colors flex items-center gap-2"
            >
              <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-secondary)] truncate group-hover:text-[var(--color-text-primary)] transition-colors">
                  {condition.condition}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                  {condition.system && <span className="truncate">{condition.system}</span>}
                  {condition.system && condition.viewedAt && <span>•</span>}
                  <span>{formatRelativeTime(condition.viewedAt)}</span>
                </p>
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(condition.id);
                }}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 hover:bg-data-fail/20 rounded transition-all"
                title="Remove from recent"
                aria-label="Remove from recent"
              >
                <X className="w-3 h-3 text-[var(--color-text-muted)] hover:text-data-fail" aria-hidden="true" />
              </button>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default RecentConditionsPanel;
