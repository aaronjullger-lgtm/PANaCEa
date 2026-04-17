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
import { springs, cardHoverVariants } from '@/config/appViews';
import { FlaskConical, Pill, Lightbulb, Target } from 'lucide-react';
import { RetrievabilityBadge, YieldBadge } from '@/components/ui/badges';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
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
      whileHover={cardHoverVariants.hover}
      whileTap={cardHoverVariants.tap}
      transition={springs.snappy}
      className={`
        group w-full text-left rounded-xl overflow-hidden
        bg-[var(--color-bg-primary)] transition-colors duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${isSelected ? '' : 'hover:bg-[var(--color-bg-tertiary)]/30'}
        ${className}
      `}
      style={{
        boxShadow: isSelected
          ? '0 0 0 2px var(--color-accent), 0 2px 8px -2px rgba(0,0,0,0.08)'
          : '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)',
      }}
    >
      {/* Vertical Layout */}
      <div className="flex flex-col h-full">
        {/* HEADER: Condition Name + Badges */}
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
          <h3 className="font-semibold text-sm text-[var(--color-text-primary)] leading-snug line-clamp-2 flex-1">
            {condition.condition || 'Untitled'}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {badge && (
              <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-[11px] font-medium">
                {badge}
              </span>
            )}
            {condition.evidenceGrade || condition.lastClinicalReviewAt ? (
              <ProvenanceBadge
                provenance={{
                  evidenceGrade: condition.evidenceGrade,
                  guidelineSource: condition.guidelineSource,
                  guidelineYear: condition.guidelineYear,
                  lastClinicalReviewAt: condition.lastClinicalReviewAt,
                  reviewedBy: condition.reviewedBy,
                }}
                size="sm"
              />
            ) : null}
            {retrievability !== null && retrievability !== undefined && (
              <RetrievabilityBadge retrievability={retrievability} size="sm" showIcon={true} />
            )}
            <YieldBadge yield={condition.pance_yield ?? null} size="sm" />
          </div>
        </div>

        {/* KEY CLINICAL FEATURES */}
        <div className="px-4 pb-3 flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="w-3 h-3 text-[var(--color-text-muted)]" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Key Features
            </span>
          </div>

          {hasFeatures ? (
            <div className="space-y-1">
              {keyFeatures.map((feature, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1.5 rounded-md bg-[var(--color-bg-tertiary)]/50 text-xs leading-relaxed"
                >
                  <MarkdownRenderer
                    content={feature}
                    className="text-xs [&_p]:mb-0 [&_p]:text-[var(--color-text-primary)]"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2.5 py-3 rounded-md bg-[var(--color-bg-tertiary)]/30 text-center">
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Click to view full details
              </p>
            </div>
          )}
        </div>

        {/* DIAGNOSTIC BADGES - Always shown if data exists */}
        {hasQuickInfo && (
          <div
            className="flex flex-wrap gap-1.5 px-4 pb-3.5 pt-2 mt-auto"
            style={{ boxShadow: 'inset 0 1px 0 0 var(--color-border)' }}
          >
            {goldStandard && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-[11px] font-medium">
                <Target className="w-3 h-3 flex-shrink-0 text-[var(--color-text-muted)]" />
                <span className="truncate max-w-[140px]">{goldStandard}</span>
              </span>
            )}
            {firstLineRx && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-[11px] font-medium">
                <Pill className="w-3 h-3 flex-shrink-0 text-[var(--color-text-muted)]" />
                <span className="truncate max-w-[140px]">{firstLineRx}</span>
              </span>
            )}
            {bestInitialTest && !goldStandard && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-[11px] font-medium">
                <FlaskConical className="w-3 h-3 flex-shrink-0 text-[var(--color-text-muted)]" />
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
