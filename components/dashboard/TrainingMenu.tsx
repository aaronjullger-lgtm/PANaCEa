'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Image as ImageIcon,
  Zap,
  GitCompare,
  FileText,
  Flame,
  HelpCircle,
  Clock,
  Trophy,
  ClipboardList,
  Activity as ActivityIcon,
  Scan,
  FileCheck,
  Layers,
  Pill,
  Beaker,
  Droplets,
  MessageSquare,
  LucideIcon,
} from 'lucide-react';
import { MODE_REGISTRY, TrainingModeConfig, TrainingModeId, MODES_WITH_DEDICATED_ROUTES } from '@/config/training-modes';

/**
 * Icon mapping helper to map string names from the config to Lucide React components.
 * Using a function to ensure icons are fully loaded before mapping.
 */
const getIconMap = (): Record<string, LucideIcon> => ({
  Brain,
  Image: ImageIcon,
  Zap,
  GitCompare,
  FileText,
  Flame,
  ClipboardList,
  Activity: ActivityIcon,
  Scan,
  FileCheck,
  Layers,
  Pill,
  Beaker,
  Droplets,
  MessageSquare,
});

/** Storage key for streak high score */
const STREAK_HIGH_SCORE_KEY = 'panceai_streak_high_score';

type FocusOption = 'all' | 'growth' | 'flagged' | 'due';

interface TrainingMenuProps {
  onStartSession?: (modeId: string, focus?: FocusOption) => void;
  /** Callback for navigating to a dedicated mode route */
  onNavigateToMode?: (route: string, mode: TrainingModeConfig) => void;
  onClose?: () => void;
  /** Number of questions due for spaced repetition review */
  dueQuestionsCount?: number;
  /** Number of flagged questions */
  flaggedQuestionsCount?: number;
  /** Number of growth areas identified */
  growthAreasCount?: number;
}

/**
 * TrainingMenu Component
 *
 * Renders the "Training Command Center" modal body with:
 * - Section A: A prominent Hero card for the Core Adaptive session
 * - Section B: A Bento-style grid for specific Drill Modes
 */
const TrainingMenu: React.FC<TrainingMenuProps> = ({ 
  onStartSession,
  onNavigateToMode,
  onClose,
  dueQuestionsCount = 0,
  flaggedQuestionsCount = 0,
  growthAreasCount = 0,
}) => {
  // Localized state for the Core Adaptive focus toggle
  const [focus, setFocus] = useState<FocusOption>('all');
  
  // Streak high score from localStorage
  const [streakHighScore, setStreakHighScore] = useState<number>(0);
  
  // Load streak high score on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(STREAK_HIGH_SCORE_KEY);
        if (saved) {
          setStreakHighScore(parseInt(saved, 10) || 0);
        }
      }
    } catch (error) {
      console.error('Failed to load streak high score from localStorage:', error);
    }
  }, []);

  // Get the core adaptive mode from registry
  const coreMode = MODE_REGISTRY.find((mode) => mode.category === 'core' && mode.id === 'core_adaptive');

  // Filter out the core category for the Bento grid
  const drillModes = MODE_REGISTRY.filter((mode) => mode.category !== 'core');

  /**
   * Get focus-specific description text
   */
  const getFocusDescription = (): string => {
    switch (focus) {
      case 'all':
        return 'The gold standard adaptive quiz engine. Practice PANCE-level questions tailored to your knowledge gaps and performance history.';
      case 'growth':
        return `Focus on your ${growthAreasCount} identified weak areas. Target the topics where you need the most improvement.`;
      case 'flagged':
        return `Review your ${flaggedQuestionsCount} flagged questions. Revisit concepts you marked for extra practice.`;
      case 'due':
        return `${dueQuestionsCount} questions are due for spaced repetition review. Strengthen long-term retention with timed reviews.`;
      default:
        return 'Practice PANCE-level questions tailored to your needs.';
    }
  };

  /**
   * Get background color class based on theme
   */
  const getThemeBackground = (theme: string): string => {
    const themeMap: Record<string, string> = {
      stone: 'bg-[var(--color-bg-secondary)]',
      slate: 'bg-slate-100',
      amber: 'bg-amber-100',
      blue: 'bg-blue-100',
      teal: 'bg-teal-100',
      red: 'bg-red-100',
      emerald: 'bg-emerald-100',
    };
    return themeMap[theme] || 'bg-gray-100';
  };

  /**
   * Handle drill mode card click
   */
  const handleDrillClick = (mode: TrainingModeConfig) => {
    // Check if mode is blocked due to "coming soon" status
    if (mode.isComingSoon) {
      console.warn(`[TrainingMenu] Mode "${mode.label}" is marked as coming soon. Check config to enable.`);
      return;
    }
    
    // Debug logging to help troubleshoot routing issues
    console.log('[TrainingMenu] handleDrillClick:', {
      modeId: mode.id,
      route: mode.route,
      hasDedicatedRoute: MODES_WITH_DEDICATED_ROUTES.includes(mode.id as TrainingModeId),
    });

    // Log the route we're attempting to navigate to (for debugging)
    console.log('Attempting nav to:', mode.route);

    // Check if this mode has a dedicated route
    if (MODES_WITH_DEDICATED_ROUTES.includes(mode.id as TrainingModeId)) {
      console.log(`[TrainingMenu] Navigating to dedicated route: ${mode.route}`);
      if (onNavigateToMode) {
        onNavigateToMode(mode.route, mode);
      } else {
        console.warn('[TrainingMenu] onNavigateToMode callback not provided. Navigation will not occur.');
      }
      onClose?.();
      return;
    }

    // Fall back to standard session start
    if (onStartSession) {
      onStartSession(mode.id);
    } else {
      console.warn('[TrainingMenu] onStartSession callback not provided. Session will not start.');
    }
    onClose?.();
  };

  /**
   * Handle core session start
   */
  const handleCoreStart = () => {
    if (coreMode) {
      onStartSession?.(coreMode.id, focus);
      onClose?.();
    }
  };

  /**
   * Render focus toggle (segmented control)
   */
  const renderFocusToggle = () => {
    const options: { value: FocusOption; label: string; count?: number; disabled?: boolean }[] = [
      { value: 'all', label: 'All Topics' },
      { value: 'growth', label: 'Growth Areas', count: growthAreasCount, disabled: growthAreasCount === 0 },
      { value: 'flagged', label: 'Flagged', count: flaggedQuestionsCount, disabled: flaggedQuestionsCount === 0 },
      { value: 'due', label: 'Due', count: dueQuestionsCount, disabled: dueQuestionsCount === 0 },
    ];

    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => !option.disabled && setFocus(option.value)}
            disabled={option.disabled}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-1.5 ${
              focus === option.value
                ? 'bg-[#364154] text-[#E9ECF1] shadow-sm dark:bg-[#364154]'
                : option.disabled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600'
            }`}
          >
            {option.value === 'due' && <Clock className="w-3.5 h-3.5" />}
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                focus === option.value ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
              }`}>
                {option.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  /**
   * Get special styling for specific drill modes
   */
  const getDrillModeStyles = (modeId: string): { 
    background: string; 
    border: string;
    overlay?: string;
    iconBg: string;
  } => {
    switch (modeId) {
      case 'photo_drill':
        return {
          background: 'bg-gradient-to-br from-slate-100 to-slate-200',
          border: 'border-slate-300',
          overlay: 'before:absolute before:inset-0 before:bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 50 Q25 30 40 50 T70 50 T100 50\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'0.5\' opacity=\'0.3\'/%3E%3Cpath d=\'M10 60 Q25 40 40 60 T70 60 T100 60\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'0.5\' opacity=\'0.2\'/%3E%3C/svg%3E")] before:opacity-30 before:rounded-2xl',
          iconBg: 'bg-white/80',
        };
      case 'ecg_drill':
        return {
          background: 'bg-gradient-to-br from-rose-50 to-rose-100',
          border: 'border-rose-200',
          overlay: 'before:absolute before:inset-0 before:bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M0 50 L20 50 L25 30 L30 70 L35 40 L40 60 L45 50 L100 50\' fill=\'none\' stroke=\'%23fb7185\' stroke-width=\'1\' opacity=\'0.3\'/%3E%3C/svg%3E")] before:opacity-40 before:rounded-2xl',
          iconBg: 'bg-white/80',
        };
      case 'derm_drill':
        return {
          background: 'bg-gradient-to-br from-pink-50 to-pink-100',
          border: 'border-pink-200',
          iconBg: 'bg-white/80',
        };
      case 'imaging_drill':
        return {
          background: 'bg-gradient-to-br from-slate-100 to-slate-200',
          border: 'border-slate-300',
          iconBg: 'bg-white/80',
        };
      case 'mini_lab':
        return {
          background: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
          border: 'border-emerald-200',
          iconBg: 'bg-white/80',
        };
      case 'rapid_recall':
        return {
          background: 'bg-gradient-to-br from-amber-50 to-amber-100',
          border: 'border-amber-200',
          iconBg: 'bg-white/80',
        };
      case 'ddx_compare':
        return {
          background: 'bg-gradient-to-br from-blue-50 to-blue-100',
          border: 'border-blue-200',
          iconBg: 'bg-white/80',
        };
      case 'guideline_drill':
        return {
          background: 'bg-gradient-to-br from-teal-50 to-teal-100',
          border: 'border-teal-200',
          iconBg: 'bg-white/80',
        };
      case 'condition_drill':
        return {
          background: 'bg-gradient-to-br from-violet-50 to-violet-100',
          border: 'border-violet-200',
          iconBg: 'bg-white/80',
        };
      case 'first_line_treatment':
        return {
          background: 'bg-gradient-to-br from-cyan-50 to-cyan-100',
          border: 'border-cyan-200',
          iconBg: 'bg-white/80',
        };
      case 'pharmacology':
        return {
          background: 'bg-gradient-to-br from-purple-50 to-purple-100',
          border: 'border-purple-200',
          iconBg: 'bg-white/80',
        };
      case 'mastery_drill':
        return {
          background: streakHighScore > 0 
            ? 'bg-gradient-to-br from-orange-100 via-red-100 to-orange-100' 
            : 'bg-gradient-to-br from-red-50 to-red-100',
          border: streakHighScore > 0 ? 'border-orange-300 ring-2 ring-orange-400/50' : 'border-red-200',
          iconBg: 'bg-white/80',
        };
      default:
        return {
          background: getThemeBackground(MODE_REGISTRY.find(m => m.id === modeId)?.theme || 'stone'),
          border: 'border-[var(--color-border)]',
          iconBg: 'bg-white/60',
        };
    }
  };

  /**
   * Get custom description for drill modes
   */
  const getDrillDescription = (mode: TrainingModeConfig): string => {
    switch (mode.id) {
      case 'ddx_compare':
        return 'Confusing Appendicitis vs. Diverticulitis? Master the differences.';
      case 'mastery_drill':
        return 'Answer until you miss. How long can you survive?';
      case 'photo_drill':
        return 'ECG rhythms, derm lesions, and imaging findings. Train your visual diagnosis.';
      case 'ecg_drill':
        return 'Master rhythm strips and 12-lead ECG interpretation.';
      case 'derm_drill':
        return 'Identify skin lesions, rashes, and dermatological findings.';
      case 'imaging_drill':
        return 'X-ray, CT, and MRI pattern recognition training.';
      case 'rapid_recall':
        return 'Lightning-fast buzzwords and flashcard drills.';
      case 'mini_lab':
        return 'Interpret lab panels and make the diagnosis.';
      case 'guideline_drill':
        return 'Glasgow coma, Light\'s criteria, JONES, and more.';
      case 'condition_drill':
        return '5-stage progressive questions for any condition.';
      case 'first_line_treatment':
        return 'What\'s the go-to treatment for each condition?';
      case 'pharmacology':
        return 'Drug mechanisms, side effects, and interactions.';
      default:
        return mode.description;
    }
  };

  /**
   * Render drill mode card with unique styling per mode
   */
  const renderDrillCard = (mode: TrainingModeConfig) => {
    const ICON_MAP = getIconMap();
    const IconComponent = ICON_MAP[mode.iconName] ?? HelpCircle;
    const isDisabled = mode.isComingSoon;
    const styles = getDrillModeStyles(mode.id);
    const isStreakMode = mode.id === 'mastery_drill';

    return (
      <button
        type="button"
        key={mode.id}
        onClick={() => handleDrillClick(mode)}
        disabled={isDisabled}
        className={`
          relative p-5 rounded-2xl border overflow-hidden
          text-left transition-all duration-200
          ${styles.background}
          ${styles.border}
          ${styles.overlay || ''}
          ${isDisabled 
            ? 'opacity-50 cursor-not-allowed grayscale' 
            : 'hover:scale-[1.02] cursor-pointer shadow-sm hover:shadow-lg'
          }
          ${isStreakMode && streakHighScore > 0 ? 'animate-pulse-subtle' : ''}
        `}
      >
        {isDisabled && (
          <span className="absolute top-2 right-2 text-xs font-medium text-slate-500 bg-white/80 px-2 py-0.5 rounded-full z-10">
            Coming Soon
          </span>
        )}
        
        {/* Streak high score badge */}
        {isStreakMode && streakHighScore > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
            <Trophy className="w-3 h-3" />
            {streakHighScore}
          </div>
        )}
        
        <div className="flex flex-col gap-3 relative z-[1]">
          <div className={`w-10 h-10 rounded-xl ${styles.iconBg} flex items-center justify-center shadow-sm`}>
            <IconComponent className={`w-5 h-5 ${isStreakMode && streakHighScore > 0 ? 'text-orange-600' : 'text-slate-600'}`} />
          </div>
          <div>
            {/* Use dark text colors on light tile backgrounds for readability in dark mode */}
            <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
              {mode.label}
              {isStreakMode && streakHighScore > 0 && (
                <Flame className="w-4 h-4 text-orange-500" />
              )}
            </h3>
            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{getDrillDescription(mode)}</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section A: The Core Adaptive Card */}
      {coreMode && (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left side: Icon and content */}
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-600">
                  <Brain className="w-7 h-7 text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Core PANCE Simulation
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 mt-1 min-h-[3rem] transition-all duration-200">
                    {getFocusDescription()}
                  </p>
                </div>
              </div>

              {/* Focus Toggle (Segmented Control) */}
              <div className="mt-5">
                {renderFocusToggle()}
              </div>
            </div>

            {/* Right side: Start button */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleCoreStart}
                className="w-full md:w-auto px-8 py-3.5 bg-[#364154] text-[#E9ECF1] font-semibold rounded-xl hover:bg-[#1F283A] transition-colors shadow-md hover:shadow-lg"
              >
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section B: The Bento Grid */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Drill Modes</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {drillModes.map((mode) => renderDrillCard(mode))}
        </div>
      </div>
    </div>
  );
};

export default TrainingMenu;
