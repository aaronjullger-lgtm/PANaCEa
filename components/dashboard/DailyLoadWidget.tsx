/**
 * DailyLoadWidget — Personalized daily study load recommendation
 *
 * Fetches from GET /api/study/daily-load and displays:
 * - Recommended new cards + review cards for today
 * - Current streak and accuracy
 * - Exam countdown if set
 * - System priority ordering
 *
 * @see lib/services/dailyLoadRecommendationService.ts
 */

import React from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { useAuth } from '@clerk/clerk-react';
import { Target, Flame, BookOpen, RefreshCw, Calendar, TrendingUp } from 'lucide-react';
import { ClinicalSkeleton } from '@/components/loading';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface DailyLoadResponse {
  recommendation: {
    recommendedNewCards: number;
    recommendedReviews: number;
    totalRecommended: number;
    capacityUtilization: number;
    message: string;
  };
  systemPriority: Array<{
    system: string;
    priority: number;
    reason: string;
  }>;
  profile: {
    dueReviews: number;
    streak: number;
    accuracy: number;
    daysUntilExam: number | null;
  };
}

function createFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<DailyLoadResponse> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch daily load');
    return res.json() as Promise<DailyLoadResponse>;
  };
}

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-primary)]/60 border border-[var(--color-border)]/50">
      <Icon size={14} className={color} />
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--color-text-primary)] ml-auto">{value}</span>
    </div>
  );
}

export default function DailyLoadWidget() {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const { data, error, isLoading, mutate } = useSWR(
    '/api/study/daily-load',
    createFetcher(getToken),
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  if (isLoading) {
    return (
      <div className="p-5">
        <ClinicalSkeleton lines={4} className="min-h-[140px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 text-center">
        <p className="text-sm text-[var(--color-text-muted)] mb-3">Couldn't load study plan</p>
        <button
          onClick={() => mutate()}
          className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 mx-auto"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const { recommendation: rec, profile } = data;
  const utilizationPct = Math.round(rec.capacityUtilization * 100);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-wide uppercase">
            Today's Study Plan
          </h3>
        </div>
        {profile.daysUntilExam != null && (
          <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)] font-medium">
            <Calendar size={10} className="inline mr-1" />
            {profile.daysUntilExam}d to exam
          </span>
        )}
      </div>

      {/* Main recommendation */}
      <div className="flex items-center gap-4">
        <div className="flex-1 text-center p-3 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
          <div className="text-2xl font-bold text-[var(--color-accent)]">{rec.recommendedReviews}</div>
          <div className="text-xs text-[var(--color-text-muted)]">Reviews</div>
        </div>
        <div className="text-lg text-[var(--color-text-muted)]">+</div>
        <div className="flex-1 text-center p-3 rounded-xl bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/20">
          <div className="text-2xl font-bold text-[var(--color-data-pass)]">{rec.recommendedNewCards}</div>
          <div className="text-xs text-[var(--color-text-muted)]">New Cards</div>
        </div>
        <div className="text-lg text-[var(--color-text-muted)]">=</div>
        <div className="flex-1 text-center p-3 rounded-xl bg-[var(--color-text-primary)]/5 border border-[var(--color-border)]">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{rec.totalRecommended}</div>
          <div className="text-xs text-[var(--color-text-muted)]">Total</div>
        </div>
      </div>

      {/* Capacity bar */}
      <div>
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
          <span>Capacity utilization</span>
          <span>{utilizationPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-bg-primary)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--color-accent)]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(utilizationPct, 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <StatPill icon={Flame} label="Streak" value={profile.streak} color="text-[var(--color-data-provisional)]" />
        <StatPill icon={TrendingUp} label="Accuracy" value={`${profile.accuracy}%`} color="text-[var(--color-data-pass)]" />
        <StatPill icon={BookOpen} label="Due" value={profile.dueReviews} color="text-[var(--color-accent)]" />
      </div>

      {/* Message */}
      <p className="text-xs text-[var(--color-text-muted)] italic">{rec.message}</p>
    </motion.div>
  );
}
