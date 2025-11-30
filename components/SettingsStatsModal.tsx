import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Settings, 
  BarChart3, 
  Sun, 
  Moon, 
  Trash2, 
  Download,
  Upload,
  TrendingUp,
  Target,
  Award,
  Calendar,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Eye,
  EyeOff,
  GripVertical
} from 'lucide-react';
import type { PerformanceRecord, SystemCode, DashboardStatId, DashboardSettings } from '@/types';
import { DEFAULT_DASHBOARD_SETTINGS } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/constants';

/** Available dashboard stat options with metadata */
const DASHBOARD_STAT_OPTIONS: Array<{ id: DashboardStatId; label: string; description: string; icon: React.ReactNode }> = [
  { id: 'overallScore', label: 'Overall Score', description: 'Your overall accuracy percentage', icon: <Target className="w-4 h-4" /> },
  { id: 'totalQuestions', label: 'Total Questions', description: 'Total questions answered', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'currentStreak', label: 'Current Streak', description: 'Your current correct answer streak', icon: <Zap className="w-4 h-4" /> },
  { id: 'bestStreak', label: 'Best Streak', description: 'Your highest correct answer streak', icon: <Award className="w-4 h-4" /> },
  { id: 'recentTrend', label: 'Recent Trend', description: 'Performance trend vs previous sessions', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'studyDays', label: 'Study Days', description: 'Number of days studied', icon: <Calendar className="w-4 h-4" /> },
  { id: 'avgQuestionsPerDay', label: 'Avg Questions/Day', description: 'Average questions per study day', icon: <Clock className="w-4 h-4" /> },
  { id: 'todayProgress', label: "Today's Progress", description: "Today's correct/total questions", icon: <Clock className="w-4 h-4" /> },
  { id: 'weekProgress', label: 'Week Progress', description: "This week's correct/total questions", icon: <Calendar className="w-4 h-4" /> },
];

interface SettingsStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  performanceData: PerformanceRecord[];
  clearPerformanceData: () => void;
  clearMissedQuestionsData: () => void;
  clearFlaggedQuestionsData: () => void;
  missedQuestionsCount: number;
  flaggedQuestionsCount: number;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  dashboardSettings?: DashboardSettings;
  onUpdateDashboardSettings?: (settings: DashboardSettings) => void;
}

type TabId = 'stats' | 'settings' | 'dashboard';

/**
 * SettingsStatsModal - Comprehensive settings and statistics view
 */
const SettingsStatsModal: React.FC<SettingsStatsModalProps> = ({
  isOpen,
  onClose,
  performanceData,
  clearPerformanceData,
  clearMissedQuestionsData,
  clearFlaggedQuestionsData,
  missedQuestionsCount,
  flaggedQuestionsCount,
  theme = 'light',
  onToggleTheme,
  dashboardSettings = DEFAULT_DASHBOARD_SETTINGS,
  onUpdateDashboardSettings,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmClear, setConfirmClear] = useState<string | null>(null);

  // Toggle stat visibility
  const toggleStat = (statId: DashboardStatId) => {
    if (!onUpdateDashboardSettings) return;
    
    const currentVisible = dashboardSettings.visibleStats;
    const isVisible = currentVisible.includes(statId);
    
    let newVisible: DashboardStatId[];
    if (isVisible) {
      newVisible = currentVisible.filter(id => id !== statId);
    } else {
      newVisible = [...currentVisible, statId];
    }
    
    onUpdateDashboardSettings({
      ...dashboardSettings,
      visibleStats: newVisible,
    });
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (performanceData.length === 0) {
      return {
        totalQuestions: 0,
        totalCorrect: 0,
        overallAccuracy: 0,
        currentStreak: 0,
        bestStreak: 0,
        todayQuestions: 0,
        todayCorrect: 0,
        weekQuestions: 0,
        weekCorrect: 0,
        systemBreakdown: [] as Array<{ system: string; label: string; correct: number; total: number; accuracy: number }>,
        recentTrend: 0,
        studyDays: 0,
        avgQuestionsPerDay: 0,
      };
    }

    const totalQuestions = performanceData.length;
    const totalCorrect = performanceData.filter(r => r.isCorrect).length;
    const overallAccuracy = Math.round((totalCorrect / totalQuestions) * 100);

    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (let i = performanceData.length - 1; i >= 0; i--) {
      if (performanceData[i].isCorrect) {
        tempStreak++;
        if (i === performanceData.length - 1 || 
            (i < performanceData.length - 1 && performanceData[i + 1].isCorrect)) {
          currentStreak = tempStreak;
        }
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
        if (i === performanceData.length - 1) {
          currentStreak = 0;
        }
      }
    }

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = performanceData.filter(r => 
      new Date(r.timestamp).toISOString().split('T')[0] === today
    );
    const todayQuestions = todayRecords.length;
    const todayCorrect = todayRecords.filter(r => r.isCorrect).length;

    // This week's stats
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekRecords = performanceData.filter(r => r.timestamp > weekAgo);
    const weekQuestions = weekRecords.length;
    const weekCorrect = weekRecords.filter(r => r.isCorrect).length;

    // System breakdown
    const systemMap = new Map<string, { correct: number; total: number }>();
    performanceData.forEach(r => {
      if (r.system && r.system !== 'OTHER') {
        const existing = systemMap.get(r.system) || { correct: 0, total: 0 };
        systemMap.set(r.system, {
          correct: existing.correct + (r.isCorrect ? 1 : 0),
          total: existing.total + 1,
        });
      }
    });

    const systemBreakdown = Array.from(systemMap.entries())
      .map(([system, data]) => ({
        system,
        label: ABBREVIATION_TO_TOPIC_MAP[system as SystemCode] || system,
        correct: data.correct,
        total: data.total,
        accuracy: Math.round((data.correct / data.total) * 100),
      }))
      .sort((a, b) => b.total - a.total);

    // Recent trend (last 50 vs previous 50)
    const last50 = performanceData.slice(-50);
    const prev50 = performanceData.slice(-100, -50);
    const last50Accuracy = last50.length > 0 
      ? last50.filter(r => r.isCorrect).length / last50.length 
      : 0;
    const prev50Accuracy = prev50.length > 0 
      ? prev50.filter(r => r.isCorrect).length / prev50.length 
      : 0;
    const recentTrend = Math.round((last50Accuracy - prev50Accuracy) * 100);

    // Study days
    const uniqueDays = new Set(
      performanceData.map(r => new Date(r.timestamp).toISOString().split('T')[0])
    );
    const studyDays = uniqueDays.size;
    const avgQuestionsPerDay = studyDays > 0 ? Math.round(totalQuestions / studyDays) : 0;

    return {
      totalQuestions,
      totalCorrect,
      overallAccuracy,
      currentStreak,
      bestStreak,
      todayQuestions,
      todayCorrect,
      weekQuestions,
      weekCorrect,
      systemBreakdown,
      recentTrend,
      studyDays,
      avgQuestionsPerDay,
    };
  }, [performanceData]);

  const handleClear = (type: string) => {
    if (confirmClear === type) {
      if (type === 'performance') clearPerformanceData();
      else if (type === 'missed') clearMissedQuestionsData();
      else if (type === 'flagged') clearFlaggedQuestionsData();
      setConfirmClear(null);
    } else {
      setConfirmClear(type);
      setTimeout(() => setConfirmClear(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[var(--color-bg-tertiary)] rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[var(--color-border)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-[var(--color-accent)]/10 rounded-lg">
                {activeTab === 'stats' ? (
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" />
                ) : activeTab === 'dashboard' ? (
                  <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" />
                ) : (
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" />
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">
                {activeTab === 'stats' ? 'Statistics' : activeTab === 'dashboard' ? 'Dashboard' : 'Settings'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-[var(--color-border)]">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                activeTab === 'stats'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline-block mr-2" />
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 inline-block mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Settings
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-4 sm:p-6">
            {activeTab === 'stats' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 sm:p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-[var(--color-accent)]">
                      {stats.overallAccuracy}%
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Overall Accuracy</div>
                  </div>
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 sm:p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
                      {stats.totalQuestions}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Total Questions</div>
                  </div>
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 sm:p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="w-5 h-5 text-orange-500" />
                      <span className="text-2xl sm:text-3xl font-bold text-orange-500">
                        {stats.currentStreak}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Current Streak</div>
                  </div>
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 sm:p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Award className="w-5 h-5 text-amber-500" />
                      <span className="text-2xl sm:text-3xl font-bold text-amber-500">
                        {stats.bestStreak}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">Best Streak</div>
                  </div>
                </div>

                {/* Trend & Activity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className={`w-5 h-5 ${stats.recentTrend >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                      <span className="font-medium text-[var(--color-text-primary)]">Recent Trend</span>
                    </div>
                    <div className={`text-2xl font-bold ${stats.recentTrend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {stats.recentTrend >= 0 ? '+' : ''}{stats.recentTrend}%
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Comparing last 50 vs previous 50 questions
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <span className="font-medium text-[var(--color-text-primary)]">Study Activity</span>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <div>
                        <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.studyDays}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">Days Studied</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.avgQuestionsPerDay}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">Avg/Day</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Today & Week */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">Today</span>
                    </div>
                    <div className="text-xl font-bold text-[var(--color-text-primary)]">
                      {stats.todayCorrect}/{stats.todayQuestions}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {stats.todayQuestions > 0 
                        ? Math.round((stats.todayCorrect / stats.todayQuestions) * 100) 
                        : 0}% accuracy
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">This Week</span>
                    </div>
                    <div className="text-xl font-bold text-[var(--color-text-primary)]">
                      {stats.weekCorrect}/{stats.weekQuestions}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {stats.weekQuestions > 0 
                        ? Math.round((stats.weekCorrect / stats.weekQuestions) * 100) 
                        : 0}% accuracy
                    </div>
                  </div>
                </div>

                {/* System Breakdown */}
                {stats.systemBreakdown.length > 0 && (
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                    <h3 className="font-medium text-[var(--color-text-primary)] mb-3">
                      Performance by System
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {stats.systemBreakdown.map(sys => (
                        <div key={sys.system} className="flex items-center gap-3">
                          <div className="w-16 text-xs font-medium text-[var(--color-text-muted)]">
                            {sys.system}
                          </div>
                          <div className="flex-1 h-2 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                sys.accuracy >= 80 ? 'bg-green-500' :
                                sys.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${sys.accuracy}%` }}
                            />
                          </div>
                          <div className="w-12 text-right text-sm font-medium text-[var(--color-text-primary)]">
                            {sys.accuracy}%
                          </div>
                          <div className="w-16 text-right text-xs text-[var(--color-text-muted)]">
                            {sys.correct}/{sys.total}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Theme Toggle */}
                {onToggleTheme && (
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {theme === 'dark' ? (
                          <Moon className="w-5 h-5 text-[var(--color-text-muted)]" />
                        ) : (
                          <Sun className="w-5 h-5 text-amber-500" />
                        )}
                        <div>
                          <div className="font-medium text-[var(--color-text-primary)]">Theme</div>
                          <div className="text-sm text-[var(--color-text-muted)]">
                            Currently using {theme} mode
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={onToggleTheme}
                        className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Data Management */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-4">Data Management</h3>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Performance Data
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {performanceData.length} records
                        </div>
                      </div>
                      <button
                        onClick={() => handleClear('performance')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          confirmClear === 'performance'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        <Trash2 className="w-4 h-4 inline-block mr-1" />
                        {confirmClear === 'performance' ? 'Confirm Clear' : 'Clear'}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Missed Questions
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {missedQuestionsCount} questions
                        </div>
                      </div>
                      <button
                        onClick={() => handleClear('missed')}
                        disabled={missedQuestionsCount === 0}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          missedQuestionsCount === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                            : confirmClear === 'missed'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        <Trash2 className="w-4 h-4 inline-block mr-1" />
                        {confirmClear === 'missed' ? 'Confirm' : 'Clear'}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Flagged Questions
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {flaggedQuestionsCount} questions
                        </div>
                      </div>
                      <button
                        onClick={() => handleClear('flagged')}
                        disabled={flaggedQuestionsCount === 0}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          flaggedQuestionsCount === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                            : confirmClear === 'flagged'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        <Trash2 className="w-4 h-4 inline-block mr-1" />
                        {confirmClear === 'flagged' ? 'Confirm' : 'Clear'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-primary)] transition-colors"
                  >
                    <span className="font-medium text-[var(--color-text-primary)]">Advanced</span>
                    {showAdvanced ? (
                      <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[var(--color-border)]"
                      >
                        <div className="p-4 space-y-3">
                          <button className="w-full flex items-center gap-3 p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors">
                            <Download className="w-5 h-5 text-[var(--color-text-muted)]" />
                            <div className="text-left">
                              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                                Export Data
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)]">
                                Download your progress as JSON
                              </div>
                            </div>
                          </button>
                          <button className="w-full flex items-center gap-3 p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors">
                            <Upload className="w-5 h-5 text-[var(--color-text-muted)]" />
                            <div className="text-left">
                              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                                Import Data
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)]">
                                Restore progress from a backup
                              </div>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Version Info */}
                <div className="text-center text-xs text-[var(--color-text-muted)]">
                  PANaCEa v1.0.0 • Built for PANCE Success
                </div>
              </div>
            )}

            {/* Dashboard Customization Tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-2">Customize Dashboard Stats</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    Choose which statistics to display on your main dashboard.
                  </p>
                  
                  <div className="space-y-2">
                    {DASHBOARD_STAT_OPTIONS.map((option) => {
                      const isVisible = dashboardSettings.visibleStats.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleStat(option.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                            isVisible
                              ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
                              : 'bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                          }`}
                        >
                          <div className={`p-1.5 rounded-md ${
                            isVisible ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                          }`}>
                            {option.icon}
                          </div>
                          <div className="flex-1 text-left">
                            <div className={`text-sm font-medium ${isVisible ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                              {option.label}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              {option.description}
                            </div>
                          </div>
                          <div className={`p-1 rounded-md ${isVisible ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                            {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-2">Selected Stats ({dashboardSettings.visibleStats.length})</h3>
                  {dashboardSettings.visibleStats.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      No stats selected. Click on stats above to add them to your dashboard.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {dashboardSettings.visibleStats.map((statId) => {
                        const stat = DASHBOARD_STAT_OPTIONS.find(s => s.id === statId);
                        return stat ? (
                          <span
                            key={statId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-medium rounded-full"
                          >
                            {stat.icon}
                            {stat.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsStatsModal;
