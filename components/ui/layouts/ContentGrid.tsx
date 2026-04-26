import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InlineSpinner } from '@/components/loading';
import { getClinicalLoadingMessage } from '@/lib/systemStateCopy';
import { cn } from '@/lib/utils';
import {
  bodySupportClass,
  sectionHeaderRowClass,
  sectionSubtitleClass,
  sectionTitleClass,
} from '@/components/ui/system';

export interface ContentGridProps {
  children: React.ReactNode;
  columns?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  loading?: boolean;
  skeletonCount?: number;
  emptyState?: React.ReactNode;
  className?: string;
}

interface GridSkeletonProps {
  count?: number;
  gap?: number;
  columns?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

/**
 * GridSkeleton - Loading state with animated skeleton cards
 */
const GridSkeleton: React.FC<GridSkeletonProps> = ({
  count = 6,
  gap = 6,
  columns = { default: 1, md: 2, lg: 3 },
}) => {
  const gridClass = getGridClass(columns);

  return (
    <div
      role="status"
      aria-label="Loading content"
      className={gridClass}
      style={{ gap: `${gap * 0.25}rem` }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 animate-pulse"
        >
          {/* Header skeleton */}
          <div className="space-y-3 mb-6">
            <div className="h-8 bg-[var(--color-bg-tertiary)] rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-6 bg-[var(--color-bg-tertiary)] rounded w-20" />
              <div className="h-6 bg-[var(--color-bg-tertiary)] rounded w-16" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="space-y-2">
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-full" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-5/6" />
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-4/6" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Helper function to generate Tailwind grid classes
 */
function getGridClass(columns: ContentGridProps['columns']): string {
  const { default: defaultCols = 1, sm = defaultCols, md = sm, lg = md, xl = lg } = columns || {};

  const colMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  const classes = ['grid'];

  // Guard each lookup - colMap[key] may be undefined for keys not in the map
  const defaultClass = colMap[defaultCols];
  const smClass = colMap[sm];
  const mdClass = colMap[md];
  const lgClass = colMap[lg];
  const xlClass = colMap[xl];

  if (defaultCols && defaultClass) classes.push(defaultClass);
  if (sm !== defaultCols && smClass) classes.push(`sm:${smClass}`);
  if (md !== sm && mdClass) classes.push(`md:${mdClass}`);
  if (lg !== md && lgClass) classes.push(`lg:${lgClass}`);
  if (xl !== lg && xlClass) classes.push(`xl:${xlClass}`);

  return classes.join(' ');
}

/**
 * ContentGrid - Responsive grid layout for content cards
 *
 * Features:
 * - Responsive column breakpoints (1/2/3 columns)
 * - Smooth card animations with stagger effect
 * - Loading skeleton state
 * - Empty state handling
 * - Customizable gap spacing
 *
 * @example
 * <ContentGrid columns={{ default: 1, md: 2, lg: 3 }} gap={6}>
 *   {items.map(item => <MedicalContentCard key={item.id} content={item} />)}
 * </ContentGrid>
 */
export const ContentGrid: React.FC<ContentGridProps> = ({
  children,
  columns = { default: 1, md: 2, lg: 3 },
  gap = 6,
  loading = false,
  skeletonCount = 6,
  emptyState,
  className = '',
}) => {
  const gridClass = getGridClass(columns);
  const gapStyle = { gap: `${gap * 0.25}rem` };

  // Loading state
  if (loading) {
    return <GridSkeleton count={skeletonCount} gap={gap} columns={columns} />;
  }

  // Empty state
  const childArray = React.Children.toArray(children);
  if (childArray.length === 0 && emptyState) {
    return <div className="flex items-center justify-center py-16">{emptyState}</div>;
  }

  return (
    <div className={cn(gridClass, className)} style={gapStyle}>
      <AnimatePresence mode="popLayout">
        {React.Children.map(children, (child, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05, // Stagger effect
              ease: 'easeOut',
            }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * ContentGridHeader - Optional header with title and controls
 */
interface ContentGridHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
}

export const ContentGridHeader: React.FC<ContentGridHeaderProps> = ({
  title,
  subtitle,
  actions,
  filters,
}) => {
  return (
    <div className="mb-8 space-y-4">
      {/* Title row */}
      {(title || actions) && (
        <div className={sectionHeaderRowClass}>
          {title && (
            <div className="min-w-0">
              <h1
                className={cn(sectionTitleClass, 'sm:text-4xl')}
                style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
              >
                {title}
              </h1>
              {subtitle && <p className={cn(sectionSubtitleClass, 'mt-1')}>{subtitle}</p>}
            </div>
          )}
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Filter row */}
      {filters && <div className="flex items-center gap-3 flex-wrap">{filters}</div>}
    </div>
  );
};

/**
 * LoadingOverlay - Inline loading indicator
 */
interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = getClinicalLoadingMessage(0),
}) => {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-16 gap-4">
      <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
      <p className={bodySupportClass}>{message}</p>
    </div>
  );
};

export default ContentGrid;
