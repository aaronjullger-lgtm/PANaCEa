/**
 * ConditionPreviewCard
 * 
 * A polished, high-density preview card for medical conditions.
 * Displays bite-sized snippets from classic_triad, clinical_pearls, buzzwords, etc.
 * Acts as a clickable teaser that navigates to the full condition page.
 * 
 * Features:
 * - Smart snippet extraction (auto-truncate, priority ordering)
 * - Markdown stripping for clean display
 * - System-based color accents
 * - Hover states with subtle lift effect
 * - Limited to 2-3 info pills to prevent clutter
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { extractSnippets, getSystemAccent } from '../../lib/utils/textFormatting';
import type { ConditionMeta } from '../../conditionRegistry';

interface ConditionPreviewCardProps {
  condition: ConditionMeta;
  content?: any; // MedicalContent from database
  onClick: (condition: ConditionMeta) => void;
  index?: number; // For staggered animations
}

export const ConditionPreviewCard: React.FC<ConditionPreviewCardProps> = ({
  condition,
  content,
  onClick,
  index = 0,
}) => {
  const snippets = extractSnippets(content, 3, 30);
  const accent = getSystemAccent(condition.system);

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ 
        y: -2,
        transition: { duration: 0.2 }
      }}
      onClick={() => onClick(condition)}
      className={`
        w-full text-left
        p-4 rounded-xl border-2
        ${accent.bg} ${accent.border} ${accent.hover}
        transition-all duration-200
        hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        group
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 line-clamp-2">
            {condition.condition}
          </h3>
          <p className={`text-xs font-medium ${accent.text}`}>
            {condition.subcategory}
          </p>
        </div>
        
        <ChevronRight 
          className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" 
        />
      </div>

      {/* Body - Info Pills */}
      {snippets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {snippets.map((snippet, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 + idx * 0.05 }}
              className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-1">
                {snippet}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State - Show when no snippets */}
      {snippets.length === 0 && (
        <div className="text-xs text-slate-500 dark:text-slate-400 italic">
          Click to view full details
        </div>
      )}
    </motion.button>
  );
};

export default ConditionPreviewCard;
