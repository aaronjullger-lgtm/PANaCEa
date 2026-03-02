/**
 * EnhancedConditionCard - Unified preview card for Clinical Reference Library
 *
 * REDESIGNED for homogeneous display:
 * - All cards show the SAME structure regardless of data availability
 * - Key Clinical Features section merges: classic_triad, buzzwords, clinical_pearls
 * - Always shows Dx/Rx badges when data exists
 * - Consistent card sizing and layout
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Pill, Lightbulb, Target } from 'lucide-react';
import { RetrievabilityBadge, YieldBadge } from '@/components/ui/badges';
import { MarkdownRenderer } from '@/components/ui/content-renderers/MarkdownRenderer';
import { parseTextField, parseListField } from '@/lib/utils/normalization';
import type { MedicalContentDisplay } from '@/types/medical-content';

interface EnhancedConditionCardProps {
  condition: Partial<MedicalContentDisplay>;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
  /** Optional badge (e.g. "85% match" for semantic search results) */
  badge?: string;
  /** Retrievability percentage (0‑100) computed from FSRS v6 stability and elapsed days */
  retrievability?: number | null;
}

/**
 * Extracts key clinical features from multiple sources in priority order
 * Returns a unified list of 3-4 items maximum for display
 */
function extractKeyFeatures(condition: Partial<MedicalContentDisplay>): string[] {
  const features: string[] = [];

  // Priority 1: Classic Triad (pathognomonic features)
  const classicTriad = parseListField(condition.classic_triad);
  if (classicTriad.length > 0) {
    features.push(...classicTriad.slice(0, 4));
    if (features.length >= 3) return features.slice(0, 4);
  }

  // Priority 2: Buzzwords (if short - true buzzwords)
  const buzzwords = parseListField(condition.buzzwords);
  const shortBuzzwords = buzzwords.filter((b) => b.length < 60 && !b.includes('.'));
  if (shortBuzzwords.length > 0) {
    features.push(...shortBuzzwords.slice(0, 4 - features.length));
    if (features.length >= 3) return features.slice(0, 4);
  }

  // Priority 3: Clinical Pearls (key sentences)
  const clinicalPearls = parseListField(condition.clinical_pearls);
  if (clinicalPearls.length > 0) {
    // Truncate long pearls
    const truncatedPearls = clinicalPearls
      .slice(0, 4 - features.length)
      .map((p) => (p.length > 80 ? p.slice(0, 77) + '...' : p));
    features.push(...truncatedPearls);
    if (features.length >= 3) return features.slice(0, 4);
  }

  // Priority 4: Long buzzwords (sentences that were stored as buzzwords)
  const longBuzzwords = buzzwords.filter((b) => b.length >= 60 || b.includes('.'));
  if (longBuzzwords.length > 0 && features.length < 3) {
    const truncated = longBuzzwords
      .slice(0, 4 - features.length)
      .map((b) => (b.length > 80 ? b.slice(0, 77) + '...' : b));
    features.push(...truncated);
  }

  // Priority 5: Extract from classic_patient if still need features
  if (features.length < 2) {
    const classicPatient = parseTextField(condition.classic_patient);
    if (classicPatient && classicPatient.length > 20) {
      // Take first 80 chars as a feature
      features.push(
        classicPatient.length > 80 ? classicPatient.slice(0, 77) + '...' : classicPatient
      );
    }
  }

  return features.slice(0, 4);
}

/**
 * EnhancedConditionCard - Uniform card with consistent sections
 */
export const EnhancedConditionCard: React.FC<EnhancedConditionCardProps> = ({
  condition,
  onClick,
  isSelected = false,
  className = '',
  badge,
  retrievability = null,
}) => {
  // Extract data
  const keyFeatures = useMemo(() => extractKeyFeatures(condition), [condition]);

  const goldStandard = useMemo(
    () => parseTextField(condition.gold_standard_dx),
    [condition.gold_standard_dx]
  );

  const firstLineRx = useMemo(
    () => parseTextField(condition.first_line_rx),
    [condition.first_line_rx]
  );

  const bestInitialTest = useMemo(
    () => parseTextField((condition as Record<string, unknown>).best_initial_test),
    [condition]
  );

  const hasQuickInfo = goldStandard || firstLineRx || bestInitialTest;
  const hasFeatures = keyFeatures.length > 0;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.015, y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        w-full text-left rounded-xl overflow-hidden
        bg-[var(--color-bg-secondary)]/40 backdrop-blur-sm
        border border-l-[3px] transition-all duration-200
        border-l-[var(--color-accent)]
        ${
          isSelected
            ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 shadow-lg shadow-[var(--color-accent)]/10'
            : 'border-[var(--color-border)]/50 hover:border-[var(--color-border)] hover:shadow-lg hover:shadow-black/10'
        }
        ${className}
      `}
    >
      {/* Unified Vertical Layout */}
      <div className="flex flex-col h-full min-h-[200px]">
        {/* HEADER: Condition Name + Yield Badge (+ optional badge) */}
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <h3 className="font-bold text-base text-[var(--color-text-primary)] leading-snug line-clamp-2 flex-1">
            {condition.condition || 'Untitled'}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {badge && (
              <span className="px-2 py-0.5 rounded-md bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-medium">
                {badge}
              </span>
            )}
            {retrievability !== null && retrievability !== undefined && (
              <RetrievabilityBadge retrievability={retrievability} size="sm" showIcon={true} />
            )}
            <YieldBadge yield={condition.pance_yield ?? null} size="sm" />
          </div>
        </div>

        {/* KEY CLINICAL FEATURES - Always same section header */}
        <div className="px-4 pb-3 flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              Key Clinical Features
            </span>
          </div>

          {hasFeatures ? (
            <div className="space-y-1.5">
              {keyFeatures.map((feature, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border)]/30 text-xs leading-relaxed"
                >
                  <MarkdownRenderer
                    content={feature}
                    className="text-xs [&_p]:mb-0 [&_p]:text-[var(--color-text-primary)]"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 rounded-lg bg-[var(--color-bg-secondary)]/40 border border-dashed border-[var(--color-border)]/30 text-center">
              <p className="text-xs text-[var(--color-text-muted)] italic">
                Click to view full details
              </p>
            </div>
          )}
        </div>

        {/* DIAGNOSTIC BADGES - Always shown if data exists */}
        {hasQuickInfo && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-2 border-t border-[var(--color-border)]/20 mt-auto">
            {goldStandard && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-data-provisional/10 border border-data-provisional/20 text-data-provisional text-[11px] font-medium">
                <Target className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[140px]">{goldStandard}</span>
              </span>
            )}
            {firstLineRx && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-data-pass/10 border border-data-pass/20 text-data-pass text-[11px] font-medium">
                <Pill className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[140px]">{firstLineRx}</span>
              </span>
            )}
            {bestInitialTest && !goldStandard && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-data-neutral/10 border border-data-neutral/20 text-data-neutral text-[11px] font-medium">
                <FlaskConical className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[140px]">{bestInitialTest}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
};

export default EnhancedConditionCard;
