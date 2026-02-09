import React, { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap, useKeyboardNavigation } from '@/lib/utils/accessibilityUtils';
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
  Search,
} from 'lucide-react';
import type {
  PerformanceRecord,
  SystemCode,
  UserProfile,
  ClinicalRotation,
  YearInProgram,
} from '@/types';
import type {
  ToggleSettings,
  ContentDifficultySettings,
  QuestionFormatSettings,
  FeedbackSettings,
  PerformanceTrackingSettings,
} from '@/types/toggleSettings';
import {
  loadToggleSettings,
  saveToggleSettings,
  DEFAULT_TOGGLE_SETTINGS,
} from '@/types/toggleSettings';
import { ABBREVIATION_TO_TOPIC_MAP, getSystemDisplayFullName } from '@/src/constants';
import { YEAR_IN_PROGRAM_OPTIONS } from '@/types';
import { loadUserProfile, updateUserProfile } from '@/services/analytics';
import { RotationSelector } from '@/components/onboarding/RotationSelector';
import { StatisticsPreferences, DEFAULT_WIDGET_CONFIG } from '@/components/ProgressDashboard';
import type { WidgetId } from '@/components/ProgressDashboard';
import { exportUserAnalytics, exportArchive } from '@/lib/analyticsExport';
import { toast } from '@/lib/toast';
import { SliderWithInput } from '@/components/ui/SliderWithInput';
import {
  calculateAccuracy,
  calculateStreaks,
  loadWidgetPreferences as loadWidgetPrefs,
  saveWidgetPreferences as saveWidgetPrefs,
} from '@/lib/dashboardUtils';
import { getAccuracyBarClassSemantic } from '@/lib/accuracyColorUtils';
// Lazy-load heavy analytics components — only rendered in specific tabs
const ActivityHeatmap = lazy(() => import('@/components/analytics/ActivityHeatmap'));
const DecisionTimeAnalysis = lazy(() => import('@/components/analytics/DecisionTimeAnalysis'));
const LongitudinalProgressDashboard = lazy(() => import('@/components/analytics/LongitudinalProgressDashboard'));
const WeaknessCheatsheetExporter = lazy(() => import('@/components/analytics/WeaknessCheatsheetExporter'));
import { ALL_MINI_MODES, MODE_REGISTRY } from '@/config/training-modes';
import { ARCHIVE_AND_RESET, TO_REVIEW_LABEL, CLEAR_TO_REVIEW } from '@/config/labels';
const EnhancedSettingsTab = lazy(() => import('@/components/settings/EnhancedSettingsTab'));
import { useCommuter } from '@/contexts/CommuterContext';
import { useUserContext } from '@/hooks/useUserContext';
import { useClinicalFidelitySettings } from '@/hooks/useClinicalFidelitySettings';
import RadialProgress from '@/components/ui/RadialProgress';
import TrendSparkline from '@/components/ui/TrendSparkline';
import { Skeleton } from '@/components/loading';

// Lazy load Character Gallery
const CharacterGallery = lazy(() => import('@/components/characters/CharacterGallery'));

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
  /** When true, show skeletons instead of 0% / 0 in Stats tab (prevents "broken" appearance while loading) */
  isLoadingStats?: boolean;
  /** Called when user clicks "Start First Session" in ActivityHeatmap empty state (closes modal, opens session) */
  onStartFirstSession?: () => void;
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
      primary: '#020617', // Brand dark blue (slate-950), no pure black
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
  DEFAULT_WIDGET_CONFIG.filter((w) => w.enabled).map((w) => w.id);

/**
 * AccessibilitySettings - Commuter Mode / Voice-First Configuration
 */
const AccessibilitySettings: React.FC = () => {
  // MUST call hooks at top level - Rules of Hooks requirement
  const commuterContext = useCommuter();
  let hasCommuterContext = true;

  // Check if context is valid after hook call
  if (!commuterContext) {
    hasCommuterContext = false;
  }

  // Early return AFTER all hooks have been called
  if (!hasCommuterContext) {
    return (
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Headphones className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="font-bold text-[var(--color-text-primary)]">Accessibility</h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Voice mode is initializing. Please refresh the page if this persists.
        </p>
      </div>
    );
  }

  const { isCommuterMode, settings, toggleCommuterMode, updateSettings } = commuterContext;

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Headphones className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-bold text-[var(--color-text-primary)]">Accessibility - Voice Mode</h3>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Enable hands-free study with voice commands and text-to-speech. Perfect for commuting or
        when you need larger touch targets.
      </p>

      {/* Main Toggle */}
      <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isCommuterMode
                ? 'bg-sage-500 text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
            }`}
          >
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

          {/* Speech rate: input + stepper + slider */}
          <div className="p-2">
            <SliderWithInput
              value={settings.speechRate}
              onChange={(v: number) => updateSettings({ speechRate: v })}
              min={0.5}
              max={2}
              step={0.1}
              unit="x"
              label={<span className="text-sm text-[var(--color-text-primary)]">Speech rate</span>}
              toInputValue={(v: number) => v.toFixed(1)}
              fromInputValue={(s: string) => parseFloat(s) || 0.5}
            />
          </div>
        </div>
      )}

      <div className="mt-3 p-3 bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800 rounded-lg">
        <p className="text-xs text-sage-900 dark:text-sage-300">
          Voice mode works with Main Session and Patient Encounter modes. Say "A", "B", "C", or "D"
          to select answers.
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
  isLoadingStats = false,
  onStartFirstSession,
}) => {
  const { careerStage } = useUserContext();
  const modalRef = useRef<HTMLDivElement>(null);

  // Accessibility: focus trap and escape key
  useFocusTrap(modalRef as React.RefObject<HTMLElement>, isOpen);
  useKeyboardNavigation(onClose);
  const perfDataIsArray = Array.isArray(performanceData);
  const hasNoStatsData = isLoadingStats || (perfDataIsArray ? performanceData.length === 0 : true);
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmClear, setConfirmClear] = useState<string | null>(null);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [exportStatus, setExportStatus] = useState<'csv' | 'json' | null>(null);

  // Widget preferences state
  const [localEnabledWidgets, setLocalEnabledWidgets] = useState<WidgetId[]>(() =>
    loadWidgetPrefs<WidgetId>(getDefaultWidgets())
  );

  // System selection state - Load from localStorage (Practicing PAs default to all ON)
  const [enabledSystems, setEnabledSystems] = useState<Set<SystemCode>>(() => {
    const saved = localStorage.getItem('panceai_enabled_systems');
    const all = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];
    if (saved) {
      try {
        const arr = JSON.parse(saved) as SystemCode[];
        return new Set(Array.isArray(arr) && arr.length > 0 ? arr : all);
      } catch {
        return new Set(all);
      }
    }
    return new Set(all);
  });

  // Practicing PAs: when opening settings with empty enabled systems, default to all
  useEffect(() => {
    if (!isOpen || careerStage !== 'practicing') return;
    const saved = localStorage.getItem('panceai_enabled_systems');
    if (saved === '[]' || !saved) {
      const all = Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[];
      setEnabledSystems(new Set(all));
      localStorage.setItem('panceai_enabled_systems', JSON.stringify(all));
      window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
    }
  }, [isOpen, careerStage]);

  // Active Unit (current learning) vs Completed/Review - for 80% current / 20% review sessions
  const [activeUnitSystems, setActiveUnitSystems] = useState<Set<SystemCode>>(() => {
    const saved = localStorage.getItem('panceai_active_unit_systems');
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as SystemCode[]);
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  // Analytics color palette state - Load from localStorage (allowlist to avoid invalid values)
  const VALID_ANALYTICS_PALETTES = new Set<AnalyticsPalette>(['default', 'neon', 'pastel', 'high-contrast']);
  const [analyticsPalette, setAnalyticsPalette] = useState<AnalyticsPalette>(() => {
    const saved = localStorage.getItem('panceai_analytics_palette');
    const value = saved?.trim();
    return value && VALID_ANALYTICS_PALETTES.has(value as AnalyticsPalette)
      ? (value as AnalyticsPalette)
      : 'default';
  });

  // Clinical Fidelity Mode settings (shared hook with Patient Encounter)
  const { settings: clinicalFidelitySettings, toggle: toggleClinicalFidelity } =
    useClinicalFidelitySettings();

  // Mini Modes selection - Load from localStorage
  const [miniModesSearch, setMiniModesSearch] = useState('');
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

  // Toggle Settings state - Load from localStorage
  const [toggleSettings, setToggleSettings] = useState<ToggleSettings>(() => {
    return loadToggleSettings();
  });

  // Use external widgets if provided, otherwise use local state
  const enabledWidgets = externalEnabledWidgets ?? localEnabledWidgets;

  const handleToggleWidget = (widgetId: WidgetId) => {
    const newWidgets = enabledWidgets.includes(widgetId)
      ? enabledWidgets.filter((w) => w !== widgetId)
      : [...enabledWidgets, widgetId];

    if (onUpdateWidgets) {
      onUpdateWidgets(newWidgets);
    } else {
      setLocalEnabledWidgets(newWidgets);
      saveWidgetPrefs(newWidgets);
    }
    toast.success('Changes saved');
  };

  const handleResetWidgets = () => {
    const defaults = getDefaultWidgets();
    if (onUpdateWidgets) {
      onUpdateWidgets(defaults);
    } else {
      setLocalEnabledWidgets(defaults);
      saveWidgetPrefs(defaults);
    }
    toast.success('Changes saved');
  };

  const notifyEnabledSystemsChanged = () => {
    window.dispatchEvent(new CustomEvent('panceai_enabled_systems_changed'));
  };

  const handleToggleSystem = (system: SystemCode) => {
    setEnabledSystems((prev: Set<SystemCode>) => {
      const next = new Set(prev);
      if (next.has(system)) {
        next.delete(system);
      } else {
        next.add(system);
      }
      localStorage.setItem('panceai_enabled_systems', JSON.stringify(Array.from(next)));
      notifyEnabledSystemsChanged();
      toast.success('Changes saved');
      return next;
    });
  };

  const handleEnableAllSystems = () => {
    const allSystems = new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
    setEnabledSystems(allSystems);
    localStorage.setItem('panceai_enabled_systems', JSON.stringify(Array.from(allSystems)));
    notifyEnabledSystemsChanged();
    toast.success('Changes saved');
  };

  const handleDisableAllSystems = () => {
    setEnabledSystems(new Set());
    localStorage.setItem('panceai_enabled_systems', JSON.stringify([]));
    notifyEnabledSystemsChanged();
    toast.success('Changes saved');
  };

  const handleSetActiveUnit = (system: SystemCode, asActive: boolean) => {
    setActiveUnitSystems((prev) => {
      const next = new Set(prev);
      if (asActive) next.add(system);
      else next.delete(system);
      localStorage.setItem('panceai_active_unit_systems', JSON.stringify(Array.from(next)));
      toast.success('Changes saved');
      return next;
    });
  };

  const handleToggleClinicalFidelity = (setting: keyof typeof clinicalFidelitySettings) => {
    toggleClinicalFidelity(setting);
    toast.success('Changes saved');
  };

  const handleToggleMiniMode = (modeId: string) => {
    setEnabledMiniModes((prev) => {
      const next = new Set(prev);
      if (next.has(modeId)) {
        next.delete(modeId);
      } else {
        next.add(modeId);
      }
      localStorage.setItem('panceai_enabled_mini_modes', JSON.stringify(Array.from(next)));
      toast.success('Changes saved');
      return next;
    });
  };

  const handleEnableAllMiniModes = () => {
    const allModes = new Set(ALL_MINI_MODES);
    setEnabledMiniModes(allModes);
    localStorage.setItem('panceai_enabled_mini_modes', JSON.stringify(Array.from(allModes)));
    toast.success('Changes saved');
  };

  const handleDisableAllMiniModes = () => {
    setEnabledMiniModes(new Set());
    localStorage.setItem('panceai_enabled_mini_modes', JSON.stringify([]));
    toast.success('Changes saved');
  };

  // Toggle handlers for Content Difficulty
  const handleToggleContentDifficulty = (setting: keyof ContentDifficultySettings) => {
    setToggleSettings((prev) => {
      const updated: ToggleSettings = {
        ...prev,
        contentDifficulty: {
          ...prev.contentDifficulty,
          [setting]: !prev.contentDifficulty[setting],
        },
      };
      saveToggleSettings(updated);
      toast.success('Changes saved');
      return updated;
    });
  };

  // Toggle handlers for Question Format (boolean fields)
  const handleToggleQuestionFormat = (
    setting: Exclude<keyof QuestionFormatSettings, 'vignetteStyle' | 'labValueDisplay'>
  ) => {
    setToggleSettings((prev) => {
      const updated: ToggleSettings = {
        ...prev,
        questionFormat: {
          ...prev.questionFormat,
          [setting]: !prev.questionFormat[setting],
        },
      };
      saveToggleSettings(updated);
      toast.success('Changes saved');
      return updated;
    });
  };

  // Handler for vignette style (enum)
  const handleSetVignetteStyle = (style: 'standard' | 'brief' | 'detailed') => {
    setToggleSettings((prev) => {
      const updated: ToggleSettings = {
        ...prev,
        questionFormat: {
          ...prev.questionFormat,
          vignetteStyle: style,
        },
      };
      saveToggleSettings(updated);
      toast.success('Changes saved');
      return updated;
    });
  };

  // Handler for lab value display (enum)
  const handleSetLabValueDisplay = (display: 'interpreted' | 'raw' | 'both') => {
    setToggleSettings((prev) => {
      const updated: ToggleSettings = {
        ...prev,
        questionFormat: {
          ...prev.questionFormat,
          labValueDisplay: display,
        },
      };
      saveToggleSettings(updated);
      toast.success('Changes saved');
      return updated;
    });
  };

  // Toggle handlers for Feedback
  const handleToggleFeedback = (setting: Exclude<keyof FeedbackSettings, 'explanationDepth'>) => {
    setToggleSettings((prev) => {
      const updated: ToggleSettings = {
        ...prev,
        feedback: {
          ...prev.feedback,
          [setting]: !prev.feedback[setting],
        },
      };
      saveToggleSettings(updated);
      toast.success('Changes saved');
      return updated;
    });
  };

  // Handler for explanation depth (enum)
  const handleSetExplanationDepth = (depth: 'brief' | 'standard' | 'comprehensive') => {
    setToggleSettings((prev) => {
      const updated: ToggleSettings = {
        ...prev,
        feedback: {
          ...prev.feedback,
          explanationDepth: depth,
        },
      };
      saveToggleSettings(updated);
      toast.success('Changes saved');
      return updated;
    });
  };

  // Toggle handlers for Performance Tracking
  const handleTogglePerformanceTracking = (setting: keyof PerformanceTrackingSettings) => {
    setToggleSettings((prev) => {
      const updated: ToggleSettings = {
        ...prev,
        performanceTracking: {
          ...prev.performanceTracking,
          [setting]: !prev.performanceTracking[setting],
        },
      };
      saveToggleSettings(updated);
      toast.success('Changes saved');
      return updated;
    });
  };

  const handleSetAnalyticsPalette = (palette: AnalyticsPalette, skipToast?: boolean) => {
    setAnalyticsPalette(palette);
    localStorage.setItem('panceai_analytics_palette', palette);
    if (!skipToast) toast.success('Changes saved');
    // Apply palette colors to CSS variables for charts/visualizations
    const paletteConfig = ANALYTICS_PALETTES.find((p) => p.id === palette);
    if (paletteConfig) {
      document.documentElement.style.setProperty(
        '--analytics-primary',
        paletteConfig.colors.primary
      );
      document.documentElement.style.setProperty(
        '--analytics-secondary',
        paletteConfig.colors.secondary
      );
      document.documentElement.style.setProperty(
        '--analytics-tertiary',
        paletteConfig.colors.tertiary
      );
      document.documentElement.style.setProperty(
        '--analytics-quaternary',
        paletteConfig.colors.quaternary
      );
      document.documentElement.style.setProperty(
        '--analytics-success',
        paletteConfig.colors.success
      );
      document.documentElement.style.setProperty(
        '--analytics-warning',
        paletteConfig.colors.warning
      );
      document.documentElement.style.setProperty('--analytics-error', paletteConfig.colors.error);
    }
  };

  // Apply analytics palette on mount
  useEffect(() => {
    handleSetAnalyticsPalette(analyticsPalette, true);
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
    return undefined;
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

  const emptyStatsShape = {
    totalQuestions: 0,
    totalCorrect: 0,
    overallAccuracy: null as number | null,
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
    recentSessionAccuracies: [] as number[],
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (!Array.isArray(performanceData)) return emptyStatsShape;

    if (performanceData.length === 0) {
      return {
        totalQuestions: 0,
        totalCorrect: 0,
        overallAccuracy: null, // null instead of 0 to indicate "no data" state
        currentStreak: 0,
        bestStreak: 0,
        todayQuestions: 0,
        todayCorrect: 0,
        weekQuestions: 0,
        weekCorrect: 0,
        systemBreakdown: [] as Array<{
          system: string;
          label: string;
          correct: number;
          total: number;
          accuracy: number;
        }>,
        recentTrend: 0,
        studyDays: 0,
        avgQuestionsPerDay: 0,
        recentSessionAccuracies: [],
      };
    }

    const emptyStats = {
      totalQuestions: 0,
      totalCorrect: 0,
      overallAccuracy: null as number | null,
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
      recentSessionAccuracies: [] as number[],
    };

    try {
    // Calculate streaks using utility function
    const { current: currentStreak, best: bestStreak } = calculateStreaks(performanceData);

    // Precompute date strings and week threshold once
    const today = new Date().toISOString().split('T')[0] ?? '';
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
      const recordDate = new Date(r.timestamp).toISOString().split('T')[0] ?? '';
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
      const sessionCorrect = sessionData.filter((r) => r.isCorrect).length;
      const sessionAccuracy =
        sessionData.length > 0 ? (sessionCorrect / sessionData.length) * 100 : 0;
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
    } catch {
      return emptyStats;
    }
  }, [performanceData]);

  const handleClear = (type: string) => {
    if (confirmClear === type) {
      if (type === 'performance' && clearConfirmText === 'DELETE') {
        clearPerformanceData();
        toast.success('Performance data cleared');
      } else if (type === 'missed') {
        clearMissedQuestionsData();
        toast.success('To review list cleared');
      } else if (type === 'flagged') {
        clearFlaggedQuestionsData();
        toast.success('Flagged questions cleared');
      }
      setConfirmClear(null);
      setClearConfirmText('');
    } else {
      setConfirmClear(type);
      setClearConfirmText('');
      if (type !== 'performance') setTimeout(() => setConfirmClear(null), 3000);
    }
  };

  const handleArchiveAndReset = () => {
    if (!Array.isArray(performanceData) || performanceData.length === 0) {
      toast.success('No performance data to archive');
      return;
    }
    const confirmed = window.confirm(
      'This will download a full archive and then clear performance, missed, and flagged data. Continue?'
    );
    if (!confirmed) return;
    exportArchive(performanceData);
    clearPerformanceData();
    clearMissedQuestionsData();
    clearFlaggedQuestionsData();
    toast.success('Archive downloaded and data reset');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center z-[100] p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="flex flex-col bg-[var(--color-bg-primary)] backdrop-blur-md rounded-xl sm:rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] w-full max-w-2xl max-h-[90vh] overflow-hidden border border-[var(--color-border)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header: title (left) and close (right) — close is modal chrome, not a tab */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 bg-[var(--color-accent)]/10 rounded-xl flex-shrink-0">
                {activeTab === 'stats' ? (
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" strokeWidth={1.5} />
                ) : activeTab === 'preferences' ? (
                  <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" strokeWidth={1.5} />
                ) : activeTab === 'activity' ? (
                  <ActivityIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" strokeWidth={1.5} />
                ) : (
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-accent)]" strokeWidth={1.5} />
                )}
              </div>
              <h2 id="settings-modal-title" className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] dark:text-slate-100 truncate">
                {activeTab === 'stats'
                  ? 'Statistics'
                  : activeTab === 'preferences'
                    ? 'Dashboard Preferences'
                    : activeTab === 'activity'
                      ? 'Activity'
                      : 'Account'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal and return to dashboard"
              title="Close"
              className="flex-shrink-0 ml-3 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-[var(--color-text-muted)] hover:bg-slate-100 hover:text-[var(--color-text-primary)] dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>

          {/* Tab Switcher - Desktop: top tabs (internal navigation; X above closes entire modal) */}
          <div
            className="hidden md:flex border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50"
            role="tablist"
            aria-label="Modal sections"
          >
            <button
              role="tab"
              aria-selected={activeTab === 'stats' ? 'true' : 'false'}
              onClick={() => setActiveTab('stats')}
              aria-label="Statistics"
              className={`flex-1 min-h-[44px] py-2.5 sm:py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
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
              role="tab"
              aria-selected={activeTab === 'activity' ? 'true' : 'false'}
              onClick={() => setActiveTab('activity')}
              aria-label="Activity"
              className={`flex-1 min-h-[44px] py-2.5 sm:py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
                activeTab === 'activity'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <ActivityIcon className="w-4 h-4 inline-block mr-1 sm:mr-2" />
              <span>Activity</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'preferences' ? 'true' : 'false'}
              onClick={() => setActiveTab('preferences')}
              aria-label="Preferences"
              className={`flex-1 min-h-[44px] py-2.5 sm:py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
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
              role="tab"
              aria-selected={activeTab === 'settings' ? 'true' : 'false'}
              onClick={() => setActiveTab('settings')}
              aria-label="Settings"
              className={`flex-1 min-h-[44px] py-2.5 sm:py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
                activeTab === 'settings'
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-1 sm:mr-2" />
              Settings
            </button>
          </div>

          {/* Content - extra bottom padding on mobile for bottom bar */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6 scrollable-area">
            {activeTab === 'stats' ? (
              <div className="space-y-4 sm:space-y-6">
                {/* Motivational Message - Low Stakes Approach */}
                <div className="card-premium-glass p-4 rounded-xl">
                  <p className="text-sm text-[var(--color-text-secondary)] dark:text-slate-100 leading-relaxed">
                    <strong className="text-[var(--color-text-primary)] dark:text-slate-100">
                      Focus on your current form.
                    </strong>{' '}
                    Your recent effort matters more than past mistakes—every session is a fresh
                    opportunity to improve.
                  </p>
                </div>

                {/* Priority: Current Form Stats - Clinical tone, teal/green for success */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Recent Trend with Sparkline - "Study Continuity" / Recent Form */}
                  <div
                    className={`rounded-xl p-4 ${stats.recentTrend >= GOLD_ACHIEVEMENT_TREND_THRESHOLD ? 'clinical-achievement' : 'bg-[var(--color-bg-secondary)]'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {stats.recentTrend >= GOLD_ACHIEVEMENT_TREND_THRESHOLD && (
                          <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        )}
                        <span className="text-sm font-medium text-[var(--color-text-muted)]">
                          {stats.recentTrend >= GOLD_ACHIEVEMENT_TREND_THRESHOLD
                            ? 'Study Continuity'
                            : 'Recent Form'}
                        </span>
                      </div>
                      <div
                        className={`text-xl font-bold min-h-[1.75rem] flex items-center ${!hasNoStatsData && stats.recentTrend >= GOLD_ACHIEVEMENT_TREND_THRESHOLD ? 'text-teal-700 dark:text-teal-300' : !hasNoStatsData && stats.recentTrend >= 0 ? 'text-data-pass' : !hasNoStatsData ? 'text-data-provisional' : ''}`}
                      >
                        {hasNoStatsData ? (
                          <Skeleton height={28} width={56} variant="wave" radius="md" />
                        ) : (
                          <>
                            {stats.recentTrend >= 0 ? '+' : ''}
                            {stats.recentTrend}%
                          </>
                        )}
                      </div>
                    </div>
                    {stats.recentSessionAccuracies.length > 0 ? (
                      <div className="flex justify-center">
                        <TrendSparkline
                          data={stats.recentSessionAccuracies}
                          width={200}
                          height={50}
                          colorScheme="clinical"
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

                  {/* Consecutive Correct (clinical label; teal for success) */}
                  <div
                    className={`rounded-xl p-4 text-center ${stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'clinical-achievement relative' : 'bg-[var(--color-bg-secondary)]'}`}
                  >
                    {stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD && (
                      <Award className="absolute top-2 right-2 w-4 h-4 text-teal-600 dark:text-teal-400" />
                    )}
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Zap
                        className={`w-5 h-5 ${stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'text-teal-600 dark:text-teal-400' : 'text-teal-500'}`}
                      />
                      <span
                        className={`text-xs font-medium ${stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'text-teal-700 dark:text-teal-300' : 'text-[var(--color-text-muted)]'}`}
                      >
                        {stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD
                          ? 'Strong consistency'
                          : 'Consecutive Correct'}
                      </span>
                    </div>
                    <div
                      className={`text-3xl font-bold min-h-[2.25rem] flex items-center justify-center ${!hasNoStatsData && stats.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD ? 'text-teal-700 dark:text-teal-300' : !hasNoStatsData ? 'text-teal-600 dark:text-teal-400' : ''}`}
                    >
                      {hasNoStatsData ? (
                        <Skeleton height={36} width={40} variant="wave" radius="md" />
                      ) : (
                        stats.currentStreak
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      questions in a row
                    </div>
                  </div>

                  {/* Overall Accuracy with Radial Progress */}
                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 flex flex-col items-center justify-center">
                    {stats.overallAccuracy !== null ? (
                      <RadialProgress
                        value={stats.overallAccuracy}
                        size={100}
                        strokeWidth={8}
                        showValue={true}
                        label="Overall Accuracy"
                        ariaLabel={`Overall accuracy: ${stats.overallAccuracy.toFixed(0)}% correct across all questions`}
                      />
                    ) : hasNoStatsData ? (
                      <div className="flex flex-col items-center justify-center" aria-busy="true" aria-label="Loading accuracy">
                        <Skeleton height={100} width={100} variant="wave" radius="full" className="mb-2" />
                        <Skeleton height={14} width={120} variant="wave" radius="sm" className="mb-1" />
                        <Skeleton height={12} width={80} variant="wave" radius="sm" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-sm font-medium text-[var(--color-text-muted)] text-center mb-1">
                          Waiting for first session
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Overall Accuracy
                        </div>
                      </div>
                    )}
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
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        Today
                      </span>
                    </div>
                    <div className="text-xl font-bold text-[var(--color-text-primary)] min-h-[1.75rem] flex items-center">
                      {hasNoStatsData ? (
                        <Skeleton height={24} width={48} variant="wave" radius="md" />
                      ) : stats.todayQuestions === 0 ? (
                        '—'
                      ) : (
                        `${stats.todayCorrect}/${stats.todayQuestions}`
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] min-h-[1rem] flex items-center mt-0.5">
                      {hasNoStatsData ? (
                        <Skeleton height={12} width={72} variant="wave" radius="sm" />
                      ) : stats.todayQuestions > 0 ? (
                        `${Math.round((stats.todayCorrect / stats.todayQuestions) * 100)}% accuracy`
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        This Week
                      </span>
                    </div>
                    <div className="text-xl font-bold text-[var(--color-text-primary)] min-h-[1.75rem] flex items-center">
                      {hasNoStatsData ? (
                        <Skeleton height={24} width={48} variant="wave" radius="md" />
                      ) : stats.weekQuestions === 0 ? (
                        '—'
                      ) : (
                        `${stats.weekCorrect}/${stats.weekQuestions}`
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] min-h-[1rem] flex items-center mt-0.5">
                      {hasNoStatsData ? (
                        <Skeleton height={12} width={72} variant="wave" radius="sm" />
                      ) : stats.weekQuestions > 0 ? (
                        `${Math.round((stats.weekCorrect / stats.weekQuestions) * 100)}% accuracy`
                      ) : (
                        '—'
                      )}
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
                      {stats.systemBreakdown.map((sys) => (
                        <div key={sys.system} className="flex items-center gap-3">
                          <div className="w-16 text-xs font-medium text-[var(--color-text-muted)]">
                            {sys.system}
                          </div>
                          <div className="flex-1 h-2 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getAccuracyBarClassSemantic(sys.accuracy)}`}
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
                <DecisionTimeAnalysis performanceData={performanceData} theme={theme} />

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
                    onStartFirstSession={onStartFirstSession}
                  />
                </div>

                {/* Activity Summary */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-3">
                    Activity Overview
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Click any day to view detailed statistics including questions answered,
                    accuracy, average time per question, and weakest system for that day.
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
                <WeaknessCheatsheetExporter performanceData={performanceData} theme={theme} />

                {/* Export Data Section */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Download className="w-5 h-5 text-[var(--color-accent)]" />
                    <h3 className="font-bold text-[var(--color-text-primary)]">Export Your Data</h3>
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
                            ? 'bg-data-pass/20 text-data-pass'
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
                            ? 'bg-data-pass/20 text-data-pass'
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
              <div className="space-y-6">
                {/* Auto-save hint so users know they don't need a Save button */}
                <p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <Check className="w-3.5 h-3.5 text-[var(--color-accent)] flex-shrink-0" aria-hidden />
                  Changes save automatically. You'll see a confirmation when you update a setting.
                </p>
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
                <div className="border-t border-[var(--color-border)] pt-6">
                  <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-6">
                    Study Preferences
                  </h3>
                </div>

                {/* Content Difficulty Settings */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="mb-3">
                    <h3 className="font-bold text-[var(--color-text-primary)]">
                      Content Difficulty
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Control the complexity and scope of medical content presented to you.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Core Content Only
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Focus on core PANCE blueprint content (excludes advanced pathology)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.contentDifficulty.coreOnly}
                        onChange={() => handleToggleContentDifficulty('coreOnly')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Include Advanced Content
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Include rare conditions and complex mechanisms for deeper learning
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.contentDifficulty.advancedContent}
                        onChange={() => handleToggleContentDifficulty('advancedContent')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          High-Yield Topics Only
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Filter to commonly tested concepts and high-yield topics
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.contentDifficulty.highYieldOnly}
                        onChange={() => handleToggleContentDifficulty('highYieldOnly')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          First-Line Treatment Priority
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Prioritize first-line treatment questions over second/third-line options
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.contentDifficulty.firstLineOnly}
                        onChange={() => handleToggleContentDifficulty('firstLineOnly')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>
                  </div>
                </div>

                {/* Question Format Settings */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="mb-3">
                    <h3 className="font-bold text-[var(--color-text-primary)]">Question Format</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Customize how questions are presented and displayed.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Vignette Style Selector */}
                    <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div className="mb-2">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Vignette Style
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Choose how detailed question vignettes should be
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSetVignetteStyle('brief')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.questionFormat.vignetteStyle === 'brief'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Brief
                        </button>
                        <button
                          onClick={() => handleSetVignetteStyle('standard')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.questionFormat.vignetteStyle === 'standard'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Standard
                        </button>
                        <button
                          onClick={() => handleSetVignetteStyle('detailed')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.questionFormat.vignetteStyle === 'detailed'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Detailed
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Image Integration
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Include images (X-rays, CT scans, dermpath) in questions
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.questionFormat.imageIntegration}
                        onChange={() => handleToggleQuestionFormat('imageIntegration')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    {/* Lab Value Display Selector */}
                    <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div className="mb-2">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Lab Value Display
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Choose how lab values are presented
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSetLabValueDisplay('interpreted')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.questionFormat.labValueDisplay === 'interpreted'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Interpreted
                        </button>
                        <button
                          onClick={() => handleSetLabValueDisplay('raw')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.questionFormat.labValueDisplay === 'raw'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Raw
                        </button>
                        <button
                          onClick={() => handleSetLabValueDisplay('both')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.questionFormat.labValueDisplay === 'both'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Both
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Show Vital Signs
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Display vital signs in question vignettes
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.questionFormat.showVitals}
                        onChange={() => handleToggleQuestionFormat('showVitals')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Multimedia Enabled
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Include audio for heart/lung sounds when relevant
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.questionFormat.multimediaEnabled}
                        onChange={() => handleToggleQuestionFormat('multimediaEnabled')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>
                  </div>
                </div>

                {/* Feedback & Review Settings */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="mb-3">
                    <h3 className="font-bold text-[var(--color-text-primary)]">
                      Feedback & Review
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Control how feedback is delivered and review sessions are configured.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Immediate Feedback
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Show immediate feedback after each answer
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.feedback.immediateFeedback}
                        onChange={() => handleToggleFeedback('immediateFeedback')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    {/* Explanation Depth Selector */}
                    <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div className="mb-2">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Explanation Depth
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Choose how detailed explanations should be
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSetExplanationDepth('brief')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.feedback.explanationDepth === 'brief'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Brief
                        </button>
                        <button
                          onClick={() => handleSetExplanationDepth('standard')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.feedback.explanationDepth === 'standard'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Standard
                        </button>
                        <button
                          onClick={() => handleSetExplanationDepth('comprehensive')}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all ${
                            toggleSettings.feedback.explanationDepth === 'comprehensive'
                              ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          Comprehensive
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Spaced Repetition (FSRS)
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Enable the FSRS v6 algorithm for optimal review scheduling
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.feedback.spacedRepetition}
                        onChange={() => handleToggleFeedback('spacedRepetition')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Auto-Advance
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Automatically advance to next question after viewing explanation
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.feedback.autoAdvance}
                        onChange={() => handleToggleFeedback('autoAdvance')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Show Clinical Pearls
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Display high-yield clinical pearls with explanations
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.feedback.showPearls}
                        onChange={() => handleToggleFeedback('showPearls')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Show Related Concepts
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Display related concepts and differential diagnoses
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.feedback.showRelatedConcepts}
                        onChange={() => handleToggleFeedback('showRelatedConcepts')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>
                  </div>
                </div>

                {/* Performance Tracking Settings */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="mb-3">
                    <h3 className="font-bold text-[var(--color-text-primary)]">
                      Performance Tracking
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Control visibility and granularity of performance metrics.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Streak Tracking
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Track and display your answer streaks
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.performanceTracking.streakTracking}
                        onChange={() => handleTogglePerformanceTracking('streakTracking')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Detailed Analytics
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Show detailed analytics on dashboard
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.performanceTracking.detailedAnalytics}
                        onChange={() => handleTogglePerformanceTracking('detailedAnalytics')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Progress Notifications
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Enable notifications for progress milestones
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.performanceTracking.progressNotifications}
                        onChange={() => handleTogglePerformanceTracking('progressNotifications')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Realtime Trends
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Show real-time performance trends and insights
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.performanceTracking.realtimeTrends}
                        onChange={() => handleTogglePerformanceTracking('realtimeTrends')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          System Breakdown
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Display performance breakdown by organ system
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.performanceTracking.systemBreakdown}
                        onChange={() => handleTogglePerformanceTracking('systemBreakdown')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Longitudinal View
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Show longitudinal progress over time
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={toggleSettings.performanceTracking.longitudinalView}
                        onChange={() => handleTogglePerformanceTracking('longitudinalView')}
                        className="ml-3 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                    </label>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[var(--color-border)] pt-6">
                  <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-6">
                    Current Curriculum
                  </h3>
                </div>

                {/* System Selection (students: include; practicing: exclude rarely practiced) */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-[var(--color-text-primary)]">
                        {careerStage === 'practicing' ? 'Exclude from practice' : 'Study Systems'}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {careerStage === 'practicing'
                          ? 'Uncheck systems you rarely practice (e.g. an Ortho PA might uncheck OBGYN). Default: all included.'
                          : 'Select which systems you want to study. Questions will only be generated from enabled systems.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={handleEnableAllSystems}
                      className="px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--color-text-primary)] rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                    >
                      Enable All
                    </button>
                    <button
                      onClick={handleDisableAllSystems}
                      className="px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--color-text-primary)] rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                    >
                      Disable All
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]).map((system) => {
                      const fullName = getSystemDisplayFullName(system);
                      return (
                        <button
                          key={system}
                          onClick={() => handleToggleSystem(system)}
                          title={fullName}
                          className={`min-w-0 p-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                            enabledSystems.has(system)
                              ? 'bg-blue-100 dark:bg-[var(--color-accent)]/30 text-blue-800 dark:text-[var(--color-btn-primary-text)] border-2 border-blue-400 dark:border-[var(--color-accent)]'
                              : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] border-2 border-transparent'
                          }`}
                        >
                          <div className="font-semibold truncate" title={system}>
                            {system}
                          </div>
                          <div className="text-xs opacity-75 truncate min-w-0" title={fullName}>
                            {fullName}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {enabledSystems.size === 0 && (
                    <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
                      <p className="text-xs text-amber-900 dark:text-amber-300">
                        <strong>Warning:</strong> No systems enabled. Please enable at least one
                        system to generate questions.
                      </p>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                    {enabledSystems.size} of {Object.keys(ABBREVIATION_TO_TOPIC_MAP).length} systems
                    enabled
                  </div>

                  {/* Cumulative Review: Active Unit vs Completed/Review */}
                  {enabledSystems.size > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                      <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        Cumulative Review
                      </h4>
                      <p className="text-xs text-[var(--color-text-muted)] mb-3">
                        Mark systems as <strong>Active Unit</strong> (what you&apos;re learning now)
                        or <strong>Completed/Review</strong> (past units). Sessions will use ~80%
                        current unit, ~20% past units for retention.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(enabledSystems).map((system) => {
                          const isActive = activeUnitSystems.has(system);
                          return (
                            <div
                              key={system}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] overflow-hidden"
                            >
                              <span className="px-2 py-1.5 text-xs font-medium bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
                                {system}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSetActiveUnit(system, true)}
                                className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                                  isActive
                                    ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                                }`}
                              >
                                Active
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetActiveUnit(system, false)}
                                className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                                  !isActive
                                    ? 'bg-[var(--color-accent)] text-[var(--color-btn-primary-text)]'
                                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                                }`}
                              >
                                Review
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {enabledSystems.size > 0 && activeUnitSystems.size === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          Tip: Mark at least one system as Active to use 80/20 mix. Otherwise all
                          enabled systems are treated equally.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Mini Modes Selection */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-[var(--color-text-primary)]">Mini Modes</h3>
                      <ul className="text-xs text-[var(--color-text-muted)] mt-1 max-w-[65ch] space-y-0.5 list-disc list-inside">
                        <li>Choose which mini training modes appear in your menu.</li>
                        <li>The main PANCE adaptive system is always available.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={handleEnableAllMiniModes}
                      className="px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--color-text-primary)] rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                    >
                      Enable All
                    </button>
                    <button
                      onClick={handleDisableAllMiniModes}
                      className="px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--color-text-primary)] rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                    >
                      Disable All
                    </button>
                  </div>

                  {/* Search - keeps list usable as more modes are added */}
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" aria-hidden />
                    <input
                      type="search"
                      value={miniModesSearch}
                      onChange={(e) => setMiniModesSearch(e.target.value)}
                      placeholder="Find a mode..."
                      className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                      aria-label="Filter mini modes by name or description"
                    />
                  </div>

                  <div className="space-y-4 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] border-opacity-50 pr-1">
                    {(() => {
                      const q = miniModesSearch.trim().toLowerCase();
                      const match = (mode: { id: string; label: string; desc: string }) =>
                        !q || [mode.id, mode.label, mode.desc].some((s) => s.toLowerCase().includes(q));

                      const visualModes = [
                        { id: 'ecg_drill', label: 'ECG', desc: 'Rhythm strips' },
                        { id: 'derm_drill', label: 'Derm', desc: 'Skin lesions' },
                        { id: 'imaging_drill', label: 'Imaging', desc: 'X-ray/CT/MRI' },
                        { id: 'mini_lab', label: 'Mini Lab', desc: 'Lab results' },
                      ].filter(match);
                      const recallModes = [
                        { id: 'rapid_recall', label: 'Rapid Recall', desc: 'Buzzwords' },
                        { id: 'ddx_compare', label: 'DDx Compare', desc: 'Side-by-side' },
                        { id: 'guideline_drill', label: 'Guidelines', desc: 'Scoring systems' },
                        { id: 'condition_drill', label: 'Conditions', desc: '5-stage drills' },
                      ].filter(match);
                      const pharmModes = [
                        { id: 'first_line_treatment', label: 'First Line', desc: 'Go-to treatments' },
                        { id: 'pharmacology', label: 'Pharm Quiz', desc: 'Drug mechanisms' },
                      ].filter(match);
                      const clinicalModes = [
                        { id: 'fluid_electrolyte', label: 'Hydro-Mode', desc: 'Fluid/lytes calc' },
                        { id: 'antibiotic_mode', label: 'Bug-Drug', desc: 'Antibiotic choice' },
                        { id: 'patient_encounter', label: 'Virtual OSCE', desc: 'Patient interview' },
                      ].filter(match);
                      const engagementModes = [
                        { id: 'code_blue_speed', label: 'Code Blue', desc: 'ACLS/PALS speed' },
                        { id: 'grand_rounds', label: 'Grand Rounds', desc: 'Live competition' },
                        { id: 'cram_mode', label: 'Cram Button', desc: '50 high-yield Qs' },
                      ].filter(match);

                      const hasAny =
                        visualModes.length > 0 ||
                        recallModes.length > 0 ||
                        pharmModes.length > 0 ||
                        clinicalModes.length > 0 ||
                        engagementModes.length > 0;

                      if (q && !hasAny) {
                        return (
                          <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                            No modes match &quot;{miniModesSearch.trim()}&quot;
                          </div>
                        );
                      }

                      return (
                        <>
                    {/* Visual Modes */}
                    {visualModes.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Visual Drills
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {visualModes.map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => handleToggleMiniMode(mode.id)}
                            className={`p-3 rounded-lg text-left text-xs transition-all ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-blue-100 dark:bg-[var(--color-accent)]/20 text-blue-800 dark:text-[var(--color-text-primary)] border border-blue-300 dark:border-[var(--color-accent)]/30'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] border border-transparent'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Recall Modes */}
                    {recallModes.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Recall Modes
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {recallModes.map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => handleToggleMiniMode(mode.id)}
                            className={`p-3 rounded-lg text-left text-xs transition-all ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-blue-100 dark:bg-[var(--color-accent)]/20 text-blue-800 dark:text-[var(--color-text-primary)] border border-blue-300 dark:border-[var(--color-accent)]/30'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] border border-transparent'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Pharmacology Modes */}
                    {pharmModes.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Pharmacology
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {pharmModes.map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => handleToggleMiniMode(mode.id)}
                            className={`p-3 rounded-lg text-left text-xs transition-all ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-blue-100 dark:bg-[var(--color-accent)]/20 text-blue-800 dark:text-[var(--color-text-primary)] border border-blue-300 dark:border-[var(--color-accent)]/30'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] border border-transparent'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Clinical Simulation Modes */}
                    {clinicalModes.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Clinical Simulation
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {clinicalModes.map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => handleToggleMiniMode(mode.id)}
                            className={`p-3 rounded-lg text-left text-xs transition-all ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-blue-100 dark:bg-[var(--color-accent)]/20 text-blue-800 dark:text-[var(--color-text-primary)] border border-blue-300 dark:border-[var(--color-accent)]/30'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] border border-transparent'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Engagement Modes (Phase 7) */}
                    {engagementModes.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Engagement Modes
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {engagementModes.map((mode) => (
                          <div
                            key={mode.id}
                            className={`p-3 rounded-lg text-left text-xs cursor-not-allowed ${
                              enabledMiniModes.has(mode.id)
                                ? 'bg-[var(--color-accent)]/20 text-[var(--color-text-primary)] border border-[var(--color-accent)]/20 opacity-60'
                                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] opacity-60'
                            }`}
                          >
                            <div className="font-semibold">{mode.label}</div>
                            <div className="text-xs opacity-75">{mode.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                    {enabledMiniModes.size} mini modes enabled
                  </div>

                  <div className="mt-3 p-3 bg-data-pass/10 border border-data-pass/30 rounded-lg">
                    <p className="text-xs text-data-pass">
                      Your main adaptive PANCE question system is always available regardless of
                      these settings.
                    </p>
                  </div>
                </div>

                {/* Accessibility - Commuter/Voice Mode */}
                <AccessibilitySettings />

                {/* Keyboard Shortcuts */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <div className="mb-3">
                    <h3 className="font-bold text-[var(--color-text-primary)]">
                      Keyboard Shortcuts
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Use these shortcuts to navigate faster during quizzes and study sessions.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Quiz Shortcuts */}
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                        Quiz Mode
                      </h4>
                      <div className="space-y-1">
                        {[
                          { keys: ['A'], description: 'Answer A' },
                          { keys: ['B'], description: 'Answer B' },
                          { keys: ['C'], description: 'Answer C' },
                          { keys: ['D'], description: 'Answer D' },
                          { keys: ['Space'], description: 'Toggle explanation after selection' },
                          { keys: ['Enter'], description: 'Proceed to next question' },
                          { keys: ['Esc'], description: 'Return to dashboard' },
                        ].map((shortcut, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--color-bg-primary)] transition-colors"
                          >
                            <span className="text-sm text-[var(--color-text-secondary)]">
                              {shortcut.description}
                            </span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, keyIdx) => (
                                <kbd
                                  key={keyIdx}
                                  className="px-2 py-0.5 text-xs font-mono font-semibold bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md min-w-[28px] text-center"
                                >
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
                      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                        General
                      </h4>
                      <div className="space-y-1">
                        {[
                          {
                            keys: ['⌘/Ctrl', 'K'],
                            description: 'Open command palette (quick navigation)',
                          },
                          { keys: ['⌘/Ctrl', '/'], description: 'Open keyboard shortcuts' },
                        ].map((shortcut, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--color-bg-primary)] transition-colors"
                          >
                            <span className="text-sm text-[var(--color-text-secondary)]">
                              {shortcut.description}
                            </span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, keyIdx) => (
                                <React.Fragment key={keyIdx}>
                                  <kbd className="px-2 py-0.5 text-xs font-mono font-semibold bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md min-w-[28px] text-center">
                                    {key}
                                  </kbd>
                                  {keyIdx < shortcut.keys.length - 1 && (
                                    <span className="text-[var(--color-text-muted)] text-xs">
                                      +
                                    </span>
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
                    <h3 className="font-bold text-[var(--color-text-primary)]">
                      Clinical Fidelity Mode
                    </h3>
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
                          Display vignettes in tabbed hospital chart format (HPI, Vitals, Labs,
                          Imaging)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={clinicalFidelitySettings.emrInterface}
                        onChange={() => handleToggleClinicalFidelity('emrInterface' as const)}
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
                          Type orders instead of selecting from multiple choice (tests active
                          recall)
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
                          Show raw lab panels without interpretation hints (e.g., "Na: 128" instead
                          of "hyponatremia")
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
                          Include audio clips for heart sounds (murmurs) and lung sounds
                          (crackles/wheezes)
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
                      [i] <strong>Note:</strong> Clinical Fidelity features are optional
                      enhancements designed for advanced learners who want more realistic practice.
                    </p>
                  </div>
                </div>

                {/* Institutional Features (Phase 9 - B2B) */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border-2 border-dashed border-[var(--color-border)]">
                  <div className="mb-3">
                    <h3 className="font-bold text-[var(--color-text-primary)]">
                      Institutional Features
                    </h3>
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
                            Class-wide analytics: "Class of 2025 is in the 90th percentile for
                            Pharm"
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
                      <Building2 className="w-4 h-4" /> <strong>For Institutions:</strong> Contact
                      us to enable these features for your PA program.
                    </p>
                  </div>
                </div>

                {/* Data Management */}
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
                  <h3 className="font-medium text-[var(--color-text-primary)] mb-4">
                    Data Management
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          Performance Data
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {performanceData.length} records
                        </div>
                        {confirmClear === 'performance' && (
                          <div className="mt-2">
                            <label htmlFor="clear-performance-confirm" className="sr-only">
                              Type DELETE to confirm clearing all performance data
                            </label>
                            <input
                              id="clear-performance-confirm"
                              type="text"
                              placeholder="Type DELETE to confirm"
                              value={clearConfirmText}
                              onChange={(e) => setClearConfirmText(e.target.value)}
                              autoComplete="off"
                              className="mt-1 px-2 py-1 text-sm border border-[var(--color-border)] rounded"
                              aria-describedby="clear-performance-hint"
                            />
                            <p id="clear-performance-hint" className="text-xs text-[var(--color-text-muted)] mt-1">
                              This permanently removes all session history. Type DELETE above to confirm.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleArchiveAndReset}
                          disabled={performanceData.length === 0}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            performanceData.length === 0
                              ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                              : 'bg-[var(--color-accent)] text-white hover:opacity-90'
                          }`}
                          aria-label="Archive and reset: download backup then clear performance data"
                        >
                          <Download className="w-4 h-4 inline-block mr-1" aria-hidden />
                          {ARCHIVE_AND_RESET}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClear('performance')}
                          disabled={confirmClear === 'performance' && clearConfirmText !== 'DELETE'}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            confirmClear === 'performance' && clearConfirmText === 'DELETE'
                              ? 'bg-red-600 text-white'
                              : confirmClear === 'performance'
                                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                          aria-label={confirmClear === 'performance' && clearConfirmText === 'DELETE' ? 'Confirm clear performance data' : 'Clear performance data permanently (requires typing DELETE)'}
                        >
                          <Trash2 className="w-4 h-4 inline-block mr-1" aria-hidden />
                          {confirmClear === 'performance' && clearConfirmText === 'DELETE'
                            ? 'Confirm Clear'
                            : 'Clear permanently…'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          To Review
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {missedQuestionsCount} to review
                        </div>
                      </div>
                      <button
                        onClick={() => handleClear('missed')}
                        disabled={missedQuestionsCount === 0}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          missedQuestionsCount === 0
                            ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                            : confirmClear === 'missed'
                              ? 'bg-red-600 text-white'
                              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                        aria-label={confirmClear === 'missed' ? 'Confirm clear to review' : 'Clear to review (opens confirmation)'}
                      >
                        <Trash2 className="w-4 h-4 inline-block mr-1" aria-hidden />
                        {confirmClear === 'missed' ? 'Confirm' : CLEAR_TO_REVIEW}
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
                            ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                            : confirmClear === 'flagged'
                              ? 'bg-red-600 text-white'
                              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                        aria-label={confirmClear === 'flagged' ? 'Confirm clear flagged questions' : 'Clear flagged questions (opens confirmation)'}
                      >
                        <Trash2 className="w-4 h-4 inline-block mr-1" aria-hidden />
                        {confirmClear === 'flagged' ? 'Confirm' : 'Clear Flagged Questions…'}
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
              </div>
            )}
          </div>

          {/* Mobile: Bottom bar tab switcher (44px+ touch targets) */}
          <div className="md:hidden flex-shrink-0 flex border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] safe-area-pb">
            <button
              onClick={() => setActiveTab('stats')}
              aria-label="Statistics"
              aria-current={activeTab === 'stats' ? 'true' : undefined}
              className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-3 px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset ${
                activeTab === 'stats'
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <BarChart3 className="w-5 h-5 mb-0.5" aria-hidden />
              <span>Stats</span>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              aria-label="Activity"
              aria-current={activeTab === 'activity' ? 'true' : undefined}
              className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-3 px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset ${
                activeTab === 'activity'
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <ActivityIcon className="w-5 h-5 mb-0.5" aria-hidden />
              <span>Activity</span>
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              aria-label="Preferences"
              aria-current={activeTab === 'preferences' ? 'true' : undefined}
              className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-3 px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset ${
                activeTab === 'preferences'
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-0.5" aria-hidden />
              <span>Prefs</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              aria-label="Settings"
              aria-current={activeTab === 'settings' ? 'true' : undefined}
              className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-3 px-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset ${
                activeTab === 'settings'
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'text-[var(--color-text-muted)] active:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <Settings className="w-5 h-5 mb-0.5" aria-hidden />
              <span>Settings</span>
            </button>
          </div>

          {/* Fixed Footer - Version (outside scroll, always visible) */}
          <div className="flex-shrink-0 border-t border-[var(--color-border)] px-4 py-2 text-center text-xs text-[var(--color-text-muted)]">
            PANaCEa v1.0.0 • Built for PANCE Success
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsStatsModal;
