import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { Sparkles, Gauge, Clock, TrendingUp, Activity } from 'lucide-react';
import type { PerformanceRecord, SystemCode } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';

interface AnalyticsDashboardProps {
  performanceData: PerformanceRecord[];
}

type SystemRadarDatum = { system: string; accuracy: number; attempts: number };
type TrendDatum = { label: string; accuracy: number; pace: number };

type TimeDatum = { system: string; seconds: number; accuracy: number };

function calculateReadinessScore(records: PerformanceRecord[]): number {
  if (!records.length) return 0;
  const correct = records.filter((r) => r.isCorrect).length;
  const accuracy = correct / records.length;
  const uniqueSystems = new Set(records.map((r) => r.system).filter(Boolean));
  const coverage = uniqueSystems.size / Object.keys(ABBREVIATION_TO_TOPIC_MAP).length;
  // Weighted blend: 70% accuracy, 30% coverage
  return Math.round((accuracy * 0.7 + coverage * 0.3) * 100);
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ performanceData }) => {
  const radarData: SystemRadarDatum[] = useMemo(() => {
    const map = new Map<SystemCode, { correct: number; total: number }>();
    performanceData.forEach((r) => {
      if (!r.system) return;
      const existing = map.get(r.system as SystemCode) || { correct: 0, total: 0 };
      map.set(r.system as SystemCode, {
        correct: existing.correct + (r.isCorrect ? 1 : 0),
        total: existing.total + 1,
      });
    });
    return Array.from(map.entries()).map(([system, stats]) => ({
      system: ABBREVIATION_TO_TOPIC_MAP[system] || system,
      accuracy: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
      attempts: stats.total,
    }));
  }, [performanceData]);

  const readinessScore = useMemo(() => calculateReadinessScore(performanceData), [performanceData]);

  const trendData: TrendDatum[] = useMemo(() => {
    const sorted = [...performanceData].sort((a, b) => a.timestamp - b.timestamp);
    const buckets: TrendDatum[] = [];
    const bucketSize = Math.max(1, Math.floor(sorted.length / 8));
    for (let i = 0; i < sorted.length; i += bucketSize) {
      const slice = sorted.slice(i, i + bucketSize);
      if (!slice.length) continue;
      const correct = slice.filter((r) => r.isCorrect).length;
      const avgTime = slice.reduce((sum, r) => sum + (r.timeSpentMs || 0), 0) / slice.length;
      buckets.push({
        label: new Date(slice[slice.length - 1].timestamp).toLocaleDateString(),
        accuracy: Math.round((correct / slice.length) * 100),
        pace: Math.round(avgTime / 1000),
      });
    }
    return buckets;
  }, [performanceData]);

  const timeData: TimeDatum[] = useMemo(() => {
    const map = new Map<SystemCode, { time: number; count: number; correct: number }>();
    performanceData.forEach((r) => {
      if (!r.system || r.timeSpentMs == null) return;
      const existing = map.get(r.system as SystemCode) || { time: 0, count: 0, correct: 0 };
      map.set(r.system as SystemCode, {
        time: existing.time + r.timeSpentMs!,
        count: existing.count + 1,
        correct: existing.correct + (r.isCorrect ? 1 : 0),
      });
    });
    return Array.from(map.entries()).map(([system, stats]) => ({
      system: ABBREVIATION_TO_TOPIC_MAP[system] || system,
      seconds: Math.round(stats.time / stats.count / 1000),
      accuracy: Math.round((stats.correct / stats.count) * 100),
    }));
  }, [performanceData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
            <Sparkles className="w-4 h-4" /> Exam Readiness
          </div>
          <div className="flex items-center gap-3 mt-3">
            <Gauge className="w-10 h-10 text-[var(--color-accent)]" />
            <div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {readinessScore}%
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                Weighted blend of accuracy + coverage
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
            <TrendingUp className="w-4 h-4" /> Recent Accuracy
          </div>
          <div className="text-3xl font-bold text-[var(--color-text-primary)] mt-3">
            {(trendData?.at(-1)?.accuracy ?? 0)}%
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Last {trendData.length} sessions</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
            <Clock className="w-4 h-4" /> Avg Decision Time
          </div>
          <div className="text-3xl font-bold text-[var(--color-text-primary)] mt-3">
            {timeData.length
              ? `${Math.round(timeData.reduce((s: number, t: TimeDatum) => s + t.seconds, 0) / timeData.length)}s`
              : '—'}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Per question across tracked systems
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-3">
            <Activity className="w-4 h-4" /> System Radar (Accuracy)
          </div>
          {radarData.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} outerRadius={120}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="system"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                />
                <Radar
                  name="Accuracy"
                  dataKey="accuracy"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-3">
            <TrendingUp className="w-4 h-4" /> Accuracy & Pace Trend
          </div>
          {trendData.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Start a session to see trends.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                  domain={[0, 100]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                />
                <Tooltip />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Accuracy (%)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="pace"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  name="Pace (s)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-3">
          <Clock className="w-4 h-4" /> Decision Time by System
        </div>
        {timeData.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Time tracking will appear once you complete timed sessions.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="system"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                interval={0}
                angle={-20}
                height={60}
              />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="seconds" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Avg seconds" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
