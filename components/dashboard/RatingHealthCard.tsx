/**
 * RatingHealthCard — Again/Good distribution health indicator
 *
 * Compact Analytics-tab card showing:
 *   - Overall Again% with health indicator (healthy/warning/critical)
 *   - Weekly trend sparkline (last 8-12 weeks)
 *   - Active anomaly badges
 *
 * Consumes useRatingAudit hook → GET /api/analytics/rating-audit
 *
 * Sprint: Implicit Rating Audit UI — April 2026
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { ClinicalSkeleton } from '@/components/loading';
import type { RatingAuditData, AnomalyLevel, WeeklyTrend } from '@/hooks/useRatingAudit';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RatingHealthCardProps {
  data: RatingAuditData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  className?: string;
}

// ─── Health Styles ────────────────────────────────────────────────────────────

const HEALTH_STYLES: Record<AnomalyLevel, { bg: string; text: string; border: string; label: string }> = {
  healthy:  { bg: 'bg-[var(--color-data-pass)]/10',        text: 'text-[var(--color-data-pass)]',        border: 'border-[var(--color-data-pass)]/20',        label: 'Healthy' },
  warning:  { bg: 'bg-[var(--color-data-provisional)]/10', text: 'text-[var(--color-data-provisional)]', border: 'border-[var(--color-data-provisional)]/20', label: 'Needs Attention' },
  critical: { bg: 'bg-[var(--color-data-fail)]/10',        text: 'text-[var(--color-data-fail)]',        border: 'border-[var(--color-data-fail)]/20',        label: 'Action Needed' },
};

function getOverallHealth(anomalies: RatingAuditData['anomalies']): AnomalyLevel {
  if (anomalies.some(a => a.level === 'critical')) return 'critical';
  if (anomalies.some(a => a.level === 'warning')) return 'warning';
  return 'healthy';
}

// ─── Sparkline (inline SVG) ─────────────────────────────────────────────────

function WeeklySparkline({ trend }: { trend: WeeklyTrend[] }) {
  if (trend.length < 2) return null;

  const values = trend.map(w => w.againPct);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 120;
  const height = 32;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((v - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  // Color based on trend direction
  const isRising = values[values.length - 1] > values[0];

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="shrink-0" aria-hidden="true">
        <polyline
          points={points}
          fill="none"
          stroke={isRising ? 'var(--color-data-provisional)' : 'var(--color-data-pass)'}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
        {trend.length}w trend
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RatingHealthCard({ data, isLoading, error, onRefresh, className = '' }: RatingHealthCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (isLoading) {
    return (
      <div
        className={`bg-[var(--color-bg-secondary)] rounded-xl p-5 ${className}`}
        style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}
      >
        <ClinicalSkeleton lines={3} className="min-h-[120px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={`bg-[var(--color-bg-secondary)] rounded-xl p-5 ${className}`}
        style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}
      >
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <AlertTriangle className="w-4 h-4 text-[var(--color-data-fail)]" />
          <span>Rating audit unavailable</span>
          <button onClick={onRefresh} className="ml-auto text-[var(--color-accent)] text-xs">Retry</button>
        </div>
      </div>
    );
  }

  const health = getOverallHealth(data.anomalies);
  const style = HEALTH_STYLES[health];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
      className={`bg-[var(--color-bg-secondary)] rounded-xl p-5 space-y-4 ${className}`}
      style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
            <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Rating Health</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${style.bg} ${style.text} ${style.border}`}>
            {style.label}
          </span>
          <button
            onClick={onRefresh}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Refresh rating audit"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>

      {/* Again/Good ratio */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-2xl font-semibold text-[var(--color-text-primary)] tabular-nums">
              {data.overall.againPct}%
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Again rate</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-[var(--color-bg-tertiary)]">
            <div
              className="h-full rounded-l-full"
              style={{
                width: `${data.overall.againPct}%`,
                backgroundColor: 'var(--color-data-fail)',
                opacity: 0.7,
              }}
            />
            <div
              className="h-full rounded-r-full"
              style={{
                width: `${data.overall.goodPct}%`,
                backgroundColor: 'var(--color-data-pass)',
                opacity: 0.7,
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-[var(--color-text-muted)]">
            <span>Again: {data.overall.againCount}</span>
            <span>Good: {data.overall.goodCount}</span>
          </div>
        </div>
        <WeeklySparkline trend={data.weeklyTrend} />
      </div>

      {/* Anomaly badges (if any) */}
      {data.anomalies.length > 0 && (
        <div className="space-y-1.5">
          {data.anomalies.slice(0, 3).map((anomaly, i) => {
            const aStyle = HEALTH_STYLES[anomaly.level];
            return (
              <div
                key={anomaly.code}
                className={`flex items-start gap-2 text-xs p-2 rounded-md border ${aStyle.bg} ${aStyle.border}`}
              >
                {anomaly.level === 'critical'
                  ? <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${aStyle.text}`} />
                  : <ShieldCheck className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${aStyle.text}`} />
                }
                <span className="text-[var(--color-text-secondary)]">{anomaly.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer metadata */}
      <p className="text-[10px] text-[var(--color-text-muted)]">
        {data.overall.total} reviews over {data.windowDays} days
      </p>
    </motion.div>
  );
}

export default RatingHealthCard;
