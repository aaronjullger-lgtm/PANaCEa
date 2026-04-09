/**
 * System Comparison Component
 *
 * Visualization showing performance by organ system.
 * Supports bar chart and radar/spider chart toggle.
 */

import React, { useState } from 'react';
import { BarChart3, Radar, TrendingUp, TrendingDown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface SystemMasterySummary {
  system: string;
  questionsAnswered: number;
  masteryScore: number; // normalized 0-1
  changeFromLastPeriod?: number; // percentage change
}

interface SystemComparisonProps {
  summary: SystemMasterySummary[];
  onSystemClick?: (system: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

// Using "Stormy Slate" semantic design tokens for organ system colors
const SYSTEM_COLORS: Record<string, string> = {
  CV: 'bg-data-fail', // Cardiovascular - critical system (11% blueprint)
  PULM: 'bg-[var(--color-accent)]', // Pulmonary - primary system (9% blueprint)
  GI: 'bg-data-provisional', // GI - developing focus
  NEURO: 'bg-[var(--color-accent)]/60', // Neurology
  MSK: 'bg-data-provisional', // Musculoskeletal - needs work indicator
  DERM: 'bg-[var(--color-accent)]', // Dermatology
  HEME: 'bg-data-fail', // Hematology
  ENDO: 'bg-[var(--color-accent)]', // Endocrine
  HEENT: 'bg-[var(--color-accent)]', // Head & Neck
  RENAL: 'bg-[var(--color-accent)]/80', // Renal
  REPRO: 'bg-[var(--color-accent)]/60', // Reproductive
  PSYCH: 'bg-[var(--color-accent)]/60', // Psychiatry
  ID: 'bg-data-pass', // Infectious Disease - mastered indicator
  GU: 'bg-[var(--color-accent)]', // Genitourinary
  PRO: 'bg-data-neutral', // Professional Practice
};

const SYSTEM_NAMES: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  NEURO: 'Neurology',
  MSK: 'Musculoskeletal',
  DERM: 'Dermatology',
  HEME: 'Hematology',
  ENDO: 'Endocrine',
  HEENT: 'Head & Neck',
  RENAL: 'Renal',
  REPRO: 'Reproductive',
  PSYCH: 'Psychiatry',
  ID: 'Infectious Disease',
  GU: 'Genitourinary',
  PRO: 'Professional Practice',
};

// ============================================================================
// Component
// ============================================================================

const SystemComparison: React.FC<SystemComparisonProps> = ({ summary, onSystemClick }) => {
  const [viewMode, setViewMode] = useState<'bar' | 'radar'>('bar');

  // Sort by mastery score (lowest first to highlight areas needing work)
  const sortedSummary = [...summary].sort((a, b) => a.masteryScore - b.masteryScore);

  // Find lowest performing system
  const lowestSystem = sortedSummary[0];

  const handleSystemClick = (system: string) => {
    if (onSystemClick) {
      onSystemClick(system);
    }
  };

  return (
    <div className="card-premium-glass card-noise-texture p-5 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-tight text-data-neutral">
          Performance by System
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('bar')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'bar'
                ? 'bg-data-neutral/10 text-data-neutral'
                : 'text-data-neutral hover:text-data-neutral dark:hover:text-data-neutral'
            }`}
            title="Bar chart view"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('radar')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'radar'
                ? 'bg-data-neutral/10 text-data-neutral'
                : 'text-data-neutral hover:text-data-neutral dark:hover:text-data-neutral'
            }`}
            title="Radar chart view"
          >
            <Radar className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lowest performer callout */}
      {lowestSystem && lowestSystem.questionsAnswered > 0 && (
        <div className="mb-4 p-3 bg-data-provisional border border-data-provisional rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-data-provisional" />
            <span className="text-sm text-data-neutral">
              <strong>{SYSTEM_NAMES[lowestSystem.system] || lowestSystem.system}</strong> needs the
              most work ({(lowestSystem.masteryScore * 100).toFixed(0)}%)
            </span>
            {lowestSystem.changeFromLastPeriod !== undefined && (
              <span
                className={`ml-auto flex items-center gap-0.5 text-xs font-medium ${
                  lowestSystem.changeFromLastPeriod > 0 ? 'text-data-pass' : 'text-data-fail'
                }`}
              >
                {lowestSystem.changeFromLastPeriod > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {lowestSystem.changeFromLastPeriod > 0 ? '+' : ''}
                {lowestSystem.changeFromLastPeriod.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bar Chart View - Slim Mode with label above bar */}
      {viewMode === 'bar' && (
        <div className="space-y-4">
          {sortedSummary.map((item) => {
            const colorClass = SYSTEM_COLORS[item.system] || 'bg-data-neutral';
            const systemName = SYSTEM_NAMES[item.system] || item.system;
            const percentage = item.masteryScore * 100;

            return (
              <button
                key={item.system}
                onClick={() => handleSystemClick(item.system)}
                className="w-full text-left group"
              >
                {/* Label above bar */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-data-neutral group-hover:text-data-neutral dark:group-hover:text-data-neutral transition-colors">
                    {systemName}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.changeFromLastPeriod !== undefined && (
                      <span
                        className={`flex items-center gap-0.5 text-xs ${
                          item.changeFromLastPeriod > 0
                            ? 'text-data-pass'
                            : item.changeFromLastPeriod < 0
                              ? 'text-data-fail'
                              : 'text-data-neutral'
                        }`}
                      >
                        {item.changeFromLastPeriod > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : item.changeFromLastPeriod < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : null}
                        {item.changeFromLastPeriod > 0 ? '+' : ''}
                        {item.changeFromLastPeriod.toFixed(0)}%
                      </span>
                    )}
                    <span className="text-xs font-semibold text-data-neutral">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                {/* Slim bar (h-2) */}
                <div className="h-2 bg-data-neutral rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colorClass} transition-all duration-300 group-hover:opacity-80`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Radar Chart View (Simplified CSS-based) — GPU layer for battery drain audit */}
      {viewMode === 'radar' && (
        <div
          className="flex items-center justify-center py-8"
          style={{ transform: 'translateZ(0)' }}
        >
          <div className="relative w-64 h-64">
            {/* Background circles */}
            {[0.25, 0.5, 0.75, 1].map((level, idx) => (
              <div
                key={idx}
                className="absolute inset-0 rounded-full border border-[var(--color-border)]"
                style={{
                  transform: `scale(${level})`,
                  transformOrigin: 'center',
                }}
              />
            ))}

            {/* System labels around the circle */}
            {sortedSummary.slice(0, 8).map((item, idx) => {
              const angle = (idx / 8) * 2 * Math.PI - Math.PI / 2;
              const radius = 140;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <div
                  key={item.system}
                  className="absolute text-xs font-medium text-[var(--color-text-muted)]"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {item.system}
                </div>
              );
            })}

            {/* Data points */}
            {sortedSummary.slice(0, 8).map((item, idx) => {
              const angle = (idx / 8) * 2 * Math.PI - Math.PI / 2;
              const radius = 100 * item.masteryScore;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const colorClass = SYSTEM_COLORS[item.system] || 'bg-data-neutral';

              return (
                <div
                  key={`point-${item.system}`}
                  className={`absolute w-3 h-3 rounded-full ${colorClass} shadow-lg`}
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  title={`${item.system}: ${(item.masteryScore * 100).toFixed(0)}%`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemComparison;

// Generate mock data for development/testing
export function generateMockSystemData(): SystemMasterySummary[] {
  const systems = [
    'CV',
    'PULM',
    'GI',
    'NEURO',
    'MSK',
    'DERM',
    'HEME',
    'ENDO',
    'HEENT',
    'RENAL',
    'REPRO',
    'PSYCH',
    'ID',
    'GU',
  ];

  return systems.map((system) => ({
    system,
    questionsAnswered: Math.floor(Math.random() * 100) + 10,
    masteryScore: 0.3 + Math.random() * 0.6,
    changeFromLastPeriod: Math.random() > 0.5 ? Math.random() * 20 - 5 : undefined,
  }));
}
