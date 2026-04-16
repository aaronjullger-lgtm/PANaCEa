/**
 * EmptyState Component
 *
 * Reusable empty state UI for when data is not available.
 * Provides consistent UX across the application with contextual messaging.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  bodySupportClass,
  emptyStateIconWrapClass,
  emptyStateSurfaceClass,
  sectionHeadingClass,
} from '@/components/ui/system';
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

export interface EmptyStateProps {
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
  /** Whether to render the icon */
  showIcon?: boolean;
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
  showIcon = true,
}: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const config = VARIANT_CONFIG[variant];
  const IconComponent = icon || config.icon;
  const displayTitle = title || config.defaultTitle;
  const displayDescription = description || config.defaultDescription;

  const content = (
    <div
      className={cn(
        emptyStateSurfaceClass,
        compact ? 'px-4 py-6 sm:px-5' : 'px-6 py-10 sm:px-8 sm:py-12',
        className,
      )}
    >
      {/* Icon */}
      {showIcon && (
        <div className={cn(compact ? 'mb-3' : 'mb-4')}>
          <div
            className={cn(
              emptyStateIconWrapClass,
              compact ? 'h-12 w-12' : 'h-16 w-16',
            )}
          >
            <IconComponent
              className={cn(
                'text-[var(--color-text-secondary)]',
                compact ? 'w-6 h-6' : 'w-8 h-8',
              )}
            />
          </div>
        </div>
      )}

      {/* Text */}
      <h3
        className={cn(
          sectionHeadingClass,
          compact ? 'text-base' : 'text-lg',
        )}
      >
        {displayTitle}
      </h3>

      {displayDescription && (
        <p
          className={cn(
            bodySupportClass,
            'max-w-lg',
            compact ? 'mb-3 text-sm' : 'mb-4',
          )}
        >
          {displayDescription}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div
          className={cn('flex flex-col items-center gap-3 sm:flex-row', compact ? 'mt-2' : 'mt-4')}
        >
          {action && (
            <Button
              variant={action.variant === 'secondary' ? 'secondary' : 'primary'}
              size="md"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="secondary"
              size={compact ? 'sm' : 'md'}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
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
