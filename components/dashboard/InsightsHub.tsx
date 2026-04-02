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
import {
  AlertTriangle, TrendingUp, TrendingDown, Target,
  Flame, Brain, ChevronRight, Loader2, RefreshCw,
} from 'lucide-react';

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
  critical: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600' },
  warning:  { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600' },
  positive: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-600' },
  info:     { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-600' },
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
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{insight.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{insight.narrative}</p>
          {insight.actionLabel && insight.actionData && onAction && (
            <button
              onClick={() => onAction(insight.actionData!)}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
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
    ahead: 'text-emerald-600',
    on_track: 'text-blue-600',
    at_risk: 'text-red-600',
    insufficient_data: 'text-gray-500',
  };

  const trendLabels: Record<string, string> = {
    ahead: 'Ahead of target',
    on_track: 'On track',
    at_risk: 'At risk',
    insufficient_data: 'Gathering data',
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Exam Readiness</h3>
        <span className={`text-sm font-medium ${trendColors[trend]}`}>{trendLabels[trend]}</span>
      </div>
      {/* Progress bar */}
      <div className="relative h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`absolute h-full rounded-full transition-all ${
            trend === 'at_risk' ? 'bg-red-500' : trend === 'ahead' ? 'bg-emerald-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* Passing threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-900 dark:bg-gray-100"
          style={{ left: `${passPct}%` }}
          title={`Passing: ${passingThreshold}`}
        />
      </div>

      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Current: {currentScore}</span>
        <span>Pass: {passingThreshold}</span>
        <span>Projected: {projectedScore}</span>
      </div>

      {daysToExam != null && (
        <p className="text-xs text-gray-500 mt-2">
          {daysToExam} days to exam · {Math.round(confidence * 100)}% confidence
        </p>
      )}
    </div>
  );
}
// ─── Main Component ──────────────────────────────────────────────────────────

export default function InsightsHub() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/student/insights');
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const handleAction = useCallback((actionData: Record<string, unknown>) => {
    // Dispatch navigation or modal based on actionData
    console.log('Insight action:', actionData);
    // TODO: integrate with app navigation
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center p-6 text-gray-500">
        <p>{error ?? 'No insights available'}</p>
        <button onClick={fetchInsights} className="mt-2 text-indigo-600 text-sm">Retry</button>
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
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Study Insights</h2>
        <button onClick={fetchInsights} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <RefreshCw className="w-4 h-4 text-gray-500" />
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
        <p className="text-sm text-gray-500 text-center py-4">
          Complete more questions to unlock personalized insights.
        </p>
      )}
    </div>
  );
}
