import React from 'react';
import { Layers, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/card';
import { bodySupportClass, sectionHeadingClass } from '@/components/ui/system';

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
  return (
    <Card
      className={`
        ${isActive ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/8 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_18%,transparent),0_20px_40px_-30px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]' : ''}
        ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--color-accent)]/18' : ''}
        ${className}
      `}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
              <Icon className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div className="space-y-1">
              <h3
                className={`${sectionHeadingClass} ${
                  isActive ? 'text-[var(--color-accent)]' : ''
                }`}
              >
                {title}
              </h3>
              {subtitle && <p className={`${bodySupportClass} line-clamp-2`}>{subtitle}</p>}
            </div>
          </div>

          {badge && (
            <Badge variant={isActive ? 'default' : 'secondary'} size="sm">
              {badge}
            </Badge>
          )}
        </div>

        {children}

        {showButton && (
          <Button
            className="w-full"
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            aria-label={`${buttonLabel} ${title}`}
          >
            {buttonLabel}
          </Button>
        )}
      </CardContent>
    </Card>
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
