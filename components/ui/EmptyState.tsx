/**
 * EmptyState Component
 *
 * Reusable empty state UI for when data is not available.
 * Provides consistent UX across the application with contextual messaging.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Button, type ButtonSize } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  bodySupportClass,
  emptyStateIconWrapClass,
  emptyStateInlineClass,
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
    icon?: React.ReactNode;
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'ghost' | 'secondary' | 'outline';
    icon?: React.ReactNode;
  };
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate entry */
  animate?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Whether to render the icon */
  showIcon?: boolean;
  /** Visual container treatment */
  layout?: 'inline' | 'surface';
  /** Shared action size */
  actionSize?: ButtonSize;
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
  layout = 'inline',
  actionSize = 'md',
}: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const config = VARIANT_CONFIG[variant];
  const IconComponent = icon || config.icon;
  const displayTitle = title || config.defaultTitle;
  const displayDescription = description || config.defaultDescription;

  const content = (
    <div
      className={cn(
        emptyStateInlineClass,
        layout === 'surface' && emptyStateSurfaceClass,
        compact ? 'py-6 px-4' : 'py-12 px-6',
        className,
      )}
    >
      {/* Icon */}
      {showIcon && (
        <div className={cn(compact ? 'mb-3' : 'mb-4')}>
          <div
            className={cn(
              emptyStateIconWrapClass,
              compact ? 'w-12 h-12' : 'w-16 h-16',
            )}
          >
            <IconComponent
              className={cn(
                'text-[var(--color-text-tertiary)]',
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
          'mb-1',
          compact ? 'text-base' : 'text-lg',
        )}
      >
        {displayTitle}
      </h3>

      {displayDescription && (
        <p
          className={cn(
            bodySupportClass,
            'max-w-sm',
            compact ? 'text-sm mb-3' : 'text-base mb-4',
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
              size={actionSize}
              icon={action.icon}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant ?? 'ghost'}
              size={compact ? 'sm' : actionSize}
              icon={secondaryAction.icon}
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
      initial={{ opacity: 0, y: 10 }}
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
