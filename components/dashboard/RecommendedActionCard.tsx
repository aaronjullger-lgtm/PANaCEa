/**
 * RecommendedActionCard - AI-powered smart suggestion
 *
 * Analyzes user data to recommend the most impactful action right now.
 * Reduces decision fatigue by providing a clear "do this next" path.
 *
 * Priority Algorithm:
 * 1. Due SRS reviews (time-sensitive)
 * 2. Weak systems (<70% accuracy, ≥10 attempts)
 * 3. Exam urgency (<30 days)
 * 4. Time-of-day optimization
 * 5. Daily session default
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Target,
  Zap,
  BookOpen,
  AlertCircle,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { SessionSettings, SystemCode } from '@/types';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface RecommendedAction {
  type: 'srs_review' | 'weak_system' | 'exam_cram' | 'time_optimized' | 'daily_session';
  title: string;
  description: string;
  icon: LucideIcon;
  action: () => void;
  priority: number; // Higher = more urgent
}

interface SystemStats {
  system: SystemCode;
  name: string;
  accuracy: number;
  totalAttempts: number;
}

interface RecommendedActionCardProps {
  /** SRS cards due for review */
  dueCount: number;
  /** System performance data */
  systemStats: SystemStats[];
  /** Days until exam (null if no exam date set) */
  daysUntilExam: number | null;
  /** Current hour (0-23) for time optimization */
  currentHour?: number;
  /** Callback to start a session */
  onStartSession: (settings: SessionSettings) => void;
  /** Callback to start a system drill */
  onStartSystemDrill: (system: SystemCode) => void;
  /** Callback to start Cram Mode */
  onStartCramMode?: () => void;
  className?: string;
}

/**
 * Calculate recommended action based on user context
 */
function getRecommendedAction(
  dueCount: number,
  systemStats: SystemStats[],
  daysUntilExam: number | null,
  currentHour: number,
  onStartSession: (settings: SessionSettings) => void,
  onStartSystemDrill: (system: SystemCode) => void,
  onStartCramMode?: () => void
): RecommendedAction {
  // Priority 1: Due SRS reviews (>10 cards)
  if (dueCount >= 10) {
    return {
      type: 'srs_review',
      title: 'Review Due Cards',
      description: `${dueCount} cards need review to maintain retention`,
      icon: Brain,
      priority: 100,
      action: () => onStartSession({ focus: 'due', systems: [], difficulty: 'medium' }),
    };
  }

  // Priority 2: Weak system (<70% accuracy, ≥10 attempts)
  const weakSystems = systemStats
    .filter((s) => s.accuracy < 0.7 && s.totalAttempts >= 10)
    .sort((a, b) => a.accuracy - b.accuracy);

  if (weakSystems[0]) {
    const sys = weakSystems[0];
    const avgAccuracy = Math.round(
      (systemStats.reduce((sum, s) => sum + s.accuracy, 0) / systemStats.length) * 100
    );
    return {
      type: 'weak_system',
      title: `Focus: ${sys.name}`,
      description: `Your accuracy: ${Math.round(sys.accuracy * 100)}% (avg: ${avgAccuracy}%)`,
      icon: Target,
      priority: 90,
      action: () => onStartSystemDrill(sys.system),
    };
  }

  // Priority 3: Exam urgency (<30 days)
  if (daysUntilExam !== null && daysUntilExam <= 30 && daysUntilExam > 0) {
    return {
      type: 'exam_cram',
      title: 'Cram Mode',
      description: `${daysUntilExam} days until exam - high-yield review`,
      icon: Zap,
      priority: 85,
      action:
        onStartCramMode ||
        (() =>
          onStartSession({ focus: 'all', systems: [], difficulty: 'medium', questionCount: 50 })),
    };
  }

  // Priority 4: Time of day optimization
  const morningHours = currentHour >= 6 && currentHour <= 10;
  const eveningHours = currentHour >= 18 && currentHour <= 22;

  if (morningHours) {
    return {
      type: 'time_optimized',
      title: 'New Material',
      description: 'Morning is optimal for learning new concepts',
      icon: BookOpen,
      priority: 70,
      action: () =>
        onStartSession({ focus: 'all', systems: [], difficulty: 'medium', questionCount: 20 }),
    };
  }

  if (eveningHours) {
    return {
      type: 'time_optimized',
      title: 'Review & Consolidate',
      description: 'Evening is great for reviewing what you learned',
      icon: Brain,
      priority: 70,
      action: () => onStartSession({ focus: 'review', systems: [], difficulty: 'medium' }),
    };
  }

  // Fallback: Daily session
  return {
    type: 'daily_session',
    title: 'Daily Session',
    description: 'Answer 40 questions (recommended daily target)',
    icon: Brain,
    priority: 50,
    action: () =>
      onStartSession({ focus: 'all', systems: [], difficulty: 'medium', questionCount: 40 }),
  };
}

export const RecommendedActionCard: React.FC<RecommendedActionCardProps> = ({
  dueCount,
  systemStats,
  daysUntilExam,
  currentHour = new Date().getHours(),
  onStartSession,
  onStartSystemDrill,
  onStartCramMode,
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Memoised: getRecommendedAction runs filter/sort/reduce over systemStats,
  // so we only recompute when the inputs actually change rather than on
  // every parent render (which is frequent on the dashboard).
  const recommendation = useMemo(
    () =>
      getRecommendedAction(
        dueCount,
        systemStats,
        daysUntilExam,
        currentHour,
        onStartSession,
        onStartSystemDrill,
        onStartCramMode
      ),
    [dueCount, systemStats, daysUntilExam, currentHour, onStartSession, onStartSystemDrill, onStartCramMode]
  );

  const Icon = recommendation.icon;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 10 }}
      animate={{ y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-xl
        bg-[var(--color-bg-secondary)]
        p-5 shadow-sm
        ${className}
      `}
    >
      {/* AI Badge */}
      <div className="absolute top-3 right-3">
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-accent)]/15">
          <Sparkles className="w-3 h-3 text-[var(--color-accent)]" />
          <span className="text-xs font-semibold text-[var(--color-accent)]">AI</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 rounded-lg bg-[var(--color-accent)]/15">
          <Icon className="w-6 h-6 text-[var(--color-accent)]" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-1">
            Recommended for you
          </div>
          <h3 className="font-bold text-lg text-[var(--color-text-primary)]">
            {recommendation.title}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        {recommendation.description}
      </p>

      {/* CTA */}
      <button
        onClick={recommendation.action}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg font-semibold hover:opacity-90 transition-opacity group"
      >
        <span>Start Now</span>
        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* Urgency indicator */}
      {recommendation.priority >= 90 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-data-provisional)]">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="font-medium">High priority</span>
        </div>
      )}
    </motion.div>
  );
};

export default RecommendedActionCard;
