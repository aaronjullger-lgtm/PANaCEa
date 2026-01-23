import React from 'react';
import { Layers, LucideIcon } from 'lucide-react';

interface StudyCardProps {
  /** Card title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Custom icon component - defaults to Layers */
  icon?: LucideIcon;
  /** Whether the card is in active/selected state */
  isActive?: boolean;
  /** Optional badge text (e.g., question count) */
  badge?: string;
  /** Click handler */
  onClick?: () => void;
  /** Button label - defaults to "Start" */
  buttonLabel?: string;
  /** Whether to show the start button */
  showButton?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * StudyCard - Reusable card component for study modes, systems, and conditions
 *
 * Features:
 * - Theme-aware with CSS variables for light/dark mode
 * - AAA accessible button text (pure white on Action Blue)
 * - Layers icon integration (or custom icon)
 * - Active state styling
 */
export const StudyCard: React.FC<StudyCardProps> = ({
  title,
  subtitle,
  icon: Icon = Layers,
  isActive = false,
  badge,
  onClick,
  buttonLabel = 'Start',
  showButton = true,
  className = '',
  children,
}) => {
  // Theme-aware styles using CSS variables
  const cardBg = isActive
    ? 'bg-action-blue-600/10 dark:bg-action-blue-600/20'
    : 'bg-white dark:bg-slate-800/50';

  const cardBorder = isActive
    ? 'border-action-blue-600 ring-2 ring-action-blue-600/30'
    : 'border-slate-200 dark:border-slate-700 hover:border-action-blue-400 dark:hover:border-action-blue-500';

  return (
    <div
      className={`
        ${cardBg}
        backdrop-blur
        rounded-xl
        p-4
        border
        ${cardBorder}
        transition-all
        duration-200
        ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Header with icon and title */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon
            className={`
              w-5 h-5 
              ${isActive ? 'text-action-blue-600' : 'text-action-blue-600 dark:text-action-blue-400'}
            `}
          />
          <h3
            className={`
              text-lg 
              font-bold 
              ${
                isActive
                  ? 'text-action-blue-600 dark:text-action-blue-400'
                  : 'text-[var(--color-text-primary)] dark:text-white'
              }
            `}
          >
            {title}
          </h3>
        </div>

        {/* Optional badge */}
        {badge && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {badge}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-sm text-[var(--color-text-secondary)] dark:text-slate-400 mb-3 line-clamp-2">
          {subtitle}
        </p>
      )}

      {/* Custom children content */}
      {children}

      {/* Action Button - AAA accessible with pure white text on Action Blue */}
      {showButton && (
        <button
          className="
            mt-3
            w-full
            py-2
            px-4
            rounded-lg
            font-semibold
            text-sm
            bg-action-blue-600
            hover:bg-action-blue-700
            active:bg-action-blue-800
            text-white
            transition-colors
            duration-150
            focus:outline-none
            focus:ring-2
            focus:ring-action-blue-500
            focus:ring-offset-2
            dark:focus:ring-offset-slate-900
          "
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          aria-label={`${buttonLabel} ${title}`}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
};

/**
 * StudyCardGrid - Container for StudyCards with responsive grid layout
 */
interface StudyCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const StudyCardGrid: React.FC<StudyCardGridProps> = ({
  children,
  columns = 3,
  className = '',
}) => {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>{children}</div>;
};

export default StudyCard;
