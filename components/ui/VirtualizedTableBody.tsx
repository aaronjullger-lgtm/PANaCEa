/**
 * VirtualizedTableBody - Windowing for table body (DOM bloat audit)
 *
 * Renders only visible rows (e.g. ~10–15) instead of thousands of DOM nodes.
 * Uses a scroll container + div-based rows (grid) so we avoid table layout + absolute positioning.
 *
 * Requirement: Never render 5,000+ DOM nodes for a list; use this or similar.
 */

import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { bodySupportClass, tableRowClass } from '@/components/ui/system';

const ROW_HEIGHT = 56;
const OVERSCAN = 5;

interface VirtualizedTableBodyProps<T> {
  items: T[];
  parentRef: React.RefObject<HTMLDivElement | null>;
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: React.ReactNode;
  rowHeight?: number;
  /** Grid template columns for each row (e.g. "1fr 80px 80px 100px 80px 100px 80px") */
  gridTemplateColumns?: string;
}

export function VirtualizedTableBody<T>({
  items,
  parentRef,
  renderRow,
  emptyMessage,
  rowHeight = ROW_HEIGHT,
  gridTemplateColumns,
}: VirtualizedTableBodyProps<T>): React.ReactElement {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${bodySupportClass}`}>
        {emptyMessage ?? 'No data.'}
      </div>
    );
  }

  return (
    <div style={{ height: `${totalSize}px`, position: 'relative', width: '100%' }}>
      {virtualItems.map((virtualRow) => {
        const item = items[virtualRow.index];
        if (item == null) return null;
        return (
          <div
            key={virtualRow.key}
            className={tableRowClass}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${rowHeight}px`,
              transform: `translateY(${virtualRow.start}px)`,
              gridTemplateColumns: gridTemplateColumns ?? '1fr',
            }}
          >
            {renderRow(item, virtualRow.index)}
          </div>
        );
      })}
    </div>
  );
}

export default VirtualizedTableBody;
