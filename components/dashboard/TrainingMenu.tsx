'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { staggerContainer, staggerItem, cardHoverVariants, springs } from '@/config/appViews';
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
  Search,
  TrendingUp,
  ChevronRight,
  Target,
} from 'lucide-react';
import { DashboardActionCard } from './DashboardActionCard';
import {
  MODE_REGISTRY,
  TrainingModeConfig,
  TrainingModeId,
  TrainingCategory,
  MODES_WITH_DEDICATED_ROUTES,
} from '@/config/training-modes';
import { useUserContext } from '@/hooks/useUserContext';
import { useResolvedBlueprint } from '@/hooks/useResolvedBlueprint';
import { getDashboardConfig, shouldShowMode } from '@/lib/services/dashboardPersonalization';
import { filterPrivateBetaModes, isPrivateBetaModeVisible } from '@/lib/modes/privateBetaVisibility';

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
  Search,
  TrendingUp,
  ChevronRight,
  PillBottle: Pill, // Alias for Polypharmacy
});

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
  /** User's progress data for each mode (for progress indicators) */
  modeProgress?: Record<
    string,
    { masteryPercent: number; lastPracticed?: Date; questionsAnswered?: number }
  >;
}

/**
 * TrainingMenu Component
 *
 * Enhanced with:
 * - Visual hierarchy (dimmed Coming Soon cards)
 * - Progress indicators
 * - Sticky category sidebar navigation
 * - Search functionality
 * - Daily recommended badges
 * - Contextual live stats
 * - Standardized 3-column grid
 * - Mobile horizontal scrolling
 */
const TrainingMenu: React.FC<TrainingMenuProps> = ({
  onStartSession,
  onNavigateToMode,
  onClose,
  dueQuestionsCount = 0,
  flaggedQuestionsCount = 0,
  growthAreasCount = 0,
  modeProgress = {},
}) => {
  const prefersReducedMotion = useReducedMotion();
  const { careerStage } = useUserContext();
  const isPracticing = careerStage === 'practicing';
  const { stage } = useResolvedBlueprint();
  const dashboardConfig = useMemo(() => getDashboardConfig(stage), [stage]);

  // Localized state for the Core Adaptive focus toggle
  const [focus, setFocus] = useState<FocusOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Get the core adaptive mode from registry
  const coreMode = MODE_REGISTRY.find((mode) => mode.id === 'core_adaptive');

  // Filter out the core mode and condition_drill (accessed via Condition Page) for the Bento grid
  // Then further filter by learner-stage eligibility plus production readiness.
  const HIDDEN_DRILL_MODES: TrainingModeId[] = ['condition_drill', 'core_adaptive'];
  const drillModes = useMemo(() => {
    const allModes = MODE_REGISTRY.filter((mode) => !HIDDEN_DRILL_MODES.includes(mode.id));
    // Search still fails closed through private-beta/mode-readiness visibility.
    if (searchQuery.trim()) return filterPrivateBetaModes(allModes);
    return filterPrivateBetaModes(allModes.filter((mode) => shouldShowMode(stage, mode.id)));
  }, [stage, searchQuery]);

  // Category-based sections for clearer navigation (using TrainingCategory)
  const CATEGORY_SECTIONS: Array<{
    key: TrainingCategory;
    title: string;
    description: string;
  }> = [
    {
      key: 'visual_diagnostics',
      title: 'Visual Diagnostics',
      description: 'Images only — ECG, derm, radiology (no text scenarios)',
    },
    {
      key: 'clinical_simulation',
      title: 'Clinical Simulation',
      description: 'Text scenarios only — fluids, labs, cases (no image interpretation)',
    },
    {
      key: 'question_practice',
      title: 'Question Practice',
      description: 'Board-style questions with explanations',
    },
    {
      key: 'specialty_drills',
      title: 'Specialty Drills',
      description: 'Focused high-yield practice',
    },
  ];

  /**
   * Filter modes based on search query
   */
  const filteredModes = useMemo(() => {
    if (!searchQuery.trim()) return drillModes;
    const query = searchQuery.toLowerCase();
    return drillModes.filter(
      (mode) =>
        mode?.label?.toLowerCase().includes(query) ||
        mode?.description?.toLowerCase().includes(query)
    );
  }, [searchQuery, drillModes]);

  /**
   * Calculate daily recommended mode (mode not practiced recently)
   */
  const dailyRecommended = useMemo(() => {
    const activeModes = drillModes.filter((mode) => !mode.isComingSoon);
    if (activeModes.length === 0) return null;

    const modesWithProgress = activeModes.filter(
      (mode) => modeProgress[mode.id]?.questionsAnswered
    );
    if (modesWithProgress.length > 0) {
      const sorted = modesWithProgress.sort((a, b) => {
        const aLast = modeProgress[a.id]?.lastPracticed?.getTime() || 0;
        const bLast = modeProgress[b.id]?.lastPracticed?.getTime() || 0;
        return aLast - bLast;
      });
      const first = sorted[0];
      return first ? first.id : null;
    }

    const untriedMode = activeModes.find((mode) => !modeProgress[mode.id]?.questionsAnswered);
    return untriedMode?.id || null;
  }, [drillModes, modeProgress]);

  /**
   * Get focus-specific description text
   */
  const [adaptiveMode, setAdaptiveMode] = useState(false);

  /**
   * Get focus-specific description text
   */
  const getFocusDescription = (): string => {
    if (adaptiveMode) {
      return 'The session will dynamically adjust question difficulty based on your real-time performance to maximize learning efficiency.';
    }
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
      slate: 'bg-data-neutral',
      amber: 'bg-data-provisional',
      blue: 'bg-[var(--color-category-practice)]',
      teal: 'bg-[var(--color-accent)]/10',
      red: 'bg-data-fail',
      emerald: 'bg-data-pass',
    };
    return themeMap[theme] || 'bg-[var(--color-bg-secondary)]';
  };

  /**
   * Handle drill mode card click
   */
  const handleDrillClick = (mode: TrainingModeConfig) => {
    // Check if mode is blocked due to "coming soon" status
    if (mode.isComingSoon) {
      console.warn(
        `[TrainingMenu] Mode "${mode.label}" is marked as coming soon. Check config to enable.`
      );
      return;
    }

    // Check if this mode has a dedicated route
    if (MODES_WITH_DEDICATED_ROUTES.includes(mode.id as TrainingModeId)) {
      if (onNavigateToMode) {
        onNavigateToMode(mode.route, mode);
      } else {
        console.warn(
          '[TrainingMenu] onNavigateToMode callback not provided. Navigation will not occur.'
        );
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
      {
        value: 'growth',
        label: 'Growth Areas',
        count: growthAreasCount,
        disabled: growthAreasCount === 0,
      },
      {
        value: 'flagged',
        label: 'Flagged',
        count: flaggedQuestionsCount,
        disabled: flaggedQuestionsCount === 0,
      },
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
            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 flex items-center gap-1.5 ${
              focus === option.value
                ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] shadow-md'
                : option.disabled
                  ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                  : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            {option.value === 'due' && <Clock className="w-3.5 h-3.5" />}
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  focus === option.value
                    ? 'bg-[var(--color-bg-primary)]/20 text-[var(--color-bg-primary)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  /**
   * Get special styling for specific drill modes - Using Semantic Tokens
   * ALL colors must use var(--color-*) to comply with design system
   */
  const getDrillModeStyles = (
    modeId: string
  ): {
    background: string;
    border: string;
    overlay?: string;
    iconBg: string;
    iconColor: string;
  } => {
    // Base styles using semantic tokens
    const baseStyles = {
      light: 'bg-[var(--color-bg-primary)]',
      border: 'border-[var(--color-border)]',
      iconBg: 'bg-[var(--color-bg-tertiary)]',
      iconColorDefault: 'text-[var(--color-text-secondary)]',
    };

    // All drill modes now use consistent semantic tokens
    // Mode-specific visual differentiation comes from icons, not color
    return {
      background: baseStyles.light,
      border: baseStyles.border,
      iconBg: baseStyles.iconBg,
      iconColor: baseStyles.iconColorDefault,
    };
  };

  /**
   * Render progress bar with mastery percentage and last practiced info
   */
  const renderProgressBar = (modeId: string) => {
    const progress = modeProgress[modeId];
    if (!progress) return null;

    const { masteryPercent, lastPracticed, questionsAnswered } = progress;
    const daysSinceLastPractice = lastPracticed
      ? Math.floor((Date.now() - lastPracticed.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>{masteryPercent}% Mastered</span>
          {daysSinceLastPractice !== null && (
            <span className="text-[10px]">
              {daysSinceLastPractice === 0 ? 'Today' : `${daysSinceLastPractice}d ago`}
            </span>
          )}
        </div>
        <div className="w-full max-w-[50%] h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${masteryPercent}%` }}
          />
        </div>
        {questionsAnswered && (
          <div className="text-[10px] text-[var(--color-text-muted)]">
            {questionsAnswered} questions answered
          </div>
        )}
      </div>
    );
  };

  /**
   * Get custom description for drill modes
   */
  const getDrillDescription = (mode: TrainingModeConfig): string => {
    switch (mode.id) {
      case 'ddx_compare':
        return 'Confusing Appendicitis vs. Diverticulitis? Master the differences.';
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
        return "Glasgow coma, Light's criteria, JONES, and more.";
      case 'condition_drill':
        return '5-stage progressive questions for any condition.';
      case 'first_line_treatment':
        return "What's the go-to treatment for each condition?";
      case 'pharmacology':
        return 'Drug mechanisms, side effects, and interactions.';
      default:
        return mode?.description || 'Practice PANCE-level questions tailored to your needs.';
    }
  };

  /**
   * Render drill mode card with unique styling per mode - Clinical Theme
   */
  const renderDrillCard = (
    mode: TrainingModeConfig,
    variant: 'featured' | 'standard' = 'standard'
  ) => {
    const ICON_MAP = getIconMap();
    const IconComponent = ICON_MAP[mode.iconName] ?? HelpCircle;
    const isDisabled = mode.isComingSoon;
    const styles = getDrillModeStyles(mode.id);
    const isDailyRecommended = dailyRecommended === mode.id;
    const featuredClasses =
      variant === 'featured'
        ? 'md:col-span-2 lg:col-span-2 shadow-[0_4px_6px_-1px_var(--color-shadow-soft)] hover:shadow-[0_18px_42px_var(--color-shadow-soft)]'
        : '';

    return (
      <motion.button
        type="button"
        key={mode.id}
        variants={prefersReducedMotion ? undefined : staggerItem}
        whileHover={prefersReducedMotion || isDisabled ? undefined : { scale: 1.015, y: -3, boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.4), 0 0 20px -4px rgba(196, 183, 138, 0.12)' }}
        whileTap={prefersReducedMotion || isDisabled ? undefined : { scale: 0.98 }}
        transition={prefersReducedMotion ? { duration: 0 } : springs.snappy}
        onClick={() => handleDrillClick(mode)}
        disabled={isDisabled}
        aria-label={`Open ${mode.label}`}
        className={`
          relative p-6 rounded-2xl border overflow-hidden
          text-left transition-colors duration-200
          ${
            isDisabled
              ? 'opacity-40 grayscale cursor-not-allowed text-[var(--color-text-muted)] border-dashed border-[var(--color-border)]'
              : 'cursor-pointer shadow-md'
          }
          ${featuredClasses}
          ${isDailyRecommended && !isDisabled ? 'ring-2 ring-[#c4b78a] ring-offset-2 ring-offset-[var(--color-bg-primary)]' : ''}
        `}
        style={
          isDisabled
            ? {
                background:
                  'color-mix(in srgb, var(--color-bg-secondary) 70%, var(--color-bg-primary) 30%)',
              }
            : {
                background:
                  'color-mix(in srgb, var(--color-bg-secondary) 78%, var(--color-bg-primary) 22%)',
                border:
                  '1px solid color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                backdropFilter: 'blur(12px) saturate(130%)',
                WebkitBackdropFilter: 'blur(12px) saturate(130%)',
              }
        }
      >
        {isDisabled && (
          <span className="absolute top-2 right-2 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]/50 px-2 py-0.5 rounded-full z-10 border border-[var(--color-border)]/30">
            Coming Soon
          </span>
        )}

        {/* Daily Recommended badge */}
        {isDailyRecommended && !isDisabled && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] px-2 py-1 rounded-full text-xs font-semibold z-10 shadow-lg border border-[var(--color-border)]">
            <TrendingUp className="w-3 h-3" />
            Daily Pick
          </div>
        )}

        {/* Permanent affordance: Go icon (touch has no hover) */}
        {!isDisabled && (
          <span
            className="absolute bottom-3 right-3 z-10 w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] pointer-events-none"
            aria-hidden
          >
            <ChevronRight className="w-5 h-5" />
          </span>
        )}

        <div className="flex flex-col gap-3 relative z-[1]">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--color-bg-tertiary)] ${isDisabled ? 'opacity-50' : ''}`}
          >
            <IconComponent
              className={`w-5 h-5 ${styles.iconColor} ${isDisabled ? 'opacity-50' : ''}`}
            />
          </div>
          <div className="min-h-[80px]">
            <h3
              className={`font-semibold text-[var(--color-text-primary)] text-base flex items-center gap-2 ${isDisabled ? 'opacity-50' : ''}`}
            >
              {mode.label}
            </h3>
            <p
              className={`text-[15px] text-[var(--color-text-secondary)] mt-1 line-clamp-2 ${isDisabled ? 'opacity-50' : ''}`}
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {getDrillDescription(mode)}
            </p>
          </div>
          {!isDisabled && renderProgressBar(mode.id)}
        </div>
      </motion.button>
    );
  };

  /**
   * Scroll to a specific section
   */
  const scrollToSection = (sectionKey: string) => {
    setActiveSection(sectionKey);
    const element = document.getElementById(`section-${sectionKey}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * Render a grouped section with standardized 3-column grid
   */
  const renderSection = (key: TrainingCategory, title: string, description: string) => {
    const modes = filteredModes.filter((mode) => mode.category === key);
    if (modes.length === 0) return null;

    return (
      <section key={key} id={`section-${key}`} className="space-y-3 scroll-mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2
            className="text-xl md:text-2xl font-semibold"
            style={{
              background: 'linear-gradient(135deg, var(--color-category-specialty) 0%, color-mix(in srgb, var(--color-category-specialty) 80%, white) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {title}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] hidden sm:block">{description}</p>
        </div>

        {/* Desktop: Standard 3-column grid with staggered entrance */}
        <motion.div
          className="hidden md:grid grid-cols-3 gap-4"
          variants={prefersReducedMotion ? undefined : staggerContainer}
          initial={prefersReducedMotion ? false : "hidden"}
          whileInView="animate"
          viewport={{ once: true, margin: '-40px' }}
        >
          {modes.map((mode) => renderDrillCard(mode, 'standard'))}
        </motion.div>

        {/* Mobile: Horizontal scrolling */}
        <div className="md:hidden overflow-x-auto -mx-4 px-4 pb-2">
          <div className="flex gap-4" style={{ width: 'max-content' }}>
            {modes.map((mode) => (
              <div key={mode.id} className="w-[280px] flex-shrink-0">
                {renderDrillCard(mode, 'standard')}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Sticky Category Sidebar - Desktop only */}
      <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-0 h-fit">
        <div
          className="workspace-subsurface rounded-2xl p-4 space-y-2"
          style={{
            backdropFilter: 'blur(12px) saturate(130%)',
            WebkitBackdropFilter: 'blur(12px) saturate(130%)',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.18)',
          }}
        >
          <h3
            className="text-xs font-semibold uppercase mb-3 px-2"
            style={{ color: 'var(--color-category-specialty)', letterSpacing: '0.08em', opacity: 0.7 }}
          >
            Categories
          </h3>
          {CATEGORY_SECTIONS.map((section) => (
            <button
              key={section.key}
              onClick={() => scrollToSection(section.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                activeSection === section.key
                  ? 'text-[var(--color-text-primary)] font-medium'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
              style={activeSection === section.key ? {
                background: 'color-mix(in srgb, var(--color-category-specialty) 12%, var(--color-bg-secondary))',
                border: '1px solid color-mix(in srgb, var(--color-category-specialty) 24%, transparent)',
                boxShadow: '0 0 8px color-mix(in srgb, var(--color-category-specialty) 16%, transparent)',
              } : {
                border: '1px solid transparent',
              }}
            >
              <span className="text-sm truncate">{section.title}</span>
              <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" />
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-8 overflow-y-auto">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search modes (e.g., ECG, Antibiotics, Rapid)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="workspace-field w-full rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50"
            style={{
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />
        </div>

        {/* Core PANCE Simulation / Knowledge Maintenance - Unified Premium Card */}
        {coreMode && !searchQuery && (
          <DashboardActionCard
            title={isPracticing ? 'Knowledge Maintenance' : `Core ${dashboardConfig.examLabel} Simulation`}
            subtitle={isPracticing ? 'PANRE-LA Check-in' : dashboardConfig.readinessLabel}
            description={getFocusDescription()}
            icon={Brain}
            stats={[
              { label: 'Questions', value: `${dashboardConfig.defaultSessionSize}+`, icon: Target },
              {
                label: 'Mode',
                value:
                  focus === 'all'
                    ? 'All Topics'
                    : focus === 'growth'
                      ? 'Growth Areas'
                      : focus === 'flagged'
                        ? 'Flagged'
                        : 'Due Today',
              },
              { label: 'Algorithm', value: 'FSRS', icon: TrendingUp },
            ]}
            buttonText={dashboardConfig.sessionCTA}
            onAction={handleCoreStart}
            variant="default"
            buttonVariant="secondary"
          />
        )}

        <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={adaptiveMode}
                onChange={(e) => setAdaptiveMode(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--color-category-practice)] bg-[var(--color-bg-secondary)] border-[var(--color-border)] focus:ring-[var(--color-category-practice)] ring-offset-gray-800 focus:ring-2"
              />
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                Adaptive Difficulty
              </span>
        </label>

        {/* Daily Challenges Hub Card */}
        {!searchQuery &&
          (isPrivateBetaModeVisible('grand_rounds') ||
            isPrivateBetaModeVisible('diagnostic_puzzle') ||
            isPrivateBetaModeVisible('medical_wordle')) &&
          (() => {
            const grandRoundsMode = MODE_REGISTRY.find((m) => m.id === 'grand_rounds');
            if (!grandRoundsMode) return null;

            const dailyChallengesMode = {
              ...grandRoundsMode,
              route: '/daily-challenges',
            };

            return (
              <DashboardActionCard
                title="Daily Challenges"
                subtitle="Grand Rounds, Diagnostic Puzzle, Medical Wordle"
                description="Complete daily challenges to maintain your streak."
                icon={Trophy}
                stats={[
                  { label: "Today's Set", value: 3 },
                  { label: 'Your Streak', value: '-', icon: Trophy },
                  { label: 'Completion', value: '0%', icon: Target },
                ]}
                buttonText="View All Daily Challenges"
                onAction={() => handleDrillClick(dailyChallengesMode)}
                variant="daily"
                buttonVariant="warning"
                badge={
                  <span className="px-3 py-1 text-xs font-semibold bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-full border border-[var(--color-accent)]/30">
                    Daily
                  </span>
                }
              />
            );
          })()}

        {/* Intent-Based Sections */}
        <div className="space-y-8">
          {CATEGORY_SECTIONS.map((section) =>
            renderSection(section.key, section.title, section.description)
          )}
        </div>

        {/* No Results Message */}
        {searchQuery && filteredModes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--color-text-muted)]">
              No modes found matching "{searchQuery}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingMenu;
