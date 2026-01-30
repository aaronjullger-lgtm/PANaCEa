import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { EmptyState } from '../ui/EmptyState';

interface SRSStats {
  dueCount: number;
  totalCards: number;
  retentionRate: number;
  matureCards: number;
}

interface RetentionWidgetProps {
  onReviewClick?: () => void;
}

export function RetentionWidget({ onReviewClick }: RetentionWidgetProps) {
  const [stats, setStats] = useState<SRSStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      loadSRSStats();
    } else {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  const loadSRSStats = async () => {
    try {
      const token = await getToken();
      if (!token) {
        console.warn('[RetentionWidget] No auth token available');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/srs/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load SRS stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[var(--color-bg-primary)] rounded w-1/2" />
          <div className="h-12 bg-[var(--color-bg-primary)] rounded" />
          <div className="h-4 bg-[var(--color-bg-primary)] rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6">
        <EmptyState
          icon={Sparkles}
          title="Start practicing to track memory"
          description="Complete some questions to see your spaced repetition stats and optimize your learning."
          action={onReviewClick ? { label: 'Start Learning', onClick: onReviewClick } : undefined}
          compact
        />
      </div>
    );
  }

  const { dueCount, totalCards, retentionRate, matureCards } = stats;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/80 rounded-2xl p-6 text-white shadow-xl overflow-hidden relative"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-[var(--color-bg-primary)]/10 rounded-full blur-3xl" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-bg-primary)]/20 rounded-lg">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Memory Status</h3>
              <p className="text-white/70 text-xs">Spaced Repetition</p>
            </div>
          </div>

          {dueCount > 0 && (
            <div className="animate-pulse">
              <div className="w-3 h-3 bg-[var(--color-data-provisional)] rounded-full" />
            </div>
          )}
        </div>

        {/* Main Stats */}
        <div className="space-y-4 mb-6">
          {/* Due Now */}
          <div>
            <div className="flex items-end gap-2 mb-1">
              <div className="text-5xl font-bold">{dueCount}</div>
              <div className="text-white/70 text-sm pb-2">due now</div>
            </div>
            {dueCount > 0 && (
              <button
                onClick={onReviewClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-primary)] text-[var(--color-accent)] rounded-lg font-semibold hover:bg-[var(--color-bg-primary)]/90 transition-colors shadow-lg"
              >
                <span>Review Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {dueCount === 0 && (
              <div className="text-white/70 text-sm">All caught up! Great work!</div>
            )}
          </div>

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            {/* Retention Rate */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[var(--color-data-pass)]" />
                <span className="text-xs text-white/70">Retention</span>
              </div>
              <div className="text-2xl font-bold">{retentionRate}%</div>
            </div>

            {/* Mature Cards */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-[var(--color-accent)]" />
                <span className="text-xs text-white/70">Learned</span>
              </div>
              <div className="text-2xl font-bold">{matureCards}</div>
              <div className="text-xs text-white/60">mature cards</div>
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="pt-4 border-t border-white/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">Total Cards</span>
            <span className="font-semibold">{totalCards}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default RetentionWidget;
