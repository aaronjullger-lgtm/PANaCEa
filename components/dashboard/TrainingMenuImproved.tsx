'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import {
  MODE_REGISTRY,
  TrainingModeConfig,
  TrainingModeId,
  TrainingCategory,
  MODES_WITH_DEDICATED_ROUTES,
} from '@/config/training-modes';

/**
 * Icon mapping helper to map string names from the config to Lucide React components.
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
  PillBottle: Pill,
});

type FocusOption = 'all' | 'growth' | 'flagged' | 'due';

interface TrainingMenuProps {
  onStartSession?: (modeId: string, focus?: FocusOption) => void;
  onNavigateToMode?: (route: string, mode: TrainingModeConfig) => void;
  onClose?: () => void;
  dueQuestionsCount?: number;
  flaggedQuestionsCount?: number;
  growthAreasCount?: number;
  /** User's progress data for each mode (for progress indicators) */
  modeProgress?: Record<
    string,
    { masteryPercent: number; lastPracticed?: Date; questionsAnswered?: number }
  >;
  /** Last practiced mode ID for daily recommended badge */
  lastPracticedMode?: string;
}

/**
 * Enhanced TrainingMenu with:
 * - Visual hierarchy (dimmed Coming Soon cards)
 * - Progress indicators
 * - Sticky category sidebar
 * - Search functionality
 * - Daily recommended badges
 * - Live stats
 * - Standardized 3-column grid
 * - Mobile horizontal scrolling
 */
const TrainingMenuImproved: React.FC<TrainingMenuProps> = ({
  onStartSession,
  onNavigateToMode,
  onClose,
  dueQuestionsCount = 0,
  flaggedQuestionsCount = 0,
  growthAreasCount = 0,
  modeProgress = {},
  lastPracticedMode,
}) => {
  const [focus, setFocus] = useState<FocusOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const coreMode = MODE_REGISTRY.find((mode) => mode.id === 'core_adaptive');
  const HIDDEN_DRILL_MODES: TrainingModeId[] = ['condition_drill', 'core_adaptive'];
  const drillModes = MODE_REGISTRY.filter((mode) => !HIDDEN_DRILL_MODES.includes(mode.id));

  const CATEGORY_SECTIONS: Array<{
    key: TrainingCategory;
    title: string;
    description: string;
  }> = [
    {
      key: 'visual_diagnostics',
      title: 'Visual Diagnostics',
      description: 'ECG, derm, imaging, and lab pattern recognition',
    },
    {
      key: 'clinical_simulation',
      title: 'Clinical Simulation',
      description: 'Interactive patient scenarios and management',
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
        mode.label.toLowerCase().includes(query) || mode.description.toLowerCase().includes(query)
    );
  }, [searchQuery, drillModes]);

  /**
   * Calculate daily recommended mode (mode not practiced recently)
   */
  const dailyRecommended = useMemo(() => {
    // Find mode with lowest recent activity
    const activeModes = drillModes.filter((mode) => !mode.isComingSoon);
    if (activeModes.length === 0) return null;

    // Prioritize modes with progress but not practiced recently
    const modesWithProgress = activeModes.filter(
      (mode) => modeProgress[mode.id]?.questionsAnswered
    );
    if (modesWithProgress.length > 0) {
      const sorted = modesWithProgress.sort((a, b) => {
        const aLast = modeProgress[a.id]?.lastPracticed?.getTime() || 0;
        const bLast = modeProgress[b.id]?.lastPracticed?.getTime() || 0;
        return aLast - bLast;
      });
      const firstMode = sorted[0];
      return firstMode?.id ?? null;
    }

    // Otherwise suggest a mode they haven't tried
    const untriedMode = activeModes.find((mode) => !modeProgress[mode.id]?.questionsAnswered);
    return untriedMode?.id || null;
  }, [drillModes, modeProgress]);

  const getFocusDescription = (): string => {
    switch (focus) {
      case 'all':
        return 'The gold standard adaptive quiz engine. Practice PANCE-level questions tailored to your knowledge gaps.';
      case 'growth':
        return `Focus on your ${growthAreasCount} identified weak areas. Target the topics where you need the most improvement.`;
      case 'flagged':
        return `Review your ${flaggedQuestionsCount} flagged questions. Revisit concepts you marked for extra practice.`;
      case 'due':
        return `${dueQuestionsCount} questions are due for spaced repetition review. Strengthen long-term retention.`;
      default:
        return 'Practice PANCE-level questions tailored to your needs.';
    }
  };

  const handleDrillClick = (mode: TrainingModeConfig) => {
    if (mode.isComingSoon) {
      console.warn(`[TrainingMenu] Mode "${mode.label}" is marked as coming soon.`);
      return;
    }

    if (MODES_WITH_DEDICATED_ROUTES.includes(mode.id as TrainingModeId)) {
      onNavigateToMode?.(mode.route, mode);
      onClose?.();
      return;
    }

    onStartSession?.(mode.id);
    onClose?.();
  };

  const handleCoreStart = () => {
    if (coreMode) {
      onStartSession?.(coreMode.id, focus);
      onClose?.();
    }
  };

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
        <div className="w-full h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
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

  const renderDrillCard = (mode: TrainingModeConfig) => {
    const ICON_MAP = getIconMap();
    const IconComponent = ICON_MAP[mode.iconName] ?? HelpCircle;
    const isDisabled = mode.isComingSoon;
    const isDailyRecommended = dailyRecommended === mode.id;

    return (
      <button
        type="button"
        key={mode.id}
        onClick={() => handleDrillClick(mode)}
        disabled={isDisabled}
        className={`
          relative p-5 rounded-2xl border overflow-hidden
          text-left transition-all duration-200
          ${
            isDisabled
              ? 'opacity-40 grayscale cursor-not-allowed bg-slate-50 dark:bg-slate-900/30 text-slate-400 dark:text-slate-600 border-dashed'
              : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:scale-[1.02] cursor-pointer shadow-md hover:shadow-xl'
          }
          ${isDailyRecommended && !isDisabled ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-slate-900' : ''}
        `}
      >
        {isDisabled && (
          <span className="absolute top-2 right-2 text-xs font-medium text-slate-500 dark:text-slate-600 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full z-10 border border-slate-300/30 dark:border-slate-700/30">
            Coming Soon
          </span>
        )}

        {isDailyRecommended && !isDisabled && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10 shadow-lg">
            <TrendingUp className="w-3 h-3" />
            Daily Pick
          </div>
        )}

        <div className="flex flex-col gap-3 relative z-[1]">
          <div
            className={`w-10 h-10 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center shadow-sm ${isDisabled ? 'opacity-50' : ''}`}
          >
            <IconComponent
              className={`w-5 h-5 text-[var(--color-text-secondary)] ${isDisabled ? 'opacity-50' : ''}`}
            />
          </div>
          <div className="min-h-[80px]">
            <h3
              className={`font-semibold text-[#1F283A] dark:text-[#E9ECF1] text-base flex items-center gap-2 ${isDisabled ? 'opacity-50' : ''}`}
            >
              {mode.label}
            </h3>
            <p
              className={`text-sm text-[#364154] dark:text-[#cbd5e1] mt-1 line-clamp-2 ${isDisabled ? 'opacity-50' : ''}`}
            >
              {mode.description}
            </p>
          </div>
          {!isDisabled && renderProgressBar(mode.id)}
        </div>
      </button>
    );
  };

  const scrollToSection = (sectionKey: string) => {
    setActiveSection(sectionKey);
    const element = document.getElementById(`section-${sectionKey}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderSection = (key: TrainingCategory, title: string, description: string) => {
    const modes = filteredModes.filter((mode) => mode.category === key);
    if (modes.length === 0) return null;

    return (
      <section key={key} id={`section-${key}`} className="space-y-3 scroll-mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold text-[#1F283A] dark:text-[#E9ECF1]">{title}</h3>
          <p className="text-sm text-[#364154] dark:text-[#cbd5e1] hidden sm:block">
            {description}
          </p>
        </div>

        {/* Desktop: Standard 3-column grid */}
        <div className="hidden md:grid grid-cols-3 gap-4">
          {modes.map((mode) => renderDrillCard(mode))}
        </div>

        {/* Mobile: Horizontal scrolling */}
        <div className="md:hidden overflow-x-auto -mx-4 px-4 pb-2">
          <div className="flex gap-4" style={{ width: 'max-content' }}>
            {modes.map((mode) => (
              <div key={mode.id} className="w-[280px] flex-shrink-0">
                {renderDrillCard(mode)}
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
        <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm space-y-2">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 px-2">
            Categories
          </h3>
          {CATEGORY_SECTIONS.map((section) => (
            <button
              key={section.key}
              onClick={() => scrollToSection(section.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                activeSection === section.key
                  ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
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
            className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Core Adaptive Card */}
        {coreMode && !searchQuery && (
          <div className="bg-white dark:bg-[#1F283A] rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
            <div className="flex flex-col md:flex-row gap-6">
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

                <div className="mt-5">{renderFocusToggle()}</div>
              </div>

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

        {/* Intent-Based Sections */}
        <div className="space-y-8">
          {CATEGORY_SECTIONS.map((section) =>
            renderSection(section.key, section.title, section.description)
          )}
        </div>

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

export default TrainingMenuImproved;
