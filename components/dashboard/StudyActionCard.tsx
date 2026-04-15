/**
 * StudyActionCard - Priority action cards for PA student study dashboard
 *
 * Shows the student what to do RIGHT NOW with:
 * - Priority-based accent stripe (left)
 * - Icon + title + subtitle
 * - Optional count badge
 * - System breakdown inline ("8 CV · 4 PULM · 2 GI")
 * - Clickable with navigation
 * - Subtle Framer Motion animations respecting user preferences
 *
 * Part of a goal-oriented study dashboard that reduces decision fatigue
 * by presenting prioritized next actions.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { springs } from '@/config/appViews';
import { ChevronRight } from '@/components/ui/icons';
import { useReducedMotion, useAccessibleAnimation } from '@/hooks/useReducedMotion';

/**
 * Study action definition
 */
export interface StudyAction {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  subtitle: string;
  count?: number;
  systemBreakdown?: Record<string, number>; // e.g. { CV: 8, PULM: 4, GI: 2 }
  route: string;
  icon: React.ReactNode;
  accentColor: string; // CSS variable reference, e.g. "var(--color-accent)"
}

/**
 * Priority-to-accent-stripe color mapping
 */
function getPriorityStripeColor(priority: StudyAction['priority']): string {
  switch (priority) {
    case 'critical':
      return 'bg-[var(--color-data-fail)]'; // Red
    case 'high':
      return 'bg-[var(--color-data-provisional)]';
    case 'medium':
      return 'bg-[var(--color-accent)]';
    case 'low':
      return 'bg-[var(--color-data-pass)]';
    default:
      return 'bg-[var(--color-accent)]';
  }
}

/**
 * Priority ranking for sorting
 */
function getPriorityRank(priority: StudyAction['priority']): number {
  switch (priority) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
  }
}

/**
 * Individual study action card
 */
interface StudyActionCardProps {
  action: StudyAction;
}

export const StudyActionCard: React.FC<StudyActionCardProps> = ({ action }) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const animDuration = useAccessibleAnimation(0.3, 0.01);

  const handleClick = () => {
    navigate(action.route);
  };

  return (
    <motion.button
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      whileHover={prefersReducedMotion ? undefined : { y: -2, transition: springs.snappy }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98, transition: { duration: 0.08 } }}
      transition={prefersReducedMotion ? { duration: 0 } : { ...springs.snappy, opacity: { duration: animDuration }, filter: { duration: 0.25 } }}
      onClick={handleClick}
      className="group w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
    >
      <div
        className="relative flex items-center gap-3.5 rounded-xl bg-[var(--color-bg-secondary)] px-4 py-3.5 transition-colors duration-150 hover:bg-[var(--color-bg-tertiary)]/40"
        style={{
          boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)',
        }}
      >
        {/* Left accent stripe */}
        <div className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${getPriorityStripeColor(action.priority)}`} />

        {/* Icon container */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--color-bg-tertiary)] flex items-center justify-center">
          <div className="flex items-center justify-center w-5 h-5 text-[var(--color-text-secondary)]">
            {action.icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title + Count */}
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
              {action.title}
            </h3>
            {action.count !== undefined && (
              <span
                className="flex-shrink-0 px-2 py-px rounded-full text-[11px] font-medium tabular-nums"
                style={{
                  backgroundColor: `${action.accentColor}12`,
                  color: action.accentColor,
                }}
              >
                {action.count}
              </span>
            )}
          </div>

          {/* Subtitle */}
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {action.subtitle}
          </p>

          {/* System breakdown (if provided) */}
          {action.systemBreakdown && Object.keys(action.systemBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(action.systemBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([system, count], idx) => {
                  const entries = Object.entries(action.systemBreakdown!).sort(([, a], [, b]) => b - a);
                  const isLast = idx === entries.length - 1;
                  return (
                    <span key={system} className="text-[11px] text-[var(--color-text-muted)] font-medium">
                      {count} {system}
                      {!isLast && <span className="opacity-40"> ·</span>}
                    </span>
                  );
                })}
            </div>
          )}
        </div>

        {/* Right chevron — static, animates only on group hover */}
        <div className="flex-shrink-0 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
    </motion.button>
  );
};

/**
 * List of study action cards, auto-sorted by priority
 */
interface StudyActionListProps {
  actions: StudyAction[];
  className?: string;
}

export const StudyActionList: React.FC<StudyActionListProps> = ({ actions, className = '' }) => {
  // Sort actions by priority (highest first) and stable sort by ID
  const sortedActions = useMemo(() => {
    return [...actions].sort((a, b) => {
      const rankDiff = getPriorityRank(b.priority) - getPriorityRank(a.priority);
      if (rankDiff !== 0) return rankDiff;
      return a.id.localeCompare(b.id);
    });
  }, [actions]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {sortedActions.map((action) => (
        <StudyActionCard key={action.id} action={action} />
      ))}
    </div>
  );
};

export default StudyActionCard;
