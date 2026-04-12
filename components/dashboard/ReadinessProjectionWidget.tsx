/**
 * ReadinessProjectionWidget.tsx
 *
 * FSRS-based exam readiness projection widget for the dashboard.
 * Shows per-system readiness, forward projection to exam date,
 * projected PANCE score range, and critical system alerts.
 *
 * Powered by readinessProjectionService → Beta-Binomial posteriors,
 * harmonic mean stability, and FSRS v6 forgetting curve projection.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  useReadinessProjection,
  type SystemReadiness,
} from '@/hooks/useReadinessProjection';
import { ExplainabilityTooltip } from '@/components/ui/ExplainabilityTooltip';

// ─── Color Helpers ─────────────────────────────────────────────────────

function readinessColor(r: number): string {
  if (r >= 0.8) return 'var(--color-data-pass)';
  if (r >= 0.65) return 'var(--color-accent)';
  if (r >= 0.5) return 'var(--color-data-provisional)';
  return 'var(--color-data-fail)';
}

function riskBadge(
  level: 'low' | 'moderate' | 'high' | 'critical'
): { label: string; bg: string; text: string } {
  switch (level) {
    case 'low':
      return { label: 'On Track', bg: 'var(--color-data-pass)', text: 'var(--color-data-pass)' };
    case 'moderate':
      return { label: 'Monitor', bg: 'var(--color-accent)', text: 'var(--color-accent)' };
    case 'high':
      return { label: 'At Risk', bg: 'var(--color-data-provisional)', text: 'var(--color-data-provisional)' };
    case 'critical':
      return { label: 'Critical', bg: 'var(--color-data-fail)', text: 'var(--color-data-fail)' };
  }
}

// ─── Skeleton ──────────────────────────────────────────────────────────

function ProjectionSkeleton() {
  return (
    <div className="bg-[var(--color-bg-secondary)]/60 backdrop-blur-xl rounded-2xl p-6 border border-[var(--color-border)]/50 animate-pulse">
      <div className="h-6 bg-[var(--color-bg-tertiary)] rounded-lg w-48 mb-4" />
      <div className="h-16 bg-[var(--color-bg-tertiary)] rounded-xl mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 bg-[var(--color-bg-tertiary)] rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── System Bar ────────────────────────────────────────────────────────

function SystemBar({ sys }: { sys: SystemReadiness }) {
  const pct = Math.round(sys.readiness * 100);
  const projPct = sys.projectedReadiness != null ? Math.round(sys.projectedReadiness * 100) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)] font-medium truncate max-w-[140px]">
          {sys.system}
        </span>
        <span
          className="font-semibold"
          style={{
            color: readinessColor(sys.readiness),
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pct}%{projPct != null && projPct !== pct && (
            <span className="text-[var(--color-text-muted)] ml-1">→ {projPct}%</span>
          )}
        </span>
      </div>
      <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden relative">
        {/* Projected readiness (ghost bar behind) */}
        {projPct != null && projPct < pct && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-30"
            style={{
              width: `${pct}%`,
              backgroundColor: readinessColor(sys.readiness),
            }}
          />
        )}
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: readinessColor(sys.readiness) }}
          initial={{ width: 0 }}
          animate={{ width: `${projPct != null ? Math.min(projPct, pct) : pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ─── Main Widget ───────────────────────────────────────────────────────

interface ReadinessProjectionWidgetProps {
  examDate?: string | null;
  className?: string;
}

export function ReadinessProjectionWidget({
  examDate,
  className = '',
}: ReadinessProjectionWidgetProps) {
  const { data, isLoading, error } = useReadinessProjection(examDate);

  if (isLoading) return <ProjectionSkeleton />;

  if (error) {
    return (
      <div
        className={`bg-[var(--color-bg-secondary)]/60 backdrop-blur-xl rounded-2xl p-6 border border-[var(--color-data-fail)]/30 ${className}`}
      >
        <p className="text-sm text-[var(--color-data-fail)] text-center">
          Unable to load readiness projection
        </p>
      </div>
    );
  }

  if (!data || data.overallReadiness === 0) {
    return (
      <div
        className={`bg-[var(--color-bg-secondary)]/60 backdrop-blur-xl rounded-2xl p-6 border border-[var(--color-border)]/50 ${className}`}
      >
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Readiness Projection
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
          {data?.message ?? 'Start studying to see your readiness projection.'}
        </p>
      </div>
    );
  }

  const badge = riskBadge(data.riskLevel);
  const overallPct = Math.round(data.overallReadiness * 100);
  const projectedPct = Math.round(data.projectedAtExam * 100);
  const { low, mid, high } = data.projectedScoreRange;

  // Sort systems by blueprint weight (highest first), then readiness
  const sortedSystems = [...data.systems].sort((a, b) => {
    const wA = a.blueprintWeight ?? 0;
    const wB = b.blueprintWeight ?? 0;
    if (wB !== wA) return wB - wA;
    return a.readiness - b.readiness;
  });

  return (
    <div
      className={`bg-[var(--color-bg-secondary)]/60 backdrop-blur-xl rounded-2xl p-6 border border-[var(--color-border)]/50 hover:shadow-md transition-shadow duration-300 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" />
          </svg>
          Readiness Projection
          <ExplainabilityTooltip
            formula="FSRS v6 forward projection with Beta-Binomial mastery estimation and harmonic mean stability aggregation. Blueprint-weighted by NCCPA 2025 organ system weights."
          />
        </h3>
        <span
          className="px-3 py-1 text-xs font-medium rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${badge.bg} 15%, transparent)`,
            color: badge.text,
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Score Projection */}
      <div className="text-center mb-4">
        <div className="flex items-baseline justify-center gap-1.5">
          <span
            className="text-4xl font-bold"
            style={{
              color: readinessColor(data.projectedAtExam),
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {mid}
          </span>
          <span className="text-lg text-[var(--color-text-muted)]">/800</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Projected PANCE Score ({low}–{high} range)
        </p>
        {data.daysUntilExam != null && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {data.daysUntilExam} days until exam
          </p>
        )}
      </div>

      {/* Overall Readiness */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
          <span>Current → Projected</span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {overallPct}% → {projectedPct}%
          </span>
        </div>
        <div className="h-2.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: readinessColor(data.projectedAtExam) }}
            initial={{ width: 0 }}
            animate={{ width: `${projectedPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Critical Systems Alert */}
      {data.criticalSystems.length > 0 && (
        <div className="mb-4 p-3 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-xl">
          <p className="text-xs font-medium text-[var(--color-data-fail)]">
            Critical: {data.criticalSystems.join(', ')}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Below 40% readiness — prioritize these systems
          </p>
        </div>
      )}

      {/* Per-System Bars */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          System Readiness
        </h4>
        {sortedSystems.slice(0, 8).map((sys) => (
          <SystemBar key={sys.system} sys={sys} />
        ))}
        {sortedSystems.length > 8 && (
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            +{sortedSystems.length - 8} more systems
          </p>
        )}
      </div>
    </div>
  );
}

export default ReadinessProjectionWidget;
