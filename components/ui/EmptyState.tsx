/**
 * EmptyState Component
 *
 * Reusable empty state UI for when data is not available.
 * Provides consistent UX across the application with contextual messaging.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  Inbox,
  Search,
  FileQuestion,
  Brain,
  Trophy,
  BookOpen,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export type EmptyStateVariant =
  | 'default'
  | 'search'
  | 'quiz'
  | 'review'
  | 'achievement'
  | 'content'
  | 'getting-started';

interface EmptyStateProps {
  /** The main title */
  title: string;
  /** Descriptive message */
  description?: string;
  /** Icon to display (Lucide icon component) */
  icon?: LucideIcon;
  /** Preset variant for common use cases */
  variant?: EmptyStateVariant;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate entry */
  animate?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

const VARIANT_CONFIG: Record<
  EmptyStateVariant,
  { icon: LucideIcon; defaultTitle: string; defaultDescription: string }
> = {
  default: {
    icon: Inbox,
    defaultTitle: 'Nothing here yet',
    defaultDescription: 'Content will appear here when available.',
  },
  search: {
    icon: Search,
    defaultTitle: 'No results found',
    defaultDescription: 'Try adjusting your search or filters.',
  },
  quiz: {
    icon: FileQuestion,
    defaultTitle: 'No questions available',
    defaultDescription: 'Check back later for new questions.',
  },
  review: {
    icon: Brain,
    defaultTitle: 'All caught up!',
    defaultDescription: 'No reviews due right now. Great work!',
  },
  achievement: {
    icon: Trophy,
    defaultTitle: 'No achievements yet',
    defaultDescription: 'Complete challenges to earn achievements.',
  },
  content: {
    icon: BookOpen,
    defaultTitle: 'No content available',
    defaultDescription: 'This section is being updated.',
  },
  'getting-started': {
    icon: Sparkles,
    defaultTitle: 'Ready to start learning?',
    defaultDescription: 'Begin your medical education journey.',
  },
};

export function EmptyState({
  title,
  description,
  icon,
  variant = 'default',
  action,
  secondaryAction,
  className = '',
  animate = true,
  compact = false,
}: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const config = VARIANT_CONFIG[variant];
  const IconComponent = icon || config.icon;
  const displayTitle = title || config.defaultTitle;
  const displayDescription = description || config.defaultDescription;

  const content = (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6 px-4' : 'py-12 px-6'} ${className}`}
    >
      {/* Icon */}
      <div className={`${compact ? 'mb-3' : 'mb-4'}`}>
        <div
          className={`
          ${compact ? 'w-12 h-12' : 'w-16 h-16'} 
          rounded-full 
          bg-[var(--color-bg-tertiary)] 
          flex items-center justify-center
        `}
        >
          <IconComponent
            className={`
              ${compact ? 'w-6 h-6' : 'w-8 h-8'} 
              text-[var(--color-text-tertiary)]
            `}
          />
        </div>
      </div>

      {/* Text */}
      <h3
        className={`
        ${compact ? 'text-base' : 'text-lg'} 
        font-semibold 
        text-[var(--color-text-primary)] 
        mb-1
      `}
      >
        {displayTitle}
      </h3>

      {displayDescription && (
        <p
          className={`
          ${compact ? 'text-sm' : 'text-base'} 
          text-[var(--color-text-secondary)] 
          max-w-sm 
          ${compact ? 'mb-3' : 'mb-4'}
        `}
        >
          {displayDescription}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div
          className={`flex flex-col sm:flex-row items-center gap-3 ${compact ? 'mt-2' : 'mt-4'}`}
        >
          {action && (
            <button
              onClick={action.onClick}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${
                  action.variant === 'secondary'
                    ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                    : 'bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)] hover:opacity-90'
                }
              `}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (!animate || prefersReducedMotion) {
    return content;
  }

  return (
    <motion.div
      initial={{ y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {content}
    </motion.div>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */
export const EmptyStates = {
  NoReviewsDue: (props?: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="review"
      title="All caught up!"
      description="No reviews are due right now. Check back later or practice new material."
      {...props}
    />
  ),

  NoSearchResults: (props?: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="search"
      title="No results found"
      description="Try adjusting your search terms or clearing filters."
      {...props}
    />
  ),

  NoQuestions: (onStartQuiz?: () => void, props?: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="quiz"
      title="No questions available"
      description="Start a new quiz session to begin practicing."
      action={onStartQuiz ? { label: 'Start Quiz', onClick: onStartQuiz } : undefined}
      {...props}
    />
  ),

  NoAchievements: (props?: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="achievement"
      title="No achievements yet"
      description="Complete quizzes and challenges to earn achievements and track your progress."
      {...props}
    />
  ),

  NoStats: (onStartLearning?: () => void, props?: Partial<EmptyStateProps>) => (
    <EmptyState
      variant="getting-started"
      title="Start practicing to see your stats"
      description="Complete some questions to see your memory retention and progress metrics."
      action={onStartLearning ? { label: 'Start Learning', onClick: onStartLearning } : undefined}
      {...props}
    />
  ),
};

export default EmptyState;
