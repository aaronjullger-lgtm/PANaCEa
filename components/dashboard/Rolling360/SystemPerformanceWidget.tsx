/**
 * SystemPerformanceWidget.tsx
 *
 * Displays system-level performance breakdown from Rolling 360 stats.
 * Highlights under-studied systems (deficit > 5% from blueprint).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useRolling360Stats, SystemStats } from '../../../hooks/useRolling360Stats';

// =============================================================================
// PANCE BLUEPRINT TARGETS
// =============================================================================

const BLUEPRINT_TARGETS: Record<string, number> = {
  Cardiovascular: 13,
  Pulmonary: 10,
  Gastrointestinal: 10,
  Musculoskeletal: 10,
  HEENT: 9,
  Reproductive: 8,
  Neurological: 7,
  Psychiatry: 6,
  Endocrine: 6,
  Dermatology: 5,
  Genitourinary: 5,
  Hematology: 3,
  'Infectious Disease': 3,
  Renal: 5,
};

// =============================================================================
// SKELETON
// =============================================================================

function SystemPerformanceSkeleton() {
  return (
    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 animate-pulse">
      <div className="h-6 bg-slate-700 rounded-lg w-48 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 h-4 bg-slate-700 rounded" />
            <div className="flex-1 h-3 bg-slate-700 rounded-full" />
            <div className="w-12 h-4 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SYSTEM ROW
// =============================================================================

interface SystemRowProps {
  system: string;
  stats: SystemStats;
  totalQuestions: number;
  index: number;
}

function SystemRow({ system, stats, totalQuestions, index }: SystemRowProps) {
  const targetPercent = BLUEPRINT_TARGETS[system] || 5;
  const actualPercent = (stats.total / totalQuestions) * 100;
  const deficit = targetPercent - actualPercent;
  const isUnderStudied = deficit > 5;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-3 rounded-xl transition-colors ${
        isUnderStudied ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-700/30'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{system}</span>
          {isUnderStudied && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full">
              Under-Studied
            </span>
          )}
        </div>
        <span
          className={`text-sm font-semibold ${
            stats.accuracy >= 70
              ? 'text-teal-400'
              : stats.accuracy >= 50
                ? 'text-amber-400'
                : 'text-red-400'
          }`}
        >
          {stats.accuracy.toFixed(0)}%
        </span>
      </div>

      {/* Accuracy bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${
            stats.accuracy >= 70
              ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
              : stats.accuracy >= 50
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-red-500 to-pink-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${stats.accuracy}%` }}
          transition={{ duration: 0.6, delay: index * 0.05 }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
        <span>
          {stats.correct}/{stats.total} correct
        </span>
        <span className={deficit > 0 ? 'text-amber-400' : 'text-slate-500'}>
          {actualPercent.toFixed(0)}% / {targetPercent}% target
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface SystemPerformanceWidgetProps {
  className?: string;
  showAll?: boolean;
  maxSystems?: number;
}

export function SystemPerformanceWidget({
  className = '',
  showAll = false,
  maxSystems = 6,
}: SystemPerformanceWidgetProps) {
  const { stats, isLoading, error } = useRolling360Stats();
  const [expanded, setExpanded] = React.useState(false);

  // Loading state
  if (isLoading) {
    return <SystemPerformanceSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div
        className={`bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-red-500/30 ${className}`}
      >
        <p className="text-red-400 text-center">Failed to load system data</p>
      </div>
    );
  }

  // Not yet assessed
  if (!stats || stats.totalInWindow < 10) {
    return (
      <div
        className={`bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 ${className}`}
      >
        <h3 className="text-lg font-semibold text-white mb-4">System Performance</h3>
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="text-slate-400 mb-4">Not yet assessed</p>
          <button
            type="button"
            onClick={() => window.location.assign('/study/main-session')}
            className="px-4 py-2.5 rounded-xl bg-teal-500/90 text-white text-sm font-medium hover:bg-teal-500 transition-colors"
          >
            Take a 10-question diagnostic quiz to unlock this graph
          </button>
        </div>
      </div>
    );
  }

  // Sort systems by weakness (lowest accuracy first)
  const sortedSystems = Object.entries(stats.systemStats)
    .filter(([_, s]) => s.total >= 3) // Need at least 3 questions
    .sort((a, b) => a[1].accuracy - b[1].accuracy);

  const displaySystems = showAll || expanded ? sortedSystems : sortedSystems.slice(0, maxSystems);

  const hasMore = sortedSystems.length > maxSystems;

  // Identify weakest systems
  const weakestCount = stats.weakestSystems?.length || 0;

  return (
    <div
      className={`bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">System Performance</h3>
        {weakestCount > 0 && (
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-sm rounded-full">
            {weakestCount} weak area{weakestCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* System list */}
      <div className="space-y-3">
        {displaySystems.map(([system, sysStats], index) => (
          <SystemRow
            key={system}
            system={system}
            stats={sysStats}
            totalQuestions={stats.totalInWindow}
            index={index}
          />
        ))}
      </div>

      {/* Show more button */}
      {hasMore && !showAll && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          {expanded ? 'Show less' : `Show ${sortedSystems.length - maxSystems} more systems`}
        </button>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-700/50">
        <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-teal-500" />
            <span>Strong (≥70%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Moderate (50-69%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Weak (&lt;50%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemPerformanceWidget;
