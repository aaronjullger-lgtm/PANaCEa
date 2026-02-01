/**
 * FSRSInsightCard Component
 *
 * Shows users their FSRS spaced repetition statistics in a transparent,
 * understandable way. This builds trust in the algorithm and shows progress.
 *
 * Features:
 * - Stability growth over time
 * - Difficulty rating per concept
 * - Predicted recall probability
 * - Review history visualization
 *
 * @see .clinerules Section 2: FSRS v5 SPACED REPETITION
 */

import React from 'react';
import { TrendingUp, Brain, Clock, Target, AlertCircle, CheckCircle, Calendar } from 'lucide-react';

interface FSRSCardData {
  conceptName: string;
  conditionId: string;
  system: string;
  stability: number; // Days until 90% recall drops to 70%
  difficulty: number; // 1-10 scale
  retrievability: number; // 0-1 probability of recall
  state: 'new' | 'learning' | 'review' | 'relearning';
  dueDate: Date;
  reviewCount: number;
  lastReview?: Date;
  stabilityHistory: { date: string; stability: number }[];
}

interface FSRSInsightCardProps {
  data: FSRSCardData;
  compact?: boolean;
  onReviewNow?: () => void;
}

export const FSRSInsightCard: React.FC<FSRSInsightCardProps> = ({
  data,
  compact = false,
  onReviewNow,
}) => {
  const isDue = new Date(data.dueDate) <= new Date();
  const daysUntilDue = Math.ceil(
    (new Date(data.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  // Color coding based on retrievability - using slate palette for consistency
  const getRetrievabilityColor = (r: number) => {
    if (r >= 0.9) return 'text-[var(--color-text-primary)]';
    if (r >= 0.7) return 'text-[var(--color-text-primary)]';
    if (r >= 0.5) return 'text-[var(--color-text-muted)]';
    return 'text-[var(--color-text-muted)]';
  };

  // Get state badge color - using slate palette for consistency
  const getStateBadge = () => {
    switch (data.state) {
      case 'new':
        return {
          bg: 'bg-[var(--color-bg-tertiary)]',
          text: 'text-[var(--color-text-muted)]',
          label: 'New',
        };
      case 'learning':
        return {
          bg: 'bg-[var(--color-accent)]/15',
          text: 'text-[var(--color-accent)]',
          label: 'Learning',
        };
      case 'review':
        return {
          bg: 'bg-[var(--color-success)]/15',
          text: 'text-[var(--color-success)]',
          label: 'Review',
        };
      case 'relearning':
        return {
          bg: 'bg-[var(--color-warning)]/15',
          text: 'text-[var(--color-warning)]',
          label: 'Relearning',
        };
    }
  };

  const stateBadge = getStateBadge();

  // Calculate stability trend - IIFE with explicit guards for array access
  // TypeScript doesn't narrow from length checks, so we must guard explicitly
  const stabilityTrend = (() => {
    if (data.stabilityHistory.length < 2) return 0;
    const last = data.stabilityHistory[data.stabilityHistory.length - 1];
    const secondLast = data.stabilityHistory[data.stabilityHistory.length - 2];
    if (!last || !secondLast) return 0;
    return last.stability - secondLast.stability;
  })();

  if (compact) {
    return (
      <div
        className={`p-4 rounded-xl border ${
          isDue
            ? 'border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10'
            : 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg ${stateBadge.bg} flex items-center justify-center`}
            >
              <Brain className={`w-5 h-5 ${stateBadge.text}`} />
            </div>
            <div>
              <h4 className="font-medium text-[var(--color-text-primary)] text-sm">
                {data.conceptName}
              </h4>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span>{data.system}</span>
                <span>•</span>
                <span className={getRetrievabilityColor(data.retrievability)}>
                  {Math.round(data.retrievability * 100)}% recall
                </span>
              </div>
            </div>
          </div>

          {isDue && onReviewNow && (
            <button
              onClick={onReviewNow}
              className="px-3 py-1.5 bg-[var(--color-warning)] hover:bg-[var(--color-warning)]/90 text-[var(--color-text-inverse)] text-xs font-medium rounded-lg transition-colors"
            >
              Review Now
            </button>
          )}

          {!isDue && (
            <span className="text-xs text-[var(--color-text-muted)]">Due in {daysUntilDue}d</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border ${
        isDue ? 'border-[var(--color-warning)]/50' : 'border-[var(--color-border)]'
      } bg-[var(--color-bg-primary)] overflow-hidden`}
    >
      {/* Header */}
      <div className="p-5 border-b border-[var(--color-border)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${stateBadge.bg} ${stateBadge.text}`}
              >
                {stateBadge.label}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{data.system}</span>
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {data.conceptName}
            </h3>
          </div>

          {isDue ? (
            <div className="flex items-center gap-2 text-[var(--color-warning)]">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Due for Review</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Due in {daysUntilDue} days</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
        {/* Stability */}
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-[var(--color-text-muted)] mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Stability</span>
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">
            {data.stability.toFixed(1)}
            <span className="text-sm font-normal text-[var(--color-text-muted)]">d</span>
          </p>
          {stabilityTrend !== 0 && (
            <p
              className={`text-xs ${
                stabilityTrend > 0
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              {stabilityTrend > 0 ? '+' : ''}
              {stabilityTrend.toFixed(1)}d from last
            </p>
          )}
        </div>

        {/* Difficulty */}
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-[var(--color-text-muted)] mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Difficulty</span>
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">
            {data.difficulty.toFixed(1)}
            <span className="text-sm font-normal text-[var(--color-text-muted)]">/10</span>
          </p>
          <div className="mt-1 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                data.difficulty <= 3
                  ? 'bg-[var(--color-success)]'
                  : data.difficulty <= 6
                    ? 'bg-[var(--color-warning)]'
                    : 'bg-[var(--color-error)]'
              }`}
              style={{ width: `${data.difficulty * 10}%` }}
            />
          </div>
        </div>

        {/* Retrievability */}
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-[var(--color-text-muted)] mb-1">
            <Brain className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Recall</span>
          </div>
          <p className={`text-2xl font-bold ${getRetrievabilityColor(data.retrievability)}`}>
            {Math.round(data.retrievability * 100)}%
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {data.retrievability >= 0.9
              ? 'Excellent'
              : data.retrievability >= 0.7
                ? 'Good'
                : data.retrievability >= 0.5
                  ? 'Fair'
                  : 'Review needed'}
          </p>
        </div>
      </div>

      {/* Stability History Mini Chart */}
      {data.stabilityHistory.length > 1 && (
        <div className="px-5 py-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] mb-2 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Stability Growth Over {data.reviewCount} Reviews
          </p>
          <div className="h-12 flex items-end gap-1">
            {data.stabilityHistory.slice(-10).map((point, idx) => {
              const maxStability = Math.max(...data.stabilityHistory.map((p) => p.stability));
              const height = (point.stability / maxStability) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 bg-[var(--color-accent)]/20 rounded-t transition-all hover:bg-[var(--color-accent)]/40"
                  style={{ height: `${Math.max(height, 10)}%` }}
                  title={`${point.date}: ${point.stability.toFixed(1)}d`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
            <span>{data.stabilityHistory[0]?.date || ''}</span>
            <span>{data.stabilityHistory[data.stabilityHistory.length - 1]?.date || ''}</span>
          </div>
        </div>
      )}

      {/* Review Button */}
      {isDue && onReviewNow && (
        <div className="p-4 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
          <button
            onClick={onReviewNow}
            className="w-full py-3 bg-[var(--color-warning)] hover:bg-[var(--color-warning)]/90 text-[var(--color-text-inverse)] font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Review This Concept Now
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Helper to convert UserProgress data to FSRSCardData
 */
export function userProgressToFSRSCard(progress: {
  conditionId: string;
  conditionName: string;
  system: string;
  stability: number;
  difficulty: number;
  state: number;
  dueDate: Date;
  reviewHistory?: Array<{ date: string; stability: number }>;
}): FSRSCardData {
  const stateMap: Record<number, FSRSCardData['state']> = {
    0: 'new',
    1: 'learning',
    2: 'review',
    3: 'relearning',
  };

  // Calculate retrievability based on time since due
  const daysSinceDue = (Date.now() - new Date(progress.dueDate).getTime()) / (1000 * 60 * 60 * 24);
  const retrievability = Math.exp(-daysSinceDue / progress.stability);

  return {
    conceptName: progress.conditionName,
    conditionId: progress.conditionId,
    system: progress.system,
    stability: progress.stability,
    difficulty: progress.difficulty,
    retrievability: Math.min(1, Math.max(0, retrievability)),
    state: stateMap[progress.state] || 'new',
    dueDate: new Date(progress.dueDate),
    reviewCount: progress.reviewHistory?.length || 0,
    lastReview: (() => {
      if (!progress.reviewHistory?.length) return undefined;
      const lastEntry = progress.reviewHistory[progress.reviewHistory.length - 1];
      return lastEntry ? new Date(lastEntry.date) : undefined;
    })(),
    stabilityHistory:
      progress.reviewHistory?.map((r) => ({
        date: new Date(r.date).toLocaleDateString(),
        stability: r.stability,
      })) || [],
  };
}

export default FSRSInsightCard;
