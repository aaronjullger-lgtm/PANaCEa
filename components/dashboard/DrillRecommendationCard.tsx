/**
 * DrillRecommendationCard — Personalized drill suggestions widget
 *
 * Displays 3-5 data-driven drill recommendations from the recommendation
 * engine. Each card shows the drill name, why it was recommended (grounded
 * in the student's data), and a visual impact indicator.
 *
 * Clicking a recommendation navigates to the drill with pre-filled focus
 * parameters (system, condition pair, etc.).
 *
 * @module components/dashboard/DrillRecommendationCard
 */

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { springs, listItemVariants, skeletonLineVariants } from '@/config/appViews';
import { ShimmerOverlay } from '@/components/loading';
import { useNavigate } from 'react-router-dom';
import { useDrillRecommendations } from '@/hooks/useDrillRecommendations';
import type { DrillRecommendation } from '@/hooks/useDrillRecommendations';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// ── Impact badge colors ──────────────────────────────────────────────────

const IMPACT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-[var(--color-data-fail)]/15', text: 'text-[var(--color-data-fail)]', label: 'High Impact' },
  medium: { bg: 'bg-[var(--color-data-provisional)]/15', text: 'text-[var(--color-data-provisional)]', label: 'Medium Impact' },
  low: { bg: 'bg-[var(--color-accent)]/15', text: 'text-[var(--color-accent)]', label: 'Low Impact' },
};

// ── Drill-type to route map ──────────────────────────────────────────────

const DRILL_ROUTES: Record<string, string> = {
  ddx_compare: '/drills/ddx',
  ddx_drill: '/drills/ddx',
  condition_drill: '/drills/condition',
  system_drill: '/drills/system',
  subcategory_drill: '/drills/subcategory',
  rapid_recall: '/drills/rapid-recall',
  pharmacology: '/drills/pharmacology',
  first_line_treatment: '/drills/first-line',
  antibiotic_mode: '/drills/antibiotics',
  ecg_drill: '/drills/ecg',
  imaging_drill: '/drills/imaging',
  mini_lab: '/drills/labs',
  fluid_electrolyte: '/drills/fluids',
  physiology_drill: '/drills/physiology',
  anatomy_review: '/drills/anatomy',
  history_drill: '/drills/history-pe',
  procedure_drill: '/drills/procedures',
  guideline_drill: '/drills/guidelines',
};

// ── Single recommendation row ────────────────────────────────────────────

const RecommendationRow: React.FC<{
  rec: DrillRecommendation;
  index: number;
  onStart: (rec: DrillRecommendation) => void;
}> = ({ rec, index, onStart }) => {
  const impact = IMPACT_STYLES[rec.impact] ?? IMPACT_STYLES['medium']!;

  return (
    <motion.button
      custom={index}
      variants={listItemVariants as unknown as Variants}
      initial="hidden"
      animate="visible"
      whileHover={{ x: 4, transition: springs.snappy }}
      whileTap={{ scale: 0.98, transition: { duration: 0.08 } }}
      onClick={() => onStart(rec)}
      aria-label={`${rec.label} — ${rec.reason}`}
      className="w-full text-left group rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors p-3.5"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-xs font-semibold flex items-center justify-center">
            {index + 1}
          </span>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {rec.label}
          </h4>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${impact.bg} ${impact.text}`}>
          {impact.label}
        </span>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed pl-7">
        {rec.reason}
      </p>

      {rec.focusSystem && (
        <div className="mt-2 pl-7">
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded">
            {rec.focusSystem}
          </span>
        </div>
      )}
    </motion.button>
  );
};

// ── Main card ────────────────────────────────────────────────────────────

interface Props {
  /** Data window in days (default 60) */
  days?: number;
}

export const DrillRecommendationCard: React.FC<Props> = ({ days = 60 }) => {
  const { recommendations, isLoading, error, data } = useDrillRecommendations(days);
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const handleStart = (rec: DrillRecommendation) => {
    const basePath = DRILL_ROUTES[rec.drillType] ?? '/drills';

    // Build query params for pre-filling drill focus
    const params = new URLSearchParams();
    if (rec.focusSystem) params.set('system', rec.focusSystem);
    if (rec.focusConditions?.length) {
      params.set('conditions', rec.focusConditions.join(','));
    }

    const query = params.toString();
    navigate(query ? `${basePath}?${query}` : basePath);
  };

  // Loading state — staggered skeleton with shimmer
  if (isLoading) {
    return (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Recommended Drills
        </h2>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={skeletonLineVariants}
              initial="hidden"
              animate="visible"
              className="relative h-20 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] overflow-hidden"
            >
              <ShimmerOverlay intensity="subtle" />
              <div className="p-3.5 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
                <div className="h-2.5 w-4/5 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          Recommended Drills
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Recommendations unavailable. Your progress is safe. Retry or start a default mixed block.
        </p>
      </section>
    );
  }

  // Insufficient data state
  if (!recommendations.length) {
    return (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          Recommended Drills
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {data?.profile.totalAttempts && data.profile.totalAttempts < 30
            ? `Complete a few more questions (${data.profile.totalAttempts}/30) to unlock personalized drill recommendations.`
            : 'No specific drill recommendations right now — keep up the great work!'}
        </p>
      </section>
    );
  }

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { y: 12, filter: 'blur(4px)' }}
      animate={{ y: 0, filter: 'blur(0px)' }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.snappy}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5"
    >
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Recommended Drills
        </h2>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          Based on {data?.profile.totalAttempts ?? 0} questions &middot; {data?.profile.days ?? days}d window
        </span>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec, i) => (
          <RecommendationRow
            key={`${rec.drillType}-${rec.focusSystem ?? i}`}
            rec={rec}
            index={i}
            onStart={handleStart}
          />
        ))}
      </div>
    </motion.section>
  );
};

export default DrillRecommendationCard;
