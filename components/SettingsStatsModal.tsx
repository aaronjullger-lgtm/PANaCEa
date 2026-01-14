import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
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
  FileSpreadsheet,
  FileJson,
  Check,
  Activity as ActivityIcon,
  Flame,
  Sparkles,
  User,
  School,
  GraduationCap,
  Headphones,
  Volume2,
  Mic,
  Eye,
  Building2,
} from 'lucide-react';
import type { PerformanceRecord, SystemCode, UserProfile, ClinicalRotation, YearInProgram } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import { YEAR_IN_PROGRAM_OPTIONS } from '@/types';
import { loadUserProfile, updateUserProfile } from '@/services/userProfileService';
import { RotationSelector } from './onboarding/RotationSelector';
import { StatisticsPreferences, DEFAULT_WIDGET_CONFIG } from './ProgressDashboard';
import type { WidgetId } from './ProgressDashboard';
import { exportUserAnalytics } from '@/lib/analyticsExport';
import { 
  calculateAccuracy, 
  calculateStreaks, 
  loadWidgetPreferences as loadWidgetPrefs, 
  saveWidgetPreferences as saveWidgetPrefs 
} from '@/lib/dashboardUtils';
import ActivityHeatmap from './analytics/ActivityHeatmap';
import DecisionTimeAnalysis from './analytics/DecisionTimeAnalysis';
import LongitudinalProgressDashboard from './analytics/LongitudinalProgressDashboard';
import WeaknessCheatsheetExporter from './analytics/WeaknessCheatsheetExporter';
import { ALL_MINI_MODES, MODE_REGISTRY } from '@/config/training-modes';
import EnhancedSettingsTab from './settings/EnhancedSettingsTab';
import { useCommuter } from '@/contexts/CommuterContext';
import RadialProgress from './ui/RadialProgress';
import TrendSparkline from './ui/TrendSparkline';

// Lazy load Character Gallery
const CharacterGallery = lazy(() => import('./characters/CharacterGallery'));

// Gold Achievement Thresholds - Reserved for extraordinary performance
const GOLD_ACHIEVEMENT_STREAK_THRESHOLD = 10;
const GOLD_ACHIEVEMENT_TREND_THRESHOLD = 10;

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
  enabledWidgets?: WidgetId[];
  onUpdateWidgets?: (widgets: WidgetId[]) => void;
  // Sync status props (passed from App.tsx)
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  syncError?: string | null;
}

type TabId = 'stats' | 'settings' | 'preferences' | 'activity'; // | 'characters' - disabled for now

// Analytics color palette types
export type AnalyticsPalette = 'default' | 'neon' | 'pastel' | 'high-contrast';

export interface AnalyticsPaletteConfig {
  id: AnalyticsPalette;
  label: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    tertiary: string;
    quaternary: string;
    success: string;
    warning: string;
    error: string;
  };
}

export const ANALYTICS_PALETTES: AnalyticsPaletteConfig[] = [
  {
    id: 'default',
    label: 'Medical Standard',
    description: 'Classic medical color coding',
    colors: {
      primary: '#3b82f6',
      secondary: '#10b981',
      tertiary: '#f59e0b',
      quaternary: '#8b5cf6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    id: 'neon',
    label: 'Neon',
    description: 'High-energy vibrant colors',
    colors: {
      primary: '#ff006e',
      secondary: '#00f5ff',
      tertiary: '#ffbe0b',
      quaternary: '#8338ec',
      success: '#06ffa5',
      warning: '#ffbe0b',
      error: '#ff006e',
    },
  },
  {
    id: 'pastel',
    label: 'Pastel',
    description: 'Soft, gentle colors',
    colors: {
      primary: '#a8dadc',
      secondary: '#f1faee',
      tertiary: '#e9c46a',
      quaternary: '#f4a261',
      success: '#b7e4c7',
      warning: '#e9c46a',
      error: '#e76f51',
    },
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    description: 'Maximum visibility',
    colors: {
      primary: '#000000',
      secondary: '#ffffff',
      tertiary: '#ffff00',
      quaternary: '#ff00ff',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
    },
  },
];

// Get default enabled widgets
const getDefaultWidgets = (): WidgetId[] => 
  DEFAULT_WIDGET_CONFIG.filter(w => w.enabled).map(w => w.id);

/**
 * AccessibilitySettings - Commuter Mode / Voice-First Configuration
 */
const AccessibilitySettings: React.FC = () => {
  // Try to use commuter context, but handle case where provider might not be available
  let commuterContext;
  try {
    commuterContext = useCommuter();
  } catch {
    // Provider not available - render fallback
    return (
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Headphones className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="font-medium text-[var(--color-text-primary)]">Accessibility</h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Voice mode is initializing. Please refresh the page if this persists.
        </p>
      </div>
    );
  }

  const { 
    isCommuterMode, 
    settings, 
    toggleCommuterMode, 
    updateSettings 
  } = commuterContext;

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Headphones className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-medium text-[var(--color-text-primary)]">Accessibility - Voice Mode</h3>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Enable hands-free study with voice commands and text-to-speech. 
        Perfect for commuting or when you need larger touch targets.
      </p>

      {/* Main Toggle */}
      <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isCommuterMode 
              ? 'bg-sage-500 text-white' 
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
          }`}>
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">
              Commuter Mode
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Voice-first interaction layer
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={isCommuterMode}
          onChange={toggleCommuterMode}
          className="w-5 h-5 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
        />
      </label>

      {/* Sub-settings when enabled */}
      {isCommuterMode && (
        <div className="space-y-2 pl-2 border-l-2 border-sage-300 dark:border-sage-700">
          {/* Auto-read questions */}
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-primary)]">Read questions aloud</span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoReadQuestions}
              onChange={() => updateSettings({ autoReadQuestions: !settings.autoReadQuestions })}
              className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
            />
          </label>

          {/* Voice input */}
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-primary)]">Voice input enabled</span>
            </div>
            <input
              type="checkbox"
              checked={settings.voiceEnabled}
              onChange={() => updateSettings({ voiceEnabled: !settings.voiceEnabled })}
              className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
            />
          </label>

          {/* High contrast */}
          <label className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-primary)]">High contrast mode</span>
            </div>
            <input
              type="checkbox"
              checked={settings.highContrastMode}
              onChange={() => updateSettings({ highContrastMode: !settings.highContrastMode })}
              className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
            />
          </label>

          {/* Speech rate */}
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-text-primary)]">Speech rate</span>
              <span className="text-xs text-[var(--color-text-muted)]">{settings.speechRate}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.speechRate}
              onChange={(e) => updateSettings({ speechRate: parseFloat(e.target.value) })}
              className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}

      <div className="mt-3 p-3 bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800 rounded-lg">
        <p className="text-xs text-sage-900 dark:text-sage-300">
          Voice mode works with Main Session and Patient Encounter modes. 
          Say "A", "B", "C", or "D" to select answers.
        </p>
      </div>
    </div>
  );
};

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
  enabledWidgets: externalEnabledWidgets,
  onUpdateWidgets,
  isSyncing,
  lastSyncTime,
  syncError,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmClear, setConfirmClear] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<'csv' | 'json' | null>(null);
  
  // Widget preferences state
  const [localEnabledWidgets, setLocalEnabledWidgets] = useState<WidgetId[]>(() => 
    loadWidgetPrefs<WidgetId>(getDefaultWidgets())
  );
  
  // System selection state - Load from localStorage
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
  
  // Analytics color palette state - Load from localStorage
  const [analyticsPalette, setAnalyticsPalette] = useState<AnalyticsPalette>(() => {
    const saved = localStorage.getItem('panceai_analytics_palette');
    return (saved as AnalyticsPalette) || 'default';
  });
  
  // Clinical Fidelity Mode settings - Load from localStorage
  const [clinicalFidelitySettings, setClinicalFidelitySettings] = useState(() => {
    const saved = localStorage.getItem('panceai_clinical_fidelity');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          emrInterface: false,
          writeOrders: false,
          rawLabValues: false,
          multimediaAuscultation: false
        };
      }
    }
    return {
      emrInterface: false,
      writeOrders: false,
      rawLabValues: false,
      multimediaAuscultation: false
    };
  });
  
  // Mini Modes selection - Load from localStorage
  const [enabledMiniModes, setEnabledMiniModes] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('panceai_enabled_mini_modes');
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as string[]);
      } catch {
        // Default: all mini modes enabled
        return new Set(ALL_MINI_MODES);
      }
    }
    // Default: all mini modes enabled
    return new Set(ALL_MINI_MODES);
  });

  // User Profile - Load from localStorage
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    return loadUserProfile() || { hasCompletedOnboarding: false };
  });
  
  // Use external widgets if provided, otherwise use local state
  const enabledWidgets = externalEnabledWidgets ?? localEnabledWidgets;
  
  const handleToggleWidget = (widgetId: WidgetId) => {
    const newWidgets = enabledWidgets.includes(widgetId)
      ? enabledWidgets.filter(w => w !== widgetId)
      : [...enabledWidgets, widgetId];
    
    if (onUpdateWidgets) {
      onUpdateWidgets(newWidgets);
    } else {
      setLocalEnabledWidgets(newWidgets);
      saveWidgetPrefs(newWidgets);
    }
  };
  
  const handleResetWidgets = () => {
    const defaults = getDefaultWidgets();
    if (onUpdateWidgets) {
      onUpdateWidgets(defaults);
    } else {
      setLocalEnabledWidgets(defaults);
      saveWidgetPrefs(defaults);
    }
  };
  
  const handleToggleSystem = (system: SystemCode) => {
    setEnabledSystems(prev => {
      const next = new Set(prev);
      if (next.has(system)) {
        next.delete(system);
      } else {
        next.add(system);
      }
      // Save to localStorage
      localStorage.setItem('panceai_enabled_systems', JSON.stringify(Array.from(next)));
      return next;
    });
  };
  
  const handleEnableAllSystems = () => {
    const allSystems = new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
    setEnabledSystems(allSystems);
    localStorage.setItem('panceai_enabled_systems', JSON.stringify(Array.from(allSystems)));
  };
  
  const handleDisableAllSystems = () => {
    setEnabledSystems(new Set());
    localStorage.setItem('panceai_enabled_systems', JSON.stringify([]));
  };
  
  const handleToggleClinicalFidelity = (setting: keyof typeof clinicalFidelitySettings) => {
    setClinicalFidelitySettings(prev => {
      const updated = { ...prev, [setting]: !prev[setting] };
      localStorage.setItem('panceai_clinical_fidelity', JSON.stringify(updated));
      return updated;
    });
  };
  
  const handleToggleMiniMode = (modeId: string) => {
    setEnabledMiniModes(prev => {
      const next = new Set(prev);
      if (next.has(modeId)) {
        next.delete(modeId);
      } else {
        next.add(modeId);
      }
      localStorage.setItem('panceai_enabled_mini_modes', JSON.stringify(Array.from(next)));
      return next;
    });
  };
  
  const handleEnableAllMiniModes = () => {
    const allModes = new Set(ALL_MINI_MODES);
    setEnabledMiniModes(allModes);
    localStorage.setItem('panceai_enabled_mini_modes', JSON.stringify(Array.from(allModes)));
  };
  
  const handleDisableAllMiniModes = () => {
    setEnabledMiniModes(new Set());
    localStorage.setItem('panceai_enabled_mini_modes', JSON.stringify([]));
  };
  
  const handleSetAnalyticsPalette = (palette: AnalyticsPalette) => {
    setAnalyticsPalette(palette);
    localStorage.setItem('panceai_analytics_palette', palette);
    // Apply palette colors to CSS variables for charts/visualizations
    const paletteConfig = ANALYTICS_PALETTES.find(p => p.id === palette);
    if (paletteConfig) {
      document.documentElement.style.setProperty('--analytics-primary', paletteConfig.colors.primary);
      document.documentElement.style.setProperty('--analytics-secondary', paletteConfig.colors.secondary);
      document.documentElement.style.setProperty('--analytics-tertiary', paletteConfig.colors.tertiary);
      document.documentElement.style.setProperty('--analytics-quaternary', paletteConfig.colors.quaternary);
      document.documentElement.style.setProperty('--analytics-success', paletteConfig.colors.success);
      document.documentElement.style.setProperty('--analytics-warning', paletteConfig.colors.warning);
      document.documentElement.style.setProperty('--analytics-error', paletteConfig.colors.error);
    }
  };
  
  // Apply analytics palette on mount
  useEffect(() => {
    handleSetAnalyticsPalette(analyticsPalette);
  }, []);

  // Body scroll lock: Prevent background page scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store original overflow value
      const originalOverflow = document.body.style.overflow;
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      
      // Cleanup: Restore original overflow on unmount or when modal closes
      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
      };
    }
  }, [isOpen]);

  // User profile update handlers
  const handleUpdateSchool = (school: string) => {
    const updated = updateUserProfile({ school });
    setUserProfile(updated);
  };

  const handleUpdateGraduationDate = (graduationDate: string) => {
    const updated = updateUserProfile({ graduationDate });
    setUserProfile(updated);
  };

  const handleUpdateYearInProgram = (yearInProgram: YearInProgram) => {
    const updated = updateUserProfile({ yearInProgram });
    setUserProfile(updated);
  };

  const handleUpdateRotation = (currentRotation: ClinicalRotation) => {
    const updated = updateUserProfile({ currentRotation });
    setUserProfile(updated);
  };
  
  // Export handlers
  const handleExportCSV = () => {
    exportUserAnalytics(performanceData, 'csv');
    setExportStatus('csv');
    setTimeout(() => setExportStatus(null), 2000);
  };
  
  const handleExportJSON = () => {
    exportUserAnalytics(performanceData, 'json');
    setExportStatus('json');
    setTimeout(() => setExportStatus(null), 2000);
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
        recentSessionAccuracies: [],
      };
    }

    // Calculate streaks using utility function
    const { current: currentStreak, best: bestStreak } = calculateStreaks(performanceData);

    // Precompute date strings and week threshold once
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Single pass through performanceData for multiple aggregations
    let totalCorrect = 0;
    let todayCorrect = 0;
    let todayQuestions = 0;
    let weekCorrect = 0;
    let weekQuestions = 0;
    let last50Correct = 0;
    let prev50Correct = 0;
    const systemMap = new Map<string, { correct: number; total: number }>();
    const uniqueDays = new Set<string>();

    const totalQuestions = performanceData.length;
    const last50Start = Math.max(0, totalQuestions - 50);
    const prev50Start = Math.max(0, totalQuestions - 100);
    const prev50End = Math.max(0, totalQuestions - 50);

    performanceData.forEach((r, index) => {
      // Overall stats
      if (r.isCorrect) totalCorrect++;

      // Date parsing (cache result)
      const recordDate = new Date(r.timestamp).toISOString().split('T')[0];
      uniqueDays.add(recordDate);

      // Today's stats
      if (recordDate === today) {
        todayQuestions++;
        if (r.isCorrect) todayCorrect++;
      }

      // Week stats
      if (r.timestamp > weekAgo) {
        weekQuestions++;
        if (r.isCorrect) weekCorrect++;
      }

      // System breakdown
      if (r.system && r.system !== 'OTHER') {
        const existing = systemMap.get(r.system);
        if (existing) {
          existing.total++;
          if (r.isCorrect) existing.correct++;
        } else {
          systemMap.set(r.system, {
            correct: r.isCorrect ? 1 : 0,
            total: 1,
          });
        }
      }

      // Recent trend (last 50 vs previous 50)
      if (index >= last50Start) {
        if (r.isCorrect) last50Correct++;
      } else if (index >= prev50Start && index < prev50End) {
        if (r.isCorrect) prev50Correct++;
      }
    });

    const overallAccuracy = calculateAccuracy(totalCorrect, totalQuestions);

    const systemBreakdown = Array.from(systemMap.entries())
      .map(([system, data]) => ({
        system,
        label: ABBREVIATION_TO_TOPIC_MAP[system as SystemCode] || system,
        correct: data.correct,
        total: data.total,
        accuracy: calculateAccuracy(data.correct, data.total),
      }))
      .sort((a, b) => b.total - a.total);

    // Recent trend calculation
    const last50Count = Math.min(50, totalQuestions);
    const prev50Count = Math.min(50, Math.max(0, totalQuestions - 50));
    const last50Accuracy = last50Count > 0 ? last50Correct / last50Count : 0;
    const prev50Accuracy = prev50Count > 0 ? prev50Correct / prev50Count : 0;
    const recentTrend = Math.round((last50Accuracy - prev50Accuracy) * 100);

    const studyDays = uniqueDays.size;
    const avgQuestionsPerDay = studyDays > 0 ? Math.round(totalQuestions / studyDays) : 0;

    // Calculate last 10 session accuracies for sparkline (group by sessions of ~10 questions)
    const sessionSize = 10;
    const recentSessionAccuracies: number[] = [];
    for (let i = Math.max(0, totalQuestions - 100); i < totalQuestions; i += sessionSize) {
      const sessionEnd = Math.min(i + sessionSize, totalQuestions);
      const sessionData = performanceData.slice(i, sessionEnd);
      const sessionCorrect = sessionData.filter(r => r.isCorrect).length;
      const sessionAccuracy = sessionData.length > 0 ? (sessionCorrect / sessionData.length) * 100 : 0;
      recentSessionAccuracies.push(sessionAccuracy);
    }

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
      recentSessionAccuracies,
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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="flex flex-col bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[var(--color-border)] dark:border-slate-700"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-[var(--color-accent)]/10 rounded-lg">
                {activeTab === 'stats' ? (
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" />
                ) : activeTab === 'preferences' ? (
                  <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" />
                ) : activeTab === 'activity' ? (
                  <ActivityIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" />
                ) : (
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" />
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] dark:text-slate-100">
                {activeTab === 'stats' ? 'Statistics' : activeTab === 'preferences' ? 'Dashboard Preferences' : activeTab === 'activity' ? 'Activity' : 'Settings'}
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
              <BarChart3 className="w-4 h-4 inline-block mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Statistics</span>
              <span className="sm:hidden">Stats</span>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                activeTab === 'activity'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <ActivityIcon className="w-4 h-4 inline-block mr-1 sm:mr-2" />
              <span>Activity</span>
            </button>
            {/* Temporarily disabled - organ characters */}
            {/* <button
              onClick={() => setActiveTab('characters')}
              className={`flex-1 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                activeTab === 'characters'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Sparkles className="w-4 h-4 inline-block mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Characters</span>
              <span className="sm:hidden">Chars</span>
            </button> */}
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex-1 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                activeTab === 'preferences'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 inline-block mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Preferences</span>
              <span className="sm:hidden">Prefs</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-1 sm:mr-2" />
              Settings
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollable-area">
            {activeTab === 'stats' ? (
              <div className="space-y-4 sm:space-y-6">
                {/* Motivational Message - Low Stakes Approach */}
                <div className="card-premium-glass p-4 rounded-xl">
                  <p className="text-sm text-[var(--color-text-secondary)] dark:text-slate-100 leading-relaxed">
                    <strong className="text-[var(--color-text-primary)] dark:text-slate-100">Focus on your current form.</strong> Your recent effort matters more than past mistakes—every session is a fresh opportunity to improve.
                  </p>
                </div>

                {/* Priority: Current Form Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Recent Trend with Sparkline - Most Important */}
                  <div className={`rounded-xl p-4 ${stats.recentTrend >= GOLD_ACHIEVEMENT_TREND_THRESHOLD ? 'gold-achievement' : 'bg-[var(--color-bg-secondary)]'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {stats.recentTrend >= GOLD_ACHIEVEMENT_TREND_THRESHOLD && <Flame className="w-5 h-5 text-amber-900" />}
                        <span className="text-sm font-medium text-[var(--color-text-muted)]">
                          {stats.recentTrend >= GOLD_ACHIEVEMENT_TREND_THRESHOLD ? 'Hot Streak!' : 'Recent Form'}
                        </span>
                      </div>
                      <div className={`text-xl font-bold ${stats.recentTrend >= GOLD_ACHIEVEMENT_TREND_THRESHOLD ? 'text-amber-900' : stats.recentTrend >= 0 ? 'text-green-500' : 'text-orange-500'}`}>
                        {stats.recentTrend >= 0 ? '+' : ''}{stats.recentTrend}%
                      </div>
                    </div>
                    {stats.recentSessionAccuracies.length > 0 ? (
                      <div className="flex justify-center">
                        <TrendSparkline
                          data={stats.recentSessionAccuracies}
                          width={200}
                          height={50}
                          colorScheme="auto"
                          showTrend={false}
                          showValue={false}
                          ariaLabel="Recent performance trend across last 10 sessions"
                        />
                      </div>
                    ) : (
                      <div className="flex justify-center py-2">
                        <span className="text-xs text-[var(--color-text-muted)] italic">
                          Complete more questions to see trend
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Current Streak */}
                  <div className={`rounded-xl p-4 text-center ${stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'gold-achievement relative' : 'bg-[var(--color-bg-secondary)]'}`}>
                    {stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD && <Award className="absolute top-2 right-2 w-4 h-4 text-amber-900" />}
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Zap className={`w-5 h-5 ${stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'text-amber-900' : 'text-orange-500'}`} />
                      <span className={`text-xs font-medium ${stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'text-amber-900' : 'text-[var(--color-text-muted)]'}`}>
                        {stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'Exceptional!' : 'Active Streak'}
                      </span>
                    </div>
                    <div className={`text-3xl font-bold ${stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'text-amber-900' : 'text-orange-500'}`}>
                      {stats.currentStreak}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      questions in a row
                    </div>
                  </div>
                  
                  {/* Overall Accuracy with Radial Progress */}
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 flex flex-col items-center justify-center">
                    <RadialProgress
                      value={stats.overallAccuracy}
                      size={100}
                      strokeWidth={8}
                      showValue={true}
                      label="Overall Accuracy"
                      ariaLabel={`Overall accuracy: ${stats.overallAccuracy.toFixed(0)}% correct across all questions`}
                    />
                  </div>
                </div>
                
                {/* De-emphasized: Lifetime Stats */}
                {showAdvanced && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 opacity-60">
                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                        {stats.totalQuestions}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">Total Questions</div>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 sm:p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Award className="w-4 h-4 text-slate-500" />
                        <span className="text-xl sm:text-2xl font-bold text-slate-500">
                          {stats.bestStreak}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">All-Time Best</div>
                    </div>
                  </div>
                )}



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
                    <h3 className="font-medium text-[var(--color-text-primary)] dark:text-slate-100 mb-3">
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
                
                {/* Decision Time Analysis */}
                <DecisionTimeAnalysis 
                  performanceData={performanceData}
                  theme={theme}
                />
                
                {/* Toggle for Lifetime Stats */}
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {showAdvanced ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide Lifetime Stats
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show Lifetime Stats
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : activeTab === 'activity' ? (
              <div className="space-y-4 sm:space-y-6">
                {/* Longitudinal Progress Dashboard */}
                <LongitudinalProgressDashboard
                  performanceData={performanceData}
                  userYearInProgram={userProfile.yearInProgram}
                  theme={theme}
                />

                {/* Activity Heatmap */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 sm:p-6">
                  <ActivityHeatmap 
                    performanceData={performanceData}
                    weeks={13}
                  />
                </div>

                {/* Activity Summary */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-3">
                    Activity Overview
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Click any day to view detailed statistics including questions answered, accuracy, 
                    average time per question, and weakest system for that day.
                  </p>
                </div>
              </div>
            ) : activeTab === 'preferences' ? (
              <div className="space-y-4 sm:space-y-6">
                {/* Statistics Preferences Panel */}
                <StatisticsPreferences
                  enabledWidgets={enabledWidgets}
                  onToggleWidget={handleToggleWidget}
                  onResetToDefaults={handleResetWidgets}
                />
                
                {/* Weakness Cheatsheet Export */}
                <WeaknessCheatsheetExporter
                  performanceData={performanceData}
                  theme={theme}
                />

                {/* Export Data Section */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Download className="w-5 h-5 text-[var(--color-accent)]" />
                    <h3 className="font-medium text-[var(--color-text-primary)]">Export Your Data</h3>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    Download your performance data in CSV or JSON format.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleExportCSV}
                      disabled={performanceData.length === 0}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        performanceData.length === 0
                          ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] cursor-not-allowed'
                          : exportStatus === 'csv'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
                      }`}
                    >
                      {exportStatus === 'csv' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )}
                      Export CSV
                    </button>
                    <button
                      onClick={handleExportJSON}
                      disabled={performanceData.length === 0}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        performanceData.length === 0
                          ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] cursor-not-allowed'
                          : exportStatus === 'json'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
                      }`}
                    >
                      {exportStatus === 'json' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <FileJson className="w-4 h-4" />
                      )}
                      Export JSON
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {/* Enhanced Settings Tab - Career Stage & Profile */}
                <EnhancedSettingsTab
                  theme={theme}
                  onToggleTheme={onToggleTheme}
                  analyticsPalette={analyticsPalette}
                  onSetAnalyticsPalette={handleSetAnalyticsPalette}
                  isSyncing={isSyncing}
                  lastSyncTime={lastSyncTime}
                  syncError={syncError}
                />
                
                {/* Divider */}
                <div className="border-t border-[var(--color-border)] pt-4">
                  <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
                    Advanced Study Options
                  </h3>
                </div>

                {/* System Selection */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-[var(--color-text-primary)]">Study Systems</h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Select which systems you want to study. Questions will only be generated from enabled systems.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={handleEnableAllSystems}
                      className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg transition-colors"
                    >
                      Enable All
                    </button>
                    <button
                      onClick={handleDisableAllSystems}
                      className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg transition-colors"
                    >
                      Disable All
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]).map(system => (
                      <button
                        key={system}
                        onClick={() => handleToggleSystem(system)}
                        className={`p-2.5 rounded-lg text-sm font-medium transition-all ${
                          enabledSystems.has(system)
                            ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                            : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                        }`}
                      >
                        <div className="font-semibold">{system}</div>
                        <div className="text-xs opacity-75 truncate">
                          {ABBREVIATION_TO_TOPIC_MAP[system].replace(' System', '').replace('Psychiatry/Behavioral Science', 'Psychiatry')}
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {enabledSystems.size === 0 && (
                    <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
                      <p className="text-xs text-amber-900 dark:text-amber-300">
                        <strong>Warning:</strong> No systems enabled. Please enable at least one system to generate questions.
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                    {enabledSystems.size} of {Object.keys(ABBREVIATION_TO_TOPIC_MAP).length} systems enabled
                  </div>
                </div>

                {/* Mini Modes Selection */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-[var(--color-text-primary)]">Mini Modes</h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Select which mini training modes appear in your menu. The main PANCE adaptive system is always available.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={handleEnableAllMiniModes}
                      className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg transition-colors"
                    >
                      Enable All
                    </button>
                    <button
                      onClick={handleDisableAllMiniModes}
                      className="px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg transition-colors"
                    >
                      Disable All
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {/* Visual Modes */}
                    <div className="mb-2">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Visual Drills</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'ecg_drill', label: 'ECG', desc: 'Rhythm strips' },
                          { id: 'derm_drill', label: 'Derm', desc: 'Skin lesions' },
                          { id: 'imaging_drill', label: 'Imaging', desc: 'X-ray/CT/MRI' },
                          { id: 'mini_lab', label: 'Mini Lab', desc: 'Lab results' }
                        ].map(mode => (
                          <button
                            key={mode.id}
                            onClick={() => handleToggleMiniMode(mode.id)}
                            className={`p-2 rounded-lg text-left text-xs transition-all ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Recall Modes */}
                    <div className="mb-2">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Recall Modes</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'rapid_recall', label: 'Rapid Recall', desc: 'Buzzwords' },
                          { id: 'ddx_compare', label: 'DDx Compare', desc: 'Side-by-side' },
                          { id: 'guideline_drill', label: 'Guidelines', desc: 'Scoring systems' },
                          { id: 'condition_drill', label: 'Conditions', desc: '5-stage drills' }
                        ].map(mode => (
                          <button
                            key={mode.id}
                            onClick={() => handleToggleMiniMode(mode.id)}
                            className={`p-2 rounded-lg text-left text-xs transition-all ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pharmacology Modes */}
                    <div className="mb-2">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Pharmacology</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'first_line_treatment', label: 'First Line', desc: 'Go-to treatments' },
                          { id: 'pharmacology', label: 'Pharm Quiz', desc: 'Drug mechanisms' }
                        ].map(mode => (
                          <button
                            key={mode.id}
                            onClick={() => handleToggleMiniMode(mode.id)}
                            className={`p-2 rounded-lg text-left text-xs transition-all ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clinical Simulation Modes */}
                    <div className="mb-2">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Clinical Simulation</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'fluid_electrolyte', label: 'Hydro-Mode', desc: 'Fluid/lytes calc' },
                          { id: 'antibiotic_mode', label: 'Bug-Drug', desc: 'Antibiotic choice' },
                          { id: 'patient_encounter', label: 'Virtual OSCE', desc: 'Patient interview' }
                        ].map(mode => (
                          <button
                            key={mode.id}
                            onClick={() => handleToggleMiniMode(mode.id)}
                            className={`p-2 rounded-lg text-left text-xs transition-all ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Engagement Modes (Phase 7) */}
                    <div className="mb-2">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Engagement Modes</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'code_blue_speed', label: 'Code Blue', desc: 'ACLS/PALS speed' },
                          { id: 'grand_rounds', label: 'Grand Rounds', desc: 'Live competition' },
                          { id: 'cram_mode', label: 'Cram Button', desc: '50 high-yield Qs' }
                        ].map(mode => (
                          <div
                            key={mode.id}
                            className={`p-2 rounded-lg text-left text-xs cursor-not-allowed ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-[var(--color-accent)]/50 text-[var(--color-btn-primary-text)]'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                    {enabledMiniModes.size} mini modes enabled
                  </div>

                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-xs text-green-900 dark:text-green-300">
                      Your main adaptive PANCE question system is always available regardless of these settings.
                    </p>
                  </div>
                </div>

                {/* Accessibility - Commuter/Voice Mode */}
                <AccessibilitySettings />

                {/* Keyboard Shortcuts */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="mb-3">
                    <h3 className="font-medium text-[var(--color-text-primary)]">Keyboard Shortcuts</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Use these shortcuts to navigate faster during quizzes and study sessions.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Quiz Shortcuts */}
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Quiz Mode</h4>
                      <div className="space-y-1">
                        {[
                          { keys: ['A'], description: 'Select answer option A' },
                          { keys: ['B'], description: 'Select answer option B' },
                          { keys: ['C'], description: 'Select answer option C' },
                          { keys: ['D'], description: 'Select answer option D' },
                          { keys: ['Space'], description: 'Toggle explanation after selection' },
                          { keys: ['Enter'], description: 'Proceed to next question' },
                          { keys: ['Esc'], description: 'Return to dashboard' },
                        ].map((shortcut, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--color-bg-primary)] transition-colors">
                            <span className="text-sm text-[var(--color-text-secondary)]">{shortcut.description}</span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, keyIdx) => (
                                <kbd key={keyIdx} className="px-2 py-0.5 text-xs font-mono font-semibold bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md min-w-[28px] text-center">
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* General Shortcuts */}
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">General</h4>
                      <div className="space-y-1">
                        {[
                          { keys: ['⌘/Ctrl', 'K'], description: 'Open command palette (quick navigation)' },
                          { keys: ['⌘/Ctrl', '/'], description: 'Open keyboard shortcuts' },
                        ].map((shortcut, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--color-bg-primary)] transition-colors">
                            <span className="text-sm text-[var(--color-text-secondary)]">{shortcut.description}</span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, keyIdx) => (
                                <React.Fragment key={keyIdx}>
                                  <kbd className="px-2 py-0.5 text-xs font-mono font-semibold bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md min-w-[28px] text-center">
                                    {key}
                                  </kbd>
                                  {keyIdx < shortcut.keys.length - 1 && (
                                    <span className="text-[var(--color-text-muted)] text-xs">+</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clinical Fidelity Mode */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="mb-3">
                    <h3 className="font-medium text-[var(--color-text-primary)]">Clinical Fidelity Mode</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Enable realistic clinical simulation features for more authentic practice.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {/* EMR Interface Toggle */}
                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Simulated EMR Interface
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Display vignettes in tabbed hospital chart format (HPI, Vitals, Labs, Imaging)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={clinicalFidelitySettings.emrInterface}
                        onChange={() => handleToggleClinicalFidelity('emrInterface')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    {/* Write Orders Input Toggle */}
                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          "Write Orders" Input
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Type orders instead of selecting from multiple choice (tests active recall)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={clinicalFidelitySettings.writeOrders}
                        onChange={() => handleToggleClinicalFidelity('writeOrders')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    {/* Raw Lab Values Toggle */}
                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Raw Lab Value Interpretation
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Show raw lab panels without interpretation hints (e.g., "Na: 128" instead of "hyponatremia")
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={clinicalFidelitySettings.rawLabValues}
                        onChange={() => handleToggleClinicalFidelity('rawLabValues')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    {/* Multimedia Auscultation Toggle */}
                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Multimedia Auscultation
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Include audio clips for heart sounds (murmurs) and lung sounds (crackles/wheezes)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={clinicalFidelitySettings.multimediaAuscultation}
                        onChange={() => handleToggleClinicalFidelity('multimediaAuscultation')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>
                  </div>

                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-900 dark:text-blue-300">
                      [i] <strong>Note:</strong> Clinical Fidelity features are optional enhancements designed for advanced learners who want more realistic practice.
                    </p>
                  </div>
                </div>

                {/* Institutional Features (Phase 9 - B2B) */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border-2 border-dashed border-[var(--color-border)]">
                  <div className="mb-3">
                    <h3 className="font-medium text-[var(--color-text-primary)]">Institutional Features</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Features for PA programs and educational institutions (Coming Soon)
                    </p>
                  </div>
                  
                  <div className="space-y-3 opacity-60">
                    {/* Program Director Dashboard */}
                    <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded">
                          <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">
                            Program Director Dashboard
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            Class-wide analytics: "Class of 2025 is in the 90th percentile for Pharm"
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Assignment System */}
                    <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">
                            Assignment System
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            Professors can create homework sets of 50 questions with due dates
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Curriculum Mapping */}
                    <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded">
                          <Target className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">
                            Curriculum Mapping
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            NCCPA PANCE Blueprint categories (e.g., "Cardiology - 13%")
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <p className="text-xs text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" /> <strong>For Institutions:</strong> Contact us to enable these features for your PA program.
                    </p>
                  </div>
                </div>

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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsStatsModal;
