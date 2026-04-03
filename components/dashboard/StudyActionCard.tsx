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
import { ChevronRight } from 'lucide-react';
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
      return 'bg-amber-500'; // Amber
    case 'medium':
      return 'bg-blue-500'; // Blue
    case 'low':
      return 'bg-green-500'; // Green
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: animDuration }}
      whileHover={prefersReducedMotion ? {} : { translateY: -2 }}
      whileTap={prefersReducedMotion ? {} : { translateY: 0 }}
      onClick={handleClick}
      className="w-full text-left transition-shadow hover:shadow-md rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
    >
      <div
        className={`
          relative flex items-center gap-4 rounded-xl
          bg-[var(--color-bg-secondary)]
          px-5 py-4 shadow-sm
          border border-transparent hover:border-[var(--color-accent)]/20
          transition-colors
        `}
      >
        {/* Left accent stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${getPriorityStripeColor(action.priority)}`} />

        {/* Icon container */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: `${action.accentColor}15`,
          }}
        >
          <div style={{ color: action.accentColor }} className="flex items-center justify-center w-6 h-6">
            {action.icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title + Count */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-base text-[var(--color-text-primary)] truncate">
              {action.title}
            </h3>
            {action.count !== undefined && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: animDuration, delay: animDuration * 0.5 }}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums"
                style={{
                  backgroundColor: `${action.accentColor}25`,
                  color: action.accentColor,
                }}
              >
                {action.count}
              </motion.div>
            )}
          </div>

          {/* Subtitle */}
          <p className="text-sm text-[var(--color-text-secondary)] mb-2 truncate">
            {action.subtitle}
          </p>

          {/* System breakdown (if provided) */}
          {action.systemBreakdown && Object.keys(action.systemBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(action.systemBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([system, count], idx) => {
                  const entries = Object.entries(action.systemBreakdown!).sort(([, a], [, b]) => b - a);
                  const isLast = idx === entries.length - 1;
                  return (
                    <span key={system} className="text-xs text-[var(--color-text-muted)] font-medium">
                      {count} {system}
                      {!isLast && <span className="text-[var(--color-text-muted)]/60"> ·</span>}
                    </span>
                  );
                })}
            </div>
          )}
        </div>

        {/* Right chevron with animation */}
        <motion.div
          className="flex-shrink-0 text-[var(--color-text-muted)]"
          animate={{ x: prefersReducedMotion ? 0 : [0, 4, 0] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </motion.div>
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
    <div className={`flex flex-col gap-[3px] ${className}`}>
      {sortedActions.map((action) => (
        <StudyActionCard key={action.id} action={action} />
      ))}
    </div>
  );
};

export default StudyActionCard;
