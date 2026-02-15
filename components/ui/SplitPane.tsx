/**
 * SplitPane – draggable split for Reference + Practice (pin Clinical Reference to right ~30%).
 * Use in quiz/simulation view to show reference panel alongside questions.
 */

import React, { useState, useCallback } from 'react';
import { GripVertical } from 'lucide-react';

const MIN_LEFT_PERCENT = 40;
const MAX_LEFT_PERCENT = 85;
const DEFAULT_LEFT_PERCENT = 70;

interface SplitPaneProps {
  /** Left pane (e.g. Core PANCE Simulation / question) */
  left: React.ReactNode;
  /** Right pane (e.g. Clinical Reference Library) */
  right: React.ReactNode;
  /** Initial width of left pane as percent (default 70 = left 70%, right 30%) */
  defaultLeftPercent?: number;
  /** Min width of left pane as percent */
  minLeftPercent?: number;
  /** Max width of left pane as percent */
  maxLeftPercent?: number;
  /** Callback when split changes (e.g. persist to localStorage) */
  onSplitChange?: (leftPercent: number) => void;
  className?: string;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  defaultLeftPercent = DEFAULT_LEFT_PERCENT,
  minLeftPercent = MIN_LEFT_PERCENT,
  maxLeftPercent = MAX_LEFT_PERCENT,
  onSplitChange,
  className = '',
}) => {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [isDragging, setIsDragging] = useState(false);

  const clamp = (v: number) => Math.min(maxLeftPercent, Math.max(minLeftPercent, v));

  const handleMove = useCallback(
    (clientX: number) => {
      if (typeof document === 'undefined') return;
      const rect = document.body.getBoundingClientRect();
      const percent = (clientX / rect.width) * 100;
      const next = clamp(percent);
      setLeftPercent(next);
      onSplitChange?.(next);
    },
    [onSplitChange, minLeftPercent, maxLeftPercent]
  );

  const handleMouseDown = useCallback(() => setIsDragging(true), []);

  React.useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMove]);

  return (
    <div className={`flex h-full w-full overflow-hidden ${className}`}>
      <div
        className="flex-shrink-0 overflow-auto"
        style={{ width: `${leftPercent}%`, minWidth: 200 }}
      >
        {left}
      </div>
      <button
        type="button"
        aria-label="Resize panels (left/right arrows)"
        onMouseDown={handleMouseDown}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const next = clamp(leftPercent - 2);
            setLeftPercent(next);
            onSplitChange?.(next);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = clamp(leftPercent + 2);
            setLeftPercent(next);
            onSplitChange?.(next);
          }
        }}
        className="flex-shrink-0 w-2 cursor-col-resize bg-[var(--color-border)] hover:bg-[var(--color-accent)]/30 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] border-0 p-0"
      >
        <GripVertical
          className="w-4 h-4 text-[var(--color-text-muted)] pointer-events-none"
          aria-hidden
        />
      </button>
      <div className="flex-1 overflow-auto min-w-0" style={{ minWidth: 180 }}>
        {right}
      </div>
    </div>
  );
};

export default SplitPane;
