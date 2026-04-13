/**
 * ErrorPatternWidget — Cognitive bias pattern insights
 *
 * Fetches from GET /api/analytics/error-patterns and displays:
 * - Dominant error pattern with description
 * - Top 3 patterns with frequency bars
 * - Targeted remediation suggestions
 *
 * @see lib/services/errorPatternService.ts
 */

import React from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { useAuth } from '@clerk/clerk-react';
import { AlertTriangle, Brain, RefreshCw, Shield, Lightbulb } from 'lucide-react';
import { ClinicalSkeleton } from '@/components/loading';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface PatternData {
  patterns: {
    totalAnalyzed: number;
    dominantPattern: string | null;
    topPatterns: Array<{
      pattern: string;
      count: number;
      frequency: number;
    }>;
    remediations: Array<{
      pattern: string;
      remediation: string;
      frequency: number;
    }>;
  };
  attemptCount: number;
}

const PATTERN_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ANCHORING: { label: 'Anchoring', color: 'var(--color-data-fail)', icon: AlertTriangle },
  PREMATURE_CLOSURE: { label: 'Premature Closure', color: 'var(--color-data-provisional)', icon: AlertTriangle },
  AVAILABILITY_BIAS: { label: 'Availability Bias', color: 'var(--color-data-neutral)', icon: Brain },
  CONFIRMATION_BIAS: { label: 'Confirmation Bias', color: 'var(--color-accent)', icon: Brain },
  REPRESENTATIVENESS: { label: 'Representativeness', color: 'var(--color-data-pass)', icon: Brain },
  RAPID_GUESS: { label: 'Rapid Guess', color: 'var(--color-data-fail)', icon: AlertTriangle },
  FATIGUE: { label: 'Fatigue', color: 'var(--color-data-provisional)', icon: Shield },
  UNKNOWN: { label: 'Unknown', color: 'var(--color-text-muted)', icon: Brain },
};

function createFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<PatternData> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch error patterns');
    return res.json() as Promise<PatternData>;
  };
}

export default function ErrorPatternWidget() {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const { data, error, isLoading, mutate } = useSWR(
    '/api/analytics/error-patterns',
    createFetcher(getToken),
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
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
        <p className="text-sm text-[var(--color-text-muted)] mb-3">Couldn't load error patterns</p>
        <button
          onClick={() => mutate()}
          className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 mx-auto"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const { patterns } = data;

  if (patterns.totalAnalyzed === 0) {
    return (
      <div className="p-5 text-center">
        <Shield size={24} className="mx-auto mb-2 text-[var(--color-data-pass)]" />
        <p className="text-sm text-[var(--color-text-primary)] font-medium">No Error Patterns Yet</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Complete more questions to see cognitive bias insights
        </p>
      </div>
    );
  }

  const topPatterns = patterns.topPatterns.slice(0, 3);
  const topRemediation = patterns.remediations[0];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain size={18} className="text-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-wide uppercase">
          Error Patterns
        </h3>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">
          {patterns.totalAnalyzed} errors analyzed
        </span>
      </div>

      {/* Pattern bars */}
      <div className="space-y-2">
        {topPatterns.map((tp) => {
          const meta = PATTERN_LABELS[tp.pattern] ?? PATTERN_LABELS['UNKNOWN']!;
          const pct = Math.round(tp.frequency * 100);
          return (
            <div key={tp.pattern}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                  {meta.label}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {tp.count}× ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-bg-primary)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: meta.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top remediation */}
      {topRemediation && (
        <div className="p-3 rounded-xl bg-[var(--color-accent)]/8 border border-[var(--color-accent)]/15">
          <div className="flex items-start gap-2">
            <Lightbulb size={14} className="text-[var(--color-accent)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {topRemediation.remediation}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
