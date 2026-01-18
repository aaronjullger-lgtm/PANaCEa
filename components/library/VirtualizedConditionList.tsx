/**
 * VirtualizedConditionList - Performance-optimized list for large condition sets
 *
 * Uses windowing to only render visible items, enabling smooth scrolling
 * through 2000+ conditions without performance degradation.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { MedicalContentDisplay } from '@/types/medical-content';
import { EnhancedConditionCard } from './EnhancedConditionCard';

interface VirtualizedConditionListProps {
  conditions: Partial<MedicalContentDisplay>[];
  onConditionClick: (condition: Partial<MedicalContentDisplay>) => void;
  onBookmarkToggle?: (id: string) => void;
  isBookmarked?: (id: string) => boolean;
  onStartQuiz?: (id: string, mode: 'rapid' | 'deep' | 'mixed') => void;
  /** Height of each item in pixels */
  itemHeight?: number;
  /** Number of items to render above/below the visible area */
  overscan?: number;
  /** Container height (defaults to 100%) */
  height?: number | string;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Grid columns (1-4) */
  columns?: 1 | 2 | 3 | 4;
}

export const VirtualizedConditionList: React.FC<VirtualizedConditionListProps> = ({
  conditions,
  onConditionClick,
  onBookmarkToggle,
  isBookmarked,
  onStartQuiz,
  itemHeight = 180,
  overscan = 3,
  height = '100%',
  isLoading = false,
  emptyMessage = 'No conditions found',
  columns = 2,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Calculate row height (includes gap)
  const rowHeight = itemHeight + 16; // 16px gap
  const itemsPerRow = columns;

  // Calculate total rows
  const totalRows = Math.ceil(conditions.length / itemsPerRow);
  const totalHeight = totalRows * rowHeight;

  // Calculate visible range
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  );

  const visibleRows = useMemo(() => {
    const rows: Partial<MedicalContentDisplay>[][] = [];
    for (let i = startRow; i <= endRow; i++) {
      const startIndex = i * itemsPerRow;
      const rowItems = conditions.slice(startIndex, startIndex + itemsPerRow);
      if (rowItems.length > 0) {
        rows.push(rowItems);
      }
    }
    return rows;
  }, [conditions, startRow, endRow, itemsPerRow]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`grid gap-4 ${
              columns === 1
                ? 'grid-cols-1'
                : columns === 2
                  ? 'grid-cols-2'
                  : columns === 3
                    ? 'grid-cols-3'
                    : 'grid-cols-4'
            }`}
          >
            {Array.from({ length: columns }).map((_, j) => (
              <div
                key={j}
                className="h-44 rounded-xl bg-[var(--color-bg-secondary)] animate-pulse"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (conditions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-lg text-[var(--color-text-muted)]">{emptyMessage}</p>
      </div>
    );
  }

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div ref={containerRef} className="overflow-y-auto" style={{ height }} onScroll={handleScroll}>
      {/* Spacer for total height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible rows */}
        <div
          style={{
            position: 'absolute',
            top: startRow * rowHeight,
            left: 0,
            right: 0,
            padding: '0 16px',
          }}
        >
          {visibleRows.map((row, rowIndex) => (
            <div key={startRow + rowIndex} className={`grid ${columnClasses[columns]} gap-4 mb-4`}>
              {row.map((condition) => (
                <motion.div
                  key={condition.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <EnhancedConditionCard
                    condition={condition}
                    onClick={() => onConditionClick(condition)}
                  />
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll position indicator */}
      <div className="sticky bottom-4 right-4 float-right mr-4">
        <div className="bg-[var(--color-bg-secondary)]/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-[var(--color-text-muted)] border border-[var(--color-border)]">
          {Math.min(endRow * itemsPerRow, conditions.length)} / {conditions.length}
        </div>
      </div>
    </div>
  );
};

export default VirtualizedConditionList;
