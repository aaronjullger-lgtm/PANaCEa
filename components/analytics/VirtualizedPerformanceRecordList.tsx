/**
 * VirtualizedPerformanceRecordList - Windowing for performance/session history (DOM bloat audit)
 *
 * Use for any list of PerformanceRecord (e.g. "History" tab, session history).
 * Renders only visible rows (~10–15) instead of 5,000+ DOM nodes.
 *
 * Requirement: Never render 5,000 DOM nodes for a list. Use this component for
 * Performance Data / History tables.
 */

import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PerformanceRecord } from '@/types';

const ROW_HEIGHT = 48;
const OVERSCAN = 5;

interface VirtualizedPerformanceRecordListProps {
  records: PerformanceRecord[];
  parentRef: React.RefObject<HTMLDivElement | null>;
  /** Parent must set scroll container height (e.g. maxHeight: "50vh") */
  emptyMessage?: React.ReactNode;
}

function formatRecordDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VirtualizedPerformanceRecordList({
  records,
  parentRef,
  emptyMessage = 'No session history yet.',
}: VirtualizedPerformanceRecordListProps): React.ReactElement {
  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)] text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      style={{ height: `${totalSize}px`, position: 'relative', width: '100%' }}
      role="list"
      aria-label="Session history"
    >
      {virtualItems.map((virtualRow) => {
        const record = records[virtualRow.index];
        if (record == null) return null;
        return (
          <div
            key={virtualRow.key}
            role="listitem"
            className="flex items-center gap-4 px-4 py-2 border-b border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-secondary)]"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${ROW_HEIGHT}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <span className="text-[var(--color-text-muted)] shrink-0 w-32">
              {formatRecordDate(record.timestamp)}
            </span>
            <span className="truncate min-w-0 flex-1" title={record.condition}>
              {record.condition || record.topic || '—'}
            </span>
            <span
              className={`shrink-0 font-medium ${
                record.isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'
              }`}
            >
              {record.isCorrect ? 'Correct' : 'Incorrect'}
            </span>
            {record.timeSpentMs != null && (
              <span className="text-[var(--color-text-muted)] shrink-0">
                {Math.round(record.timeSpentMs / 1000)}s
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default VirtualizedPerformanceRecordList;
