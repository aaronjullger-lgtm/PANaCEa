'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Zap,
  Clock,
  Trophy,
  Search,
  Star,
  StarOff,
  ChevronRight,
  TrendingUp,
  Timer,
  Target,
  Flame,
  Activity,
  Beaker,
  BookOpen,
  FileCheck,
  GitCompare,
  GraduationCap,
  Hash,
  Headphones,
  Heart,
  Layers,
  MessageSquare,
  Pill,
  Scan,
  Siren,
  Wind,
  Droplets,
  Image as ImageIcon,
  LucideIcon,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { MODE_REGISTRY, TrainingModeConfig, TrainingModeId, MODES_WITH_DEDICATED_ROUTES } from '@/config/training-modes';

// ============================================================================
// Types & Constants
// ============================================================================

type TimeInvestment = 'rapid' | 'targeted' | 'deep';
type FocusOption = 'all' | 'growth' | 'flagged' | 'due';

interface ModeProgress {
  masteryPercent: number;
  lastPracticed?: Date;
  questionsAnswered?: number;
  averageTimeSeconds?: number;
  lastScore?: number;
}

interface TrainingMenuTieredProps {
  onStartSession?: (modeId: string, focus?: FocusOption) => void;
  onNavigateToMode?: (route: string, mode: TrainingModeConfig) => void;
  onClose?: () => void;
  dueQuestionsCount?: number;
  flaggedQuestionsCount?: number;
  growthAreasCount?: number;
  /** User's progress data for each mode */
  modeProgress?: Record<string, ModeProgress>;
  /** User's pinned/favorite mode IDs */
  pinnedModes?: string[];
  /** Callback when user pins/unpins a mode */
  onTogglePin?: (modeId: string) => void;
}

// Time investment categorization
const TIME_INVESTMENT_MAP: Record<TrainingModeId, TimeInvestment> = {
  // Rapid-Fire (1-5 min)
  'rapid_recall': 'rapid',
  'medical_wordle': 'rapid',
  'code_blue_speed': 'rapid',
  'cram_mode': 'rapid',
  
  // Targeted Drills (5-15 min)
  'core_adaptive': 'targeted',
  'ecg_drill': 'targeted',
  'derm_drill': 'targeted',
  'imaging_drill': 'targeted',
  'mini_lab': 'targeted',
  'ddx_compare': 'targeted',
  'guideline_drill': 'targeted',
  'first_line_treatment': 'targeted',
  'pharmacology': 'targeted',
  'condition_drill': 'targeted',
  'system_drill': 'targeted',
  'subcategory_drill': 'targeted',
  'antibiotic_mode': 'targeted',
  'photo_drill': 'targeted',
  'grand_rounds': 'targeted',
  
  // Deep Clinical Encounters (15+ min)
  'patient_encounter': 'deep',
  'panre_la': 'deep',
  'fluid_electrolyte': 'deep',
  'ventilator_hero': 'deep',
  'polypharmacy_puzzle': 'deep',
  'radiology_scroll': 'deep',
  'physiology_drill': 'deep',
  'anatomy_review': 'deep',
};

const TIME_TIER_CONFIG: Record<TimeInvestment, { label: string; description: string; timeRange: string; icon: LucideIcon; color: string }> = {
  rapid: {
    label: 'Rapid-Fire',
    description: 'Quick drills for speed and retention',
    timeRange: '1-5 min',
    icon: Zap,
    color: 'text-amber-500',
  },
  targeted: {
    label: 'Targeted Drills',
    description: 'Focused practice sessions',
    timeRange: '5-15 min',
    icon: Target,
    color: 'text-blue-500',
  },
  deep: {
    label: 'Deep Encounters',
    description: 'Immersive clinical simulations',
    timeRange: '15+ min',
    icon: Brain,
    color: 'text-purple-500',
  },
};

// Icon mapping
const getIconMap = (): Record<string, LucideIcon> => ({
  Brain,
  Image: ImageIcon,
  Zap,
  GitCompare,
  FileText: FileCheck,
  Flame,
  ClipboardList: BookOpen,
  Activity,
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
  AlertTriangle: AlertCircle,
  PillBottle: Pill,
  Target,
  Heart,
});

// ============================================================================
// Subcomponents
// ============================================================================

interface ModeCardProps {
  mode: TrainingModeConfig;
  progress?: ModeProgress;
  isPinned: boolean;
  isDailyPick: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  variant: TimeInvestment;
}

const ModeCard: React.FC<ModeCardProps> = ({
  mode,
  progress,
  isPinned,
  isDailyPick,
  onSelect,
  onTogglePin,
  variant,
}) => {
  const ICON_MAP = getIconMap();
  const IconComponent = ICON_MAP[mode.iconName] ?? HelpCircle;
  const isDisabled = mode.isComingSoon;
  
  // Variant-specific styling
  const variantStyles = {
    rapid: {
      card: 'min-h-[120px]',
      content: 'compact',
    },
    targeted: {
      card: 'min-h-[160px]',
      content: 'standard',
    },
    deep: {
      card: 'min-h-[200px]',
      content: 'expanded',
    },
  };

  return (
    <motion.div
      whileHover={!isDisabled ? { y: -4, scale: 1.02 } : {}}
      className={`
        relative rounded-2xl border overflow-hidden transition-all
        ${variantStyles[variant].card}
        ${isDisabled
          ? 'opacity-40 grayscale cursor-not-allowed bg-slate-100 dark:bg-slate-900/30 border-dashed border-slate-300 dark:border-slate-700'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl cursor-pointer shadow-md'
        }
        ${isPinned && !isDisabled ? 'ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-slate-950' : ''}
        ${isDailyPick && !isDisabled ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-slate-950' : ''}
      `}
    >
      {/* Pin button */}
      {!isDisabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors z-10"
          title={isPinned ? 'Unpin' : 'Pin to favorites'}
        >
          {isPinned ? (
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          ) : (
            <StarOff className="w-4 h-4 text-slate-400 hover:text-amber-500" />
          )}
        </button>
      )}

      {/* Coming Soon badge */}
      {isDisabled && (
        <span className="absolute top-3 right-3 text-xs font-medium text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-300/30 z-10">
          Coming Soon
        </span>
      )}

      {/* Daily Pick badge */}
      {isDailyPick && !isDisabled && (
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10 shadow-lg">
          <TrendingUp className="w-3 h-3" />
          Daily Pick
        </div>
      )}

      <button
        onClick={onSelect}
        disabled={isDisabled}
        className="w-full h-full p-5 text-left"
      >
        <div className="flex flex-col h-full">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 ${isDisabled ? 'opacity-50' : ''}`}>
            <IconComponent className={`w-5 h-5 text-slate-600 dark:text-slate-300 ${isDisabled ? 'opacity-50' : ''}`} />
          </div>

          {/* Title & Description */}
          <h3 className={`font-semibold text-slate-900 dark:text-white text-base mb-1 ${isDisabled ? 'opacity-50' : ''}`}>
            {mode.label}
          </h3>
          <p className={`text-sm text-slate-600 dark:text-slate-400 line-clamp-2 flex-1 ${isDisabled ? 'opacity-50' : ''}`}>
            {mode.description}
          </p>

          {/* Progress indicator (for targeted/deep modes) */}
          {progress && !isDisabled && variant !== 'rapid' && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{progress.masteryPercent}% mastery</span>
                {progress.lastPracticed && (
                  <span>
                    {Math.floor((Date.now() - progress.lastPracticed.getTime()) / (1000 * 60 * 60 * 24))}d ago
                  </span>
                )}
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${progress.masteryPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Last score for deep encounters */}
          {progress?.lastScore !== undefined && variant === 'deep' && !isDisabled && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Last score: {progress.lastScore}%</span>
            </div>
          )}
        </div>
      </button>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const TrainingMenuTiered: React.FC<TrainingMenuTieredProps> = ({
  onStartSession,
  onNavigateToMode,
  onClose,
  dueQuestionsCount = 0,
  flaggedQuestionsCount = 0,
  growthAreasCount = 0,
  modeProgress = {},
  pinnedModes = [],
  onTogglePin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [focus, setFocus] = useState<FocusOption>('all');

  // Get core adaptive mode
  const coreMode = MODE_REGISTRY.find((mode) => mode.id === 'core_adaptive');

  // Filter and categorize modes
  const { pinnedModesData, rapidModes, targetedModes, deepModes, filteredCount } = useMemo(() => {
    const HIDDEN_MODES: TrainingModeId[] = ['condition_drill', 'core_adaptive'];
    let allModes = MODE_REGISTRY.filter((mode) => !HIDDEN_MODES.includes(mode.id));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      allModes = allModes.filter((mode) =>
        mode.label.toLowerCase().includes(query) ||
        mode.description.toLowerCase().includes(query)
      );
    }

    // Separate pinned modes
    const pinned = allModes.filter((mode) => pinnedModes.includes(mode.id));
    const unpinned = allModes.filter((mode) => !pinnedModes.includes(mode.id));

    // Categorize by time investment
    const rapid = unpinned.filter((mode) => TIME_INVESTMENT_MAP[mode.id] === 'rapid');
    const targeted = unpinned.filter((mode) => TIME_INVESTMENT_MAP[mode.id] === 'targeted');
    const deep = unpinned.filter((mode) => TIME_INVESTMENT_MAP[mode.id] === 'deep');

    return {
      pinnedModesData: pinned,
      rapidModes: rapid,
      targetedModes: targeted,
      deepModes: deep,
      filteredCount: allModes.length,
    };
  }, [searchQuery, pinnedModes]);

  // Daily pick calculation
  const dailyPick = useMemo(() => {
    const activeModes = MODE_REGISTRY.filter((m) => !m.isComingSoon && m.id !== 'core_adaptive');
    if (activeModes.length === 0) return null;

    const modesWithProgress = activeModes.filter((m) => modeProgress[m.id]?.questionsAnswered);
    if (modesWithProgress.length > 0) {
      return modesWithProgress.sort((a, b) => {
        const aLast = modeProgress[a.id]?.lastPracticed?.getTime() || 0;
        const bLast = modeProgress[b.id]?.lastPracticed?.getTime() || 0;
        return aLast - bLast;
      })[0].id;
    }

    return activeModes.find((m) => !modeProgress[m.id]?.questionsAnswered)?.id || null;
  }, [modeProgress]);

  const handleModeSelect = useCallback((mode: TrainingModeConfig) => {
    if (mode.isComingSoon) return;

    if (MODES_WITH_DEDICATED_ROUTES.includes(mode.id as TrainingModeId)) {
      onNavigateToMode?.(mode.route, mode);
    } else {
      onStartSession?.(mode.id);
    }
    onClose?.();
  }, [onNavigateToMode, onStartSession, onClose]);

  const handleCoreStart = useCallback(() => {
    if (coreMode) {
      onStartSession?.(coreMode.id, focus);
      onClose?.();
    }
  }, [coreMode, focus, onStartSession, onClose]);

  const handleTogglePin = useCallback((modeId: string) => {
    onTogglePin?.(modeId);
  }, [onTogglePin]);

  const getFocusDescription = () => {
    switch (focus) {
      case 'all':
        return 'Adaptive questions based on your performance history.';
      case 'growth':
        return `Focus on ${growthAreasCount} identified weak areas.`;
      case 'flagged':
        return `Review ${flaggedQuestionsCount} flagged questions.`;
      case 'due':
        return `${dueQuestionsCount} questions due for review.`;
      default:
        return 'Practice PANCE-level questions.';
    }
  };

  const renderTierSection = (
    tier: TimeInvestment,
    modes: TrainingModeConfig[],
    gridCols: string
  ) => {
    if (modes.length === 0) return null;
    const config = TIME_TIER_CONFIG[tier];
    const TierIcon = config.icon;

    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800`}>
            <TierIcon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {config.label}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                ({config.timeRange})
              </span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{config.description}</p>
          </div>
        </div>

        <div className={`grid ${gridCols} gap-4`}>
          {modes.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              progress={modeProgress[mode.id]}
              isPinned={pinnedModes.includes(mode.id)}
              isDailyPick={dailyPick === mode.id}
              onSelect={() => handleModeSelect(mode)}
              onTogglePin={() => handleTogglePin(mode.id)}
              variant={tier}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search training modes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        {searchQuery && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {filteredCount} results
          </div>
        )}
      </div>

      {/* Core Adaptive Hero (hidden when searching) */}
      {!searchQuery && coreMode && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 border border-slate-700">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Brain className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Core PANCE Simulation</h2>
                  <p className="text-sm text-slate-400">{getFocusDescription()}</p>
                </div>
              </div>

              {/* Focus toggles */}
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all' as FocusOption, label: 'All Topics' },
                  { value: 'growth' as FocusOption, label: 'Growth Areas', count: growthAreasCount },
                  { value: 'flagged' as FocusOption, label: 'Flagged', count: flaggedQuestionsCount },
                  { value: 'due' as FocusOption, label: 'Due', count: dueQuestionsCount },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFocus(opt.value)}
                    disabled={opt.count !== undefined && opt.count === 0 && opt.value !== 'all'}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                      focus === opt.value
                        ? 'bg-blue-500 text-white'
                        : opt.count === 0 && opt.value !== 'all'
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                    {opt.count !== undefined && opt.count > 0 && (
                      <span className="ml-1.5 text-xs opacity-70">({opt.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center">
              <button
                onClick={handleCoreStart}
                className="px-8 py-3.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/25"
              >
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pinned Favorites */}
      {pinnedModesData.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Your Favorites
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedModesData.map((mode) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                progress={modeProgress[mode.id]}
                isPinned={true}
                isDailyPick={dailyPick === mode.id}
                onSelect={() => handleModeSelect(mode)}
                onTogglePin={() => handleTogglePin(mode.id)}
                variant={TIME_INVESTMENT_MAP[mode.id] || 'targeted'}
              />
            ))}
          </div>
        </section>
      )}

      {/* Time-Based Tiers */}
      {renderTierSection('rapid', rapidModes, 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}
      {renderTierSection('targeted', targetedModes, 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}
      {renderTierSection('deep', deepModes, 'grid-cols-1 sm:grid-cols-2')}

      {/* No results */}
      {searchQuery && filteredCount === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">No training modes found for "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};

export default TrainingMenuTiered;
