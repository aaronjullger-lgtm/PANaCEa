/**
 * Timing Metrics Panel
 * 
 * Displays real-time timing analytics during OSCE sessions.
 * Shows efficiency score, question count, and key milestones.
 */

import React from 'react';
import { Clock, TrendingUp, MessageSquare } from 'lucide-react';
import type { TimingMetric } from '@/types/smart-scribe-system';

interface TimingMetricsPanelProps {
  metrics: TimingMetric[];
  sessionStartTime: number;
  questionCount: number;
  efficiencyScore?: number;
  className?: string;
}

export function TimingMetricsPanel({
  metrics,
  sessionStartTime,
  questionCount,
  efficiencyScore,
  className = '',
}: TimingMetricsPanelProps) {
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const criticalMetrics = metrics.filter((m) => m.significance === 'critical');
  const completedMetrics = criticalMetrics.filter((m) => m.status === 'completed');

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Live Analytics
        </h3>
      </div>

      <div className="space-y-3 text-sm">
        {/* Time elapsed */}
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-muted)]">Time Elapsed</span>
          <span className="font-mono font-semibold text-[var(--color-text-primary)]">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Question count */}
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-muted)] flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            Questions Asked
          </span>
          <span className="font-semibold text-[var(--color-text-primary)]">
            {questionCount}
          </span>
        </div>

        {/* Efficiency score */}
        {efficiencyScore !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-muted)] flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Efficiency
            </span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {efficiencyScore}%
            </span>
          </div>
        )}

        {/* Critical metrics */}
        {criticalMetrics.length > 0 && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
              Critical Actions
            </div>
            {criticalMetrics.map((metric) => (
              <div key={metric.id} className="flex items-center justify-between py-1">
                <span className="text-[var(--color-text-secondary)] text-xs truncate">
                  {metric.name}
                </span>
                {metric.status === 'completed' ? (
                  <span className="text-xs font-semibold text-emerald-500">
                    {metric.duration}s ✓
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    In progress...
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        Tracking your decision-making efficiency
      </div>
    </div>
  );
}
