'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, CardHeader, CardStats } from './ui/GlassCard';
import { PrimaryButton } from './ui/PrimaryButton';
import { RecommendationFeed } from './dashboard/RecommendationFeed';
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
  Users,
  Flame,
  AlertCircle,
  CheckCircle,
  Timer,
  GraduationCap,
  Beaker,
  FileImage,
  Shield,
  Layers,
  Sparkles,
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
  LucideIcon,
  User,
} from 'lucide-react';
import type { PerformanceRecord, Question, SessionSettings } from '../types';
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard';
import { DatabaseAnalyticsDashboard } from './analytics/DatabaseAnalyticsDashboard';
import { LearningProfileDashboard } from './analytics/LearningProfileDashboard';
import { AdvancedLearningProfileDashboard } from './analytics/AdvancedLearningProfileDashboard';
import { UserFriendlyStatsDisplay } from './analytics/UserFriendlyStatsDisplay';
import {
  VISUAL_DIAGNOSTICS_MODES,
  CLINICAL_SIMULATION_MODES,
  QUESTION_PRACTICE_MODES,
  SPECIALTY_DRILL_MODES,
  CORE_ADAPTIVE_MODE,
  OSCE_MODE,
  GRAND_ROUNDS_MODE,
  PANRE_LA_MODE,
  CATEGORY_INFO,
  type TrainingModeConfig,
  type TrainingCategory,
} from '../config/training-modes';
import { useUserContext } from '../hooks/useUserContext';

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
  onStartSession: (settings?: SessionSettings) => void;
  onNavigateToDrillMode: (modeId: string) => void;
  onNavigateToToolkit: () => void;
  onNavigateToGapAnalysis: () => void;
  onNavigateToClinicalProfile?: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToSimulation?: (settings?: { initialFocus?: 'all' | 'growth' | 'flagged' | 'due' }) => void;
  onNavigateToReference?: () => void;
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
const GrandRoundsBanner: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <GlassCard variant="warning" hoverable className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardHeader
            icon={Trophy}
            iconColor="text-muted-amber"
            title="Grand Rounds"
            subtitle="Same questions for everyone. Compare your score!"
            badge={{
              text: `Daily Challenge • ${dateStr}`,
              color:
                'bg-muted-amber/10 text-muted-amber border border-muted-amber/20',
            }}
          />
        </div>

        <PrimaryButton variant="warning" size="md" icon={Play} onClick={onStart}>
          Start
        </PrimaryButton>
      </div>
    </GlassCard>
  );
};

// Core Adaptive Hero (Main Event)
const CoreAdaptiveHero: React.FC<{
  onStart: () => void;
  accuracy: number;
  questionsToday: number;
  examLabel: string;
}> = ({ onStart, accuracy, questionsToday, examLabel }) => {
  return (
    <GlassCard variant="primary" hoverable className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex-1">
          <CardHeader
            icon={Brain}
            iconColor="text-action-blue"
            title="Core PANCE Simulation"
            subtitle="AI-powered adaptive questions that target your knowledge gaps"
            badge={{
              text: `${examLabel} Prep`,
              color: 'bg-action-blue/10 text-action-blue border border-action-blue/20',
            }}
          />

          <CardStats
            stats={[
              {
                icon: Target,
                label: 'accuracy',
                value: `${accuracy}%`,
                color: 'bg-sage-500/10 border-sage-400/20 text-sage-400',
              },
              {
                icon: CheckCircle,
                label: 'today',
                value: questionsToday,
                color: 'bg-action-blue/10 border-action-blue/20 text-action-blue',
              },
            ]}
          />
        </div>

        <div className="flex items-center">
          <PrimaryButton
            variant="secondary"
            size="lg"
            icon={Play}
            iconRight={ChevronRight}
            onClick={onStart}
          >
            Start Session
          </PrimaryButton>
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
        <div className="flex-1">
          <CardHeader
            icon={MessageSquare}
            iconColor="text-steel-blue-500"
            title="Virtual OSCE"
            subtitle="Full interactive patient encounters with AI-powered evaluation and real-time feedback"
            badge={{
              text: 'Interactive',
              color: 'text-steel-blue-400',
            }}
          />
          <div className="flex items-center gap-4 mt-3">
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

// Quick Stats Bar
const QuickStatsBar: React.FC<{
  streak: number;
  dueCount: number;
  accuracy: number;
  questionsToday: number;
}> = ({ streak, dueCount, accuracy, questionsToday }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Day Streak', value: streak, icon: Flame, color: 'text-muted-amber' },
        {
          label: 'Due for Review',
          value: dueCount,
          icon: AlertCircle,
          color: dueCount > 0 ? 'text-muted-amber' : 'text-[var(--color-text-muted)]',
        },
        { label: 'Accuracy', value: `${accuracy}%`, icon: Target, color: 'text-sage-500' },
        { label: 'Today', value: questionsToday, icon: CheckCircle, color: 'text-action-blue' },
      ].map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]"
        >
          <stat.icon className={`w-5 h-5 ${stat.color}`} />
          <div>
            <div className="text-lg font-bold text-[var(--color-text-primary)]">{stat.value}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{stat.label}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// Mode Card
const ModeCard: React.FC<{
  mode: TrainingModeConfig;
  onSelect: () => void;
}> = ({ mode, onSelect }) => {
  const Icon = ICON_MAP[mode.iconName] || Target;

  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      disabled={mode.isComingSoon}
      className={`
        w-full text-left p-4 rounded-xl border transition-all duration-200 group
        ${
          mode.isComingSoon
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900/30 border-dashed border-[var(--color-border)]'
            : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-accent)]/10 transition-colors">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-[var(--color-text-primary)] truncate">
              {mode.label}
            </h4>
            {mode.isComingSoon ? (
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full">
                Soon
              </span>
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-0.5 transition-all" />
            )}
          </div>
          <p className="text-sm text-[var(--color-text-muted)] line-clamp-1 mt-0.5">
            {mode.description}
          </p>
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
        <div className="p-2 rounded-lg bg-[var(--color-bg-secondary)]">
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
// Main Component
// ============================================================================

export const CommandCenterHub: React.FC<CommandCenterHubProps> = ({
  performanceData,
  missedQuestions,
  flaggedQuestions,
  growthAreas,
  dueCount: propDueCount,
  examLabel = 'PANCE',
  onStartSession,
  onNavigateToDrillMode,
  onNavigateToToolkit,
  onNavigateToGapAnalysis,
  onNavigateToClinicalProfile,
  onNavigateToIntegrations,
  onNavigateToSimulation,
  onNavigateToReference,
}) => {
  const { user } = useUser();
  const { showPANREContent } = useUserContext();
  const [activeTab, setActiveTab] = useState<'training' | 'resources' | 'analytics'>('training');
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

  // Calculate stats for the dashboard
  const stats = useMemo(() => {
    const recent = performanceData.slice(-100);
    const correct = recent.filter((r) => r.isCorrect).length;
    const accuracy = recent.length > 0 ? Math.round((correct / recent.length) * 100) : 0;

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

    // Calculate streak from performance data
    let streak = 0;
    const sortedData = [...(performanceData || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDate = new Date(today);
    const dateSet = new Set<string>();

    for (const record of sortedData) {
      const recordDate = new Date(record.timestamp);
      recordDate.setHours(0, 0, 0, 0);
      const isoDateParts = recordDate.toISOString().split('T');
      const dateStr = isoDateParts[0] ?? recordDate.toDateString();

      if (!dateSet.has(dateStr)) {
        dateSet.add(dateStr);

        if (recordDate.getTime() === checkDate.getTime()) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (recordDate.getTime() < checkDate.getTime()) {
          break;
        }
      }
    }

    const dueCount =
      propDueCount !== undefined
        ? propDueCount
        : (flaggedQuestions?.length || 0) + (missedQuestions?.length || 0);

    return { streak, dueCount, accuracy, questionsToday: todayRecords.length };
  }, [performanceData, flaggedQuestions, missedQuestions, propDueCount]);

  // Filter modes based on user context (PANCE vs PANRE)
  const filteredModes = useMemo(() => {
    const filterForContext = (modes: TrainingModeConfig[]) =>
      modes.filter((m) => !m.panreOnly || showPANREContent);

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
      <QuickStatsBar
        streak={stats.streak}
        dueCount={stats.dueCount}
        accuracy={stats.accuracy}
        questionsToday={stats.questionsToday}
      />

      {/* Intelligent Recommendations */}
      <RecommendationFeed onNavigateToDrill={handleNavigateToDrillModeWithSettings} />

      {/* Grand Rounds - Daily Challenge (Standalone) */}
      <GrandRoundsBanner onStart={() => onNavigateToDrillMode('grand_rounds')} />

      {/* Core Adaptive - THE MAIN EVENT */}
      <CoreAdaptiveHero
        onStart={() => (onNavigateToSimulation ? onNavigateToSimulation() : onStartSession())}
        accuracy={stats.accuracy}
        questionsToday={stats.questionsToday}
        examLabel={examLabel}
      />

      {/* Due for Review CTA */}
      {stats.dueCount > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.005 }}
          onClick={() =>
          onNavigateToSimulation
            ? onNavigateToSimulation({ initialFocus: 'due' })
            : onStartSession({ focus: 'review' })
          }
          className="w-full mb-6 p-4 bg-data-provisional/10 dark:bg-data-provisional/5 border border-data-provisional/30 dark:border-data-provisional/20 rounded-xl flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-data-provisional/20 dark:bg-data-provisional/10">
              <AlertCircle className="w-5 h-5 text-muted-amber" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-[var(--color-text-primary)]">
                {stats.dueCount} questions due for review
              </div>
              <div className="text-sm text-muted-amber">
                Strengthen retention with spaced repetition
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-amber group-hover:translate-x-1 transition-transform" />
        </motion.button>
      )}

      {/* Virtual OSCE Section (Standalone Feature) */}
      <OSCESection onStart={() => onNavigateToDrillMode('patient_encounter')} />

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

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
        {[
          { id: 'training' as const, label: 'Training Modes', icon: Zap },
          { id: 'resources' as const, label: 'Clinical Resources', icon: BookOpen },
          { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-action-blue text-white shadow-lg'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'training' && (
          <motion.div
            key="training"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
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
          </motion.div>
        )}

        {activeTab === 'resources' && (
          <motion.div
            key="resources"
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">
                        Lab Calculators
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        GFR, Anion Gap, Corrected Na+, A-a Gradient
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            </section>

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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">
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
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </section>
            )}
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
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
                Performance Analysis
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">
                        Competency Heatmap
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Visual mastery grid across organ systems
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">
                        Gap Analysis
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Identify high-yield focus areas
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">
                        Clinical Profile
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Strengths, timing patterns, and diagnosis bias
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
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
                    onClick={() =>
                      onStartSession({ focus: 'topic', topic: area })
                    }
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
