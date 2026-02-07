/**
 * Rotation Analytics Dashboard
 * Priority 1: Enhanced Rotation Features
 * 
 * Shows rotation-specific performance, progress toward EOR readiness,
 * and identifies weak areas within the current rotation
 */

import React from 'react';
import { TrendingUp, TrendingDown, Target, Calendar, Award } from 'lucide-react';
import type { PerformanceRecord, ClinicalRotation, SystemCode } from '@/types';
import { getSystemsForRotation } from '@/config/rotation-systems';

interface RotationAnalyticsProps {
  currentRotation: ClinicalRotation;
  eorTestDate?: string; // ISO date string
  performanceData: PerformanceRecord[];
  className?: string;
}

export const RotationAnalytics: React.FC<RotationAnalyticsProps> = ({
  currentRotation,
  eorTestDate,
  performanceData,
  className = '',
}) => {
  // Filter to rotation-relevant systems
  const rotationSystems = getSystemsForRotation(currentRotation);
  const rotationPerformance = performanceData.filter(
    (p) => p.system && rotationSystems.includes(p.system as SystemCode)
  );

  // Calculate stats
  const totalQuestions = rotationPerformance.length;
  const correctAnswers = rotationPerformance.filter((p) => p.isCorrect).length;
  const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

  // Calculate per-system breakdown
  const systemStats: Record<string, { correct: number; total: number }> = {};
  rotationPerformance.forEach((p) => {
    const system = p.system || 'Other';
    if (!systemStats[system]) {
      systemStats[system] = { correct: 0, total: 0 };
    }
    systemStats[system].total++;
    if (p.isCorrect) systemStats[system].correct++;
  });

  // Sort by accuracy (weakest first)
  const systemBreakdown = Object.entries(systemStats)
    .map(([system, stats]) => ({
      system,
      accuracy: (stats.correct / stats.total) * 100,
      correct: stats.correct,
      total: stats.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Days until EOR
  const daysUntilEOR = eorTestDate
    ? Math.ceil((new Date(eorTestDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // EOR readiness assessment
  const eorReadiness =
    accuracy >= 80 ? 'excellent' : accuracy >= 70 ? 'good' : accuracy >= 60 ? 'fair' : 'needs-work';

  const readinessConfig = {
    excellent: {
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      label: 'Excellent',
      message: 'You\'re well-prepared for your EOR!',
    },
    good: {
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      label: 'Good',
      message: 'Solid progress. Keep reviewing weak areas.',
    },
    fair: {
      color: 'text-yellow-500',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      label: 'Fair',
      message: 'Focus on weak systems to improve EOR readiness.',
    },
    'needs-work': {
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      label: 'Needs Work',
      message: 'Prioritize daily practice to build confidence.',
    },
  };

  const readiness = readinessConfig[eorReadiness];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          {currentRotation} Rotation
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {rotationSystems.length} organ systems covered in this rotation
        </p>
      </div>

      {/* EOR Countdown */}
      {daysUntilEOR !== null && daysUntilEOR > 0 && (
        <div className={`p-4 rounded-xl border ${readiness.bg} ${readiness.border}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className={`w-5 h-5 ${readiness.color}`} />
              <span className="font-semibold text-[var(--color-text-primary)]">
                EOR Exam in {daysUntilEOR} days
              </span>
            </div>
            <span className={`text-sm font-semibold ${readiness.color}`}>
              {readiness.label} Readiness
            </span>
          </div>
          <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full ${readiness.color.replace('text-', 'bg-')}`}
              style={{ width: `${Math.min(accuracy, 100)}%` }}
            />
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">{readiness.message}</p>
        </div>
      )}

      {/* Overall Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl text-center">
          <div className="text-3xl font-bold text-[var(--color-accent)] mb-1">
            {Math.round(accuracy)}%
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Overall Accuracy</div>
        </div>
        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl text-center">
          <div className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
            {totalQuestions}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Questions Answered</div>
        </div>
        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl text-center">
          <div className="text-3xl font-bold text-green-500 mb-1">
            {systemStats ? Object.keys(systemStats).length : 0}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Systems Practiced</div>
        </div>
      </div>

      {/* System Breakdown */}
      <div className="p-6 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl">
        <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          System Breakdown
        </h3>

        {systemBreakdown.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <p className="mb-2">No rotation questions answered yet</p>
            <p className="text-sm">
              Start a Shift Prep session to begin tracking your rotation performance
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {systemBreakdown.map(({ system, accuracy: sysAccuracy, correct, total }) => {
              const isWeak = sysAccuracy < 70;
              const isStrong = sysAccuracy >= 85;

              return (
                <div key={system} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {system}
                      </span>
                      {isWeak && <TrendingDown className="w-4 h-4 text-red-500" />}
                      {isStrong && <TrendingUp className="w-4 h-4 text-green-500" />}
                    </div>
                    <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                      {Math.round(sysAccuracy)}% ({correct}/{total})
                    </span>
                  </div>
                  <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isWeak
                          ? 'bg-red-500'
                          : isStrong
                            ? 'bg-green-500'
                            : 'bg-[var(--color-accent)]'
                      }`}
                      style={{ width: `${sysAccuracy}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weak Areas Focus */}
      {systemBreakdown.some((s) => s.accuracy < 70) && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <h4 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Focus Areas for EOR Success
          </h4>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
            {systemBreakdown
              .filter((s) => s.accuracy < 70)
              .slice(0, 3)
              .map(({ system }) => (
                <li key={system}>
                  <strong>{system}</strong> - Increase practice time
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RotationAnalytics;
