import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  X,
  Target,
  Brain,
  Zap,
  Stethoscope,
  BookOpen,
  Pill,
  Activity,
  Clock,
  Trophy,
  Flame,
  AlertCircle,
  CheckCircle,
  Timer,
  GraduationCap,
  Beaker,
  FileImage,
  Shield,
  Layers,
  Droplets,
  GitCompare,
  FileCheck,
  Siren,
  Hash,
  Heart,
  Wind,
  Eye,
  MessageSquare,
  Image,
  Scan,
  FlaskConical,
  Headphones,
  FolderTree,
  Calculator,
  BarChart3,
  TrendingUp,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useUserContext } from '@/hooks/useUserContext';
import { useRolling360Stats } from '@/hooks/useRolling360Stats';
import {
  VISUAL_DIAGNOSTICS_MODES,
  CLINICAL_SIMULATION_MODES,
  QUESTION_PRACTICE_MODES,
  SPECIALTY_DRILL_MODES,
  CATEGORY_INFO,
  MODE_REGISTRY,
  type TrainingModeConfig,
  type TrainingCategory,
} from '@/config/training-modes';
import { getRecentModeIds, recordRecentMode } from '@/lib/recentModes';
import { BodyMapWidget } from '@/components/dashboard/BodyMapWidget';
import { RoundsButton } from '@/components/dashboard/RoundsButton';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Zap,
  Target,
  Stethoscope,
  BookOpen,
  Pill,
  Activity,
  Clock,
  Trophy,
  Flame,
  AlertCircle,
  CheckCircle,
  Timer,
  GraduationCap,
  Beaker,
  FileImage,
  Shield,
  Layers,
  Droplets,
  GitCompare,
  FileCheck,
  Siren,
  Hash,
  Heart,
  Wind,
  Eye,
  MessageSquare,
  Image,
  Scan,
  FlaskConical,
  Headphones,
  FolderTree,
  Calculator,
  BarChart3,
  TrendingUp,
  Sparkles,
};

interface PracticePageProps {
  onNavigateToDrillMode: (modeId: string) => void;
  onNavigateToDrillWithSystem?: (modeId: string, system: string) => void;
}

const ModeCard: React.FC<{
  mode: TrainingModeConfig;
  onSelect: () => void;
}> = ({ mode, onSelect }) => {
  const Icon = ICON_MAP[mode.iconName] || Target;
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      onClick={onSelect}
      disabled={mode.isComingSoon}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
        mode.isComingSoon
          ? 'opacity-50 cursor-not-allowed bg-[var(--color-bg-tertiary)] border-dashed'
          : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-accent)]/10 transition-colors flex-shrink-0">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="font-semibold text-[var(--color-text-primary)]">{mode.label}</h4>
            {mode.isComingSoon && (
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full">
                Soon
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{mode.description}</p>
          {mode.estimatedMinutes && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
              <Timer className="w-3 h-3" />
              <span>~{mode.estimatedMinutes} min</span>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
};

const CategorySection: React.FC<{
  category: TrainingCategory;
  modes: TrainingModeConfig[];
  onSelectMode: (mode: TrainingModeConfig) => void;
}> = ({ category, modes, onSelectMode }) => {
  const info = CATEGORY_INFO[category];
  const Icon = ICON_MAP[info.iconName] || Target;

  if (modes.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[var(--color-bg-secondary)]">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{info.label}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">{info.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {modes.map((mode) => (
          <ModeCard key={mode.id} mode={mode} onSelect={() => onSelectMode(mode)} />
        ))}
      </div>
    </section>
  );
};

export const PracticePage: React.FC<PracticePageProps> = ({
  onNavigateToDrillMode,
  onNavigateToDrillWithSystem,
}) => {
  const { showPANREContent } = useUserContext();
  const { stats: rolling360Stats, isLoading } = useRolling360Stats();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'quick' | 'medium' | 'long'>('all');

  const filteredModes = useMemo(() => {
    const filterForContext = (modes: TrainingModeConfig[]) =>
      modes.filter((m) => {
        if (m.panreOnly && !showPANREContent) return false;
        if (m.didacticOnly && showPANREContent) return false;
        
        const matchesSearch = searchQuery === '' || 
          m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.description.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesTime = timeFilter === 'all' || 
          (timeFilter === 'quick' && (m.estimatedMinutes ?? 0) <= 10) ||
          (timeFilter === 'medium' && (m.estimatedMinutes ?? 0) > 10 && (m.estimatedMinutes ?? 0) <= 30) ||
          (timeFilter === 'long' && (m.estimatedMinutes ?? 0) > 30);
        
        return matchesSearch && matchesTime;
      });

    return {
      visual: filterForContext(VISUAL_DIAGNOSTICS_MODES),
      clinical: filterForContext(CLINICAL_SIMULATION_MODES),
      questions: filterForContext(QUESTION_PRACTICE_MODES),
      specialty: filterForContext(SPECIALTY_DRILL_MODES),
    };
  }, [showPANREContent, searchQuery, timeFilter]);

  const handleModeSelect = useCallback(
    (mode: TrainingModeConfig) => {
      recordRecentMode(mode.id);
      onNavigateToDrillMode(mode.id);
    },
    [onNavigateToDrillMode]
  );

  const recentModeIds = getRecentModeIds();
  const recentModes = useMemo(
    () =>
      recentModeIds
        .map((id) => MODE_REGISTRY.find((m) => m.id === id))
        .filter((m): m is TrainingModeConfig => !!m && !m.isComingSoon)
        .slice(0, 6),
    [recentModeIds]
  );

  const recommendedModeIds = ['core_adaptive', 'grand_rounds', 'diagnostic_puzzle'] as const;
  const recommendedModes = useMemo(
    () =>
      recommendedModeIds
        .map((id) => MODE_REGISTRY.find((m) => m.id === id))
        .filter((m): m is TrainingModeConfig => !!m && !m.isComingSoon)
        .filter((m) => !m.panreOnly || showPANREContent),
    [showPANREContent]
  );

  const weakestSet = useMemo(() => new Set(rolling360Stats?.weakestSystems ?? []), [rolling360Stats?.weakestSystems]);
  const weakestSystem = rolling360Stats?.weakestSystems?.[0] ?? null;
  const hasData = (rolling360Stats?.totalInWindow ?? 0) >= 5;
  const systemsWithData = Object.entries(rolling360Stats?.systemStats ?? {}).filter(([, s]) => s.total >= 2);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Practice & Training</h1>
        <p className="text-[var(--color-text-muted)]">Choose a training mode to sharpen your clinical skills</p>
      </div>

      {/* Start here — recommended modes when not searching */}
      {!searchQuery && recommendedModes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
            Start here
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommendedModes.map((mode) => (
              <ModeCard key={mode.id} mode={mode} onSelect={() => handleModeSelect(mode)} />
            ))}
          </div>
        </section>
      )}

      {/* Recently used — same storage as Command Palette */}
      {!searchQuery && recentModes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
            Recently used
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentModes.map((mode) => (
              <ModeCard key={mode.id} mode={mode} onSelect={() => handleModeSelect(mode)} />
            ))}
          </div>
        </section>
      )}

      {/* Search & Filters */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search modes (e.g., 'ECG', 'pharmacology')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'quick', 'medium', 'long'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === filter
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              {filter === 'all' && 'All Modes'}
              {filter === 'quick' && 'Quick (≤10 min)'}
              {filter === 'medium' && 'Medium (15-30 min)'}
              {filter === 'long' && 'Long (45+ min)'}
            </button>
          ))}
        </div>
      </div>

      {/* Training Mode Categories */}
      <CategorySection category="visual_diagnostics" modes={filteredModes.visual} onSelectMode={handleModeSelect} />
      <CategorySection category="clinical_simulation" modes={filteredModes.clinical} onSelectMode={handleModeSelect} />
      <CategorySection category="question_practice" modes={filteredModes.questions} onSelectMode={handleModeSelect} />
      <CategorySection category="specialty_drills" modes={filteredModes.specialty} onSelectMode={handleModeSelect} />

      {/* Residency Cockpit */}
      {!isLoading && onNavigateToDrillWithSystem && (
        <section className="mb-6">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-[var(--color-text-muted)]" />
            Residency Cockpit
          </h3>
          <div className="flex flex-col lg:flex-row gap-6">
            {hasData && systemsWithData.length > 0 && rolling360Stats?.systemStats && (
              <div className="flex-shrink-0">
                <BodyMapWidget
                  systemStats={rolling360Stats.systemStats}
                  weakestSystems={rolling360Stats.weakestSystems ?? []}
                  onSystemClick={(s) => onNavigateToDrillWithSystem('system_drill', s)}
                />
              </div>
            )}
            <div className="flex-1 flex flex-col gap-4">
              <RoundsButton
                weakestSystem={weakestSystem}
                hasData={hasData}
                onStartRounds={(system) => {
                  if (system) {
                    onNavigateToDrillWithSystem('system_drill', system);
                  } else {
                    onNavigateToDrillWithSystem('system_drill', '');
                  }
                }}
              />
              {systemsWithData.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {systemsWithData.slice(0, 12).map(([system, sysStats]) => {
                    const isWeak = weakestSet.has(system);
                    return (
                      <button
                        key={system}
                        type="button"
                        onClick={() => onNavigateToDrillWithSystem('system_drill', system)}
                        className={`text-left p-4 rounded-xl border transition-all bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg ${
                          isWeak ? 'ring-1 ring-[var(--color-accent)]/30' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {system}
                          </span>
                          {isWeak && (
                            <span className="px-1.5 py-0.5 bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs rounded">
                              Weak
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {sysStats.accuracy.toFixed(0)}% · {sysStats.total} q
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default PracticePage;
