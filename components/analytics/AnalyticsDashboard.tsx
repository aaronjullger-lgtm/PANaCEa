import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { Sparkles, Gauge, Clock, TrendingUp, Activity, AlertCircle, BarChart3, Brain } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import type { PerformanceRecord, SystemCode } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import { SkeletonLoader, SkeletonCard } from '@/components/ui/SkeletonLoader';

interface AnalyticsDashboardProps {
  performanceData: PerformanceRecord[];
  isLoading?: boolean;
}

type SystemRadarDatum = { system: string; accuracy: number; attempts: number };
type TrendDatum = { label: string; accuracy: number; pace: number };
type TimeDatum = { system: string; seconds: number; accuracy: number };
type StabilityTrendDatum = { date: string; avgStability: number; totalReviews: number };

function calculateReadinessScore(records: PerformanceRecord[]): number {
  if (!records.length) return 0;
  const correct = records.filter((r) => r.isCorrect).length;
  const accuracy = correct / records.length;
  const uniqueSystems = new Set(records.map((r) => r.system).filter(Boolean));
  const coverage = uniqueSystems.size / Object.keys(ABBREVIATION_TO_TOPIC_MAP).length;
  // Weighted blend: 70% accuracy, 30% coverage
  return Math.round((accuracy * 0.7 + coverage * 0.3) * 100);
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ performanceData, isLoading = false }) => {
  const { getToken } = useAuth();
  const [stabilityTrendData, setStabilityTrendData] = useState<StabilityTrendDatum[]>([]);
  const [stabilityLoading, setStabilityLoading] = useState(true);
  const [stabilityError, setStabilityError] = useState<string | null>(null);

  // Fetch stability trend on mount
  useEffect(() => {
    const fetchStabilityTrend = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setStabilityLoading(false);
          return;
        }

        const response = await fetch('/api/user/stability-trend?days=30', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stability trend');
        }

        const result = await response.json();
        
        if (result.data && Array.isArray(result.data)) {
          // Format dates for display
          const formattedData = result.data.map((point: any) => ({
            date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            avgStability: point.avgStability,
            totalReviews: point.totalReviews,
          }));
          setStabilityTrendData(formattedData);
        }
      } catch (error) {
        console.error('[AnalyticsDashboard] Failed to fetch stability trend:', error);
        setStabilityError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setStabilityLoading(false);
      }
    };

    fetchStabilityTrend();
  }, [getToken]);

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
    return Array.from(map.entries())
      .map(([system, stats]) => ({
        system: ABBREVIATION_TO_TOPIC_MAP[system] || system,
        accuracy: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
        attempts: stats.total,
      }))
      .sort((a, b) => b.attempts - a.attempts) // Sort by most attempted
      .slice(0, 10); // Show top 10 systems
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
    return Array.from(map.entries())
      .map(([system, stats]) => ({
        system: ABBREVIATION_TO_TOPIC_MAP[system] || system,
        seconds: Math.round(stats.time / stats.count / 1000),
        accuracy: Math.round((stats.correct / stats.count) * 100),
      }))
      .sort((a, b) => b.accuracy - a.accuracy) // Sort by accuracy
      .slice(0, 8); // Top 8 systems
  }, [performanceData]);

  // Find weakest areas (for student context)
  const weakestAreas = useMemo(() => {
    return radarData
      .filter((d) => d.attempts >= 5) // Only include systems with enough data
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);
  }, [radarData]);

  const hasData = performanceData.length > 0;

  // Loading state skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader height="5rem" className="rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonLoader height="20rem" className="rounded-xl" />
          <SkeletonLoader height="20rem" className="rounded-xl" />
        </div>
        <SkeletonLoader height="20rem" className="rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Context Banner for Students */}
      {hasData && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                PANCE Readiness Overview
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Track your progress across all organ systems. Focus on your weakest areas for maximum improvement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-[var(--color-bg-secondary)] rounded-xl">
          <div className="mb-4">
            <BarChart3 className="w-16 h-16 text-[var(--color-text-muted)] opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            No Analytics Data Yet
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] text-center max-w-sm">
            Complete a few practice sessions to see your performance analytics and track your progress.
          </p>
        </div>
      )}

      {/* Stats Grid - Student Context */}
      {hasData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-blue-500/50 transition-colors">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-2">
                <Gauge className="w-4 h-4" /> 
                <span className="font-medium">Exam Readiness</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-bold text-[var(--color-text-primary)]">{readinessScore}%</div>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Based on accuracy ({Math.round((performanceData.filter(r => r.isCorrect).length / performanceData.length) * 100)}%) + coverage
              </p>
            </div>
            
            <div className="p-5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-emerald-500/50 transition-colors">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-2">
                <TrendingUp className="w-4 h-4" /> 
                <span className="font-medium">Recent Performance</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-bold text-[var(--color-text-primary)]">{trendData.at(-1)?.accuracy ?? 0}%</div>
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Last {trendData.length} session{trendData.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="p-5 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-amber-500/50 transition-colors">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-2">
                <Clock className="w-4 h-4" /> 
                <span className="font-medium">Decision Speed</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-bold text-[var(--color-text-primary)]">
                  {timeData.length ? `${Math.round(timeData.reduce((s, t) => s + t.seconds, 0) / timeData.length)}s` : '—'}
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Average per question
              </p>
            </div>
          </div>

          {/* Weakest Subject Areas - Student Priority */}
          {weakestAreas.length > 0 && (
            <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-bold text-amber-900 dark:text-amber-100">
                  Focus Areas - Highest Impact
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {weakestAreas.map((area) => (
                  <div key={area.system} className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                      {area.system}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {area.accuracy}%
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {area.attempts} Q's
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual vs Text Performance Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-3">
                <Activity className="w-4 h-4" /> System Performance Radar
              </div>
              {radarData.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData} outerRadius={120}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="system" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                    <Radar name="Accuracy" dataKey="accuracy" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
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
                    <YAxis yAxisId="left" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={false} name="Accuracy (%)" />
                    <Line yAxisId="right" type="monotone" dataKey="pace" stroke="#6366f1" strokeWidth={2} dot={false} name="Pace (s)" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* FSRS Stability Growth Trend - NEW */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
                <Brain className="w-4 h-4" /> Memory Stability Growth (Last 30 Days)
              </div>
              {stabilityLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-[var(--color-text-muted)]">Fetching data...</span>
                </div>
              )}
            </div>
            {stabilityError ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Error loading stability data: {stabilityError}
              </p>
            ) : stabilityLoading ? (
              <SkeletonLoader width="100%" height={320} />
            ) : stabilityTrendData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[320px] text-center">
                <Brain className="w-12 h-12 text-[var(--color-text-muted)] mb-2 opacity-30" />
                <p className="text-sm text-[var(--color-text-muted)]">
                  Complete questions to track your memory stability growth over time.
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Stability measures how well you retain knowledge.
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={stabilityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} 
                      angle={-20}
                      height={60}
                    />
                    <YAxis 
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} 
                      label={{ value: 'Stability', angle: -90, position: 'insideLeft', style: { fill: 'var(--color-text-muted)' } }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === 'avgStability') return [value.toFixed(2), 'Stability'];
                        return [value, name];
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgStability" 
                      stroke="#8b5cf6" 
                      strokeWidth={3} 
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      name="avgStability"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-900 dark:text-purple-100">
                    <strong>What is Stability?</strong> Stability measures how long you'll remember information. 
                    Higher stability means longer retention and fewer reviews needed. 
                    {stabilityTrendData.length > 1 && (
                      <span className="block mt-1">
                        Your stability has{' '}
                        <strong>
                          {stabilityTrendData[stabilityTrendData.length - 1].avgStability > stabilityTrendData[0].avgStability
                            ? 'increased'
                            : 'remained stable'}
                        </strong>{' '}
                        over the past 30 days.
                      </span>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-3">
              <Clock className="w-4 h-4" /> Decision Time by System
            </div>
            {timeData.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Time tracking will appear once you complete timed sessions.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="system" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} interval={0} angle={-20} height={60} />
                  <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="seconds" fill="#f59e0b" radius={[6,6,0,0]} name="Avg seconds" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
