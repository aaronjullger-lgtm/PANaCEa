import React from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { Sparkles, RefreshCw, ShieldCheck, BookOpen, Flame } from 'lucide-react';
import { ClinicalSkeleton } from '../ui/ClinicalSkeleton';
import { fetchDailyTriad, type DailyTriad } from '@/services/domain';

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
        <span
          key={word}
          className="text-xs px-2 py-1 rounded-full bg-[var(--color-bg-tertiary)]/50 text-[var(--color-text-muted)] border border-[var(--color-border)]"
        >
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[var(--color-data-fail)]/40 to-[var(--color-data-fail)]/30 rounded-2xl p-5 border border-[var(--color-data-fail)]/30 shadow-xl text-[var(--color-text-primary)]"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-data-fail)]">The Daily Triad</p>
          <h3 className="text-lg font-semibold mt-2 text-[var(--color-text-primary)]">Unable to load</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            We couldn't fetch a gold standard or clinical pearl. Try again in a moment.
          </p>
        </div>
        <RefreshCw className="w-5 h-5 text-[var(--color-data-fail)]" />
      </div>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/70 rounded-lg text-sm font-semibold text-[var(--color-text-primary)]"
      >
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </motion.div>
  );
}

export default function DailyTriadCard() {
  const { data, error, isLoading, mutate } = useSWR<DailyTriad>(
    '/api/dashboard/daily-triad',
    triadFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  if (isLoading) return <TriadSkeleton />;
  if (error || !data) return <ErrorCard onRetry={() => mutate()} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] rounded-2xl p-5 border border-[var(--color-border)] shadow-xl text-[var(--color-text-primary)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-muted)]">The Daily Triad</p>
          <h3 className="text-xl font-semibold flex items-center gap-2 text-[var(--color-text-primary)]">
            <Sparkles className="w-5 h-5 text-[var(--color-data-provisional)]" />
            {data.condition}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{data.highlight}</p>
        </div>
        <TriadBadge type={data.type} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)]">
          <ShieldCheck className="w-4 h-4 text-[var(--color-data-pass)]" />
          {data.system}
        </span>
        {data.subcategory && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)]">
            <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
            {data.subcategory}
          </span>
        )}
        {typeof data.panceYield === 'number' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)]">
            <Flame className="w-4 h-4 text-[var(--color-data-provisional)]" />
            Yield {data.panceYield}
          </span>
        )}
      </div>

      <BuzzwordPills buzzwords={data.buzzwords} />

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">Source: {data.source.toUpperCase()}</p>
        <button
          onClick={() => mutate()}
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/70 text-[var(--color-text-primary)]"
        >
          <RefreshCw className="w-4 h-4" />
          Shuffle
        </button>
      </div>
    </motion.div>
  );
}
