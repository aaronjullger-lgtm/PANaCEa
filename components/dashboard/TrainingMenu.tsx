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
  GraduationCap,
  Siren,
  Headphones,
  Hash,
  Wind,
  AlertTriangle,
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
  GraduationCap,
  Siren,
  Trophy,
  Clock,
  Headphones,
  Hash,
  Wind,
  AlertTriangle,
  PillBottle: Pill, // Alias for Polypharmacy
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

  // Filter out the core category and condition_drill (accessed via Condition Page) for the Bento grid
  // condition_drill is hidden from the main menu but users can access it via the Condition Page
  const HIDDEN_DRILL_MODES: TrainingModeId[] = ['condition_drill'];
  const drillModes = MODE_REGISTRY.filter((mode) => mode.category !== 'core' && !HIDDEN_DRILL_MODES.includes(mode.id));

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
                ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] shadow-md'
                : option.disabled
                ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-sm'
            }`}
          >
            {option.value === 'due' && <Clock className="w-3.5 h-3.5" />}
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                focus === option.value ? 'bg-[var(--color-bg-primary)]/20 text-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
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
   * Get special styling for specific drill modes - Clinical Theme
   */
  const getDrillModeStyles = (modeId: string): { 
    background: string; 
    border: string;
    overlay?: string;
    iconBg: string;
    iconColor: string;
  } => {
    // Clinical Theme: Clean whites/navy with subtle color accents
    const baseStyles = {
      light: 'bg-[var(--color-bg-primary)]',
      border: 'border-[var(--color-border)]',
      iconBg: 'bg-[var(--color-bg-tertiary)]',
    };

    switch (modeId) {
      case 'photo_drill':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-slate-600 dark:text-slate-300',
        };
      case 'ecg_drill':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-rose-600 dark:text-rose-400',
        };
      case 'derm_drill':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-pink-600 dark:text-pink-400',
        };
      case 'imaging_drill':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-slate-600 dark:text-slate-300',
        };
      case 'mini_lab':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'rapid_recall':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-amber-600 dark:text-amber-400',
        };
      case 'ddx_compare':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'guideline_drill':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-teal-600 dark:text-teal-400',
        };
      case 'condition_drill':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-violet-600 dark:text-violet-400',
        };
      case 'first_line_treatment':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-cyan-600 dark:text-cyan-400',
        };
      case 'pharmacology':
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-purple-600 dark:text-purple-400',
        };
      case 'mastery_drill':
        return {
          background: baseStyles.light,
          border: streakHighScore > 0 ? 'border-orange-300 ring-2 ring-orange-400/50 dark:border-orange-600 dark:ring-orange-500/50' : baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-orange-600 dark:text-orange-400',
        };
      default:
        return {
          background: baseStyles.light,
          border: baseStyles.border,
          iconBg: baseStyles.iconBg,
          iconColor: 'text-[#364154] dark:text-[#E9ECF1]',
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
   * Render drill mode card with unique styling per mode - Clinical Theme
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
          ${isDisabled 
            ? 'opacity-50 cursor-not-allowed grayscale' 
            : 'hover:scale-[1.02] cursor-pointer shadow-md hover:shadow-xl'
          }
          ${isStreakMode && streakHighScore > 0 ? 'animate-pulse-subtle' : ''}
        `}
      >
        {isDisabled && (
          <span className="absolute top-2 right-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full z-10">
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
            <IconComponent className={`w-5 h-5 ${styles.iconColor}`} />
          </div>
          <div className="card-content-min">
            <h3 className="font-semibold text-[#1F283A] dark:text-[#E9ECF1] text-base flex items-center gap-2">
              {mode.label}
              {isStreakMode && streakHighScore > 0 && (
                <Flame className="w-4 h-4 text-orange-500" />
              )}
            </h3>
            <p className="text-sm text-[#364154] dark:text-[#cbd5e1] mt-1 line-clamp-2">{getDrillDescription(mode)}</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section A: The Core Adaptive Card */}
      {coreMode && (
        <div className="bg-white dark:bg-[#1F283A] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left side: Icon and content */}
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#E9ECF1] dark:bg-[#364154] flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-600">
                  <Brain className="w-7 h-7 text-[#1F283A] dark:text-[#E9ECF1]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">
                    Core PANCE Simulation
                  </h2>
                  <p className="text-[#364154] dark:text-[#cbd5e1] mt-1 min-h-[3rem] transition-all duration-200">
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
                className="w-full md:w-auto px-8 py-3.5 bg-[#1F283A] text-[#E9ECF1] dark:bg-[#E9ECF1] dark:text-[#1F283A] font-semibold rounded-xl hover:bg-[#364154] dark:hover:bg-white transition-colors shadow-md hover:shadow-lg"
              >
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section B: The Bento Grid */}
      <div>
        <h3 className="text-lg font-semibold text-[#1F283A] dark:text-[#E9ECF1] mb-4">Drill Modes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {drillModes.map((mode) => renderDrillCard(mode))}
        </div>
      </div>
    </div>
  );
};

export default TrainingMenu;
