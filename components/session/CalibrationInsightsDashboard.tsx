/**
 * Calibration Insights Dashboard (Sprint 10)
 *
 * Student-facing component surfacing FSRS retrievability calibration:
 * - Predicted vs actual recall calibration chart
 * - Rolling-window drift indicator (Sprint 8)
 * - Per-system calibration breakdown
 * - Circadian performance phases (Sprint 9)
 *
 * Data is fetched from /api/study/calibration-insights.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sun,
  Cloud,
  Moon,
  Star,
  BarChart3,
  Activity,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface CalibrationBin {
  predictedCenter: number;
  actualRecallRate: number;
  count: number;
  calibrationRatio: number;
}

interface DriftData {
  longWindowFactor: number;
  shortWindowFactor: number;
  drift: number;
  isDrifting: boolean;
  direction: 'improving' | 'degrading' | 'stable';
}

interface CircadianPhaseData {
  phase: string;
  reviewCount: number;
  recallRate: number;
  optimized: boolean;
}

interface SystemCalibration {
  system: string;
  factor: number;
  reviewCount: number;
}

interface InsightsData {
  bins: CalibrationBin[];
  globalFactor: number;
  drift: DriftData;
  circadianPhases: CircadianPhaseData[];
  systemCalibrations: SystemCalibration[];
  totalReviews: number;
  lastUpdated: string;
}

// ─── Sub-components ─────────────────────────────────────────────

function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  if (bins.length === 0 || bins.every(b => b.count < 10)) {
    return (
      <p className="text-sm text-muted-foreground italic py-4">
        Not enough review data yet. Keep studying to unlock calibration.
      </p>
    );
  }

  const maxCount = Math.max(...bins.map(b => b.count));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>Predicted</span>
        <span>Actual Recall</span>
      </div>
      {bins.filter(b => b.count >= 10).map((bin, i) => {
        const predictedPct = (bin.predictedCenter * 100).toFixed(0);
        const actualPct = (bin.actualRecallRate * 100).toFixed(0);
        const barWidth = Math.max(5, (bin.count / maxCount) * 100);
        const isCalibrated = Math.abs(bin.calibrationRatio - 1.0) < 0.15;
        const barColor = isCalibrated
          ? 'bg-[var(--color-data-pass)]'
          : bin.calibrationRatio > 1 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-data-provisional)]';

        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-10 text-right text-muted-foreground">{predictedPct}%</span>
            <div className="flex-1 h-3.5 bg-muted rounded overflow-hidden relative">
              <div
                className={`h-full ${barColor} rounded transition-all duration-500`}
                style={{ width: `${barWidth}%` }}
              />
              <div
                className="absolute top-0 h-full w-px bg-foreground/30"
                style={{ left: `${bin.predictedCenter * 100}%` }}
              />
            </div>
            <span className="w-10 text-foreground">{actualPct}%</span>
            <span className="w-8 text-muted-foreground text-right">{bin.count}</span>
          </div>
        );
      })}
      <div className="flex gap-3 text-xs text-muted-foreground mt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-[var(--color-data-pass)]" /> Calibrated
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-[var(--color-accent)]" /> Under-predicted
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-[var(--color-data-provisional)]" /> Over-predicted
        </span>
      </div>
    </div>
  );
}

function DriftIndicator({ drift }: { drift: DriftData }) {
  const Icon = drift.isDrifting
    ? drift.direction === 'improving' ? TrendingUp : TrendingDown
    : Minus;

  const statusColor = drift.isDrifting
    ? drift.direction === 'improving' ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'
    : 'text-muted-foreground';

  const label = drift.isDrifting
    ? drift.direction === 'improving'
      ? 'Your recall is improving recently'
      : 'Your recall has dipped recently'
    : 'Recall is stable';

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
      <Icon className={`w-6 h-6 ${statusColor}`} />
      <div>
        <p className={`text-sm font-medium ${statusColor}`}>{label}</p>
        <p className="text-xs text-muted-foreground">
          Recent: {(drift.shortWindowFactor * 100).toFixed(0)}%
          {' | '}Historical: {(drift.longWindowFactor * 100).toFixed(0)}%
        </p>
      </div>
    </div>
  );
}

function CircadianPhases({ phases }: { phases: CircadianPhaseData[] }) {
  const phaseIcons: Record<string, React.ReactNode> = {
    morning: <Sun className="w-4 h-4 text-[var(--color-data-provisional)]" />,
    afternoon: <Cloud className="w-4 h-4 text-[var(--color-data-provisional)]" />,
    evening: <Moon className="w-4 h-4 text-[var(--color-accent)]" />,
    night: <Star className="w-4 h-4 text-[var(--color-text-muted)]" />,
  };

  const bestPhase = phases.reduce((best, p) =>
    p.recallRate > (best?.recallRate ?? 0) ? p : best,
    phases[0],
  );

  return (
    <div className="space-y-2">
      {phases.map(p => (
        <div key={p.phase} className="flex items-center gap-2">
          <span className="w-5">{phaseIcons[p.phase]}</span>
          <span className="text-sm text-foreground w-20 capitalize">{p.phase}</span>
          <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${
                p.phase === bestPhase?.phase ? 'bg-[var(--color-data-pass)]' : 'bg-[var(--color-accent)]'
              }`}
              style={{ width: `${p.recallRate * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-20 text-right">
            {(p.recallRate * 100).toFixed(0)}% ({p.reviewCount})
          </span>
        </div>
      ))}
      {bestPhase && (
        <p className="text-xs text-muted-foreground mt-1">
          Best performance:{' '}
          <span className="text-[var(--color-data-pass)] capitalize">{bestPhase.phase}</span>
          {bestPhase.phase === 'morning' && ' — consistent with cortisol-driven encoding peaks'}
          {bestPhase.phase === 'evening' && ' — you may benefit from pre-sleep consolidation'}
        </p>
      )}
    </div>
  );
}

function SystemBreakdown({ systems }: { systems: SystemCalibration[] }) {
  if (systems.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {systems.map(s => {
        const deviation = Math.abs(s.factor - 1.0);
        const color = deviation < 0.1
          ? 'text-[var(--color-data-pass)]'
          : deviation < 0.2 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]';
        return (
          <div key={s.system} className="flex justify-between text-sm">
            <span className="text-foreground">{s.system}</span>
            <span className={color}>
              {s.factor > 1 ? '+' : ''}{((s.factor - 1) * 100).toFixed(0)}%
              <span className="text-muted-foreground ml-1">({s.reviewCount})</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function CalibrationInsightsDashboard() {
  const { getToken } = useAuth();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchInsights() {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setError('Not authenticated');
            setLoading(false);
          }
          return;
        }
        const res = await fetch('/api/study/calibration-insights', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data?: InsightsData } | InsightsData | null;
        const normalized = json && typeof json === 'object' && 'data' in json
          ? json.data ?? null
          : json;
        if (!cancelled) setData(normalized as InsightsData | null);
      } catch (err: any) {
        console.warn('[CalibrationInsightsDashboard] Fetch failed', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchInsights();
    return () => { cancelled = true; };
  }, [getToken]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-[var(--color-data-fail)]">
        Unable to load calibration insights: {error}
      </div>
    );
  }

  if (!data || data.totalReviews < 50) {
    return (
      <div className="p-4 text-sm text-muted-foreground italic">
        Complete at least 50 reviews to unlock calibration insights.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
          <Activity className="w-5 h-5" /> Calibration Insights
        </h3>
        <p className="text-xs text-muted-foreground">
          How well FSRS predicts your recall — based on {data.totalReviews.toLocaleString()} reviews
        </p>
      </div>

      <DriftIndicator drift={data.drift} />

      <div>
        <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-2">
          <BarChart3 className="w-4 h-4" /> Predicted vs Actual Recall
        </h4>
        <CalibrationChart bins={data.bins} />
      </div>

      {data.circadianPhases.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">
            Study Time Performance
          </h4>
          <CircadianPhases phases={data.circadianPhases} />
        </div>
      )}

      {data.systemCalibrations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">
            By Body System
          </h4>
          <SystemBreakdown systems={data.systemCalibrations} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Last updated: {new Date(data.lastUpdated).toLocaleDateString()}
      </p>
    </div>
  );
}
