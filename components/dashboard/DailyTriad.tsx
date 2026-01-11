import React from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { Sparkles, RefreshCw, ShieldCheck, BookOpen, Flame } from 'lucide-react';
import ClinicalSkeleton from '../ui/ClinicalSkeleton';
import { fetchDailyTriad, type DailyTriad } from '@/services/dailyTriadService';

const triadFetcher = () => fetchDailyTriad();

function TriadBadge({ type }: { type: DailyTriad['type'] }) {
  const isGold = type === 'gold_standard';
  return (
    <span
      className={`px-3 py-1 text-xs font-semibold rounded-full border ${
        isGold
          ? 'bg-amber-500/15 text-amber-200 border-amber-400/40'
          : 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40'
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
          className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/80 border border-white/10"
        >
          {word}
        </span>
      ))}
    </div>
  );
}

function TriadSkeleton() {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-white/10 shadow-xl">
      <ClinicalSkeleton lines={4} className="min-h-[170px]" />
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-rose-900 to-rose-800 rounded-2xl p-5 border border-rose-400/30 shadow-xl text-white"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-rose-200">The Daily Triad</p>
          <h3 className="text-lg font-semibold mt-2">Unable to load</h3>
          <p className="text-sm text-rose-100/80 mt-1">
            We couldn't fetch a gold standard or clinical pearl. Try again in a moment.
          </p>
        </div>
        <RefreshCw className="w-5 h-5 text-rose-200" />
      </div>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm font-semibold"
      >
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </motion.div>
  );
}

export default function DailyTriadCard() {
  const { data, error, isLoading, mutate } = useSWR<DailyTriad>('/api/dashboard/daily-triad', triadFetcher, {
    revalidateOnFocus: false,
  });

  if (isLoading) return <TriadSkeleton />;
  if (error || !data) return <ErrorCard onRetry={() => mutate()} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-white/10 shadow-xl text-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-200/80">The Daily Triad</p>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            {data.condition}
          </h3>
          <p className="text-sm text-slate-100/90 leading-relaxed">
            {data.highlight}
          </p>
        </div>
        <TriadBadge type={data.type} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-200/80">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
          <ShieldCheck className="w-4 h-4 text-emerald-200" />
          {data.system}
        </span>
        {data.subcategory && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
            <BookOpen className="w-4 h-4 text-sky-200" />
            {data.subcategory}
          </span>
        )}
        {typeof data.panceYield === 'number' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
            <Flame className="w-4 h-4 text-orange-200" />
            Yield {data.panceYield}
          </span>
        )}
      </div>

      <BuzzwordPills buzzwords={data.buzzwords} />

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-slate-200/70">Source: {data.source.toUpperCase()}</p>
        <button
          onClick={() => mutate()}
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white"
        >
          <RefreshCw className="w-4 h-4" />
          Shuffle
        </button>
      </div>
    </motion.div>
  );
}
