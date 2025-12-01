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
  masteryScore: number;   // normalized 0-1
  changeFromLastPeriod?: number; // percentage change
}

interface SystemComparisonProps {
  summary: SystemMasterySummary[];
  onSystemClick?: (system: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const SYSTEM_COLORS: Record<string, string> = {
  CV: 'bg-red-500',
  PULM: 'bg-sky-500',
  GI: 'bg-amber-500',
  NEURO: 'bg-purple-500',
  MSK: 'bg-orange-500',
  DERM: 'bg-pink-500',
  HEME: 'bg-rose-500',
  ENDO: 'bg-teal-500',
  HEENT: 'bg-indigo-500',
  RENAL: 'bg-blue-500',
  REPRO: 'bg-fuchsia-500',
  PSYCH: 'bg-violet-500',
  ID: 'bg-emerald-500',
  GU: 'bg-cyan-500',
  PRO: 'bg-slate-500',
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

const SystemComparison: React.FC<SystemComparisonProps> = ({ 
  summary,
  onSystemClick,
}) => {
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
    <div className="p-4 bg-[var(--color-glass-bg)] backdrop-blur-sm rounded-xl border border-[var(--color-glass-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Performance by System
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('bar')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'bar' 
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' 
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
            title="Bar chart view"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('radar')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'radar' 
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' 
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
            title="Radar chart view"
          >
            <Radar className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Lowest performer callout */}
      {lowestSystem && lowestSystem.questionsAnswered > 0 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-[var(--color-text-primary)]">
              <strong>{SYSTEM_NAMES[lowestSystem.system] || lowestSystem.system}</strong> needs the most work ({(lowestSystem.masteryScore * 100).toFixed(0)}%)
            </span>
            {lowestSystem.changeFromLastPeriod !== undefined && (
              <span className={`ml-auto flex items-center gap-0.5 text-xs font-medium ${
                lowestSystem.changeFromLastPeriod > 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {lowestSystem.changeFromLastPeriod > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {lowestSystem.changeFromLastPeriod > 0 ? '+' : ''}{lowestSystem.changeFromLastPeriod.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Bar Chart View */}
      {viewMode === 'bar' && (
        <div className="space-y-3">
          {sortedSummary.map((item) => {
            const colorClass = SYSTEM_COLORS[item.system] || 'bg-slate-500';
            const systemName = SYSTEM_NAMES[item.system] || item.system;
            const percentage = item.masteryScore * 100;
            
            return (
              <button
                key={item.system}
                onClick={() => handleSystemClick(item.system)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                      {item.system}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {systemName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.changeFromLastPeriod !== undefined && (
                      <span className={`flex items-center gap-0.5 text-xs ${
                        item.changeFromLastPeriod > 0 
                          ? 'text-green-500' 
                          : item.changeFromLastPeriod < 0
                          ? 'text-red-500'
                          : 'text-[var(--color-text-muted)]'
                      }`}>
                        {item.changeFromLastPeriod > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : item.changeFromLastPeriod < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : null}
                        {item.changeFromLastPeriod > 0 ? '+' : ''}{item.changeFromLastPeriod.toFixed(0)}%
                      </span>
                    )}
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colorClass} transition-all duration-300 group-hover:opacity-80`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {item.questionsAnswered} questions answered
                </div>
              </button>
            );
          })}
        </div>
      )}
      
      {/* Radar Chart View (Simplified CSS-based) */}
      {viewMode === 'radar' && (
        <div className="flex items-center justify-center py-8">
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
              const colorClass = SYSTEM_COLORS[item.system] || 'bg-slate-500';
              
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
  const systems = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];
  
  return systems.map(system => ({
    system,
    questionsAnswered: Math.floor(Math.random() * 100) + 10,
    masteryScore: 0.3 + Math.random() * 0.6,
    changeFromLastPeriod: Math.random() > 0.5 ? (Math.random() * 20 - 5) : undefined,
  }));
}
