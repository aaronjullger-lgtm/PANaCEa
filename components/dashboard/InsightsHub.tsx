/**
 * InsightsHub — Student-facing unified insights dashboard
 *
 * Fetches from /api/student/insights and renders:
 *   - Top priority insight card (critical action needed)
 *   - Exam readiness gauge
 *   - System weakness cards with drill buttons
 *   - Improvement/streak badges
 *
 * Sprint 3D — April 2026
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  AlertTriangle, TrendingUp, TrendingDown, Target,
  Flame, Brain, ChevronRight, RefreshCw,
} from 'lucide-react';
import { InlineSpinner } from '@/components/loading';

// ─── Types (mirrors insightGenerationService) ────────────────────────────────

type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info';
type InsightCategory = 'weakness' | 'calibration' | 'readiness' | 'improvement' | 'streak';

interface StudentInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  narrative: string;
  actionLabel?: string;
  actionData?: Record<string, unknown>;
  system?: string;
}
interface ExamReadiness {
  currentScore: number;
  projectedScore: number;
  passingThreshold: number;
  confidence: number;
  trend: 'on_track' | 'at_risk' | 'ahead' | 'insufficient_data';
  daysToExam: number | null;
  weeklyGainRate: number;
}

interface InsightsResponse {
  insights: StudentInsight[];
  examReadiness?: ExamReadiness;
  topPriority: StudentInsight | null;
}

// ─── Severity Styles ─────────────────────────────────────────────────────────

const severityStyles: Record<InsightSeverity, { bg: string; border: string; icon: string }> = {
  critical: { bg: 'bg-[var(--color-data-fail)]/8',        border: 'border-[var(--color-data-fail)]/20',        icon: 'text-[var(--color-data-fail)]' },
  warning:  { bg: 'bg-[var(--color-data-provisional)]/8', border: 'border-[var(--color-data-provisional)]/20', icon: 'text-[var(--color-data-provisional)]' },
  positive: { bg: 'bg-[var(--color-data-pass)]/8',        border: 'border-[var(--color-data-pass)]/20',        icon: 'text-[var(--color-data-pass)]' },
  info:     { bg: 'bg-[var(--color-accent)]/8',            border: 'border-[var(--color-accent)]/20',            icon: 'text-[var(--color-accent)]' },
};

function SeverityIcon({ severity }: { severity: InsightSeverity }) {
  const cls = `w-5 h-5 ${severityStyles[severity].icon}`;
  switch (severity) {
    case 'critical': return <AlertTriangle className={cls} />;
    case 'warning': return <Brain className={cls} />;
    case 'positive': return <TrendingUp className={cls} />;
    case 'info': return <Target className={cls} />;
  }
}
// ─── Sub-Components ──────────────────────────────────────────────────────────

function InsightCard({ insight, onAction }: { insight: StudentInsight; onAction?: (data: Record<string, unknown>) => void }) {
  const style = severityStyles[insight.severity];
  return (
    <div className={`rounded-lg border p-4 ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-3">
        <SeverityIcon severity={insight.severity} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{insight.title}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{insight.narrative}</p>
          {insight.actionLabel && insight.actionData && onAction && (
            <button
              onClick={() => onAction(insight.actionData!)}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:opacity-80"
            >
              {insight.actionLabel}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function ReadinessGauge({ readiness }: { readiness: ExamReadiness }) {
  const { currentScore, projectedScore, passingThreshold, trend, daysToExam, confidence } = readiness;
  const pct = Math.min(100, Math.round((currentScore / 800) * 100));
  const passPct = Math.round((passingThreshold / 800) * 100);

  const trendColors: Record<string, string> = {
    ahead: 'text-[var(--color-data-pass)]',
    on_track: 'text-[var(--color-accent)]',
    at_risk: 'text-[var(--color-data-fail)]',
    insufficient_data: 'text-[var(--color-text-muted)]',
  };

  const trendLabels: Record<string, string> = {
    ahead: 'Ahead of target',
    on_track: 'On track',
    at_risk: 'At risk',
    insufficient_data: 'Gathering data',
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">Exam Readiness</h3>
        <span className={`text-sm font-medium ${trendColors[trend]}`}>{trendLabels[trend]}</span>
      </div>
      {/* Progress bar */}
      <div className="relative h-4 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
        <div
          className={`absolute h-full rounded-full transition-all ${
            trend === 'at_risk' ? 'bg-[var(--color-data-fail)]' : trend === 'ahead' ? 'bg-[var(--color-data-pass)]' : 'bg-[var(--color-accent)]'
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* Passing threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[var(--color-text-primary)]"
          style={{ left: `${passPct}%` }}
          title={`Passing: ${passingThreshold}`}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs text-[var(--color-text-muted)]">
        <span>Current: {currentScore}</span>
        <span>Pass: {passingThreshold}</span>
        <span>Projected: {projectedScore}</span>
      </div>

      {daysToExam != null && (
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          {daysToExam} days to exam · {Math.round(confidence * 100)}% confidence
        </p>
      )}
    </div>
  );
}
// ─── Main Component ──────────────────────────────────────────────────────────

export default function InsightsHub() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/student/insights', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (err) {
      console.warn('[InsightsHub] Fetch failed', err);
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const handleAction = useCallback((actionData: Record<string, unknown>) => {
    // Route-based actions: navigate to the specified route
    if (typeof actionData.route === 'string') {
      navigate(actionData.route);
      return;
    }
    // System-specific drill: navigate to drill with system filter
    if (typeof actionData.system === 'string') {
      navigate(`/study/main-session?system=${encodeURIComponent(actionData.system)}`);
      return;
    }
    // Condition-specific drill: navigate to targeted session
    if (typeof actionData.conditionId === 'string') {
      navigate(`/study/targeted-session?conditions=${encodeURIComponent(actionData.conditionId)}`);
      return;
    }
    console.warn('[InsightsHub] Unhandled action data:', actionData);
  }, [navigate]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-8"
        role="status"
        aria-live="polite"
        aria-label="Loading insights"
      >
        <InlineSpinner size="lg" className="text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center p-6 text-[var(--color-text-muted)]">
        <p>{error ?? 'No insights available'}</p>
        <button onClick={fetchInsights} className="mt-2 text-[var(--color-accent)] text-sm">Retry</button>
      </div>
    );
  }
  const criticalInsights = data.insights.filter(i => i.severity === 'critical' || i.severity === 'warning');
  const positiveInsights = data.insights.filter(i => i.severity === 'positive');
  const infoInsights = data.insights.filter(i => i.severity === 'info');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Study Insights</h2>
        <button onClick={fetchInsights} className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)]" aria-label="Refresh">
          <RefreshCw className="w-4 h-4 text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* Exam Readiness */}
      {data.examReadiness && <ReadinessGauge readiness={data.examReadiness} />}

      {/* Critical / Warning */}
      {criticalInsights.length > 0 && (
        <div className="space-y-2">
          {criticalInsights.map(i => (
            <InsightCard key={i.id} insight={i} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* Positive */}
      {positiveInsights.length > 0 && (
        <div className="space-y-2">
          {positiveInsights.map(i => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}

      {/* Info */}
      {infoInsights.length > 0 && (
        <div className="space-y-2">
          {infoInsights.map(i => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}

      {data.insights.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
          Complete more questions to unlock personalized insights.
        </p>
      )}
    </div>
  );
}
