/**
 * AsyncContent — Unified loading / error / empty state wrapper
 *
 * Eliminates scattered conditional rendering for async data across views.
 * Composes the canonical Loader, ErrorState, and EmptyState components.
 */

import React from 'react';
import { Skeleton, ClinicalSkeleton } from '@/components/loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState, type EmptyStateVariant, type EmptyStateProps } from '@/components/ui/EmptyState';

type SkeletonVariant = 'skeleton' | 'clinical' | 'custom';

interface AsyncContentProps<T> {
  /** The async data to render. null/undefined = loading, Error = error */
  data: T | null | undefined;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error object or message, if any */
  error?: Error | string | null;
  /** Render function when data is available and non-empty */
  children: (data: T) => React.ReactNode;
  /** Predicate to determine if data is "empty" (default: empty array or falsy) */
  isEmpty?: (data: T) => boolean;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** EmptyState variant to show */
  emptyVariant?: EmptyStateVariant;
  /** Custom empty state props override */
  emptyProps?: Partial<EmptyStateProps>;
  /** Loading skeleton variant */
  skeletonVariant?: SkeletonVariant;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Custom empty component */
  emptyComponent?: React.ReactNode;
  /** Skeleton line count (for clinical variant) */
  skeletonLines?: number;
  /** Skeleton className */
  skeletonClassName?: string;
  /** Wrapper className */
  className?: string;
  /** Error title */
  errorTitle?: string;
}

function defaultIsEmpty<T>(data: T): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (data && typeof data === 'object' && 'length' in data) return (data as { length: number }).length === 0;
  return !data;
}

export function AsyncContent<T>({
  data,
  isLoading,
  error,
  children,
  isEmpty = defaultIsEmpty,
  onRetry,
  emptyVariant = 'default',
  emptyProps,
  skeletonVariant = 'skeleton',
  loadingComponent,
  errorComponent,
  emptyComponent,
  skeletonLines = 3,
  skeletonClassName = 'h-40 w-full',
  className = '',
  errorTitle,
}: AsyncContentProps<T>) {
  // Loading state
  if (isLoading) {
    if (loadingComponent) return <div className={className}>{loadingComponent}</div>;
    return (
      <div className={className}>
        {skeletonVariant === 'clinical' ? (
          <ClinicalSkeleton lines={skeletonLines} />
        ) : (
          <Skeleton className={skeletonClassName} />
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    if (errorComponent) return <div className={className}>{errorComponent}</div>;
    const errorMessage = error instanceof Error ? error.message : error;
    return (
      <div className={className}>
        <ErrorState
          title={errorTitle}
          message={errorMessage}
          onRetry={onRetry}
        />
      </div>
    );
  }

  // Empty state (data loaded but empty)
  if (data === null || data === undefined || isEmpty(data)) {
    if (emptyComponent) return <div className={className}>{emptyComponent}</div>;
    return (
      <div className={className}>
        <EmptyState variant={emptyVariant} {...emptyProps} title={emptyProps?.title || ''} />
      </div>
    );
  }

  // Success — render children with data
  return <>{children(data)}</>;
}

export type { AsyncContentProps };
