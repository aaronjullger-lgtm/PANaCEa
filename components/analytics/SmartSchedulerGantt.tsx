/**
 * SmartSchedulerGantt – Gantt-style calendar for FSRS / spaced repetition.
 * Shows review blocks on a timeline; visually "blocks out" when reviews are due.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';

export interface ScheduleBlock {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
  system?: string;
  count?: number;
  type?: 'review' | 'new' | 'exam';
}

interface SmartSchedulerGanttProps {
  /** Blocks to show (e.g. from FSRS due forecast) */
  blocks: ScheduleBlock[];
  /** Start date for the strip (default: today) */
  startDate?: string;
  /** Number of days to show (default: 14) */
  daysToShow?: number;
  /** Callback when a block is clicked */
  onBlockClick?: (block: ScheduleBlock) => void;
  className?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(s: string): number {
  return new Date(s + 'T12:00:00').getTime();
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return `+${diff} days`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const SmartSchedulerGantt: React.FC<SmartSchedulerGanttProps> = ({
  blocks,
  startDate = new Date().toISOString().slice(0, 10),
  daysToShow = 14,
  onBlockClick,
  className = '',
}) => {
  const { dayLabels, dayStart } = useMemo(() => {
    const start = parseDate(startDate);
    const labels: string[] = [];
    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(start + i * DAY_MS);
      labels.push(d.toISOString().slice(0, 10));
    }
    return { dayLabels: labels, dayStart: start };
  }, [startDate, daysToShow]);

  const blocksByDay = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    blocks.forEach((b) => {
      if (b.date >= startDate && b.date < dayLabels[dayLabels.length - 1] + ' ') {
        const list = map.get(b.date) ?? [];
        list.push(b);
        map.set(b.date, list);
      }
    });
    return map;
  }, [blocks, startDate, dayLabels]);

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-4 text-[var(--color-text-primary)]">
        <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-semibold">Spaced repetition schedule</h3>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {dayLabels.map((dateStr) => {
          const dayBlocks = blocksByDay.get(dateStr) ?? [];
          const isToday = dateStr === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={dateStr}
              className="flex-shrink-0 w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 min-h-[80px]"
            >
              <div
                className={`text-xs font-medium mb-2 ${isToday ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
              >
                {formatDayLabel(dateStr)}
              </div>
              <div className="space-y-1">
                {dayBlocks.map((block) => (
                  <motion.button
                    key={block.id}
                    type="button"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full text-left px-2 py-1.5 rounded text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/30 transition-colors truncate"
                    onClick={() => onBlockClick?.(block)}
                    title={block.label}
                  >
                    {block.system ?? block.label}
                    {block.count != null && block.count > 1 ? ` (${block.count})` : ''}
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {blocks.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-6 text-[var(--color-text-muted)] text-sm">
          <Clock className="w-4 h-4" />
          <span>No scheduled reviews in this window. Complete questions to see FSRS schedule.</span>
        </div>
      )}
    </div>
  );
};

export default SmartSchedulerGantt;
