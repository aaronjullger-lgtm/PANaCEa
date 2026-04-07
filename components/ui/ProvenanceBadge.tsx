/**
 * ProvenanceBadge — Phase 1.4: Content Provenance Indicator
 *
 * Displays a color-coded badge on condition cards indicating evidence quality:
 *   - Green:  Grade A, reviewed within 2 years
 *   - Yellow: Grade B or reviewed >2 years ago
 *   - Gray:   No provenance data
 *
 * Tooltip shows full provenance details on hover/focus.
 */

import React, { useState, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

export interface ProvenanceData {
  evidenceGrade?: string | null;
  guidelineSource?: string | null;
  guidelineYear?: number | null;
  lastClinicalReviewAt?: string | Date | null;
  reviewedBy?: string | null;
}

type ProvenanceTier = 'strong' | 'moderate' | 'unknown';

function classifyProvenance(data: ProvenanceData): ProvenanceTier {
  const { evidenceGrade, lastClinicalReviewAt } = data;

  if (!evidenceGrade && !lastClinicalReviewAt) return 'unknown';

  const isGradeA = evidenceGrade?.toUpperCase() === 'A';
  const reviewDate = lastClinicalReviewAt ? new Date(lastClinicalReviewAt) : null;
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const isRecent = reviewDate ? reviewDate >= twoYearsAgo : false;

  if (isGradeA && isRecent) return 'strong';
  if (evidenceGrade || lastClinicalReviewAt) return 'moderate';
  return 'unknown';
}

function formatReviewDate(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

const TIER_CONFIG = {
  strong: {
    Icon: ShieldCheck,
    bgClass: 'bg-emerald-500/15 border-emerald-500/25',
    textClass: 'text-emerald-400',
    label: 'Strong evidence',
  },
  moderate: {
    Icon: ShieldAlert,
    bgClass: 'bg-amber-500/15 border-amber-500/25',
    textClass: 'text-amber-400',
    label: 'Moderate evidence',
  },
  unknown: {
    Icon: ShieldQuestion,
    bgClass: 'bg-zinc-500/15 border-zinc-500/25',
    textClass: 'text-zinc-400',
    label: 'No provenance',
  },
} as const;

interface ProvenanceBadgeProps {
  provenance: ProvenanceData;
  size?: 'sm' | 'md';
  /** Show only the icon (no text label) */
  iconOnly?: boolean;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  provenance,
  size = 'sm',
  iconOnly = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tier = classifyProvenance(provenance);
  const { Icon, bgClass, textClass, label } = TIER_CONFIG[tier];

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  const handleEnter = useCallback(() => setShowTooltip(true), []);
  const handleLeave = useCallback(() => setShowTooltip(false), []);

  // Build tooltip text
  const tooltipLines: string[] = [];
  if (provenance.guidelineSource) {
    tooltipLines.push(`Source: ${provenance.guidelineSource}${provenance.guidelineYear ? ` ${provenance.guidelineYear}` : ''}`);
  }
  if (provenance.evidenceGrade) {
    tooltipLines.push(`Grade: ${provenance.evidenceGrade.toUpperCase()}`);
  }
  const reviewDateStr = formatReviewDate(provenance.lastClinicalReviewAt);
  if (reviewDateStr) {
    tooltipLines.push(`Last reviewed: ${reviewDateStr}`);
  }
  if (provenance.reviewedBy) {
    tooltipLines.push(`Reviewed by: ${provenance.reviewedBy}`);
  }
  if (tooltipLines.length === 0) {
    tooltipLines.push('No provenance data available');
  }

  return (
    <span
      className={`relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${bgClass} ${textClass} cursor-help`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      tabIndex={0}
      role="img"
      aria-label={`${label}: ${tooltipLines.join('. ')}`}
    >
      <Icon className={`${iconSize} flex-shrink-0`} />
      {!iconOnly && (
        <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <span
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[240px]
            px-3 py-2 rounded-lg text-xs leading-relaxed
            bg-[var(--color-bg-primary)] border border-[var(--color-border)]
            shadow-lg shadow-black/20 pointer-events-none"
          role="tooltip"
        >
          {tooltipLines.map((line, i) => (
            <span key={i} className="block text-[var(--color-text-secondary)]">
              {line}
            </span>
          ))}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
              border-4 border-transparent border-t-[var(--color-border)]"
          />
        </span>
      )}
    </span>
  );
};

export default ProvenanceBadge;
