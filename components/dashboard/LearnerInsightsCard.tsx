/**
 * LearnerInsightsCard — Learner archetype + early warning dashboard widget
 *
 * Fetches from GET /api/analytics/learner-profile and displays:
 * - Assigned learner archetype with confidence
 * - Risk score gauge
 * - Top early warnings with severity + recommendations
 *
 * @see lib/services/learnerClusteringService.ts
 */

import React from 'react';
import useSWR from 'swr';
import { useAuth } from '@clerk/clerk-react';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Shield,
  ShieldAlert,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { ClinicalSkeleton } from '@/components/loading';

interface LearnerProfileResponse {
  archetype: string;
  archetypeConfidence: number;
  riskScore: number;
  warnings: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    recommendation: string;
  }>;
  features: {
    dailyVolume: number;
    accuracy: number;
    spacingRegularity: number;
    systemBreadth: number;
    engagementTrend: 'improving' | 'stable' | 'declining';
  };
}

const ARCHETYPE_META: Record<string, { label: string; description: string; color: string }> = {
  CONSISTENT_REVIEWER: {
    label: 'Consistent Reviewer',
    description: 'Steady daily practice with balanced review load',
    color: 'var(--color-data-pass)',
  },
  CRAMMER: {
    label: 'Crammer',
    description: 'Intense bursts separated by gaps — high volume, low spacing',
    color: 'var(--color-data-provisional)',
  },
  PERFECTIONIST: {
    label: 'Perfectionist',
    description: 'High accuracy but slow pace with narrow system focus',
    color: 'var(--color-accent)',
  },
  DISENGAGING: {
    label: 'Disengaging',
    description: 'Declining activity and engagement — may need intervention',
    color: 'var(--color-data-fail)',
  },
  SPRINTER: {
    label: 'Sprinter',
    description: 'Fast responses, broad coverage, moderate accuracy',
    color: 'var(--color-data-neutral)',
  },
  EXPLORER: {
    label: 'Explorer',
    description: 'Wide system coverage with variable depth',
    color: 'var(--color-accent)',
  },
};

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: React.ElementType }> = {
  critical: { bg: 'bg-[var(--color-data-fail)]/10', border: 'border-[var(--color-data-fail)]/30', icon: ShieldAlert },
  warning: { bg: 'bg-[var(--color-data-provisional)]/10', border: 'border-[var(--color-data-provisional)]/30', icon: AlertTriangle },
  info: { bg: 'bg-[var(--color-accent)]/8', border: 'border-[var(--color-accent)]/15', icon: Activity },
};

function createFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<LearnerProfileResponse> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch learner profile');
    return res.json() as Promise<LearnerProfileResponse>;
  };
}

function RiskGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.6
      ? 'var(--color-data-fail)'
      : score >= 0.3
        ? 'var(--color-data-provisional)'
        : 'var(--color-data-pass)';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[var(--color-bg-primary)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp size={12} className="text-[var(--color-data-pass)]" />;
  if (trend === 'declining') return <TrendingDown size={12} className="text-[var(--color-data-fail)]" />;
  return <Minus size={12} className="text-[var(--color-text-muted)]" />;
}

export default function LearnerInsightsCard() {
  const { getToken } = useAuth();
  const { data, error, isLoading, mutate } = useSWR(
    '/api/analytics/learner-profile',
    createFetcher(getToken),
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  if (isLoading) {
    return (
      <div className="p-5">
        <ClinicalSkeleton lines={5} className="min-h-[180px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 text-center">
        <p className="text-sm text-[var(--color-text-muted)] mb-3">Couldn't load learner profile</p>
        <button
          onClick={() => mutate()}
          className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 mx-auto"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const meta = ARCHETYPE_META[data.archetype] ?? {
    label: data.archetype,
    description: '',
    color: 'var(--color-text-muted)',
  };

  const topWarnings = data.warnings
    .sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
    })
    .slice(0, 3);

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users size={18} className="text-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-wide uppercase">
          Learner Profile
        </h3>
      </div>

      {/* Archetype badge */}
      <div className="flex items-center gap-3">
        <div
          className="px-3 py-1.5 rounded-lg text-sm font-semibold"
          style={{
            backgroundColor: `color-mix(in srgb, ${meta.color} 15%, transparent)`,
            color: meta.color,
            border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)`,
          }}
        >
          <Zap size={12} className="inline mr-1" />
          {meta.label}
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          {Math.round(data.archetypeConfidence * 100)}% match
        </span>
        <TrendIcon trend={data.features.engagementTrend} />
      </div>

      {meta.description && (
        <p className="text-xs text-[var(--color-text-muted)] italic">{meta.description}</p>
      )}

      {/* Risk score */}
      <div>
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
          <span>Risk score</span>
          <span>{data.riskScore === 0 ? 'All clear' : ''}</span>
        </div>
        <RiskGauge score={data.riskScore} />
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs px-2 py-1 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)]/50 text-[var(--color-text-secondary)]">
          {data.features.dailyVolume} Q/day
        </span>
        <span className="text-xs px-2 py-1 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)]/50 text-[var(--color-text-secondary)]">
          {data.features.accuracy}% acc
        </span>
        <span className="text-xs px-2 py-1 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)]/50 text-[var(--color-text-secondary)]">
          {data.features.systemBreadth}% breadth
        </span>
      </div>

      {/* Warnings */}
      {topWarnings.length > 0 && (
        <div className="space-y-2">
          {topWarnings.map((w, i) => {
            const style = SEVERITY_STYLES[w.severity] ?? SEVERITY_STYLES['info']!;
            const WarnIcon = style.icon;
            return (
              <div
                key={`${w.type}-${i}`}
                className={`p-2.5 rounded-lg border ${style.bg} ${style.border}`}
              >
                <div className="flex items-start gap-2">
                  <WarnIcon size={13} className="mt-0.5 shrink-0 opacity-70" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-primary)]">
                      {w.message}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {w.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {topWarnings.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-data-pass)]">
          <Shield size={14} />
          <span>No active warnings — keep it up!</span>
        </div>
      )}
    </div>
  );
}
