/**
 * System Mastery Map Component
 * Sprint 7: Interactive heat map visualization of organ system performance
 *
 * Shows NCCPA blueprint systems with color-coded mastery levels
 * and clickable drill-down for detailed analytics.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Wind,
  Brain,
  Bone,
  Eye,
  Activity,
  Pill,
  Droplet,
  Zap,
  Shield,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  X,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface SystemMasteryData {
  system: string;
  displayName: string;
  accuracy: number; // 0-100
  questionsAnswered: number;
  questionsNeeded: number; // For blueprint coverage
  trend: 'improving' | 'stable' | 'declining';
  blueprintWeight: number; // NCCPA percentage
  lastStudied?: Date;
  weakTopics?: string[];
  strongTopics?: string[];
}

export interface SystemMasteryMapProps {
  data: SystemMasteryData[];
  onSystemClick?: (system: string) => void;
  showLegend?: boolean;
  compact?: boolean;
  isLoading?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SYSTEM_ICONS: Record<string, React.ReactNode> = {
  cardiovascular: <Heart className="h-5 w-5" />,
  pulmonary: <Wind className="h-5 w-5" />,
  neurological: <Brain className="h-5 w-5" />,
  musculoskeletal: <Bone className="h-5 w-5" />,
  heent: <Eye className="h-5 w-5" />,
  gastrointestinal: <Activity className="h-5 w-5" />,
  endocrine: <Pill className="h-5 w-5" />,
  genitourinary: <Droplet className="h-5 w-5" />,
  reproductive: <Users className="h-5 w-5" />,
  dermatology: <Shield className="h-5 w-5" />,
  psychiatry: <Brain className="h-5 w-5" />,
  hematology: <Droplet className="h-5 w-5" />,
  infectious_disease: <Shield className="h-5 w-5" />,
  nephrology: <Droplet className="h-5 w-5" />,
  emergency_medicine: <Zap className="h-5 w-5" />,
};

const getMasteryLevel = (accuracy: number): { level: string; color: string; bgColor: string } => {
  // Using "Stormy Slate" semantic design tokens
  if (accuracy >= 90)
    return {
      level: 'Mastered',
      color: 'text-data-pass dark:text-data-pass',
      bgColor: 'bg-data-pass',
    };
  if (accuracy >= 80)
    return {
      level: 'Proficient',
      color: 'text-[var(--color-accent)]',
      bgColor: 'bg-[var(--color-accent)]',
    };
  if (accuracy >= 70)
    return {
      level: 'Competent',
      color: 'text-action-blue-600 dark:text-action-blue-400',
      bgColor: 'bg-action-blue-500',
    };
  if (accuracy >= 60)
    return {
      level: 'Developing',
      color: 'text-data-provisional dark:text-data-provisional',
      bgColor: 'bg-data-provisional',
    };
  if (accuracy >= 50)
    return {
      level: 'Needs Work',
      color: 'text-muted-amber-600 dark:text-muted-amber-400',
      bgColor: 'bg-muted-amber-500',
    };
  return {
    level: 'Critical',
    color: 'text-data-fail dark:text-data-fail',
    bgColor: 'bg-data-fail',
  };
};

const getHeatColor = (accuracy: number): string => {
  // Using "Stormy Slate" semantic design tokens
  if (accuracy >= 90) return 'bg-data-pass/80 dark:bg-data-pass/70';
  if (accuracy >= 80) return 'bg-[var(--color-accent)]/80';
  if (accuracy >= 70) return 'bg-action-blue-500/80 dark:bg-action-blue-600/80';
  if (accuracy >= 60) return 'bg-data-provisional/80 dark:bg-data-provisional/70';
  if (accuracy >= 50) return 'bg-muted-amber-500/80 dark:bg-muted-amber-600/80';
  return 'bg-data-fail/80 dark:bg-data-fail/70';
};

// =============================================================================
// COMPONENT
// =============================================================================

export function SystemMasteryMap({
  data,
  onSystemClick,
  showLegend = true,
  compact = false,
  isLoading = false,
}: SystemMasteryMapProps) {
  const [selectedSystem, setSelectedSystem] = useState<SystemMasteryData | null>(null);
  const [hoveredSystem, setHoveredSystem] = useState<string | null>(null);

  // Sort by blueprint weight (most important systems first)
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.blueprintWeight - a.blueprintWeight);
  }, [data]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const totalWeight = data.reduce((sum, d) => sum + d.blueprintWeight, 0);
    const weightedAccuracy =
      data.reduce((sum, d) => sum + d.accuracy * d.blueprintWeight, 0) / totalWeight;

    const totalAnswered = data.reduce((sum, d) => sum + d.questionsAnswered, 0);
    const totalNeeded = data.reduce((sum, d) => sum + d.questionsNeeded, 0);

    return {
      weightedAccuracy: Math.round(weightedAccuracy),
      totalAnswered,
      coverage: Math.round((totalAnswered / totalNeeded) * 100),
      masteredSystems: data.filter((d) => d.accuracy >= 80).length,
      criticalSystems: data.filter((d) => d.accuracy < 60).length,
    };
  }, [data]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with overall stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Organ System Mastery
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            {overallStats.masteredSystems}/{data.length} systems at proficiency
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">
            {overallStats.weightedAccuracy}%
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">Weighted Accuracy</p>
        </div>
      </div>

      {/* Heat Map Grid */}
      <div className={`grid ${compact ? 'grid-cols-5' : 'grid-cols-3 md:grid-cols-5'} gap-3`}>
        {sortedData.map((system, index) => {
          const mastery = getMasteryLevel(system.accuracy);
          const heatColor = getHeatColor(system.accuracy);
          const isHovered = hoveredSystem === system.system;
          const coverage = Math.min(100, (system.questionsAnswered / system.questionsNeeded) * 100);

          return (
            <motion.div
              key={system.system}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              onHoverStart={() => setHoveredSystem(system.system)}
              onHoverEnd={() => setHoveredSystem(null)}
              onClick={() => {
                setSelectedSystem(system);
                onSystemClick?.(system.system);
              }}
              className={`
                relative rounded-xl cursor-pointer transition-all overflow-hidden
                ${compact ? 'p-3' : 'p-4'}
                ${heatColor}
                ${isHovered ? 'ring-2 ring-[var(--color-text-inverse)]/40 scale-105' : ''}
              `}
            >
              {/* Coverage overlay */}
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/20"
                style={{ height: `${100 - coverage}%` }}
              />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[var(--color-text-inverse)]/80">
                    {SYSTEM_ICONS[system.system] || <Activity className="h-5 w-5" />}
                  </div>
                  <div className="flex items-center gap-1">
                    {system.trend === 'improving' && (
                      <TrendingUp className="h-3 w-3 text-[var(--color-text-inverse)]" />
                    )}
                    {system.trend === 'declining' && (
                      <TrendingDown className="h-3 w-3 text-[var(--color-text-inverse)]" />
                    )}
                    {system.trend === 'stable' && (
                      <Minus className="h-3 w-3 text-[var(--color-text-inverse)]/60" />
                    )}
                  </div>
                </div>

                <p
                  className={`font-bold text-[var(--color-text-inverse)] ${compact ? 'text-lg' : 'text-xl'}`}
                >
                  {Math.round(system.accuracy)}%
                </p>

                <p
                  className={`text-[var(--color-text-inverse)]/80 truncate ${
                    compact ? 'text-xs' : 'text-sm'
                  }`}
                >
                  {system.displayName}
                </p>

                {!compact && (
                  <p className="text-xs text-[var(--color-text-inverse)]/60 mt-1">
                    {system.questionsAnswered} Qs • {Math.round(system.blueprintWeight * 100)}%
                  </p>
                )}
              </div>

              {/* Blueprint weight indicator */}
              <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-medium bg-black/30 text-[var(--color-text-inverse)]">
                {Math.round(system.blueprintWeight * 100)}%
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-data-pass" />
            <span>≥90% Mastered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[var(--color-accent)]" />
            <span>≥80% Proficient</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-action-blue-500" />
            <span>≥70% Competent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-data-provisional" />
            <span>≥60% Developing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-muted-amber-500" />
            <span>≥50% Needs Work</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-data-fail" />
            <span>&lt;50% Critical</span>
          </div>
        </div>
      )}

      {/* Critical systems alert */}
      {overallStats.criticalSystems > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-data-fail/10 border border-data-fail/30">
          <AlertTriangle className="h-5 w-5 text-data-fail dark:text-data-fail" />
          <p className="text-sm text-data-fail dark:text-data-fail/90">
            {overallStats.criticalSystems} system{overallStats.criticalSystems > 1 ? 's' : ''} below
            60% - prioritize these areas
          </p>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedSystem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setSelectedSystem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[var(--color-bg-primary)] rounded-2xl shadow-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${getHeatColor(selectedSystem.accuracy)}`}>
                    {SYSTEM_ICONS[selectedSystem.system] || (
                      <Activity className="h-6 w-6 text-[var(--color-text-inverse)]" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {selectedSystem.displayName}
                    </h4>
                    <p className={getMasteryLevel(selectedSystem.accuracy).color}>
                      {getMasteryLevel(selectedSystem.accuracy).level}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSystem(null)}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                  <p className="text-xs text-[var(--color-text-muted)]">Accuracy</p>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {Math.round(selectedSystem.accuracy)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                  <p className="text-xs text-[var(--color-text-muted)]">Questions</p>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {selectedSystem.questionsAnswered}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                  <p className="text-xs text-[var(--color-text-muted)]">Blueprint Weight</p>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {Math.round(selectedSystem.blueprintWeight * 100)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                  <p className="text-xs text-[var(--color-text-muted)]">Trend</p>
                  <div className="flex items-center gap-1">
                    {selectedSystem.trend === 'improving' && (
                      <>
                        <TrendingUp className="h-5 w-5 text-data-pass" />
                        <span className="text-data-pass font-medium">Improving</span>
                      </>
                    )}
                    {selectedSystem.trend === 'declining' && (
                      <>
                        <TrendingDown className="h-5 w-5 text-data-fail" />
                        <span className="text-data-fail font-medium">Declining</span>
                      </>
                    )}
                    {selectedSystem.trend === 'stable' && (
                      <>
                        <Minus className="h-5 w-5 text-[var(--color-text-muted)]" />
                        <span className="text-[var(--color-text-muted)] font-medium">Stable</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Coverage progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--color-text-muted)]">Coverage</span>
                  <span className="text-[var(--color-text-primary)]">
                    {selectedSystem.questionsAnswered}/{selectedSystem.questionsNeeded}
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getHeatColor(selectedSystem.accuracy)} transition-all`}
                    style={{
                      width: `${Math.min(100, (selectedSystem.questionsAnswered / selectedSystem.questionsNeeded) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Weak/Strong topics */}
              {selectedSystem.weakTopics && selectedSystem.weakTopics.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Areas to Review:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedSystem.weakTopics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 text-xs rounded bg-data-fail/10 dark:bg-data-fail/20 text-data-fail dark:text-data-fail/90"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedSystem.strongTopics && selectedSystem.strongTopics.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Strengths:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedSystem.strongTopics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 text-xs rounded bg-data-pass/10 dark:bg-data-pass/20 text-data-pass dark:text-data-pass/90"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SystemMasteryMap;
