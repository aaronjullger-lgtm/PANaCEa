/**
 * ConditionPreviewCard
 *
 * A polished, high-density preview card for medical conditions.
 * Intelligently renders content with proper formatting and visual hierarchy.
 *
 * Features:
 * - Intelligent content rendering (pills for short items, blocks for long)
 * - RichText rendering for markdown bold/italic
 * - System-based color accents
 * - Visual hierarchy with prominent title and category badge
 * - Hover effects with border color transition
 * - Automatic content type detection
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import { getSystemAccent } from '../../lib/utils/textFormatting';
import { RichText, stripMarkdown } from '../../src/components/ui/RichText';
import type { ConditionMeta } from '../../src/types/conditions';

/**
 * Content structure from MedicalContent database
 */
interface MedicalContentData {
  classic_triad?: string | string[];
  buzzwords?: string | string[];
  clinical_pearls?: string | string[];
  classic_patient?: string;
  gold_standard_dx?: string;
  first_line_rx?: string;
  best_initial_test?: string;
  [key: string]: string | string[] | undefined;
}

interface ConditionPreviewCardProps {
  condition: ConditionMeta;
  content?: MedicalContentData;
  onClick: (condition: ConditionMeta) => void;
  index?: number; // For staggered animations
}

interface ContentItem {
  text: string;
  type: 'pill' | 'block';
  source: string; // field name for debugging
}

/**
 * Intelligently extract and categorize content items
 * Short items (<30 chars) → pills, Long items → blocks
 */
function extractContentItems(
  content: MedicalContentData | undefined,
  maxItems: number = 5
): ContentItem[] {
  if (!content) return [];

  const items: ContentItem[] = [];

  // Priority order for fields
  const fieldConfigs = [
    { field: 'classic_triad', priority: 1 },
    { field: 'buzzwords', priority: 2 },
    { field: 'clinical_pearls', priority: 3 },
    { field: 'classic_patient', priority: 4 },
    { field: 'gold_standard_dx', priority: 5 },
    { field: 'first_line_rx', priority: 6 },
    { field: 'best_initial_test', priority: 7 },
  ];

  for (const { field } of fieldConfigs) {
    if (items.length >= maxItems) break;

    const value = content[field];
    if (!value) continue;

    // Handle arrays
    if (Array.isArray(value)) {
      for (const item of value) {
        if (items.length >= maxItems) break;

        const text = typeof item === 'string' ? item : String(item);
        const stripped = stripMarkdown(text);

        if (stripped.length === 0) continue;

        // Determine type: pill if short, block if long
        const type = stripped.length <= 30 ? 'pill' : 'block';

        items.push({ text, type, source: field });
      }
    }
    // Handle strings
    else if (typeof value === 'string' && value.length > 0) {
      const stripped = stripMarkdown(value);
      if (stripped.length === 0) continue;

      const type = stripped.length <= 30 ? 'pill' : 'block';
      items.push({ text: value, type, source: field });
    }
  }

  return items;
}

export const ConditionPreviewCard: React.FC<ConditionPreviewCardProps> = ({
  condition,
  content,
  onClick,
  index = 0,
}) => {
  // Memoize content extraction to avoid re-computation on every render
  const contentItems = useMemo(() => extractContentItems(content, 5), [content]);

  const accent = useMemo(() => getSystemAccent(condition.system), [condition.system]);

  // Memoize pills and blocks separation
  const { pills, blocks } = useMemo(
    () => ({
      pills: contentItems.filter((item) => item.type === 'pill'),
      blocks: contentItems.filter((item) => item.type === 'block'),
    }),
    [contentItems]
  );

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{
        y: -4,
        transition: { duration: 0.2 },
      }}
      onClick={() => onClick(condition)}
      className={`
        w-full text-left
        p-5 rounded-xl border-2
        ${accent.bg} ${accent.border}
        transition-all duration-200
        hover:shadow-lg hover:border-[var(--color-accent)]
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent)]
        group
      `}
    >
      {/* Header Section */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {/* Condition Name - Prominent */}
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1.5 leading-tight">
            {condition.condition}
          </h3>

          {/* Category Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`
                inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold
                ${accent.text} bg-[var(--color-bg-primary)]/80 border ${accent.border}
              `}
            >
              <Sparkles className="w-3 h-3" />
              {condition.subcategory}
            </span>

            {/* System badge if different from subcategory */}
            {condition.system && (
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                {condition.system}
              </span>
            )}
          </div>
        </div>

        {/* Arrow Icon */}
        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 mt-1 group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all duration-200" />
      </div>

      {/* Content Section */}
      <div className="space-y-3">
        {/* Pills - Short content items */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pills.map((item, idx) => (
              <motion.div
                key={`pill-${idx}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 + idx * 0.05 }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-sm"
              >
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  <RichText accentColor="blue">{item.text}</RichText>
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Blocks - Long content items */}
        {blocks.length > 0 && (
          <div className="space-y-2">
            {blocks.map((item, idx) => (
              <motion.div
                key={`block-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 + idx * 0.05 + 0.1 }}
                className="p-3 rounded-lg bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
              >
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  <RichText accentColor="blue">{item.text}</RichText>
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {contentItems.length === 0 && (
          <div className="text-sm text-[var(--color-text-muted)] italic flex items-center gap-2">
            <ChevronRight className="w-4 h-4" />
            Click to view full details
          </div>
        )}
      </div>
    </motion.button>
  );
};

export default ConditionPreviewCard;
