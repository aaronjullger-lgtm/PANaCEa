'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import type { PerformanceRecord, Question, SessionSettings } from '../types';
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
  onStartSession: (settings: SessionSettings) => void;
  onNavigateToDrillMode: (modeId: string) => void;
  onNavigateToToolkit: () => void;
  onNavigateToGapAnalysis: () => void;
  onNavigateToIntegrations?: () => void;
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
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-800 dark:via-slate-900 dark:to-black p-6 mb-6"
    >
      {/* Background effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.4),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(168,85,247,0.3),transparent_50%)]" />
      </div>
      
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-white/10">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  {examLabel} Prep
                </span>
                <h2 className="text-2xl font-bold text-white">Adaptive Questions</h2>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-4 max-w-lg">
              AI-powered questions that adapt to your knowledge gaps. The core of your board prep.
            </p>
            
            {/* Mini stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">{accuracy}% accuracy</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                <span className="text-slate-300">{questionsToday} today</span>
              </div>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-xl shadow-purple-500/25 transition-all text-lg"
          >
            <Play className="w-6 h-6" />
            Start Session
          </motion.button>
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
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/30 p-5 mb-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-500/20">
            <MessageSquare className="w-6 h-6 text-teal-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Virtual OSCE</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Full interactive patient encounters with AI-powered scoring
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Timer className="w-3 h-3" /> ~20 min
          </span>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors"
          >
            Start Encounter
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
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
  onStartSession,
  onNavigateToDrillMode,
  onNavigateToToolkit,
  onNavigateToGapAnalysis,
}) => {
  const { user } = useUser();
  const { showPANREContent, examLabel } = useUserContext();
  const [activeTab, setActiveTab] = useState<'training' | 'resources' | 'analytics'>('training');

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = performanceData.filter(
      (r) => new Date(r.timestamp).toISOString().split('T')[0] === today
    );

    const last100 = performanceData.slice(-100);
    const accuracy = last100.length > 0
      ? Math.round((last100.filter((r) => r.isCorrect).length / last100.length) * 100)
      : 0;

    // Calculate streak
    const uniqueDays = new Set(
      performanceData.map((r) => new Date(r.timestamp).toISOString().split('T')[0])
    );
    const sortedDays = Array.from(uniqueDays).sort().reverse();
    let streak = 0;
    const checkDate = new Date();
    for (const day of sortedDays) {
      const dayDate = new Date(day);
      const diffDays = Math.floor((checkDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const dueCount = flaggedQuestions.length + missedQuestions.length;

    return { streak, dueCount, accuracy, questionsToday: todayRecords.length };
  }, [performanceData, flaggedQuestions.length, missedQuestions.length]);

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
    if (mode.route === 'core_adaptive') {
      onStartSession({ focus: 'all', difficulty: 'same' });
    } else {
      onNavigateToDrillMode(mode.route);
    }
  }, [onNavigateToDrillMode, onStartSession]);

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

      {/* Grand Rounds - Daily Challenge (Standalone) */}
      <GrandRoundsBanner onStart={() => onNavigateToDrillMode('grand_rounds')} />

      {/* Core Adaptive - THE MAIN EVENT */}
      <CoreAdaptiveHero
        onStart={() => onStartSession({ focus: 'all', difficulty: 'same' })}
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
          onClick={() => onStartSession({ focus: 'review', difficulty: 'same' })}
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
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
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
            <section>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--color-text-muted)]" />
                Performance Analysis
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
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
