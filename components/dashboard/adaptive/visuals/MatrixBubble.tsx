import React from 'react';
import type { MatrixItem } from '../model/DashboardContext';

export function MatrixBubble({ item, onSelect, selected }: { item: MatrixItem; onSelect?: (item: MatrixItem) => void; selected?: boolean }) {
  const left = `${item.urgency * 88 + 4}%`;
  const bottom = `${item.mastery * 78 + 9}%`;
  const size = 32 + item.weight * 26;
  const trend = item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→';

  return (
    <button
      type="button"
      className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full border text-left shadow-sm transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
        selected || item.isTodayTarget
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
      style={{ left, bottom, width: size, height: size }}
      onClick={() => onSelect?.(item)}
      aria-pressed={selected}
      aria-label={`${item.label}: urgency ${Math.round(item.urgency * 100)}, mastery ${Math.round(item.mastery * 100)}. ${item.attribution}`}
      title={item.attribution}
    >
      <span className="flex h-full w-full flex-col items-center justify-center px-1 text-center">
        <span className="max-w-[5.8rem] truncate text-[0.68rem] font-semibold text-[var(--color-text-primary)]">
          {item.label}
        </span>
        <span className="font-mono text-[0.68rem] text-[var(--color-text-secondary)]">{trend}</span>
      </span>
    </button>
  );
}
