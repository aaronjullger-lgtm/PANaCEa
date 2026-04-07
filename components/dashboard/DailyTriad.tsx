import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { Sparkles, RefreshCw, ShieldCheck, BookOpen, Flame, Check } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { ClinicalSkeleton } from '@/components/loading';
import { fetchDailyTriad, markTriadReviewed, type DailyTriad } from '@/services/domain';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const triadFetcher = () => fetchDailyTriad();

function TriadBadge({ type }: { type: DailyTriad['type'] }) {
  const isGold = type === 'gold_standard';
  return (
    <span
      className={`px-3 py-1 text-xs font-semibold rounded-full border ${
        isGold
          ? 'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)] border-[var(--color-data-provisional)]/40'
          : 'bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)] border-[var(--color-data-pass)]/40'
      }`}
    >
      {isGold ? 'Gold Standard' : 'Clinical Pearl'}
    </span>
  );
}

function BuzzwordPills({ buzzwords }: { buzzwords: string[] }) {
  const pills = buzzwords.slice(0, 3);
  if (!pills.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {pills.map((word) => (
        <span key={word} className="text-xs text-[var(--color-text-muted)]" aria-hidden>
          {word}
        </span>
      ))}
    </div>
  );
}

function TriadSkeleton() {
  return (
    <div className="bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] rounded-2xl p-5 border border-[var(--color-border)] shadow-xl">
      <ClinicalSkeleton lines={4} className="min-h-[170px]" />
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 10 }}
      animate={{ y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
      className="bg-gradient-to-br from-[var(--color-data-fail)]/40 to-[var(--color-data-fail)]/30 rounded-2xl p-5 border border-[var(--color-data-fail)]/30 shadow-xl text-[var(--color-text-primary)]"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-data-fail)]">
            The Daily Triad
          </p>
          <h3 className="text-lg font-semibold mt-2 text-[var(--color-text-primary)]">
            Unable to load
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            We couldn't fetch a gold standard or clinical pearl. Try again in a moment.
          </p>
        </div>
        <RefreshCw className="w-5 h-5 text-[var(--color-data-fail)]" aria-hidden="true" />
      </div>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 px-3 py-2 min-h-[36px] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/70 rounded-lg text-sm font-semibold text-[var(--color-text-primary)] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" /> Retry
      </button>
    </motion.div>
  );
}

export default function DailyTriadCard() {
  const { getToken } = useAuth();
  const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);
  const [markError, setMarkError] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<DailyTriad>(
    '/api/dashboard/daily-triad',
    triadFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const handleMarkReviewed = useCallback(async () => {
    try {
      setIsMarkingReviewed(true);
      setMarkError(false);
      const token = await getToken();
      if (token) {
        await markTriadReviewed(token);
      }
    } catch {
      setMarkError(true);
      // Auto-clear error after 3 seconds
      setTimeout(() => setMarkError(false), 3000);
    } finally {
      setIsMarkingReviewed(false);
    }
  }, [getToken]);

  const prefersReducedMotion = useReducedMotion();

  if (isLoading) return <TriadSkeleton />;
  if (error || !data) return <ErrorCard onRetry={() => mutate()} />;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 12 }}
      animate={{ y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
      whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.01 }}
      className="bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] rounded-2xl p-5 border border-[var(--color-border)] shadow-xl text-[var(--color-text-primary)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
            The Daily Triad
          </p>
          <h3 className="text-xl font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
            <Sparkles className="w-5 h-5 text-[var(--color-data-provisional)]" />
            {data.condition}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {data.highlight}
          </p>
        </div>
        <TriadBadge type={data.type} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[var(--color-data-pass)]" aria-hidden="true" />
          {data.system}
        </span>
        {data.subcategory && (
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
            {data.subcategory}
          </span>
        )}
        {typeof data.panceYield === 'number' && (
          <span className="inline-flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[var(--color-data-provisional)]" aria-hidden="true" />
            Yield <span className="tabular-nums">{data.panceYield}</span>
          </span>
        )}
      </div>

      <BuzzwordPills buzzwords={data.buzzwords} />

      <div className="mt-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            Source: {data.source.toUpperCase()}
          </p>
          {markError && (
            <span className="text-[10px] text-[var(--color-data-fail)]">Couldn't save</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkReviewed}
            disabled={isMarkingReviewed}
            aria-label="Mark triad as reviewed"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 min-h-[36px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 disabled:opacity-50 ${
              markError
                ? 'bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)] hover:bg-[var(--color-data-fail)]/20'
                : 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)] hover:bg-[var(--color-data-pass)]/20'
            }`}
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            {isMarkingReviewed ? 'Saving...' : markError ? 'Retry' : 'Reviewed'}
          </button>
          <button
            onClick={() => mutate()}
            aria-label="Shuffle for a different triad"
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 min-h-[36px] rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/70 text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Shuffle
          </button>
        </div>
      </div>
    </motion.div>
  );
}
