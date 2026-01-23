// src/components/MenuView.tsx

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, SignOutButton } from '@clerk/clerk-react';
import {
  Award,
  Hospital,
  Pill,
  RotateCcw,
  Bookmark,
  FileText,
  Link2,
  Users,
  X,
  Trophy,
  GraduationCap,
  Home,
  BarChart3,
  Dumbbell,
  User,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { useIsMobile } from '../lib/utils/responsive';
import type {
  PerformanceRecord,
  SessionSettings,
  Question,
  TopicStats,
  SystemCode,
} from '../types';
import TrainingMenu from './dashboard/TrainingMenu';
import ProgressRing from './ProgressRing';
import TopicHeatmap from './TopicHeatmap';
import SystemDrilldownModal from './SystemDrilldownModal';
import { ABBREVIATION_TO_TOPIC_MAP } from '../src/constants';
import type { SystemDrilldownSelection } from './SystemDrilldownModal';
import type { ConditionMeta } from '../src/types/conditions';
import ConditionDetailModal from './ConditionDetailModal';
import DrugDetailModal from './DrugDetailModal';
import { findConditionMetaById } from '../src/lib/conditionSearch';
import { findDrugByName } from '../src/lib/drugSearch';
import { unifiedSearch, type UnifiedSearchResult } from '../src/lib/unifiedSearch';
import type { DrugEntry } from '../src/archived/pharm-old/drugTypes';
import { StreakTracker } from './StreakTracker';
import { QuickReviewMode } from './QuickReviewMode';
import { BookmarksPanel } from './BookmarksPanel';
import { StudyGuideGenerator } from './StudyGuideGenerator';
import {
  WidgetGrid,
  TimeScopeFilter,
  HeatmapCalendar,
  SystemComparison,
  DEFAULT_WIDGET_CONFIG,
  RootCauseAnalysis,
  DailyPrescription,
} from './ProgressDashboard';
import type {
  WidgetId,
  WidgetData,
  TimeScope,
  ProgressDayRecord,
  SystemMasterySummary,
  ErrorTagCount,
} from './ProgressDashboard';
import { calculateAccuracy, calculateStreaks, loadWidgetPreferences } from '../lib/dashboardUtils';
import { getTimeBasedGreeting } from '../lib/utils/timeUtils';
import type { ErrorTag } from '../types';

// System names for dynamic welcome message
const SYSTEM_DISPLAY_NAMES: Record<string, string> = {
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

interface MenuViewProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  onBackToQuiz: () => void; // "Continue Session"
  hasActiveSession: boolean;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onStartSession: () => void;
  onConfirmSession: (settings: SessionSettings) => void;
  growthAreas: string[];
  /** Callback for navigating to dedicated drill mode views */
  onNavigateToDrillMode?: (modeId: string) => void;
  /** Callback for navigating to integrations hub */
  onNavigateToIntegrations?: () => void;
  /** Callback for navigating to social dashboard */
  onNavigateToSocial?: () => void;
  /** Callback for navigating to toolkit hub */
  onNavigateToToolkit?: () => void;
  /** Callback for navigating to gap analysis dashboard */
  onNavigateToGapAnalysis?: () => void;
  /** Callback for navigating to simulation page */
  onNavigateToSimulation?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  syncError?: string | null;
}

// For the heatmap: one row per PANCE system
export interface SystemStats {
  system: SystemCode;
  label: string;
  score: number; // % correct
  correct: number; // # correct
  total: number; // # attempts
}

const MenuView: React.FC<MenuViewProps> = ({
  performanceData,
  missedQuestions,
  flaggedQuestions,
  onBackToQuiz,
  hasActiveSession,
  onStartSession,
  onConfirmSession,
  growthAreas,
  onNavigateToDrillMode,
  onNavigateToIntegrations,
  onNavigateToSocial,
  onNavigateToToolkit,
  onNavigateToGapAnalysis,
  onNavigateToSimulation,
  isSyncing,
  lastSyncTime,
  syncError,
}) => {
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<ConditionMeta | null>(null);
  const [selectedDrug, setSelectedDrug] = useState<DrugEntry | null>(null);

  // New feature modals
  const [showQuickReview, setShowQuickReview] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showStudyGuide, setShowStudyGuide] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const { user } = useUser();

  // Mobile navigation state
  const [activeTab, setActiveTab] = useState<'home' | 'stats' | 'drills' | 'settings'>('home');
  const isMobile = useIsMobile();

  // Dashboard state
  const [timeScope, setTimeScope] = useState<TimeScope>('1wk');
  const defaultWidgets = DEFAULT_WIDGET_CONFIG.filter((w) => w.enabled).map((w) => w.id);
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(() =>
    loadWidgetPreferences<WidgetId>(defaultWidgets)
  );

  const stats = useMemo(() => {
    // Overall score = last 360 questions (any mode) as before
    const last360 = performanceData.slice(-360);
    const correct360 = last360.filter((q) => q.isCorrect).length;
    const overallScore = last360.length > 0 ? (correct360 / last360.length) * 100 : 0;

    // Heatmap: ONLY PANCE-level ALL-topics sessions
    const panceAllRecords = performanceData.filter(
      (r) => r.focus === 'all' && r.difficulty === 'same' && r.system && r.system !== 'OTHER'
    ) as (PerformanceRecord & { system: SystemCode })[];

    const uniqueSystems = Array.from(new Set(panceAllRecords.map((r) => r.system))) as SystemCode[];

    const systemStats: SystemStats[] = uniqueSystems
      .map((system) => {
        const rows = panceAllRecords.filter((r) => r.system === system);
        const correct = rows.filter((r) => r.isCorrect).length;
        const total = rows.length;
        const score = total > 0 ? (correct / total) * 100 : 0;
        const label = ABBREVIATION_TO_TOPIC_MAP[system] || (system as string).toString();
        return {
          system,
          label,
          score,
          correct,
          total,
        };
      })
      // Show systems with more data first
      .sort((a, b) => b.total - a.total);

    // Keep the old topicScores calc if you want it elsewhere later
    const topics: string[] = Array.from(new Set(performanceData.map((q) => q.topic)));
    const topicScores: TopicStats[] = topics
      .map((topic) => {
        const topicQuestions = performanceData.filter((q) => q.topic === topic).slice(-100);
        const correct = topicQuestions.filter((q) => q.isCorrect).length;
        const total = topicQuestions.length;
        const score = total > 0 ? (correct / total) * 100 : 0;
        return { topic, score, correct, total };
      })
      .sort((a, b) => b.total - a.total);

    // Calculate widget data
    const totalQuestions = performanceData.length;
    const totalCorrect = performanceData.filter((r) => r.isCorrect).length;

    // Calculate streaks using utility function
    const { current: currentStreak, best: bestStreak } = calculateStreaks(performanceData);

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = performanceData.filter(
      (r) => new Date(r.timestamp).toISOString().split('T')[0] === today
    );
    const todayQuestions = todayRecords.length;
    const todayCorrect = todayRecords.filter((r) => r.isCorrect).length;

    // This week's stats
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekRecords = performanceData.filter((r) => r.timestamp > weekAgo);
    const weekQuestions = weekRecords.length;
    const weekCorrect = weekRecords.filter((r) => r.isCorrect).length;

    // This month's stats
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const monthRecords = performanceData.filter((r) => r.timestamp > monthAgo);
    const monthQuestions = monthRecords.length;
    const monthCorrect = monthRecords.filter((r) => r.isCorrect).length;

    // Recent trend (last 50 vs previous 50)
    const last50 = performanceData.slice(-50);
    const prev50 = performanceData.slice(-100, -50);
    const last50Accuracy =
      last50.length > 0 ? last50.filter((r) => r.isCorrect).length / last50.length : 0;
    const prev50Accuracy =
      prev50.length > 0 ? prev50.filter((r) => r.isCorrect).length / prev50.length : 0;
    const recentTrend = Math.round((last50Accuracy - prev50Accuracy) * 100);

    // Study days
    const uniqueDays = new Set(
      performanceData.map((r) => new Date(r.timestamp).toISOString().split('T')[0])
    );
    const studyDays = uniqueDays.size;

    // Widget data
    const widgetData: WidgetData = {
      currentStreak,
      bestStreak,
      questionsAttempted: totalQuestions,
      overallAccuracy: calculateAccuracy(totalCorrect, totalQuestions),
      todayQuestions,
      todayCorrect,
      weekQuestions,
      weekCorrect,
      monthQuestions,
      monthCorrect,
      recentTrend,
      studyDays,
    };

    // Heatmap calendar data (last 90 days)
    const heatmapData: ProgressDayRecord[] = [];
    const dailyMap = new Map<string, { attempts: number; correct: number; system: string }>();
    for (const record of performanceData) {
      const date = new Date(record.timestamp).toISOString().split('T')[0] ?? '';
      const existing = dailyMap.get(date) || { attempts: 0, correct: 0, system: '' };
      dailyMap.set(date, {
        attempts: existing.attempts + 1,
        correct: existing.correct + (record.isCorrect ? 1 : 0),
        system: record.system || existing.system || '',
      });
    }
    for (const [date, data] of dailyMap.entries()) {
      heatmapData.push({
        date,
        attempts: data.attempts,
        correct: data.correct,
        accuracy: calculateAccuracy(data.correct, data.attempts),
        system: data.system,
      });
    }

    // System comparison data with trend calculation
    const systemComparisonData: SystemMasterySummary[] = systemStats.map((s) => {
      // Calculate change from last period (last 2 weeks vs 2 weeks before that)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;

      const recentSystemRecords = performanceData.filter(
        (r) => r.system === s.system && r.timestamp > twoWeeksAgo
      );
      const previousSystemRecords = performanceData.filter(
        (r) => r.system === s.system && r.timestamp > fourWeeksAgo && r.timestamp <= twoWeeksAgo
      );

      const recentAccuracy =
        recentSystemRecords.length > 0
          ? recentSystemRecords.filter((r) => r.isCorrect).length / recentSystemRecords.length
          : 0;
      const previousAccuracy =
        previousSystemRecords.length > 0
          ? previousSystemRecords.filter((r) => r.isCorrect).length / previousSystemRecords.length
          : 0;

      const changeFromLastPeriod =
        previousSystemRecords.length >= 3 && recentSystemRecords.length >= 3
          ? Math.round((recentAccuracy - previousAccuracy) * 100)
          : undefined;

      return {
        system: s.system,
        questionsAnswered: s.total,
        masteryScore: s.score / 100, // normalize to 0-1
        changeFromLastPeriod,
      };
    });

    // Error taxonomy counts for Root Cause Analysis
    const errorCounts: ErrorTagCount[] = [
      {
        tag: 'knowledge_gap',
        count: performanceData.filter((r) => !r.isCorrect && r.errorTag === 'knowledge_gap').length,
      },
      {
        tag: 'misread_question',
        count: performanceData.filter((r) => !r.isCorrect && r.errorTag === 'misread_question')
          .length,
      },
      {
        tag: 'guessing',
        count: performanceData.filter((r) => !r.isCorrect && r.errorTag === 'guessing').length,
      },
    ];
    const totalIncorrect = performanceData.filter((r) => !r.isCorrect).length;

    // Vignette Stamina calculations
    const SHORT_THRESHOLD = 50;
    const LONG_THRESHOLD = 150;
    const shortQuestions = performanceData.filter(
      (r) => r.questionWordCount && r.questionWordCount < SHORT_THRESHOLD
    );
    const longQuestions = performanceData.filter(
      (r) => r.questionWordCount && r.questionWordCount > LONG_THRESHOLD
    );

    const shortQuestionAccuracy =
      shortQuestions.length >= 5
        ? Math.round(
            (shortQuestions.filter((r) => r.isCorrect).length / shortQuestions.length) * 100
          )
        : undefined;
    const longQuestionAccuracy =
      longQuestions.length >= 5
        ? Math.round((longQuestions.filter((r) => r.isCorrect).length / longQuestions.length) * 100)
        : undefined;

    // Add vignette stamina data to widget data
    widgetData.shortQuestionAccuracy = shortQuestionAccuracy ?? 0;
    widgetData.longQuestionAccuracy = longQuestionAccuracy ?? 0;

    return {
      overallScore,
      correct360,
      total360: last360.length,
      systemStats,
      topicScores,
      widgetData,
      heatmapData,
      systemComparisonData,
      errorCounts,
      totalIncorrect,
    };
  }, [performanceData]);

  const dueQuestionsCount = useMemo(() => {
    if (!missedQuestions) return 0;
    const today = new Date().toISOString().split('T')[0] ?? '';
    return missedQuestions.filter((q) => q.nextReviewDate && q.nextReviewDate <= today).length;
  }, [missedQuestions]);

  const handleTopicSessionStart = (topicAbbr: string) => {
    onConfirmSession({
      focus: 'topic',
      difficulty: 'same',
      topic: topicAbbr,
    });
  };

  // Handler for starting a focused session from Daily Prescription
  const handleStartFocusSession = (system: SystemCode) => {
    onConfirmSession({
      focus: 'topic',
      difficulty: 'same',
      topic: system,
    });
  };

  // Unified search results with intelligent ranking
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await unifiedSearch(searchQuery);
        if (isMounted) {
          setSearchResults(results as UnifiedSearchResult[]);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    };

    performSearch();

    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  // Check if we have any search results
  const hasSearchResults = searchResults.length > 0;

  return (
    <>
      <AnimatePresence></AnimatePresence>

      {selectedSystem && (
        <SystemDrilldownModal
          system={selectedSystem}
          performanceData={performanceData}
          onClose={() => setSelectedSystem(null)}
          onDrillSubcategory={({ system, subcategory }) => {
            if (!system) return;
            onConfirmSession({
              focus: 'topic',
              difficulty: 'same',
              topic: system,
              subcategoryName: subcategory,
            });
          }}
        />
      )}

      {selectedCondition && (
        <ConditionDetailModal
          condition={selectedCondition}
          onClose={() => setSelectedCondition(null)}
          onDrillCondition={(meta) => {
            onConfirmSession({
              focus: 'topic',
              difficulty: 'same',
              topic: meta.system,
              conditionName: meta.condition,
            });
            setSelectedCondition(null);
          }}
        />
      )}

      {selectedDrug && (
        <DrugDetailModal drug={selectedDrug} onClose={() => setSelectedDrug(null)} />
      )}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
          <div className="grid grid-cols-4 gap-0">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center justify-center py-3 transition-colors ${
                activeTab === 'home'
                  ? 'text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Home className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Home</span>
            </button>
            <button
              onClick={() => setActiveTab('drills')}
              className={`flex flex-col items-center justify-center py-3 transition-colors ${
                activeTab === 'drills'
                  ? 'text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Dumbbell className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Drills</span>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex flex-col items-center justify-center py-3 transition-colors ${
                activeTab === 'stats'
                  ? 'text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Stats</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center justify-center py-3 transition-colors ${
                activeTab === 'settings'
                  ? 'text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Profile</span>
            </button>
          </div>
        </div>
      )}

      <div className={`flex flex-col max-w-5xl mx-auto px-4 ${isMobile ? 'pb-20' : ''}`}>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-[var(--color-accent)] mb-3 text-center sr-only"
        >
          PANaCEa
        </motion.h1>

        {/* Premium Glass Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-2xl mx-auto mb-10 relative"
        >
          <div className="flex justify-center">
            <input
              id="condition-search"
              name="condition-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conditions or medications (e.g., ACS, Fluoxetine, DKA, Metoprolol)..."
              className="w-full px-5 py-3.5 border border-[var(--color-border)] bg-[var(--color-glass-bg)] backdrop-blur-xl text-[var(--color-text-primary)] rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] focus:scale-[1.01] transition-all duration-300 placeholder:text-[var(--color-text-muted)]"
              autoComplete="off"
            />
          </div>
          <AnimatePresence>
            {hasSearchResults && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-30 mt-2 w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-xl shadow-lg max-h-80 overflow-y-auto"
              >
                {/* Unified search results - intelligently ranked */}
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={async () => {
                      if (result.type === 'condition' && result.conditionData) {
                        const meta = await findConditionMetaById(result.id);
                        if (meta) {
                          setSelectedCondition(meta);
                        }
                      } else if (result.type === 'drug' && result.drugData) {
                        const drug = await findDrugByName(result.drugData.drugName);
                        if (drug) {
                          setSelectedDrug(drug);
                        }
                      }
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      {/* Icon badge */}
                      <span className="flex-shrink-0 mt-1">
                        {result.type === 'condition' ? (
                          <Hospital className="w-4 h-4 text-[var(--color-accent)]" />
                        ) : (
                          <Pill className="w-4 h-4 text-[var(--color-accent)]" />
                        )}
                      </span>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="font-semibold text-[var(--color-text-primary]">
                          {result.name}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                          {result.subtitle}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="space-y-10">
          {/* Home Tab Content (or all content on desktop) */}
          {(!isMobile || activeTab === 'home') && (
            <>
              {/* Welcome Card - Prioritized at Top */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <h2 className="text-3xl font-light tracking-tight text-slate-900 dark:text-slate-100 mb-2">
                  {getTimeBasedGreeting()}.
                </h2>
                {stats.systemComparisonData.length > 0 && stats.systemComparisonData[0] ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Your recommended focus is{' '}
                    <span className="font-semibold text-[var(--color-accent)]">
                      {SYSTEM_DISPLAY_NAMES[stats.systemComparisonData[0].system] ||
                        stats.systemComparisonData[0].system}
                    </span>
                    .
                  </p>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Start studying to unlock personalized recommendations.
                  </p>
                )}
              </motion.section>

              {/* Daily Prescription - Smart Action Card */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <DailyPrescription
                  performanceData={performanceData}
                  onStartFocusSession={handleStartFocusSession}
                />
              </motion.section>

              {/* Session controls */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center space-y-3"
              >
                {hasActiveSession && (
                  <motion.button
                    onClick={onBackToQuiz}
                    className="w-full px-6 py-3 btn-glass font-bold rounded-xl"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    Continue Study Session
                  </motion.button>
                )}
                <motion.button
                  onClick={() => onNavigateToSimulation?.()}
                  className="w-full px-6 py-4 btn-glass text-lg font-bold tracking-tight rounded-xl"
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Start Adaptive Session
                </motion.button>
              </motion.section>
            </>
          )}

          {/* Drills Tab Content (or all content on desktop) */}
          {(!isMobile || activeTab === 'drills') && (
            <>
              {/* Quick Actions - New Feature Shortcuts */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.23 }}
                className="pt-2"
              >
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
                  Quick Actions
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Gap Analysis Button */}
                  {onNavigateToGapAnalysis && (
                    <motion.button
                      onClick={onNavigateToGapAnalysis}
                      className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 text-left relative overflow-hidden group"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="absolute top-0 right-0 p-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      </div>
                      <BarChart3 className="w-8 h-8 mb-2 text-emerald-500" />
                      <div className="font-semibold text-sm text-slate-900 dark:text-white">
                        Gap Analysis
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Peer Benchmarks
                      </div>
                    </motion.button>
                  )}

                  <motion.button
                    onClick={() => setShowQuickReview(true)}
                    className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 text-left"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <RotateCcw className="w-8 h-8 mb-2 text-blue-500" />
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                      Quick Review
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Recent misses</div>
                  </motion.button>

                  <motion.button
                    onClick={() => setShowBookmarks(true)}
                    className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 text-left"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Bookmark className="w-8 h-8 mb-2 text-slate-400" />
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                      Bookmarks
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Saved questions
                    </div>
                  </motion.button>

                  <motion.button
                    onClick={() => setShowStudyGuide(true)}
                    className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 text-left"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FileText className="w-8 h-8 mb-2 text-slate-500" />
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                      Study Guide
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Print/Export</div>
                  </motion.button>

                  <motion.button
                    onClick={() => setShowLeaderboard(true)}
                    className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 text-left"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Award className="w-8 h-8 mb-2 text-slate-400" />
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                      Leaderboard
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Compare stats</div>
                  </motion.button>

                  {onNavigateToIntegrations && (
                    <motion.button
                      onClick={onNavigateToIntegrations}
                      className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 text-left"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Link2 className="w-8 h-8 mb-2 text-indigo-500" />
                      <div className="font-semibold text-sm text-slate-900 dark:text-white">
                        Integrations
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Anki, Calendar
                      </div>
                    </motion.button>
                  )}

                  {onNavigateToSocial && (
                    <motion.button
                      onClick={onNavigateToSocial}
                      className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 text-left"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Users className="w-8 h-8 mb-2 text-pink-500" />
                      <div className="font-semibold text-sm text-slate-900 dark:text-white">
                        Social
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Groups & Friends
                      </div>
                    </motion.button>
                  )}

                  {onNavigateToToolkit && (
                    <motion.button
                      onClick={onNavigateToToolkit}
                      className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 text-left"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <GraduationCap className="w-8 h-8 mb-2 text-emerald-500" />
                      <div className="font-semibold text-sm text-slate-900 dark:text-white">
                        Toolkit Hub
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Learning Resources
                      </div>
                    </motion.button>
                  )}
                </div>
              </motion.section>
            </>
          )}

          {/* Stats Tab Content (or all content on desktop) */}
          {(!isMobile || activeTab === 'stats') && (
            <>
              {/* Streak Tracker */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
              >
                <StreakTracker
                  currentStreak={stats.widgetData.currentStreak}
                  bestStreak={stats.widgetData.bestStreak}
                  lastStudyDate={(() => {
                    const lastRecord = performanceData[performanceData.length - 1];
                    return lastRecord
                      ? (new Date(lastRecord.timestamp).toISOString().split('T')[0] ?? '')
                      : undefined;
                  })()}
                />
              </motion.section>

              {/* Analytics Dashboard */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="pt-2"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Analytics Dashboard
                  </h2>
                  <TimeScopeFilter value={timeScope} onChange={setTimeScope} />
                </div>

                {/* Widget Grid */}
                <WidgetGrid
                  data={stats.widgetData}
                  enabledWidgets={enabledWidgets}
                  timeScope={timeScope}
                />

                {/* Root Cause Analysis Widget - shows breakdown of why questions are missed */}
                {stats.totalIncorrect > 0 && (
                  <div className="mt-6">
                    <RootCauseAnalysis
                      errorCounts={stats.errorCounts}
                      totalIncorrect={stats.totalIncorrect}
                    />
                  </div>
                )}
              </motion.section>

              {/* Study Activity Heatmap */}
              {stats.heatmapData.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <HeatmapCalendar records={stats.heatmapData} metric="attempts" weeks={12} />
                </motion.section>
              )}

              {/* System Comparison */}
              {stats.systemComparisonData.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <SystemComparison
                    summary={stats.systemComparisonData}
                    onSystemClick={(system) => setSelectedSystem(system as SystemCode)}
                  />
                </motion.section>
              )}

              {/* System Mastery Grid – now by PANCE system */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-5">
                  System Mastery Grid
                </h2>
                <TopicHeatmap
                  topicScores={stats.topicScores || []}
                  onTopicClick={(topicStats) => {
                    // topicStats is a TopicStats object; its `.topic` is your "CV", "GI", etc.
                    setSelectedSystem(topicStats.topic as SystemCode);
                  }}
                />
              </motion.section>
            </>
          )}

          {/* Settings Tab Content (Mobile only) */}
          {isMobile && activeTab === 'settings' && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
                Settings & Profile
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-500" />
                    <span className="font-medium text-slate-900 dark:text-white">Account</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {user?.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
                <button
                  onClick={() => onNavigateToIntegrations?.()}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-slate-500" />
                    <span className="font-medium text-slate-900 dark:text-white">Preferences</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>
                <div className="pt-4">
                  <SignOutButton>
                    <button className="w-full px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                      Sign Out
                    </button>
                  </SignOutButton>
                </div>
              </div>
            </motion.section>
          )}
        </div>
      </div>

      {/* New Feature Modals */}
      {showQuickReview && (
        <QuickReviewMode
          missedQuestions={missedQuestions}
          onClose={() => setShowQuickReview(false)}
          onStartReview={(questions) => {
            // Start a review session with the selected questions
            setShowQuickReview(false);
            // Note: Full implementation would trigger a special review session mode
            // For now, this demonstrates the flow
            onConfirmSession({
              focus: 'review',
              difficulty: 'same',
            });
          }}
        />
      )}

      {showBookmarks && (
        <BookmarksPanel
          bookmarkedQuestions={missedQuestions.filter((q) => q.isBookmarked) || []}
          onRemoveBookmark={(question) => {
            // Update question bookmark status
            // Note: Full implementation would update in parent state/database
            const updatedQuestion = { ...question, isBookmarked: false };
          }}
          onViewQuestion={async (question) => {
            // Open question in a review modal or navigate to it
            const meta = await findConditionMetaById(question.conditionId);
            if (meta) {
              setSelectedCondition(meta);
            }
            setShowBookmarks(false);
          }}
          onClose={() => setShowBookmarks(false)}
        />
      )}

      {showStudyGuide && (
        <StudyGuideGenerator
          questions={missedQuestions}
          title="Missed Questions Study Guide"
          onClose={() => setShowStudyGuide(false)}
        />
      )}

      {showLeaderboard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowLeaderboard(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-yellow-500" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Grand Rounds</h2>
              </div>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              The daily competitive leaderboard has moved to Grand Rounds mode. Compete against
              other students with speed-weighted scoring!
            </p>
            <button
              onClick={() => {
                setShowLeaderboard(false);
                onNavigateToDrillMode?.('grand_rounds');
              }}
              className="w-full px-6 py-3 bg-muted-amber-500 hover:bg-muted-amber-600 text-white rounded-lg font-semibold transition-colors"
            >
              Go to Grand Rounds
            </button>
          </motion.div>
        </motion.div>
      )}
    </>
  );
};

export default MenuView;
