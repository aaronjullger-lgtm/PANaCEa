/**
 * SkeletonLoader — compatibility shim for legacy imports.
 *
 * The canonical skeleton primitives live in components/loading/index.tsx.
 * This file provides the SkeletonLoader and SkeletonCard components that
 * some older components import from @/components/ui/SkeletonLoader.
 */
import React from 'react';
import { Skeleton } from '@/components/loading';

interface SkeletonLoaderProps {
  height?: string;
  width?: string;
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  height,
  width,
  className = '',
  variant: _variant,
}) => (
  <Skeleton
    className={`${height ? `h-[${height}]` : ''} ${width ? `w-[${width}]` : 'w-full'} ${className}`.trim()}
  />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Skeleton className={`h-32 w-full rounded-xl ${className}`.trim()} />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className="h-4 w-full last:w-3/4 rounded" />
    ))}
  </div>
);
