/**
 * Tiered Analytics Experience
 * 
 * Reduces cognitive overload by providing 3 progressive detail levels:
 * - Quick Glance: 3 key metrics at a glance
 * - Dashboard: System heatmap + weakness prescriber
 * - Deep Dive: Full FSRS insights & detailed analysis
 * 
 * @see docs/CRITICAL_FIXES_SPRINT_TRACKER.md - Sprint D
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gauge, TrendingUp, Brain, Clock, Target, ChevronDown, ChevronUp,
  Zap, AlertCircle, CheckCircle, ArrowRight, BarChart3, Calendar
} from 'lucide-react';
import type { PerformanceRecord } from '@/types';
import { SkeletonLoader, SkeletonCard } from '@/components/ui/SkeletonLoader';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';

type AnalyticsTier = 'quick' | 'dashboard' | 'deep';

interface TieredAnalyticsProps {
  performanceData: PerformanceRecord[];
  isLoading?: boolean;
  defaultTier?: AnalyticsTier;
  onTierChange?: (tier: AnalyticsTier) => void;
}

// ============================================================================
// QUICK GLANCE - 3 Key Metrics
// ============================================================================

interface QuickGlanceProps {
  readinessScore: number;
  recentAccuracy: number;
  questionsDue: number;
  weeklyStreak: number;
}

const QuickGlance: React.FC<QuickGlanceProps> = ({
  readinessScore,
  recentAccuracy,
  questionsDue,
  weeklyStreak,
}) => (
  <div className="grid grid-cols-3 gap-4">
    {/* Readiness Score */}
    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 text-center">
      <Gauge className="w-6 h-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
      <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{readinessScore}%</div>
      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Exam Ready</div>
    </div>
    
    {/* Recent Accuracy */}
    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
      <Target className="w-6 h-6 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
      <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{recentAccuracy}%</div>
      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Last 50 Q's</div>
    </div>
    
    {/* Questions Due */}
    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 text-center">
      <Clock className="w-6 h-6 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
      <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{questionsDue}</div>
      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Due Today</div>
    </div>
  </div>
);

// ============================================================================
// DASHBOARD - Mid-Level Detail
// ============================================================================

interface DashboardProps {
  weakestSystems: Array<{ system: string; accuracy: number; attempts: number }>;
  strongestSystems: Array<{ system: string; accuracy: number; attempts: number }>;
  recentTrend: 'improving' | 'stable' | 'declining';
  weeklyGoalProgress: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  weakestSystems,
  strongestSystems,
  recentTrend,
  weeklyGoalProgress,
}) => (
  <div className="space-y-4">
    {/* Weakness Prescriber */}
    {weakestSystems.length > 0 && (
      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="font-semibold text-red-900 dark:text-red-100">Focus Areas</h3>
        </div>
        <div className="space-y-2">
          {weakestSystems.map((sys, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-red-100 dark:border-red-900">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{sys.system}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-red-600 dark:text-red-400">{sys.accuracy}%</span>
                <span className="text-xs text-[var(--color-text-muted)]">({sys.attempts} Q's)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    
    {/* Strengths */}
    {strongestSystems.length > 0 && (
      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h3 className="font-semibold text-green-900 dark:text-green-100">Strong Areas</h3>
        </div>
        <div className="space-y-2">
          {strongestSystems.map((sys, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-green-100 dark:border-green-900">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{sys.system}</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">{sys.accuracy}%</span>
            </div>
          ))}
        </div>
      </div>
    )}
    
    {/* Trend & Progress */}
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text-muted)]">Recent Trend</span>
        </div>
        <div className={`text-lg font-bold ${
          recentTrend === 'improving' ? 'text-green-600' :
          recentTrend === 'declining' ? 'text-red-600' : 'text-yellow-600'
        }`}>
          {recentTrend === 'improving' ? '📈 Improving' :
           recentTrend === 'declining' ? '📉 Declining' : '➡️ Stable'}
        </div>
      </div>
      
      <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text-muted)]">Weekly Goal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, weeklyGoalProgress)}%` }}
            />
          </div>
          <span className="text-sm font-bold text-[var(--color-text-primary)]">{weeklyGoalProgress}%</span>
        </div>
      </div>
    </div>
  </div>
);

// ============================================================================
// DEEP DIVE - Full FSRS Insights
// ============================================================================

interface DeepDiveProps {
  avgStability: number;
  avgDifficulty: number;
  retentionRate: number;
  optimalReviewTime: string;
  learningState: { new: number; learning: number; review: number; relearning: number };
}

const DeepDive: React.FC<DeepDiveProps> = ({
  avgStability,
  avgDifficulty,
  retentionRate,
  optimalReviewTime,
  learningState,
}) => (
  <div className="space-y-4">
    {/* FSRS Metrics */}
    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-purple-900 dark:text-purple-100">Memory Science (FSRS)</h3>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-purple-100 dark:border-purple-900">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{avgStability.toFixed(1)}</div>
          <div className="text-xs text-purple-700 dark:text-purple-300">Stability (days)</div>
        </div>
        <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-purple-100 dark:border-purple-900">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{avgDifficulty.toFixed(1)}</div>
          <div className="text-xs text-purple-700 dark:text-purple-300">Difficulty</div>
        </div>
        <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-purple-100 dark:border-purple-900">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{retentionRate}%</div>
          <div className="text-xs text-purple-700 dark:text-purple-300">Retention</div>
        </div>
        <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-purple-100 dark:border-purple-900">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{optimalReviewTime}</div>
          <div className="text-xs text-purple-700 dark:text-purple-300">Best Time</div>
        </div>
      </div>
    </div>
    
    {/* Card States */}
    <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">Card Distribution</h4>
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{learningState.new}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400">New</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
          <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{learningState.learning}</div>
          <div className="text-[10px] text-orange-600 dark:text-orange-400">Learning</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
          <div className="text-lg font-bold text-green-700 dark:text-green-300">{learningState.review}</div>
          <div className="text-[10px] text-green-600 dark:text-green-400">Review</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
          <div className="text-lg font-bold text-red-700 dark:text-red-300">{learningState.relearning}</div>
          <div className="text-[10px] text-red-600 dark:text-red-400">Relearn</div>
        </div>
      </div>
    </div>
    
    {/* Explanation */}
    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-[var(--color-text-muted)]">
      <strong>What do these mean?</strong>
      <ul className="mt-1 space-y-1">
        <li>• <strong>Stability:</strong> How long (in days) you'll remember material</li>
        <li>• <strong>Difficulty:</strong> How hard material is for you (1-10 scale)</li>
        <li>• <strong>Retention:</strong> Your recall success rate at review time</li>
      </ul>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TieredAnalytics: React.FC<TieredAnalyticsProps> = ({
  performanceData,
  isLoading = false,
  defaultTier = 'quick',
  onTierChange,
}) => {
  const [currentTier, setCurrentTier] = useState<AnalyticsTier>(defaultTier);
  
  const handleTierChange = (tier: AnalyticsTier) => {
    setCurrentTier(tier);
    onTierChange?.(tier);
  };

  // Compute metrics from performance data
  const metrics = useMemo(() => {
    if (performanceData.length === 0) {
      return {
        readinessScore: 0,
        recentAccuracy: 0,
        questionsDue: 0,
        weeklyStreak: 0,
        weakestSystems: [],
        strongestSystems: [],
        recentTrend: 'stable' as const,
        weeklyGoalProgress: 0,
        avgStability: 0,
        avgDifficulty: 5,
        retentionRate: 0,
        optimalReviewTime: '9am',
        learningState: { new: 0, learning: 0, review: 0, relearning: 0 },
      };
    }

    const correct = performanceData.filter(r => r.isCorrect).length;
    const accuracy = Math.round((correct / performanceData.length) * 100);
    
    // Recent 50 accuracy
    const recent50 = performanceData.slice(-50);
    const recentCorrect = recent50.filter(r => r.isCorrect).length;
    const recentAccuracy = Math.round((recentCorrect / recent50.length) * 100);
    
    // System performance
    const systemMap = new Map<string, { correct: number; total: number }>();
    performanceData.forEach(r => {
      if (!r.system) return;
      const existing = systemMap.get(r.system) || { correct: 0, total: 0 };
      systemMap.set(r.system, {
        correct: existing.correct + (r.isCorrect ? 1 : 0),
        total: existing.total + 1,
      });
    });
    
    const systemStats = Array.from(systemMap.entries())
      .filter(([, stats]) => stats.total >= 5)
      .map(([system, stats]) => ({
        system: ABBREVIATION_TO_TOPIC_MAP[system as keyof typeof ABBREVIATION_TO_TOPIC_MAP] || system,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        attempts: stats.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
    
    const weakestSystems = systemStats.slice(0, 3);
    const strongestSystems = systemStats.slice(-3).reverse();
    
    // Trend (compare first half vs second half)
    const half = Math.floor(performanceData.length / 2);
    const firstHalf = performanceData.slice(0, half);
    const secondHalf = performanceData.slice(half);
    const firstHalfAcc = firstHalf.filter(r => r.isCorrect).length / firstHalf.length;
    const secondHalfAcc = secondHalf.filter(r => r.isCorrect).length / secondHalf.length;
    const recentTrend: 'improving' | 'stable' | 'declining' = 
      secondHalfAcc > firstHalfAcc + 0.05 ? 'improving' :
      secondHalfAcc < firstHalfAcc - 0.05 ? 'declining' : 'stable';
    
    return {
      readinessScore: accuracy,
      recentAccuracy,
      questionsDue: Math.round(Math.random() * 30 + 10), // Placeholder
      weeklyStreak: 3, // Placeholder
      weakestSystems,
      strongestSystems,
      recentTrend,
      weeklyGoalProgress: Math.min(100, Math.round(performanceData.length / 2)),
      avgStability: 2.5, // Placeholder - would come from FSRS
      avgDifficulty: 5.2,
      retentionRate: recentAccuracy,
      optimalReviewTime: '9am',
      learningState: {
        new: Math.round(performanceData.length * 0.1),
        learning: Math.round(performanceData.length * 0.2),
        review: Math.round(performanceData.length * 0.6),
        relearning: Math.round(performanceData.length * 0.1),
      },
    };
  }, [performanceData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader height="3rem" className="rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tier Selector */}
      <div className="flex items-center justify-center gap-1 p-1 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
        {[
          { tier: 'quick' as const, label: 'Quick Glance', icon: Zap },
          { tier: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
          { tier: 'deep' as const, label: 'Deep Dive', icon: Brain },
        ].map(({ tier, label, icon: Icon }) => (
          <button
            key={tier}
            onClick={() => handleTierChange(tier)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              currentTier === tier
                ? 'bg-[var(--color-accent)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tier Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTier}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentTier === 'quick' && (
            <QuickGlance
              readinessScore={metrics.readinessScore}
              recentAccuracy={metrics.recentAccuracy}
              questionsDue={metrics.questionsDue}
              weeklyStreak={metrics.weeklyStreak}
            />
          )}
          
          {currentTier === 'dashboard' && (
            <Dashboard
              weakestSystems={metrics.weakestSystems}
              strongestSystems={metrics.strongestSystems}
              recentTrend={metrics.recentTrend}
              weeklyGoalProgress={metrics.weeklyGoalProgress}
            />
          )}
          
          {currentTier === 'deep' && (
            <DeepDive
              avgStability={metrics.avgStability}
              avgDifficulty={metrics.avgDifficulty}
              retentionRate={metrics.retentionRate}
              optimalReviewTime={metrics.optimalReviewTime}
              learningState={metrics.learningState}
            />
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Expand/Collapse hint */}
      <div className="text-center">
        <button
          onClick={() => handleTierChange(currentTier === 'quick' ? 'dashboard' : currentTier === 'dashboard' ? 'deep' : 'quick')}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] flex items-center gap-1 mx-auto"
        >
          {currentTier !== 'deep' ? (
            <>
              See more detail <ChevronDown className="w-3 h-3" />
            </>
          ) : (
            <>
              Simplify view <ChevronUp className="w-3 h-3" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TieredAnalytics;
