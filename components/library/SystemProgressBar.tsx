/**
 * SystemProgressBar - Shows overall mastery progress for a system
 *
 * Displays:
 * - Overall mastery percentage
 * - Breakdown by mastery level (new, learning, developing, competent, mastered)
 * - Number of conditions studied vs total
 */

import React from 'react';
import { Award, BookOpen, TrendingUp } from 'lucide-react';

interface MasteryStats {
  total: number;
  new: number;
  learning: number;
  developing: number;
  competent: number;
  mastered: number;
}

interface SystemProgressBarProps {
  /** System name (e.g., "Cardiovascular") */
  systemName: string;
  /** Mastery statistics */
  stats: MasteryStats;
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Calculate weighted mastery score (0-100)
 */
function calculateMasteryScore(stats: MasteryStats): number {
  if (stats.total === 0) return 0;

  const weights = {
    new: 0,
    learning: 15,
    developing: 40,
    competent: 70,
    mastered: 100,
  };

  const weightedSum =
    stats.new * weights.new +
    stats.learning * weights.learning +
    stats.developing * weights.developing +
    stats.competent * weights.competent +
    stats.mastered * weights.mastered;

  return Math.round(weightedSum / stats.total);
}

/**
 * Get color for score
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-[var(--color-category-practice)]';
  if (score >= 60) return 'text-data-pass';
  if (score >= 40) return 'text-data-provisional';
  if (score >= 20) return 'text-orange-400';
  return 'text-data-fail';
}

export const SystemProgressBar: React.FC<SystemProgressBarProps> = ({
  systemName,
  stats,
  showBreakdown = false,
  compact = false,
}) => {
  const score = calculateMasteryScore(stats);
  const studied = stats.total - stats.new;
  const scoreColor = getScoreColor(score);

  // Calculate segment widths
  const segments = [
    { key: 'mastered', color: 'bg-[var(--color-category-practice)]', count: stats.mastered },
    { key: 'competent', color: 'bg-data-pass', count: stats.competent },
    { key: 'developing', color: 'bg-data-provisional', count: stats.developing },
    { key: 'learning', color: 'bg-data-fail', count: stats.learning },
    { key: 'new', color: 'bg-data-neutral', count: stats.new },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden flex">
          {segments.map(
            (seg) =>
              seg.count > 0 && (
                <div
                  key={seg.key}
                  className={`${seg.color} transition-all`}
                  style={{ width: `${(seg.count / stats.total) * 100}%` }}
                />
              )
          )}
        </div>
        <span className={`text-xs font-bold ${scoreColor}`}>{score}%</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/30 border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {systemName} Progress
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden flex mb-3">
        {segments.map(
          (seg) =>
            seg.count > 0 && (
              <div
                key={seg.key}
                className={`${seg.color} transition-all duration-500`}
                style={{ width: `${(seg.count / stats.total) * 100}%` }}
                title={`${seg.key}: ${seg.count}`}
              />
            )
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          <span>
            {studied} / {stats.total} studied
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Award className="w-3 h-3 text-[var(--color-category-practice)]" />
          <span>{stats.mastered + stats.competent} mastered</span>
        </div>
      </div>

      {/* Breakdown */}
      {showBreakdown && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-5 gap-2">
          {[
            { label: 'New', count: stats.new, color: 'bg-data-neutral' },
            { label: 'Learning', count: stats.learning, color: 'bg-data-fail' },
            { label: 'Developing', count: stats.developing, color: 'bg-data-provisional' },
            { label: 'Competent', count: stats.competent, color: 'bg-data-pass' },
            { label: 'Mastered', count: stats.mastered, color: 'bg-[var(--color-category-practice)]' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className={`w-2 h-2 ${item.color} rounded-full mx-auto mb-1`} />
              <p className="text-[10px] text-[var(--color-text-muted)]">{item.label}</p>
              <p className="text-xs font-bold text-[var(--color-text-secondary)]">{item.count}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * MiniProgressIndicator - Ultra compact progress for sidebar
 */
export const MiniProgressIndicator: React.FC<{
  stats: MasteryStats;
}> = ({ stats }) => {
  const score = calculateMasteryScore(stats);
  const scoreColor = getScoreColor(score);

  return (
    <div className="flex items-center gap-1">
      <div className="w-8 h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 60 ? 'bg-data-pass' : score >= 30 ? 'bg-data-provisional' : 'bg-data-fail'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-[10px] font-medium ${scoreColor}`}>{score}%</span>
    </div>
  );
};

export default SystemProgressBar;
