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

  // Color coding based on retrievability
  const getRetrievabilityColor = (r: number) => {
    if (r >= 0.9) return 'text-green-400';
    if (r >= 0.7) return 'text-yellow-400';
    if (r >= 0.5) return 'text-orange-400';
    return 'text-red-400';
  };

  // Get state badge color
  const getStateBadge = () => {
    switch (data.state) {
      case 'new':
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'New' };
      case 'learning':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Learning' };
      case 'review':
        return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Review' };
      case 'relearning':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Relearning' };
    }
  };

  const stateBadge = getStateBadge();

  // Calculate stability trend
  const stabilityTrend =
    data.stabilityHistory.length >= 2
      ? data.stabilityHistory[data.stabilityHistory.length - 1].stability -
        data.stabilityHistory[data.stabilityHistory.length - 2].stability
      : 0;

  if (compact) {
    return (
      <div
        className={`p-4 rounded-xl border ${isDue ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700 bg-slate-800'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg ${stateBadge.bg} flex items-center justify-center`}
            >
              <Brain className={`w-5 h-5 ${stateBadge.text}`} />
            </div>
            <div>
              <h4 className="font-medium text-white text-sm">{data.conceptName}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-400">
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
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Review Now
            </button>
          )}

          {!isDue && <span className="text-xs text-slate-400">Due in {daysUntilDue}d</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border ${isDue ? 'border-amber-500/50' : 'border-slate-700'} bg-slate-800 overflow-hidden`}
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${stateBadge.bg} ${stateBadge.text}`}
              >
                {stateBadge.label}
              </span>
              <span className="text-xs text-slate-500">{data.system}</span>
            </div>
            <h3 className="text-lg font-semibold text-white">{data.conceptName}</h3>
          </div>

          {isDue ? (
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Due for Review</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Due in {daysUntilDue} days</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 divide-x divide-slate-700">
        {/* Stability */}
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-indigo-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Stability</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {data.stability.toFixed(1)}
            <span className="text-sm font-normal text-slate-400">d</span>
          </p>
          {stabilityTrend !== 0 && (
            <p className={`text-xs ${stabilityTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stabilityTrend > 0 ? '+' : ''}
              {stabilityTrend.toFixed(1)}d from last
            </p>
          )}
        </div>

        {/* Difficulty */}
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Difficulty</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {data.difficulty.toFixed(1)}
            <span className="text-sm font-normal text-slate-400">/10</span>
          </p>
          <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                data.difficulty <= 3
                  ? 'bg-green-500'
                  : data.difficulty <= 6
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${data.difficulty * 10}%` }}
            />
          </div>
        </div>

        {/* Retrievability */}
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-cyan-400 mb-1">
            <Brain className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Recall</span>
          </div>
          <p className={`text-2xl font-bold ${getRetrievabilityColor(data.retrievability)}`}>
            {Math.round(data.retrievability * 100)}%
          </p>
          <p className="text-xs text-slate-500">
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
        <div className="px-5 py-4 border-t border-slate-700">
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-2">
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
                  className="flex-1 bg-indigo-500/30 rounded-t transition-all hover:bg-indigo-500/50"
                  style={{ height: `${Math.max(height, 10)}%` }}
                  title={`${point.date}: ${point.stability.toFixed(1)}d`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>{data.stabilityHistory[0]?.date || ''}</span>
            <span>{data.stabilityHistory[data.stabilityHistory.length - 1]?.date || ''}</span>
          </div>
        </div>
      )}

      {/* Review Button */}
      {isDue && onReviewNow && (
        <div className="p-4 bg-slate-900/50 border-t border-slate-700">
          <button
            onClick={onReviewNow}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 
              text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
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
    lastReview: progress.reviewHistory?.length
      ? new Date(progress.reviewHistory[progress.reviewHistory.length - 1].date)
      : undefined,
    stabilityHistory:
      progress.reviewHistory?.map((r) => ({
        date: new Date(r.date).toLocaleDateString(),
        stability: r.stability,
      })) || [],
  };
}

export default FSRSInsightCard;
