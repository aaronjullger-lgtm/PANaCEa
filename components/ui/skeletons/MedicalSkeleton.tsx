/**
 * MedicalSkeleton - Zero-CLS loading states for medical content
 *
 * Implements skeleton loaders that exactly match the dimensions of loaded content
 * to achieve Cumulative Layout Shift (CLS) of 0.0 during data fetching.
 *
 * All skeletons use consistent styling: bg-data-neutral dark:bg-data-neutral animate-pulse rounded-xl
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton with pulse animation
 */
const SkeletonBase: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = '',
  style,
}) => (
  <div
    className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`}
    style={style}
  />
);

/**
 * Text line skeleton
 */
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  widths?: string[];
}> = ({ lines = 3, className = '', widths = [] }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonBase
        key={i}
        className="h-4 rounded"
        style={{ width: widths[i] || (i === lines - 1 ? '60%' : '100%') }}
      />
    ))}
  </div>
);

/**
 * Question card skeleton - matches question display dimensions
 */
export const QuestionCardSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`p-6 border border-slate-700 rounded-xl bg-slate-900/50 ${className}`}>
    {/* Question stem */}
    <div className="space-y-2 mb-6">
      <SkeletonBase className="h-5 w-3/4" />
      <SkeletonBase className="h-5 w-full" />
      <SkeletonBase className="h-5 w-5/6" />
    </div>

    {/* Divider */}
    <div className="h-px bg-data-neutral my-4" />

    {/* Answer choices */}
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-4 border border-data-neutral rounded-lg bg-data-neutral/30"
        >
          <SkeletonBase className="w-8 h-8 rounded-full flex-shrink-0" />
          <SkeletonBase className="h-4 flex-1" style={{ width: `${60 + (i % 3) * 10}%` }} />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Condition card skeleton - matches library condition card dimensions
 */
export const ConditionCardSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`p-4 border border-slate-700 rounded-xl bg-slate-900/50 ${className}`}>
    {/* Header with title and yield badge */}
    <div className="flex items-start justify-between gap-2 mb-3">
      <SkeletonBase className="h-6 w-2/3" />
      <SkeletonBase className="h-5 w-12 rounded-full" />
    </div>

    {/* Subcategory */}
    <SkeletonBase className="h-3 w-1/3 mb-3" />

    {/* Divider */}
    <div className="h-px bg-data-neutral my-3" />

    {/* Classic patient snippet */}
    <div className="flex items-start gap-2 mb-3">
      <SkeletonBase className="w-4 h-4 rounded flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <SkeletonBase className="h-3 w-full" />
        <SkeletonBase className="h-3 w-4/5" />
      </div>
    </div>

    {/* Buzzwords */}
    <div className="flex items-start gap-2">
      <SkeletonBase className="w-4 h-4 rounded flex-shrink-0" />
      <div className="flex flex-wrap gap-1.5">
        <SkeletonBase className="h-5 w-16 rounded-md" />
        <SkeletonBase className="h-5 w-20 rounded-md" />
        <SkeletonBase className="h-5 w-14 rounded-md" />
      </div>
    </div>
  </div>
);

/**
 * Detail panel skeleton - matches condition detail view
 */
export const DetailPanelSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`p-6 ${className}`}>
    {/* Title */}
    <SkeletonBase className="h-10 w-2/3 mb-4" />

    {/* Badges row */}
    <div className="flex items-center gap-3 mb-6">
      <SkeletonBase className="h-6 w-24 rounded-full" />
      <SkeletonBase className="h-6 w-16 rounded-full" />
      <SkeletonBase className="h-6 w-20 rounded-full" />
    </div>

    {/* Sections */}
    {[1, 2, 3, 4].map((section) => (
      <div key={section} className="mb-6">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-3">
          <SkeletonBase className="w-5 h-5 rounded" />
          <SkeletonBase className="h-4 w-32" />
        </div>

        {/* Section content */}
        <div className="p-4 border border-data-neutral rounded-xl bg-data-neutral/30">
          <SkeletonText lines={4} widths={['100%', '90%', '95%', '70%']} />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Feedback panel skeleton - matches expanded feedback panel
 */
export const FeedbackPanelSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`p-6 border border-slate-700 rounded-xl bg-slate-900/50 ${className}`}>
    {/* Result badge */}
    <div className="flex items-center justify-center mb-4">
      <SkeletonBase className="h-12 w-40 rounded-full" />
    </div>

    {/* Correct answer */}
    <div className="mb-4">
      <SkeletonBase className="h-4 w-24 mb-2" />
      <SkeletonBase className="h-6 w-3/4" />
    </div>

    {/* Explanation */}
    <div className="mb-4">
      <SkeletonBase className="h-4 w-20 mb-2" />
      <SkeletonText lines={5} />
    </div>

    {/* Clinical pearls */}
    <div className="space-y-2">
      <SkeletonBase className="h-4 w-24 mb-2" />
      <SkeletonBase className="h-16 w-full rounded-lg" />
      <SkeletonBase className="h-16 w-full rounded-lg" />
    </div>
  </div>
);

/**
 * Drill hub skeleton - matches diagnostic drill hub layout
 */
export const DrillHubSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`min-h-screen bg-slate-950 p-6 ${className}`}>
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <div>
        <SkeletonBase className="h-8 w-48 mb-2" />
        <SkeletonBase className="h-4 w-32" />
      </div>
      <SkeletonBase className="h-10 w-24 rounded-lg" />
    </div>

    {/* Progress bar */}
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <SkeletonBase className="h-4 w-24" />
        <SkeletonBase className="h-4 w-16" />
      </div>
      <SkeletonBase className="h-2 w-full rounded-full" />
    </div>

    {/* Question area */}
    <div className="max-w-4xl mx-auto">
      <QuestionCardSkeleton />
    </div>
  </div>
);

/**
 * Analytics dashboard skeleton
 */
export const AnalyticsSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`p-6 ${className}`}>
    {/* Stats row */}
    <div className="grid grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 border border-data-neutral rounded-xl bg-data-neutral/50">
          <SkeletonBase className="h-4 w-20 mb-2" />
          <SkeletonBase className="h-8 w-16" />
        </div>
      ))}
    </div>

    {/* Chart area */}
    <div className="p-4 border border-data-neutral rounded-xl bg-data-neutral/50 mb-6">
      <SkeletonBase className="h-4 w-32 mb-4" />
      <SkeletonBase className="h-64 w-full" />
    </div>

    {/* Performance grid */}
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 border border-data-neutral rounded-xl bg-data-neutral/50">
        <SkeletonBase className="h-4 w-32 mb-4" />
        <SkeletonText lines={6} />
      </div>
      <div className="p-4 border border-data-neutral rounded-xl bg-data-neutral/50">
        <SkeletonBase className="h-4 w-32 mb-4" />
        <SkeletonText lines={6} />
      </div>
    </div>
  </div>
);

/**
 * Session setup skeleton
 */
export const SessionSetupSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`p-6 ${className}`}>
    <SkeletonBase className="h-8 w-48 mb-6" />

    {/* Options grid */}
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="p-4 border border-data-neutral rounded-xl bg-data-neutral/50">
          <SkeletonBase className="w-8 h-8 rounded-lg mb-2" />
          <SkeletonBase className="h-4 w-20 mb-1" />
          <SkeletonBase className="h-3 w-full" />
        </div>
      ))}
    </div>

    {/* Start button */}
    <SkeletonBase className="h-12 w-full rounded-xl" />
  </div>
);

/**
 * Library sidebar skeleton
 */
export const SidebarSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`w-64 p-4 border-r border-slate-700 bg-slate-900/50 ${className}`}>
    {/* Search */}
    <SkeletonBase className="h-10 w-full rounded-lg mb-4" />

    {/* Toggle */}
    <div className="flex items-center gap-2 mb-4">
      <SkeletonBase className="w-10 h-5 rounded-full" />
      <SkeletonBase className="h-4 w-24" />
    </div>

    {/* System list */}
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="flex items-center gap-2 p-2">
          <SkeletonBase className="w-5 h-5 rounded" />
          <SkeletonBase className="h-4 flex-1" />
          <SkeletonBase className="h-4 w-8" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Generic content card grid skeleton
 */
export const CardGridSkeleton: React.FC<{
  count?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}> = ({ count = 6, columns = 3, className = '' }) => (
  <div
    className={`grid gap-4 ${
      columns === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : columns === 3
          ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    } ${className}`}
  >
    {Array.from({ length: count }).map((_, i) => (
      <ConditionCardSkeleton key={i} />
    ))}
  </div>
);

/**
 * Inline loading indicator for text content
 */
export const InlineLoadingSkeleton: React.FC<{ width?: string; className?: string }> = ({
  width = '100px',
  className = '',
}) => <SkeletonBase className={`h-4 inline-block rounded ${className}`} style={{ width }} />;

// Export all components
export const MedicalSkeleton = {
  Base: SkeletonBase,
  Text: SkeletonText,
  QuestionCard: QuestionCardSkeleton,
  ConditionCard: ConditionCardSkeleton,
  DetailPanel: DetailPanelSkeleton,
  FeedbackPanel: FeedbackPanelSkeleton,
  DrillHub: DrillHubSkeleton,
  Analytics: AnalyticsSkeleton,
  SessionSetup: SessionSetupSkeleton,
  Sidebar: SidebarSkeleton,
  CardGrid: CardGridSkeleton,
  InlineLoading: InlineLoadingSkeleton,
};

export default MedicalSkeleton;
