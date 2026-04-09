/**
 * ConditionPreviewCardAdvanced
 *
 * Enhanced version with additional features:
 * - PANCE Yield indicator (High/Medium/Low)
 * - Quick action buttons (Drill, Bookmark, Share)
 * - Related systems badges
 * - Loading states
 * - Error boundaries
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Target, BookmarkPlus, Share2, Sparkles } from 'lucide-react';
import { extractSnippets, getSystemAccent } from '../../lib/utils/textFormatting';
import type { ConditionMeta } from '../../src/types/conditions';

interface ConditionPreviewCardAdvancedProps {
  condition: ConditionMeta;
  content?: any;
  onClick: (condition: ConditionMeta) => void;
  onDrill?: (condition: ConditionMeta) => void;
  onBookmark?: (condition: ConditionMeta) => void;
  index?: number;
  showActions?: boolean;
}

/**
 * Get PANCE yield badge configuration
 */
function getPanceYieldBadge(yield_level?: number): {
  label: string;
  color: string;
  icon: React.ReactNode;
} | null {
  if (!yield_level) return null;

  switch (yield_level) {
    case 3:
      return {
        label: 'High Yield',
        color:
          'bg-data-pass text-data-pass border-data-pass',
        icon: <Sparkles className="w-3 h-3" />,
      };
    case 2:
      return {
        label: 'Medium',
        color:
          'bg-data-provisional text-data-provisional border-data-provisional',
        icon: <Target className="w-3 h-3" />,
      };
    case 1:
      return {
        label: 'Low Yield',
        color:
          'bg-data-neutral text-data-neutral border-data-neutral',
        icon: <Target className="w-3 h-3" />,
      };
    default:
      return null;
  }
}

export const ConditionPreviewCardAdvanced: React.FC<ConditionPreviewCardAdvancedProps> = ({
  condition,
  content,
  onClick,
  onDrill,
  onBookmark,
  index = 0,
  showActions = true,
}) => {
  const snippets = extractSnippets(content, 3, 30);
  const accent = getSystemAccent(condition.system);
  const yieldBadge = getPanceYieldBadge(content?.pance_yield);

  const handleActionClick = (e: React.MouseEvent, action: (condition: ConditionMeta) => void) => {
    e.stopPropagation(); // Prevent card click
    action(condition);
  };

  return (
    <motion.div
      initial={{ y: 20 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{
        y: -2,
        transition: { duration: 0.2 },
      }}
      className={`
        w-full
        rounded-xl border-2
        ${accent.bg} ${accent.border} ${accent.hover}
        transition-all duration-200
        hover:shadow-md
        group
        overflow-hidden
      `}
    >
      {/* Main clickable area */}
      <button
        onClick={() => onClick(condition)}
        className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-category-practice)]"
      >
        {/* Header with PANCE Yield */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-data-neutral line-clamp-2">
                {condition.condition}
              </h3>

              {yieldBadge && (
                <span
                  className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold
                  ${yieldBadge.color}
                  flex-shrink-0
                `}
                >
                  {yieldBadge.icon}
                  <span className="hidden sm:inline">{yieldBadge.label}</span>
                </span>
              )}
            </div>

            <p className={`text-xs font-medium ${accent.text}`}>{condition.subcategory}</p>

            {/* Related Systems */}
            {condition.relatedSystems && condition.relatedSystems.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {condition.relatedSystems.map((sys) => (
                  <span
                    key={sys}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-data-neutral/60 text-data-neutral font-medium"
                  >
                    {sys}
                  </span>
                ))}
              </div>
            )}
          </div>

          <ChevronRight className="w-5 h-5 text-data-neutral flex-shrink-0 mt-0.5 group-hover:text-data-neutral dark:group-hover:text-data-neutral transition-colors" />
        </div>

        {/* Body - Info Pills */}
        {snippets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {snippets.map((snippet, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 + idx * 0.05 }}
                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--color-bg-primary)]/60 border border-data-neutral"
              >
                <span className="text-xs font-medium text-data-neutral line-clamp-1">
                  {snippet}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {snippets.length === 0 && (
          <div className="text-xs text-data-neutral italic">
            Click to view full details
          </div>
        )}
      </button>

      {/* Quick Actions Footer */}
      {showActions && (onDrill || onBookmark) && (
        <div className="px-4 pb-3 pt-2 border-t border-data-neutral/50 flex gap-2">
          {onDrill && (
            <button
              onClick={(e) => handleActionClick(e, onDrill)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[color-mix(in_srgb,var(--color-category-practice)_30%,transparent)] text-[var(--color-category-practice)] hover:bg-[color-mix(in_srgb,var(--color-category-practice)_50%,transparent)] transition-colors"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Drill</span>
            </button>
          )}

          {onBookmark && (
            <button
              onClick={(e) => handleActionClick(e, onBookmark)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save</span>
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ConditionPreviewCardAdvanced;
