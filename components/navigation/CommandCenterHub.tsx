'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RecommendationFeed } from '@/components/dashboard/RecommendationFeed';
import { useUser } from '@clerk/clerk-react';
import {
  Zap,
  Target,
  Brain,
  Stethoscope,
  BarChart3,
  Calculator,
  BookOpen,
  Pill,
  Activity,
  Clock,
  Trophy,
  TrendingUp,
  ChevronRight,
  Play,
  Flame,
  AlertCircle,
  CheckCircle,
  Timer,
  GraduationCap,
  Beaker,
  Layers,
  LucideIcon,
  User,
  FileImage,
  Shield,
  Droplets,
  GitCompare,
  FileCheck,
  Siren,
  Hash,
  Heart,
  Wind,
  Eye,
  MessageSquare,
  Image,
  Scan,
  FlaskConical,
  Headphones,
  FolderTree,
  Sparkles,
} from 'lucide-react';
import type { PerformanceRecord, Question, SessionSettings, SystemCode } from '@/types';
import type { ClinicalRotation } from '@/types';
import { loadUserProfile, updateUserProfile } from '@/services/analytics';
import { getSystemsForRotation, isEorRotation } from '@/config/rotation-systems';
import { RotationSelector } from '@/components/onboarding/RotationSelector';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { DatabaseAnalyticsDashboard } from '@/components/analytics/DatabaseAnalyticsDashboard';
import { LearningProfileDashboard } from '@/components/analytics/LearningProfileDashboard';
import { AdvancedLearningProfileDashboard } from '@/components/analytics/AdvancedLearningProfileDashboard';
import { UserFriendlyStatsDisplay } from '@/components/analytics/UserFriendlyStatsDisplay';
import {
  VISUAL_DIAGNOSTICS_MODES,
  CLINICAL_SIMULATION_MODES,
  QUESTION_PRACTICE_MODES,
  SPECIALTY_DRILL_MODES,
  CATEGORY_INFO,
  STUDY_OUTCOME_GROUPS,
  getModeById,
  type TrainingModeConfig,
  type TrainingCategory,
} from '@/config/training-modes';
import { useUserContext } from '@/hooks/useUserContext';
import { useRolling360Stats } from '@/hooks/useRolling360Stats';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { calculateDayStreak } from '@/lib/dashboardUtils';
import { QuickStatsBarSkeleton } from '@/components/loading';
import { ABBREVIATION_TO_TOPIC_MAP, getSystemDisplayFullName } from '@/src/constants';
import { BodyMapWidget } from '@/components/dashboard/BodyMapWidget';
import { RoundsButton } from '@/components/dashboard/RoundsButton';

// ============================================================================
// Types
// ============================================================================

interface CommandCenterHubProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  growthAreas: string[];
  dueCount?: number;
  examLabel?: string;
  /** When true, show skeleton instead of QuickStatsBar (prevents 0% during load) */
  isLoadingStats?: boolean;
  onStartSession: (settings?: SessionSettings) => void;
  onNavigateToDrillMode: (modeId: string) => void;
  /** Navigate to system drill with a specific system pre-selected (Residency Cockpit) */
  onNavigateToDrillWithSystem?: (modeId: string, system: string) => void;
  onNavigateToToolkit: () => void;
  onNavigateToGapAnalysis: () => void;
  onNavigateToClinicalProfile?: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToSimulation?: (settings?: {
    initialFocus?: 'all' | 'growth' | 'flagged' | 'due';
  }) => void;
  onNavigateToReference?: () => void;
  /** My Library: upload PDFs, set active cache for Tutor */
  onNavigateToMyLibrary?: () => void;
  /** Study Companion: PDF + citations + chat with textbook */
  onNavigateToStudyCompanion?: () => void;
  onNavigateToCustomStudy?: () => void;
  /** Opens Pearl Deck (Rapid Review - saved pearls only) */
  onNavigateToPearlDeck?: () => void;
  /** Clinical Eye: image analysis with code execution */
  onNavigateToClinicalEye?: () => void;
  /** Anatomy Visualizer: Firefly + Gemini segmentation */
  onNavigateToVisualizer?: () => void;
  /** Opens the Settings modal (for Current Curriculum "Change" button) */
  onOpenSettings?: () => void;
  /** Profile-aware Reasoning Tutor chat */
  onNavigateToTutorChat?: () => void;
}

// Icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Zap,
  Target,
  Stethoscope,
  BookOpen,
  Pill,
  Activity,
  Clock,
  Trophy,
  Flame,
  AlertCircle,
  CheckCircle,
  Timer,
  GraduationCap,
  Beaker,
  FileImage,
  Shield,
  Layers,
  Droplets,
  GitCompare,
  FileCheck,
  Siren,
  Hash,
  Heart,
  Wind,
  Eye,
  MessageSquare,
  Image,
  Scan,
  FlaskConical,
  Headphones,
  FolderTree,
  Calculator,
  BarChart3,
  TrendingUp,
  Sparkles,
};

// ============================================================================
// Subcomponents
// ============================================================================

// Grand Rounds Banner (Standalone Daily Challenge)
// Didactic: "Targeted Daily Question" from enabled systems only; Clinical/Pro: Global Grand Rounds
const GrandRoundsBanner: React.FC<{
  onStart: () => void;
  /** When true, show "Targeted Daily Question" and pass targeted flag so mode fetches by enabled systems */
  isDidactic?: boolean;
}> = ({ onStart, isDidactic }) => {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const title = isDidactic ? 'Targeted Daily Question' : 'Grand Rounds';
  const subtitle = isDidactic
    ? 'One question from your current curriculum.'
    : 'Same questions for everyone — daily standardized assessment.';

  const handleStart = () => {
    if (isDidactic) {
      try {
        sessionStorage.setItem('panceai_grand_rounds_targeted', '1');
      } catch {
        /* ignore */
      }
    }
    onStart();
  };

  return (
    <GlassCard variant="warning" hoverable className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-xl bg-muted-amber/20 backdrop-blur-sm">
            <Trophy className="w-6 h-6 text-muted-amber" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted-amber/10 text-muted-amber border border-muted-amber/20">
                Daily Challenge • {dateStr}
              </span>
            </div>
            <p className="text-sm text-slate-300">{subtitle}</p>
          </div>
        </div>

        <PrimaryButton variant="warning" size="md" icon={Play} onClick={handleStart}>
          Start
        </PrimaryButton>
      </div>
    </GlassCard>
  );
};

// Core Adaptive Hero (Main Event)
const CoreAdaptiveHero: React.FC<{
  onStart: () => void;
  accuracy: number | null;
  questionsToday: number;
  examLabel: string;
  /** When true, show "Knowledge Maintenance" / "PANRE-LA Check-in" instead of Core PANCE */
  isPracticing?: boolean;
  /** Sub-label for Start Session (e.g. "Testing: CV, PULM, GI Only") - shown for Didactic users */
  enabledSystemsLabel?: string | null;
  /** Optional label for accuracy (e.g. "Module Accuracy") */
  accuracyLabel?: string;
  /** Weak areas from analytics; when present, show "Focusing on your weak areas: X, Y" */
  growthAreas?: string[];
}> = ({
  onStart,
  accuracy,
  questionsToday,
  examLabel,
  isPracticing,
  enabledSystemsLabel,
  accuracyLabel,
  growthAreas = [],
}) => {
  const mainTitle = isPracticing ? 'Knowledge Maintenance' : 'Core PANCE Simulation';
  const badgeLabel = isPracticing ? 'PANRE-LA Check-in' : `${examLabel} Prep`;
  const subtitle =
    growthAreas.length > 0
      ? `Focusing on your weak areas: ${growthAreas.slice(0, 3).join(', ')}.`
      : isPracticing
        ? 'Maintain your certification knowledge with adaptive questions.'
        : 'Questions weighted by blueprint and your performance patterns.';
  return (
    <GlassCard variant="primary" hoverable className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-action-blue/20 backdrop-blur-sm">
              <Brain className="w-7 h-7 text-action-blue" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                  {mainTitle}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-action-blue/10 text-action-blue border border-action-blue/20">
                  {badgeLabel}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Target className="w-4 h-4 text-sage-500" aria-hidden />
              {accuracy !== null ? `${accuracy}%` : 'Waiting for first session'}{' '}
              {accuracyLabel ?? 'accuracy'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm">
              <CheckCircle className="w-4 h-4 text-action-blue" aria-hidden />
              {questionsToday} today
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <PrimaryButton
            variant="secondary"
            size="lg"
            icon={Play}
            iconRight={ChevronRight}
            onClick={onStart}
          >
            Start Session
          </PrimaryButton>
          {enabledSystemsLabel && (
            <span className="text-xs text-[var(--color-text-muted)]">{enabledSystemsLabel}</span>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

// OSCE Section (Standalone Feature)
const OSCESection: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <GlassCard variant="info" hoverable className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-xl bg-steel-blue-400/20 backdrop-blur-sm">
            <MessageSquare className="w-6 h-6 text-steel-blue-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Live OSCE</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-steel-blue-400">
                Voice patient
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
              Practice with a live voice simulated patient; rubric-based SOAP note grading and real-time feedback.
            </p>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Timer className="w-3.5 h-3.5" />
                <span className="font-medium">~20 minutes</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Stethoscope className="w-3.5 h-3.5" />
                <span className="font-medium">Clinical Skills</span>
              </span>
            </div>
          </div>
        </div>

        <PrimaryButton
          variant="primary"
          size="md"
          icon={Play}
          iconRight={ChevronRight}
          onClick={onStart}
        >
          Start Encounter
        </PrimaryButton>
      </div>
    </GlassCard>
  );
};

// Quick Stats Bar (respects prefers-reduced-motion)
const QuickStatsBar: React.FC<{
  streak: number;
  dueCount: number;
  accuracy: number | null;
  questionsToday: number;
  /** "Module Accuracy" when Didactic with filtered systems, "Global Accuracy" otherwise */
  accuracyLabel?: string;
  /** "To Review" for students, "Maintenance Due" for Practicing PAs */
  dueLabel?: string;
}> = ({ streak, dueCount, accuracy, questionsToday, accuracyLabel = 'Global Accuracy', dueLabel = 'To Review' }) => {
  const prefersReducedMotion = useReducedMotion();
  const stats = [
    { label: 'Study Continuity', value: streak, icon: Zap, color: 'text-teal-600 dark:text-teal-400' },
    {
      label: dueLabel,
      value: dueCount,
      icon: AlertCircle,
      color: dueCount > 0 ? 'text-muted-amber' : 'text-[var(--color-text-muted)]',
    },
    {
      label: accuracyLabel,
      value: accuracy !== null ? `${accuracy}%` : 'Waiting for first session',
      icon: Target,
      color: 'text-sage-500',
    },
    { label: 'Today', value: questionsToday, icon: CheckCircle, color: 'text-action-blue' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((stat, i) => {
        const isDueCard = stat.label === dueLabel;
        const hasDueItems = isDueCard && dueCount > 0;

        const animate = prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : hasDueItems
            ? {
                opacity: 1,
                y: 0,
                scale: [1, 1.02, 1],
                borderColor: [
                  'var(--color-border)',
                  'rgba(20, 184, 166, 0.4)',
                  'var(--color-border)',
                ],
              }
            : { opacity: 1, y: 0 };
        const transition = prefersReducedMotion
          ? { duration: 0 }
          : hasDueItems
            ? {
                opacity: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
                y: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const },
                scale: {
                  delay: i * 0.05 + 0.3,
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'loop' as const,
                  ease: 'easeInOut',
                },
                borderColor: {
                  delay: i * 0.05 + 0.3,
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'loop' as const,
                  ease: 'easeInOut',
                },
              }
            : { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const };

        return (
          <motion.div
            key={stat.label}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={animate}
            transition={transition}
            className={`flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-xl border transition-colors ${
              hasDueItems
                ? 'border-data-provisional/30 hover:border-data-provisional/40'
                : 'border-[var(--color-border)] hover:border-[var(--color-border)]/60'
            }`}
          >
            <div className="p-2 rounded-xl bg-[var(--color-bg-primary)]">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--color-text-primary)]">{stat.value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{stat.label}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// Mode Card (respects prefers-reduced-motion; reflow-friendly for text scaling)
const ModeCard: React.FC<{
  mode: TrainingModeConfig;
  onSelect: () => void;
}> = ({ mode, onSelect }) => {
  const Icon = ICON_MAP[mode.iconName] || Target;
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      onClick={onSelect}
      disabled={mode.isComingSoon}
      className={`
        w-full text-left p-4 rounded-xl border transition-all duration-200 group min-h-0
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${
          mode.isComingSoon
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900/30 border-dashed border-[var(--color-border)]'
            : 'bg-[var(--color-bg-primary)] border-slate-200 dark:border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg shadow-md shadow-slate-400/5 dark:shadow-none dark:hover:shadow-black/10'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-accent)]/10 transition-colors duration-200 flex-shrink-0">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
        </div>
        <div className="flex-1 min-w-0 max-w-xl">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="font-semibold text-[var(--color-text-primary)] break-words">
              {mode.label}
            </h4>
            {mode.isComingSoon && (
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full flex-shrink-0">
                Soon
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-muted)] line-clamp-3">{mode.description}</p>
          {mode.estimatedMinutes && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
              <Timer className="w-3 h-3" />
              <span>~{mode.estimatedMinutes} min</span>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
};

// Category Section
const CategorySection: React.FC<{
  category: TrainingCategory;
  modes: TrainingModeConfig[];
  onSelectMode: (mode: TrainingModeConfig) => void;
}> = ({ category, modes, onSelectMode }) => {
  const info = CATEGORY_INFO[category];
  const Icon = ICON_MAP[info.iconName] || Target;

  if (modes.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[var(--color-bg-secondary)]">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{info.label}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">{info.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {modes.map((mode) => (
          <ModeCard key={mode.id} mode={mode} onSelect={() => onSelectMode(mode)} />
        ))}
      </div>
    </section>
  );
};

// ============================================================================
// Residency Cockpit: Study by System (body map / system grid from Rolling 360)
// ============================================================================

function ResidencyCockpitSection({
  onNavigateToDrillWithSystem,
}: {
  onNavigateToDrillWithSystem: (modeId: string, system: string) => void;
}) {
  const { stats, isLoading } = useRolling360Stats();
  const weakestSet = useMemo(() => new Set(stats?.weakestSystems ?? []), [stats?.weakestSystems]);
  const weakestSystem = stats?.weakestSystems?.[0] ?? null;
  const hasData = (stats?.totalInWindow ?? 0) >= 5;
  const systemsWithData = Object.entries(stats?.systemStats ?? {}).filter(([, s]) => s.total >= 2);

  if (isLoading) return null;

  return (
    <section className="mb-6">
      <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
        Residency Cockpit
      </h3>

      <div className="flex flex-col lg:flex-row gap-6">
        {hasData && systemsWithData.length > 0 && (
          <div className="flex-shrink-0">
            <BodyMapWidget
              systemStats={stats!.systemStats}
              weakestSystems={stats!.weakestSystems ?? []}
              onSystemClick={(s) => onNavigateToDrillWithSystem('system_drill', s)}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col gap-4">
          <RoundsButton
            weakestSystem={weakestSystem}
            hasData={hasData}
            onStartRounds={(system) => {
              if (system) {
                onNavigateToDrillWithSystem('system_drill', system);
              } else {
                onNavigateToDrillWithSystem('system_drill', '');
              }
            }}
          />
          {systemsWithData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {systemsWithData.slice(0, 12).map(([system, sysStats]) => {
                const isWeak = weakestSet.has(system);
                return (
                  <button
                    key={system}
                    type="button"
                    onClick={() => onNavigateToDrillWithSystem('system_drill', system)}
                    className={`
                      text-left p-4 rounded-xl border transition-all
                      bg-[var(--color-bg-primary)] border-[var(--color-border)]
                      hover:border-[var(--color-accent)]/50 hover:shadow-lg
                      ${isWeak ? 'ring-1 ring-amber-500/30' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {system}
                      </span>
                      {isWeak && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded">
                          Weak
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {sysStats.accuracy.toFixed(0)}% · {sysStats.total} q
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const CommandCenterHub: React.FC<CommandCenterHubProps> = ({
  performanceData,
  missedQuestions,
  flaggedQuestions,
  growthAreas,
  dueCount: propDueCount,
  examLabel = 'PANCE',
  isLoadingStats = false,
  onStartSession,
  onNavigateToDrillMode,
  onNavigateToDrillWithSystem,
  onNavigateToToolkit,
  onNavigateToGapAnalysis,
  onNavigateToClinicalProfile,
  onNavigateToIntegrations,
  onNavigateToSimulation,
  onNavigateToReference,
  onNavigateToMyLibrary,
  onNavigateToStudyCompanion,
  onNavigateToCustomStudy,
  onNavigateToPearlDeck,
  onNavigateToClinicalEye,
  onNavigateToVisualizer,
  onOpenSettings,
  onNavigateToTutorChat,
}) => {
  const { user } = useUser();
  const { showPANREContent, careerStage } = useUserContext();

  // Load enabled systems from localStorage (updates when Settings modal changes them)
  const [enabledSystems, setEnabledSystems] = useState<Set<SystemCode>>(() => {
    const saved = localStorage.getItem('panceai_enabled_systems');
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as SystemCode[]);
      } catch {
        return new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
      }
    }
    return new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
  });

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('panceai_enabled_systems');
      if (saved) {
        try {
          setEnabledSystems(new Set(JSON.parse(saved) as SystemCode[]));
        } catch {
          /* ignore */
        }
      }
    };
    globalThis.addEventListener('panceai_enabled_systems_changed', handler);
    return () => globalThis.removeEventListener('panceai_enabled_systems_changed', handler);
  }, []);

  // Practicing PAs: default to all systems ON (they toggle OFF to exclude rarely practiced areas)
  useEffect(() => {
    if (careerStage !== 'practicing') return;
    const all = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];
    const saved = localStorage.getItem('panceai_enabled_systems');
    if (!saved || saved === '[]') {
      setEnabledSystems(new Set(all));
      localStorage.setItem('panceai_enabled_systems', JSON.stringify(all));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
    }
  }, [careerStage]);

  const handleToggleSystem = useCallback((system: SystemCode) => {
    setEnabledSystems((prev: Set<SystemCode>) => {
      const next = new Set(prev);
      if (next.has(system)) next.delete(system);
      else next.add(system);
      localStorage.setItem('panceai_enabled_systems', JSON.stringify(Array.from(next)));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
      return next;
    });
  }, []);

  const [userProfile, setUserProfile] = useState(() => loadUserProfile() || { hasCompletedOnboarding: false });
  useEffect(() => {
    const sync = () => setUserProfile(loadUserProfile() || { hasCompletedOnboarding: false });
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const isClinicalStudent = careerStage === 'student' && userProfile?.yearInProgram === 'Clinical Year';
  const currentRotation = userProfile?.currentRotation;
  const eorTestDate = userProfile?.eorTestDate;

  const handleRotationChange = useCallback(
    (rotation: ClinicalRotation) => {
      updateUserProfile({ currentRotation: rotation });
      setUserProfile((prev) => ({ ...prev, currentRotation: rotation }));
      const systems = getSystemsForRotation(rotation);
      setEnabledSystems(new Set(systems));
      localStorage.setItem('panceai_enabled_systems', JSON.stringify(systems));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
      // Persist for question service Clinical 60/40 (60% rotation / 40% background)
      localStorage.setItem('panceai_current_rotation', rotation);
      localStorage.setItem('panceai_year_in_program', 'Clinical Year');
    },
    []
  );

  const handleEorTestDateChange = useCallback((date: string) => {
    updateUserProfile({ eorTestDate: date || undefined });
    setUserProfile((prev) => ({ ...prev, eorTestDate: date || undefined }));
  }, []);

  const [activeTab, setActiveTab] = useState<'training' | 'resources' | 'analytics'>('training');
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [studyFocusStep, setStudyFocusStep] = useState<'idle' | 'choose_focus'>('idle');
  const [showAllTools, setShowAllTools] = useState(false);

  // Calculate stats for the dashboard (accuracy null when no data - show "—" instead of 0%)
  const stats = useMemo(() => {
    const recent = performanceData.slice(-100);
    const correct = recent.filter((r) => r.isCorrect).length;
    const accuracy =
      recent.length > 0 ? Math.round((correct / recent.length) * 100) : (null as number | null);

    const todayRecords = (performanceData || []).filter((r) => {
      if (!r?.timestamp) return false;
      const date = new Date(r.timestamp);
      const today = new Date();
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    });

    // Day streak (consecutive days studied) - single source of truth
    const { current: streak } = calculateDayStreak(performanceData || []);

    const dueCount =
      propDueCount ?? (flaggedQuestions?.length || 0) + (missedQuestions?.length || 0);

    return { streak, dueCount, accuracy, questionsToday: todayRecords.length };
  }, [performanceData, flaggedQuestions, missedQuestions, propDueCount]);

  // For Didactic users: sub-label showing enabled systems (e.g. "Testing: CV, PULM, GI Only")
  const enabledSystemsLabel = useMemo(() => {
    if (careerStage !== 'student') return null;
    const all = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];
    const enabled = all.filter((s) => enabledSystems.has(s));
    if (enabled.length === 0 || enabled.length === all.length) return null;
    return `Testing: ${enabled.slice(0, 5).join(', ')}${enabled.length > 5 ? '…' : ''} Only`;
  }, [careerStage, enabledSystems]);

  // Filter modes based on user context (PANCE vs PANRE; hide didactic-only for Practicing PAs)
  const filteredModes = useMemo(() => {
    const filterForContext = (modes: TrainingModeConfig[]) =>
      modes.filter((m) => {
        if (m.panreOnly && !showPANREContent) return false;
        if (m.didacticOnly && showPANREContent) return false;
        return true;
      });

    return {
      visual: filterForContext(VISUAL_DIAGNOSTICS_MODES),
      clinical: filterForContext(CLINICAL_SIMULATION_MODES),
      questions: filterForContext(QUESTION_PRACTICE_MODES),
      specialty: filterForContext(SPECIALTY_DRILL_MODES),
    };
  }, [showPANREContent]);

  const handleModeSelect = useCallback(
    (mode: TrainingModeConfig) => {
      if (mode.id === 'core_adaptive') {
        // Navigate to dedicated simulation page instead of opening modal
        if (onNavigateToSimulation) {
          onNavigateToSimulation();
        } else {
          onStartSession({ focus: 'all' });
        }
      } else {
        onNavigateToDrillMode(mode.id);
      }
    },
    [onNavigateToDrillMode, onStartSession, onNavigateToSimulation]
  );

  const handleNavigateToDrillModeWithSettings = (modeId: string, settings?: any) => {
    if (modeId === 'core_adaptive' || modeId === 'custom_practice') {
      onStartSession(settings);
    } else {
      onNavigateToDrillMode(modeId);
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
          {greeting}, {user?.firstName || 'Student'}
        </h1>
        <p className="text-[var(--color-text-muted)] mt-1">
          Ready to advance your clinical knowledge?
        </p>
      </motion.div>

      {/* Quick Stats */}
      {isLoadingStats ? (
        <QuickStatsBarSkeleton />
      ) : (
        <QuickStatsBar
          streak={stats.streak}
          dueCount={stats.dueCount}
          accuracy={stats.accuracy}
          questionsToday={stats.questionsToday}
          accuracyLabel={
            careerStage === 'student' &&
            enabledSystems.size > 0 &&
            enabledSystems.size < Object.keys(ABBREVIATION_TO_TOPIC_MAP).length
              ? 'Module Accuracy'
              : 'Global Accuracy'
          }
          dueLabel={careerStage === 'practicing' ? 'Maintenance Due' : 'To Review'}
        />
      )}

      {/* Primary CTA: Start review when due, else start a session */}
      {!isLoadingStats && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {stats.dueCount > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-accent)]/10">
              <p className="text-[var(--color-text-primary)] font-medium">
                {stats.dueCount} question{stats.dueCount !== 1 ? 's' : ''} due
                {careerStage === 'practicing' ? ' — maintenance' : ' — maintain study continuity'}
              </p>
              <PrimaryButton
                onClick={() => onStartSession({ focus: 'review' })}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {careerStage === 'practicing' ? 'Practice due' : 'Start review'}
              </PrimaryButton>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <p className="text-[var(--color-text-secondary)] font-medium">
                Ready to study?
              </p>
              <PrimaryButton
                onClick={() => onStartSession()}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start a session
              </PrimaryButton>
            </div>
          )}
        </motion.div>
      )}

      {/* Recommended for you */}
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">
        Recommended for you
      </h2>
      <RecommendationFeed onNavigateToDrill={handleNavigateToDrillModeWithSettings} />

      {/* Residency Cockpit: Study by System (body map / system grid from Rolling 360) */}
      {onNavigateToDrillWithSystem && (
        <ResidencyCockpitSection onNavigateToDrillWithSystem={onNavigateToDrillWithSystem} />
      )}

      {/* Grand Rounds (Clinical/Pro) vs Targeted Daily Question (Didactic) */}
      <GrandRoundsBanner
        onStart={() => onNavigateToDrillMode('grand_rounds')}
        isDidactic={
          careerStage === 'student' && userProfile?.yearInProgram !== 'Clinical Year'
        }
      />

      {/* Clinical Student: Current Rotation dropdown (presets systems) + EOR Test Date */}
      {isClinicalStudent && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
        >
          <h3 className="font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[var(--color-accent)]" />
            Current Rotation
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Selecting a rotation presets which systems you&apos;re tested on (e.g. Surgery = GI, CV, MSK; zero Psych).
          </p>
          <RotationSelector
            value={currentRotation}
            onChange={handleRotationChange}
            label=""
          />
          {currentRotation && isEorRotation(currentRotation) && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                EOR Test Date
              </label>
              <input
                type="date"
                value={eorTestDate ?? ''}
                onChange={(e) => handleEorTestDateChange(e.target.value)}
                className="w-full max-w-xs px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm"
                aria-label="EOR test date for current rotation"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Dashboard will show &quot;EOR Readiness&quot; until this date.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Current Curriculum - Elevated for Didactic: Study Systems on dashboard + sub-label on Start Session */}
      {careerStage === 'student' &&
        enabledSystems.size >= 0 &&
        enabledSystems.size <= Object.keys(ABBREVIATION_TO_TOPIC_MAP).length && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
          >
            <div className="flex flex-col gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[var(--color-accent)]/10">
                  <Layers className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--color-text-primary)]">Current Curriculum</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {enabledSystems.size === 0
                      ? 'Enable at least one system to test.'
                      : enabledSystems.size === Object.keys(ABBREVIATION_TO_TOPIC_MAP).length
                        ? 'All systems enabled.'
                        : `Testing: ${Array.from(enabledSystems).slice(0, 6).join(', ')}${enabledSystems.size > 6 ? ` +${enabledSystems.size - 6} more` : ''} only`}
                  </p>
                </div>
              </div>
              {/* Unified toolbar: Enable All, Disable All, More options */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const all = new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
                    setEnabledSystems(all);
                    localStorage.setItem('panceai_enabled_systems', JSON.stringify(Array.from(all)));
                    window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg"
                >
                  Enable All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnabledSystems(new Set());
                    localStorage.setItem('panceai_enabled_systems', JSON.stringify([]));
                    window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg"
                >
                  Disable All
                </button>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                  >
                    More options
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]).map((system) => {
                const fullName = getSystemDisplayFullName(system);
                return (
                  <button
                    key={system}
                    type="button"
                    onClick={() => handleToggleSystem(system)}
                    title={fullName}
                    className={`min-w-0 p-4 rounded-lg text-xs font-medium transition-all text-left ${
                      enabledSystems.has(system)
                        ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-2 border-[var(--color-accent)]'
                        : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] border-2 border-transparent'
                    }`}
                  >
                    <div className="font-semibold truncate" title={system}>
                      {system}
                    </div>
                    <div className="text-[10px] opacity-80 truncate min-w-0" title={fullName}>
                      {fullName}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

      {/* Core Adaptive - THE MAIN EVENT */}
      <CoreAdaptiveHero
        onStart={() => (onNavigateToSimulation ? onNavigateToSimulation() : onStartSession())}
        accuracy={stats.accuracy}
        questionsToday={stats.questionsToday}
        examLabel={examLabel}
        enabledSystemsLabel={enabledSystemsLabel}
        accuracyLabel={
          careerStage === 'student' &&
          enabledSystems.size > 0 &&
          enabledSystems.size < Object.keys(ABBREVIATION_TO_TOPIC_MAP).length
            ? 'Module Accuracy'
            : 'Global Accuracy'
        }
        growthAreas={growthAreas}
      />

      {/* Virtual OSCE Section (Standalone Feature) */}
      <OSCESection onStart={() => onNavigateToDrillMode('patient_encounter')} />

      {/* Custom Study Mode - System Chooser (Targeted Practice) */}
      {onNavigateToCustomStudy && (
        <GlassCard variant="primary" hoverable className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 rounded-xl bg-action-blue/20 backdrop-blur-sm">
                <Layers className="w-6 h-6 text-action-blue" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
                    Custom Study Builder
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-action-blue/10 text-action-blue border border-action-blue/20">
                    System Chooser
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  Build targeted sessions: choose specific organ systems, focus areas, and customize
                  difficulty
                </p>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Target className="w-3.5 h-3.5" />
                    <span className="font-medium">Multi-System Selection</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="font-medium">Custom Focus</span>
                  </span>
                </div>
              </div>
            </div>

            <PrimaryButton
              variant="primary"
              size="md"
              icon={Play}
              iconRight={ChevronRight}
              onClick={onNavigateToCustomStudy}
            >
              Build Session
            </PrimaryButton>
          </div>
        </GlassCard>
      )}

      {/* PANRE-LA (Only for practicing PAs) */}
      {showPANREContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-deep-plum-500/10 to-deep-plum-400/10 border border-deep-plum-500/30 p-5 mb-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-deep-plum-500/20">
                <GraduationCap className="w-6 h-6 text-deep-plum-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  PANRE-LA Simulator
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Longitudinal assessment format for recertification
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigateToDrillMode('panre_la')}
              className="flex items-center gap-2 px-4 py-2 bg-deep-plum-500 hover:bg-deep-plum-600 text-white font-medium rounded-lg transition-colors"
            >
              Start Practice
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Study Tools / Maintenance Section Header - Sticky; aligned to same grid as content */}
      <div className="sticky top-0 z-20 bg-[var(--color-bg-primary)]/95 backdrop-blur border-b border-[var(--color-border)] -mx-4 px-4 pb-4 mb-6">
        <div className="mb-3 max-w-[1200px] mx-auto">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {careerStage === 'practicing' ? 'Maintenance & Reference' : 'Study Tools'}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {careerStage === 'practicing'
              ? 'Training modes, clinical resources, and progress'
              : 'Switch view: choose training modes, clinical resources, or progress &amp; analytics'}
          </p>
        </div>

        {/* Tab Navigation - switches content below (not scroll anchors) */}
        <div
          className="flex gap-4 overflow-x-auto -mx-1 px-1 border-b border-[var(--color-border)] max-w-[1200px] mx-auto"
          role="tablist"
          aria-label="Study tools view"
        >
          {[
            { id: 'training' as const, label: 'Training Modes', icon: Zap },
            { id: 'resources' as const, label: 'Clinical Resources', icon: BookOpen },
            { id: 'analytics' as const, label: 'Progress & Analytics', icon: BarChart3 },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            const className = `flex items-center gap-2 px-1 py-2 font-medium transition-all whitespace-nowrap border-b-2 bg-transparent ${
              isSelected
                ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200'
            }`;

            return isSelected ? (
              <button
                key={tab.id}
                role="tab"
                aria-selected="true"
                aria-controls={`study-tools-panel-${tab.id}`}
                id={`study-tools-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={className}
              >
                <tab.icon className="w-4 h-4" strokeWidth={1.5} />
                {tab.label}
              </button>
            ) : (
              <button
                key={tab.id}
                role="tab"
                aria-selected="false"
                aria-controls={`study-tools-panel-${tab.id}`}
                id={`study-tools-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={className}
              >
                <tab.icon className="w-4 h-4" strokeWidth={1.5} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab panels: one visible at a time (view switch, not scroll) */}
      <AnimatePresence mode="wait">
        {activeTab === 'training' && (
          <motion.div
            key="training"
            id="study-tools-panel-training"
            role="tabpanel"
            aria-labelledby="study-tools-tab-training"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {/* Progressive disclosure: default = one CTA; "Study Now" opens outcome choice */}
            {studyFocusStep === 'idle' && !showAllTools && (
              <div className="space-y-6">
                <div className="text-center py-6">
                  <p className="text-[var(--color-text-secondary)] mb-6">
                    What do you want to do?
                  </p>
                  <PrimaryButton
                    size="lg"
                    icon={Play}
                    iconRight={ChevronRight}
                    onClick={() => setStudyFocusStep('choose_focus')}
                    className="gap-2"
                  >
                    Study Now
                  </PrimaryButton>
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllTools(true)}
                    className="text-sm text-[var(--color-accent)] hover:underline"
                  >
                    Browse all tools
                  </button>
                </div>
              </div>
            )}

            {/* Second step: "What do you want to focus on?" — grouped by outcome */}
            {studyFocusStep === 'choose_focus' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                    What do you want to focus on?
                  </h3>
                  <button
                    type="button"
                    onClick={() => setStudyFocusStep('idle')}
                    className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    Back
                  </button>
                </div>

                {/* Learn New Material */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-5 h-5 text-[var(--color-text-muted)]" />
                    <h4 className="font-semibold text-[var(--color-text-primary)]">
                      {STUDY_OUTCOME_GROUPS.learn.label}
                    </h4>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">
                    {STUDY_OUTCOME_GROUPS.learn.description}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {STUDY_OUTCOME_GROUPS.learn.modeIds.map((id) => {
                      const mode = getModeById(id);
                      if (!mode || (mode.panreOnly && !showPANREContent)) return null;
                      return (
                        <ModeCard
                          key={mode.id}
                          mode={mode}
                          onSelect={() => {
                            handleModeSelect(mode);
                            setStudyFocusStep('idle');
                          }}
                        />
                      );
                    })}
                  </div>
                </section>

                {/* Test My Knowledge */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
                    <h4 className="font-semibold text-[var(--color-text-primary)]">
                      {STUDY_OUTCOME_GROUPS.test.label}
                    </h4>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">
                    {STUDY_OUTCOME_GROUPS.test.description}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {STUDY_OUTCOME_GROUPS.test.modeIds.slice(0, 6).map((id) => {
                      const mode = getModeById(id);
                      if (!mode || mode.isComingSoon || (mode.panreOnly && !showPANREContent)) return null;
                      return (
                        <ModeCard
                          key={mode.id}
                          mode={mode}
                          onSelect={() => {
                            handleModeSelect(mode);
                            setStudyFocusStep('idle');
                          }}
                        />
                      );
                    })}
                  </div>
                  {STUDY_OUTCOME_GROUPS.test.modeIds.length > 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAllTools(true);
                        setStudyFocusStep('idle');
                      }}
                      className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
                    >
                      More options…
                    </button>
                  )}
                </section>

                {/* Fix My Weaknesses */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-[var(--color-text-muted)]" />
                    <h4 className="font-semibold text-[var(--color-text-primary)]">
                      {STUDY_OUTCOME_GROUPS.fix.label}
                    </h4>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">
                    {STUDY_OUTCOME_GROUPS.fix.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onStartSession(growthAreas.length > 0 ? { focus: 'topic', topic: growthAreas[0] } : { focus: 'incorrect' });
                      setStudyFocusStep('idle');
                    }}
                    className="w-full sm:w-auto text-left p-4 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-secondary)] transition-all group flex items-center gap-3"
                  >
                    <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                      <Target className="w-5 h-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        Focus on my weak areas
                      </span>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {growthAreas.length > 0
                          ? `Start with ${growthAreas[0]} and related topics`
                          : 'Questions from your to-review list'}
                      </p>
                    </div>
                  </button>
                </section>
              </div>
            )}

            {/* Full list (progressive disclosure: "Browse all tools") */}
            {showAllTools && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">All study tools</h3>
                  <button
                    type="button"
                    onClick={() => setShowAllTools(false)}
                    className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    Show less
                  </button>
                </div>
                <CategorySection
                  category="visual_diagnostics"
                  modes={filteredModes.visual}
                  onSelectMode={handleModeSelect}
                />
                <CategorySection
                  category="clinical_simulation"
                  modes={filteredModes.clinical}
                  onSelectMode={handleModeSelect}
                />
                <CategorySection
                  category="question_practice"
                  modes={filteredModes.questions}
                  onSelectMode={handleModeSelect}
                />
                <CategorySection
                  category="specialty_drills"
                  modes={filteredModes.specialty}
                  onSelectMode={handleModeSelect}
                />
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'resources' && (
          <motion.div
            key="resources"
            id="study-tools-panel-resources"
            role="tabpanel"
            aria-labelledby="study-tools-tab-resources"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <section>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[var(--color-text-muted)]" />
                Calculators & Risk Scores
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={onNavigateToToolkit}
                  className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                      <Target className="w-6 h-6 text-[var(--color-text-secondary)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--color-text-primary)]">
                        Clinical Calculators
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Wells, CURB-65, PERC, CHA₂DS₂-VASc, and more
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
                <button
                  onClick={onNavigateToToolkit}
                  className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                      <Beaker className="w-6 h-6 text-[var(--color-text-secondary)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--color-text-primary)]">
                        Lab Calculators
                      </h4>
<p className="text-sm text-[var(--color-text-muted)] mt-1">
                      GFR, Anion Gap, Corrected Na+, A-a Gradient
                    </p>
                    </div>
                  </div>
                </button>
              </div>
            </section>

            {/* Rapid Review (Pearl Deck) */}
            {onNavigateToPearlDeck && (
              <section>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[var(--color-text-muted)]" />
                  High-Yield Review
                </h3>
                <button
                  onClick={onNavigateToPearlDeck}
                  className="w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-amber-500/50 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10">
                      <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--color-text-primary)]">
                        Rapid Review (Pearl Deck)
                      </h4>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Study only your saved clinical pearls for high-yield review
                      </p>
                    </div>
                  </div>
                </button>
              </section>
            )}

            {/* AI-Powered Tools: Clinical Eye & Visualizer */}
            {(onNavigateToClinicalEye || onNavigateToVisualizer || onNavigateToTutorChat) && (
              <section>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[var(--color-text-muted)]" />
                  AI-Powered Tools
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {onNavigateToClinicalEye && (
                    <button
                      onClick={onNavigateToClinicalEye}
                      className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                          <Eye className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            Clinical Eye
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              AI-powered
                            </span>
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            Image analysis: upload ECGs or clinical images for AI explanations and code-based measurements
                          </p>
                        </div>
                      </div>
                    </button>
                  )}
                  {onNavigateToVisualizer && (
                    <button
                      onClick={onNavigateToVisualizer}
                      className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                          <Image className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            Anatomy Visualizer
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                              AI-powered
                            </span>
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            Generate anatomy images and segment regions (Firefly + Gemini)
                          </p>
                        </div>
                      </div>
                    </button>
                  )}
                  {onNavigateToTutorChat && (
                    <button
                      onClick={onNavigateToTutorChat}
                      className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                          <MessageSquare className="w-6 h-6 text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            Reasoning Tutor Chat
                          </h4>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            Chat with a Gemini Tutor that uses your weak spots and active Library to
                            guide explanations
                          </p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Clinical Reference Library */}
            {onNavigateToReference && (
              <section>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-[var(--color-text-muted)]" />
                  Clinical Reference
                </h3>
                <button
                  onClick={onNavigateToReference}
                  className="w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-steel-blue-100 dark:bg-steel-blue-900/30">
                      <BookOpen className="w-6 h-6 text-steel-blue-600 dark:text-steel-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--color-text-primary)]">
                        Clinical Reference Library
                      </h4>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Browse Anatomy, Labs, Drugs, ECG Patterns, Procedures, Physiology & more
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-steel-blue-100 dark:bg-steel-blue-900/40 text-steel-blue-700 dark:text-steel-blue-300">
                          300+ Anatomy
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-sage-100 dark:bg-sage-900/40 text-sage-700 dark:text-sage-300">
                          200+ Labs
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-deep-plum-100 dark:bg-deep-plum-900/40 text-deep-plum-700 dark:text-deep-plum-300">
                          1000+ Drugs
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-dusty-rose-100 dark:bg-dusty-rose-900/40 text-dusty-rose-700 dark:text-dusty-rose-300">
                          50+ ECG
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </section>
            )}

            {/* My Library - Upload PDFs, set active cache for Tutor */}
            {onNavigateToMyLibrary && (
              <section>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <FolderTree className="w-5 h-5 text-[var(--color-text-muted)]" />
                  Knowledge
                </h3>
                <button
                  onClick={onNavigateToMyLibrary}
                  className="w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-[var(--color-accent)]/20">
                      <Sparkles className="w-6 h-6 text-[var(--color-accent)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                        My Library
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                          Smarter tutor
                        </span>
                      </h4>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Upload notes and PDFs so the Tutor uses your materials for personalized explanations
                      </p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                        Context caching
                      </span>
                    </div>
                  </div>
                </button>

                {onNavigateToStudyCompanion && (
                  <button
                    onClick={onNavigateToStudyCompanion}
                    className="mt-3 w-full text-left p-5 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-action-blue/15">
                        <MessageSquare className="w-6 h-6 text-action-blue" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                          Study Companion
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-action-blue/15 text-action-blue">
                            Citations
                          </span>
                        </h4>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                          Chat with an approved textbook and see evidence highlighted directly on the PDF
                        </p>
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-action-blue/15 text-action-blue">
                          PDF + Tutor
                        </span>
                      </div>
                    </div>
                  </button>
                )}
              </section>
            )}
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            id="study-tools-panel-analytics"
            role="tabpanel"
            aria-labelledby="study-tools-tab-analytics"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Research-Backed User-Friendly Stats */}
            <section>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-action-blue" />
                Your Learning Analytics
              </h3>
              <UserFriendlyStatsDisplay />
            </section>

            {/* Learning Profile - Comprehensive User Analytics */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <User className="w-5 h-5 text-[var(--color-text-muted)]" />
                  Detailed Learning Profile
                </h3>
                <button
                  onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    showAdvancedAnalytics
                      ? 'bg-action-blue text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {showAdvancedAnalytics ? '✦ Advanced View' : 'Switch to Advanced'}
                </button>
              </div>
              {showAdvancedAnalytics ? (
                <AdvancedLearningProfileDashboard />
              ) : (
                <LearningProfileDashboard />
              )}
            </section>

            <section>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--color-text-muted)]" />
                Overview
              </h3>

              {/* Database-backed analytics (authenticated users) */}
              <DatabaseAnalyticsDashboard />

              {/* Session-based analytics (local data) */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
                  Session Performance
                </h4>
                <AnalyticsDashboard performanceData={performanceData} />
              </div>

              {/* Additional navigation to detailed views */}
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <button
                  onClick={onNavigateToGapAnalysis}
                  className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                      <Layers className="w-6 h-6 text-[var(--color-text-secondary)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--color-text-primary)]">
                        Competency Heatmap
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Visual mastery grid across organ systems
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={onNavigateToGapAnalysis}
                  className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                      <Target className="w-6 h-6 text-[var(--color-text-secondary)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--color-text-primary)]">Gap Analysis</h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Identify high-yield focus areas
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={onNavigateToClinicalProfile}
                  className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group md:col-span-2"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                      <BarChart3 className="w-6 h-6 text-[var(--color-text-secondary)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--color-text-primary)]">
                        Clinical Profile
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Strengths, timing patterns, and diagnosis bias
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </section>

            {/* Growth Areas */}
            {growthAreas.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-muted-amber" />
                  Priority Focus Areas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {growthAreas.map((area) => (
                    <button
                      key={area}
                      onClick={() => onStartSession({ focus: 'topic', topic: area })}
                      className="px-4 py-2 bg-data-provisional/10 dark:bg-data-provisional/5 border border-data-provisional/30 dark:border-data-provisional/20 text-muted-amber rounded-lg hover:bg-data-provisional/20 dark:hover:bg-data-provisional/10 transition-colors"
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CommandCenterHub;
