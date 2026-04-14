// src/components/MenuView.tsx

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, SignOutButton } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
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
import { useIsMobile } from '@/lib/utils/responsive';
import { useDatabaseStats } from '@/hooks/useDatabaseStats';
import type { PerformanceRecord, SessionSettings, Question, TopicStats, SystemCode } from '@/types';
import type { QuizQuestion } from '@/types';
import TrainingMenu from '@/components/dashboard/TrainingMenu';
import ProgressRing from '@/components/ui/ProgressRing';
import TopicHeatmap from '@/components/analytics/TopicHeatmap';
import SystemDrilldownModal from '@/components/modals/SystemDrilldownModal';
import { ABBREVIATION_TO_TOPIC_MAP, getSystemDisplayFullName } from "@/config/topic-map";
import type { SystemDrilldownSelection } from '@/components/modals/SystemDrilldownModal';
import type { ConditionMeta } from "@/types/conditions";
import ConditionDetailModal from '@/components/modals/ConditionDetailModal';
import DrugDetailModal from '@/components/modals/DrugDetailModal';
import { findConditionMetaById } from '@/lib/conditionSearch';
import { findDrugByName } from '@/lib/drugSearch';
import { unifiedSearch, type UnifiedSearchResult } from '@/lib/unifiedSearch';
import type { DrugEntry } from '@/types/pharm';
import { StreakTracker } from '@/components/analytics/StreakTracker';
import { QuickReviewMode } from '@/components/session/QuickReviewMode';
import { BookmarksPanel } from '@/components/panels/BookmarksPanel';
import { StudyGuideGenerator } from '@/components/toolkit/StudyGuideGenerator';
import {
  WidgetGrid,
  TimeScopeFilter,
  HeatmapCalendar,
  SystemComparison,
  DEFAULT_WIDGET_CONFIG,
  RootCauseAnalysis,
  DailyPrescription,
} from '@/components/progress-dashboard';
import type {
  WidgetId,
  WidgetData,
  TimeScope,
  ProgressDayRecord,
  SystemMasterySummary,
  ErrorTagCount,
} from '@/components/progress-dashboard';
import { calculateAccuracy, calculateDayStreak, loadWidgetPreferences } from '@/lib/dashboardUtils';
import { getTimeBasedGreeting } from '@/lib/utils/timeUtils';
import { TO_REVIEW_STUDY_GUIDE } from '@/config/labels';
import type { ErrorTag } from '@/types';

interface MenuViewProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  onBackToQuiz: () => void; // "Continue Session"
  hasActiveSession: boolean;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onStartSession: () => void;
  onConfirmSession: (settings: SessionSettings, preloadedQueue?: QuizQuestion[]) => void;
  /** Callback to remove a question from bookmarks */
  onRemoveBookmark?: (question: Question) => void;
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
  onNavigateToSimulation?: (settings?: {
    initialFocus?: 'all' | 'growth' | 'flagged' | 'due';
  }) => void;
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
  onRemoveBookmark,
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

  useEffect(() => {
    if (!showLeaderboard) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLeaderboard(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLeaderboard]);

  // Mobile navigation state
  const [activeTab, setActiveTab] = useState<'home' | 'stats' | 'drills' | 'settings'>('home');
  const isMobile = useIsMobile();

  // Dashboard state
  const [timeScope, setTimeScope] = useState<TimeScope>('1wk');
  const defaultWidgets = DEFAULT_WIDGET_CONFIG.filter((w) => w.enabled).map((w) => w.id);
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(() =>
    loadWidgetPreferences<WidgetId>(defaultWidgets)
  );

  // Server stats: when signed in, use as source of truth for topicScores/systemStats when available
  const { stats: serverStats } = useDatabaseStats();

  const stats = useMemo(() => {
    // Overall score = last 360 questions (any mode) as before
    const last360 = performanceData.slice(-360);
    const correct360 = last360.filter((q) => q.isCorrect).length;
    const overallScore = last360.length > 0 ? (correct360 / last360.length) * 100 : 0;

    // Heatmap: ALL-topics sessions (all questions are PANCE-level)
    const panceAllRecords = performanceData.filter(
      (r) => r.focus === 'all' && r.system && r.system !== 'OTHER'
    ) as (PerformanceRecord & { system: SystemCode })[];

    const uniqueSystems = Array.from(new Set(panceAllRecords.map((r) => r.system))) as SystemCode[];

    const localSystemStats: SystemStats[] = uniqueSystems
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
      .sort((a, b) => b.total - a.total);

    // Prefer server bySystems for topicScores/systemStats when available; fallback to local
    const systemStats: SystemStats[] =
      serverStats?.bySystems && Object.keys(serverStats.bySystems).length > 0
        ? Object.entries(serverStats.bySystems)
            .filter(([, s]) => s.total > 0)
            .map(([system, s]) => ({
              system: system as SystemCode,
              label: ABBREVIATION_TO_TOPIC_MAP[system as SystemCode] || system,
              score: s.accuracy,
              correct: s.correct,
              total: s.total,
            }))
            .sort((a, b) => b.total - a.total)
        : localSystemStats;

    const localTopicScores: TopicStats[] = (() => {
      const topics: string[] = Array.from(new Set(performanceData.map((q) => q.topic)));
      return topics
        .map((topic) => {
          const topicQuestions = performanceData.filter((q) => q.topic === topic).slice(-100);
          const correct = topicQuestions.filter((q) => q.isCorrect).length;
          const total = topicQuestions.length;
          const score = total > 0 ? (correct / total) * 100 : 0;
          return { topic, score, correct, total };
        })
        .sort((a, b) => b.total - a.total);
    })();

    const topicScores: TopicStats[] =
      serverStats?.bySystems && Object.keys(serverStats.bySystems).length > 0
        ? Object.entries(serverStats.bySystems)
            .filter(([, s]) => s.total > 0)
            .map(([topic, s]) => ({ topic, score: s.accuracy, correct: s.correct, total: s.total }))
            .sort((a, b) => b.total - a.total)
        : localTopicScores;

    // Calculate widget data
    const totalQuestions = performanceData.length;
    const totalCorrect = performanceData.filter((r) => r.isCorrect).length;

    // Day streak (consecutive days studied) - sync with Dashboard
    const { current: currentStreak, best: bestStreak } = calculateDayStreak(performanceData);

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
  }, [performanceData, serverStats]);

  const dueQuestionsCount = useMemo(() => {
    if (!missedQuestions) return 0;
    const today = new Date().toISOString().split('T')[0] ?? '';
    return missedQuestions.filter((q) => q.nextReviewDate && q.nextReviewDate <= today).length;
  }, [missedQuestions]);

  const handleTopicSessionStart = (topicAbbr: string) => {
    onConfirmSession({
      focus: 'topic',
      topic: topicAbbr,
    });
  };

  // Handler for starting a focused session from Daily Prescription
  const handleStartFocusSession = (system: SystemCode) => {
    onConfirmSession({
      focus: 'topic',
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
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg-secondary)]/90 backdrop-blur-md border-t border-[var(--color-border)] shadow-[0_-4px_6px_-1px_var(--color-shadow-soft)]">
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
          initial={{ y: -10 }}
          animate={{ y: 0 }}
          className="text-3xl font-semibold text-[var(--color-accent)] mb-3 text-center sr-only"
        >
          PANaCEa
        </motion.h1>

        {/* Premium Glass Search Bar */}
        <motion.div
          initial={{ y: 10 }}
          animate={{ y: 0 }}
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
              aria-label="Search conditions or medications"
              className="w-full px-5 py-3.5 bg-[var(--color-glass-bg)] backdrop-blur-xl text-[var(--color-text-primary)] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:scale-[1.01] transition-all duration-300 placeholder:text-[var(--color-text-muted)]"
              style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}
              autoComplete="off"
            />
          </div>
          <AnimatePresence>
            {hasSearchResults && (
              <motion.div
                initial={{ y: -10 }}
                animate={{ y: 0 }}
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
                        <span className="font-semibold text-[var(--color-text-primary)]">
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
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                className="bg-[var(--color-bg-secondary)] rounded-2xl p-6"
                style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}
              >
                <h2 className="text-3xl font-light tracking-tight text-[var(--color-text-primary)] mb-2">
                  {getTimeBasedGreeting()}.
                </h2>
                {stats.systemComparisonData.length > 0 && stats.systemComparisonData[0] ? (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Your recommended focus is{' '}
                    <span className="font-semibold text-[var(--color-accent)]">
                      {getSystemDisplayFullName(stats.systemComparisonData[0].system)}
                    </span>
                    .
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Start studying to unlock personalized recommendations.
                  </p>
                )}
              </motion.section>

              {/* Daily Prescription - Smart Action Card */}
              <motion.section
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <DailyPrescription
                  performanceData={performanceData}
                  onStartFocusSession={handleStartFocusSession}
                />
              </motion.section>

              {/* Micro-study chips - 5–15 min sessions for clinical students */}
              <motion.div
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.18 }}
                className="flex flex-wrap gap-2 justify-center"
              >
                <Button
                  variant="outline"
                  onClick={() => onConfirmSession({ focus: 'all', count: 10 })}
                >
                  Quick 10 (~5 min)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onConfirmSession({ focus: 'all', count: 30 })}
                >
                  Quick 30 (~15 min)
                </Button>
              </motion.div>

              {/* Session controls */}
              <motion.section
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center space-y-3"
              >
                {hasActiveSession && (
                  <motion.button
                    onClick={onBackToQuiz}
                    className="w-full px-6 py-3 btn-glass font-semibold rounded-xl"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    Continue Study Session
                  </motion.button>
                )}
                <motion.button
                  onClick={() => onNavigateToSimulation?.()}
                  className="w-full px-6 py-4 btn-glass text-lg font-semibold tracking-tight rounded-xl"
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
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.23 }}
                className="pt-2"
              >
                <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)] mb-4">
                  Quick Actions
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Gap Analysis Button */}
                  {onNavigateToGapAnalysis && (
                    <motion.button
                      onClick={onNavigateToGapAnalysis}
                      className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all duration-200 text-left relative overflow-hidden group"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="absolute top-0 right-0 p-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-data-pass opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-data-pass"></span>
                        </span>
                      </div>
                      <BarChart3 className="w-8 h-8 mb-2 text-data-pass" />
                      <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                        Gap Analysis
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Peer Benchmarks</div>
                    </motion.button>
                  )}

                  <motion.button
                    onClick={() => setShowQuickReview(true)}
                    className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all duration-200 text-left"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <RotateCcw className="w-8 h-8 mb-2 text-[var(--color-category-practice)]" />
                    <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                      Quick Review
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Recent misses</div>
                  </motion.button>

                  <motion.button
                    onClick={() => setShowBookmarks(true)}
                    className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all duration-200 text-left"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Bookmark className="w-8 h-8 mb-2 text-data-neutral" />
                    <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                      Bookmarks
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Saved questions</div>
                  </motion.button>

                  <motion.button
                    onClick={() => setShowStudyGuide(true)}
                    className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all duration-200 text-left"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FileText className="w-8 h-8 mb-2 text-data-neutral" />
                    <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                      Study Guide
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Print/Export</div>
                  </motion.button>

                  <motion.button
                    onClick={() => setShowLeaderboard(true)}
                    className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all duration-200 text-left"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Award className="w-8 h-8 mb-2 text-data-neutral" />
                    <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                      Leaderboard
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Compare stats</div>
                  </motion.button>

                  {onNavigateToIntegrations && (
                    <motion.button
                      onClick={onNavigateToIntegrations}
                      className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all duration-200 text-left"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Link2 className="w-8 h-8 mb-2 text-[var(--color-accent)]" />
                      <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                        Integrations
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Anki, Calendar</div>
                    </motion.button>
                  )}

                  {/* HIDDEN: Social/Study Groups feature (API not implemented in Cloudflare Functions)
                  {onNavigateToSocial && (
                    <motion.button
                      onClick={onNavigateToSocial}
                      className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all duration-200 text-left"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Users className="w-8 h-8 mb-2 text-[var(--color-accent)]" />
                      <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                        Social
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Groups & Friends
                      </div>
                    </motion.button>
                  )}
                  */}

                  {onNavigateToToolkit && (
                    <motion.button
                      onClick={onNavigateToToolkit}
                      className="p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] hover:shadow-md transition-all duration-200 text-left"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <GraduationCap className="w-8 h-8 mb-2 text-data-pass" />
                      <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                        Toolkit Hub
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
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
                initial={{ y: 10 }}
                animate={{ y: 0 }}
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
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.25 }}
                className="pt-2"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
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
                  initial={{ y: 10 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <HeatmapCalendar records={stats.heatmapData} metric="attempts" weeks={12} />
                </motion.section>
              )}

              {/* System Comparison */}
              {stats.systemComparisonData.length > 0 && (
                <motion.section
                  initial={{ y: 10 }}
                  animate={{ y: 0 }}
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
                initial={{ y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-2">
                  System Mastery Grid
                </h2>
                {(!stats.topicScores || stats.topicScores.length === 0) && (
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    Complete 5+ questions per system to unlock mastery tracking.
                  </p>
                )}
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
              initial={{ y: 10 }}
              animate={{ y: 0 }}
              className="bg-[var(--color-bg-secondary)] rounded-2xl p-6"
              style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)' }}
            >
              <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-6">
                Settings & Profile
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-data-neutral rounded-xl">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-data-neutral" />
                    <span className="font-medium text-[var(--color-text-primary)]">Account</span>
                  </div>
                  <span className="text-sm text-data-neutral">
                    {user?.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
                <button
                  onClick={() => onNavigateToIntegrations?.()}
                  className="w-full flex items-center justify-between p-4 bg-data-neutral rounded-xl hover:bg-data-neutral dark:hover:bg-data-neutral transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-data-neutral" />
                    <span className="font-medium text-[var(--color-text-primary)]">
                      Preferences
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-data-neutral" />
                </button>
                <div className="pt-4">
                  <SignOutButton>
                    <Button variant="secondary" className="w-full">
                      Sign Out
                    </Button>
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
            setShowQuickReview(false);
            onConfirmSession(
              { focus: 'review', count: questions.length },
              questions
            );
          }}
        />
      )}

      {showBookmarks && (
        <BookmarksPanel
          bookmarkedQuestions={missedQuestions.filter((q) => q.isBookmarked) || []}
          onRemoveBookmark={(question) => {
            onRemoveBookmark?.(question);
          }}
          onStartSession={() => onStartSession?.()}
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
          title={TO_REVIEW_STUDY_GUIDE}
          onClose={() => setShowStudyGuide(false)}
        />
      )}

      {showLeaderboard && (
        <motion.div
          initial={false}
          animate={{}}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4"
          onClick={() => setShowLeaderboard(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Leaderboard"
            className="bg-[var(--color-bg-secondary)] rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-[var(--color-accent)]" />
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  Grand Rounds
                </h2>
              </div>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="p-2 hover:bg-data-neutral dark:hover:bg-data-neutral rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-data-neutral mb-6">
              The daily competitive leaderboard has moved to Grand Rounds mode. Compete against
              other students with speed-weighted scoring!
            </p>
            <button
              onClick={() => {
                setShowLeaderboard(false);
                onNavigateToDrillMode?.('grand_rounds');
              }}
              className="w-full px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-[var(--color-text-inverse)] rounded-lg font-semibold transition-colors"
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
