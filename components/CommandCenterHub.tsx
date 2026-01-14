'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { RecommendationFeed } from './dashboard/RecommendationFeed';

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
  onNavigateToClinicalProfile: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToSimulation?: () => void;
  onNavigateToReference?: () => void;
}

// Icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
  Brain, Zap, Target, Stethoscope, BookOpen, Pill, Activity, Clock,
  Trophy, Flame, AlertCircle, CheckCircle, Timer, GraduationCap,
  Beaker, FileImage, Shield, Layers, Droplets, GitCompare, FileCheck,
  Siren, Hash, Heart, Wind, Eye, MessageSquare, Image, Scan,
  FlaskConical, Headphones, FolderTree, Calculator, BarChart3,
  TrendingUp, Sparkles,
};

// ============================================================================
// Subcomponents
// ============================================================================

// Grand Rounds Banner (Standalone Daily Challenge)
const GrandRoundsBanner: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-500/10 border border-amber-500/30 p-5 mb-6"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/20">
            <Trophy className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Daily Challenge
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">•</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{dateStr}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Grand Rounds</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Same questions for everyone. Compare your score!
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStart}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all"
        >
          <Play className="w-4 h-4" />
          Start
        </motion.button>
      </div>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-[1px] mb-6"
    >
      {/* Gradient border effect */}
      <div className="relative overflow-hidden rounded-[15px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-900 dark:via-slate-950 dark:to-black p-6 sm:p-8">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      {examLabel} Prep
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                    Core PANCE Simulation
                  </h2>
                  <p className="text-slate-200/80 text-sm sm:text-base leading-relaxed max-w-xl">
                    AI-powered adaptive questions that target your knowledge gaps
                  </p>
                </div>
              </div>

              {/* Stats cards */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 backdrop-blur-sm rounded-lg border border-emerald-400/20">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">{accuracy}% accuracy</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-400/20">
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">{questionsToday} today</span>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStart}
              className="flex items-center justify-center gap-3 px-8 py-4 bg-white hover:bg-blue-50 text-slate-900 font-bold rounded-xl shadow-2xl shadow-blue-900/50 transition-all text-base sm:text-lg hover:shadow-blue-800/60 border-2 border-white/20"
            >
              <Play className="w-5 h-5" />
              <span>Start Session</span>
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// OSCE Section (Standalone Feature)
const OSCESection: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-emerald-500/10 border-2 border-teal-500/20 hover:border-teal-500/40 p-6 mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/10"
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Virtual OSCE</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                Interactive
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              Full interactive patient encounters with AI-powered evaluation and real-time feedback
            </p>
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
        </div>

        <motion.button
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/30 transition-all hover:shadow-xl hover:shadow-teal-500/40"
        >
          <span>Start Encounter</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </motion.button>
      </div>
    </motion.div>
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
        { label: 'Day Streak', value: streak, icon: Flame, color: 'text-orange-500' },
        { label: 'Due for Review', value: dueCount, icon: AlertCircle, color: dueCount > 0 ? 'text-amber-500' : 'text-slate-400' },
        { label: 'Accuracy', value: `${accuracy}%`, icon: Target, color: 'text-emerald-500' },
        { label: 'Today', value: questionsToday, icon: CheckCircle, color: 'text-blue-500' },
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
        ${mode.isComingSoon
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
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            {info.label}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            {info.description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {modes.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            onSelect={() => onSelectMode(mode)}
          />
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
    const correct = recent.filter(r => r.isCorrect).length;
    const accuracy = recent.length > 0 ? Math.round((correct / recent.length) * 100) : 0;

    const todayRecords = (performanceData || []).filter(r => {
      if (!r?.timestamp) return false;
      const date = new Date(r.timestamp);
      const today = new Date();
      return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
    });

    // Calculate streak from performance data
    let streak = 0;
    const sortedData = [...(performanceData || [])].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkDate = new Date(today);
    const dateSet = new Set<string>();

    for (const record of sortedData) {
      const recordDate = new Date(record.timestamp);
      recordDate.setHours(0, 0, 0, 0);
      const dateStr = recordDate.toISOString().split('T')[0];

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

    const dueCount = propDueCount !== undefined ? propDueCount : ((flaggedQuestions?.length || 0) + (missedQuestions?.length || 0));

    return { streak, dueCount, accuracy, questionsToday: todayRecords.length };
  }, [performanceData, flaggedQuestions, missedQuestions, propDueCount]);

  // Filter modes based on user context (PANCE vs PANRE)
  const filteredModes = useMemo(() => {
    const filterForContext = (modes: TrainingModeConfig[]) =>
      modes.filter(m => !m.panreOnly || showPANREContent);

    return {
      visual: filterForContext(VISUAL_DIAGNOSTICS_MODES),
      clinical: filterForContext(CLINICAL_SIMULATION_MODES),
      questions: filterForContext(QUESTION_PRACTICE_MODES),
      specialty: filterForContext(SPECIALTY_DRILL_MODES),
    };
  }, [showPANREContent]);

  const handleModeSelect = useCallback((mode: TrainingModeConfig) => {
    if (mode.id === 'core_adaptive') {
      // Navigate to dedicated simulation page instead of opening modal
      if (onNavigateToSimulation) {
        onNavigateToSimulation();
      } else {
        onStartSession({ focus: 'all', difficulty: 'same' });
      }
    } else {
      onNavigateToDrillMode(mode.id);
    }
  }, [onNavigateToDrillMode, onStartSession, onNavigateToSimulation]);

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
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
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
        onStart={() => onNavigateToSimulation ? onNavigateToSimulation() : onStartSession()}
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
          onClick={() => onNavigateToSimulation ? onNavigateToSimulation() : onStartSession({ focus: 'review', difficulty: 'same' })}
          className="w-full mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-amber-900 dark:text-amber-100">
                {stats.dueCount} questions due for review
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-400">
                Strengthen retention with spaced repetition
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      )}

      {/* Virtual OSCE Section (Standalone Feature) */}
      <OSCESection onStart={() => onNavigateToDrillMode('patient_encounter')} />

      {/* PANRE-LA (Only for practicing PAs) */}
      {showPANREContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 p-5 mb-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/20">
                <GraduationCap className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">PANRE-LA Simulator</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Longitudinal assessment format for recertification
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigateToDrillMode('panre_la')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
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
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === tab.id
              ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] shadow-lg'
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">Clinical Calculators</h4>
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">Lab Calculators</h4>
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
                  className="w-full text-left p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                      <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-[var(--color-text-primary)]">Clinical Reference Library</h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Browse Anatomy, Labs, Drugs, ECG Patterns, Procedures, Physiology & more
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          300+ Anatomy
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          200+ Labs
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                          1000+ Drugs
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
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
                <BarChart3 className="w-5 h-5 text-blue-500" />
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
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${showAdvancedAnalytics
                    ? 'bg-blue-500 text-white'
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
                <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Session Performance</h4>
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">Competency Heatmap</h4>
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">Gap Analysis</h4>
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
                      <h4 className="font-semibold text-[var(--color-text-primary)]">Clinical Profile</h4>
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
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Priority Focus Areas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {growthAreas.map((area) => (
                    <button
                      key={area}
                      onClick={() => onStartSession({ focus: 'topic', difficulty: 'same', topic: area })}
                      className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
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
