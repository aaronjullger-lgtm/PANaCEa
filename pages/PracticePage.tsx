import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Brain,
  Calculator,
  Clock,
  Eye,
  FileCheck,
  FlaskConical,
  FolderTree,
  GitCompare,
  GraduationCap,
  Hash,
  Headphones,
  Heart,
  Image,
  Layers,
  MessageSquare,
  Pill,
  Scan,
  Search,
  Shield,
  Siren,
  Sparkles,
  Stethoscope,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  WorkspaceEmptyState,
  WorkspaceFilterBar,
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { BodyMapWidget } from '@/components/dashboard/BodyMapWidget';
import { RoundsButton } from '@/components/dashboard/RoundsButton';
import { useUserContext } from '@/hooks/useUserContext';
import { useRolling360Stats } from '@/hooks/useRolling360Stats';
import {
  CATEGORY_INFO,
  CLINICAL_SIMULATION_MODES,
  MODE_REGISTRY,
  QUESTION_PRACTICE_MODES,
  SPECIALTY_DRILL_MODES,
  VISUAL_DIAGNOSTICS_MODES,
  type TrainingCategory,
  type TrainingModeConfig,
} from '@/config/training-modes';
import { getRecentModeIds, recordRecentMode } from '@/lib/recentModes';
import { ROUTES } from '@/config/routes';

const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  Brain,
  Calculator,
  Clock,
  Eye,
  FileCheck,
  FlaskConical,
  FolderTree,
  GitCompare,
  GraduationCap,
  Hash,
  Headphones,
  Heart,
  Image,
  Layers,
  MessageSquare,
  Pill,
  Scan,
  Shield,
  Siren,
  Sparkles,
  Stethoscope,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Wind,
  Zap,
};

const CATEGORY_ACCENTS: Record<TrainingCategory, string> = {
  visual_diagnostics: '#728ba6',
  clinical_simulation: '#9a7f9a',
  question_practice: '#c4b78a',
  specialty_drills: '#7a8f6e',
};

const TIME_FILTER_LABELS = {
  all: 'All windows',
  quick: 'Quick wins',
  medium: 'Focused blocks',
  long: 'Deep work',
} as const;

interface PracticePageProps {
  onNavigateToDrillMode: (modeId: string) => void;
  onNavigateToDrillWithSystem?: (modeId: string, system: string) => void;
}

function ModeCard({
  mode,
  accent,
  onSelect,
}: {
  mode: TrainingModeConfig;
  accent: string;
  onSelect: () => void;
}) {
  const Icon = ICON_MAP[mode.iconName] || Target;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={mode.isComingSoon}
      className="h-full w-full text-left disabled:cursor-not-allowed"
    >
      <WorkspaceSurface
        accent={accent}
        className={`h-full transition-transform duration-300 hover:translate-y-[-2px] ${
          mode.isComingSoon ? 'opacity-55 grayscale-[0.1]' : ''
        }`}
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8"
              style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}
            >
              <Icon className="h-5 w-5" style={{ color: accent }} aria-hidden="true" />
            </div>
            {mode.isComingSoon ? (
              <span className="rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Coming soon
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
              {mode.label}
            </h3>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              {mode.description}
            </p>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--color-text-muted)]">
            {mode.estimatedMinutes ? (
              <span className="rounded-full border border-white/8 bg-white/4 px-2.5 py-1">
                ~{mode.estimatedMinutes} min
              </span>
            ) : null}
          </div>
        </div>
      </WorkspaceSurface>
    </button>
  );
}

function CategorySection({
  category,
  modes,
  onSelectMode,
}: {
  category: TrainingCategory;
  modes: TrainingModeConfig[];
  onSelectMode: (mode: TrainingModeConfig) => void;
}) {
  if (modes.length === 0) return null;

  const info = CATEGORY_INFO[category];
  const Icon = ICON_MAP[info.iconName] || Target;
  const accent = CATEGORY_ACCENTS[category];

  return (
    <WorkspaceSection
      title={info.label}
      subtitle={info.description}
      action={
        <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
          {modes.length} mode{modes.length === 1 ? '' : 's'}
        </span>
      }
    >
      <WorkspaceSurface accent={accent} className="space-y-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8"
            style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {info.label}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Curated for this study lane.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modes.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              accent={accent}
              onSelect={() => onSelectMode(mode)}
            />
          ))}
        </div>
      </WorkspaceSurface>
    </WorkspaceSection>
  );
}

export const PracticePage: React.FC<PracticePageProps> = ({
  onNavigateToDrillMode,
  onNavigateToDrillWithSystem,
}) => {
  const navigate = useNavigate();
  const { showPANREContent } = useUserContext();
  const { stats: rolling360Stats, isLoading } = useRolling360Stats();

  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('practice.search') || '';
    } catch {
      return '';
    }
  });

  const [timeFilter, setTimeFilter] = useState<'all' | 'quick' | 'medium' | 'long'>(() => {
    try {
      const saved = localStorage.getItem('practice.timeFilter') as
        | 'all'
        | 'quick'
        | 'medium'
        | 'long'
        | null;
      return saved || 'all';
    } catch {
      return 'all';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('practice.search', searchQuery);
    } catch {
      /* ignore persistence errors */
    }
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem('practice.timeFilter', timeFilter);
    } catch {
      /* ignore persistence errors */
    }
  }, [timeFilter]);

  const filteredModes = useMemo(() => {
    const filterForContext = (modes: TrainingModeConfig[]) =>
      modes.filter((mode) => {
        if (mode.panreOnly && !showPANREContent) return false;
        if (mode.didacticOnly && showPANREContent) return false;

        const matchesSearch =
          searchQuery === '' ||
          mode.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          mode.description.toLowerCase().includes(searchQuery.toLowerCase());

        const minutes = mode.estimatedMinutes ?? 0;
        const matchesTime =
          timeFilter === 'all' ||
          (timeFilter === 'quick' && minutes <= 10) ||
          (timeFilter === 'medium' && minutes > 10 && minutes <= 30) ||
          (timeFilter === 'long' && minutes > 30);

        return matchesSearch && matchesTime;
      });

    return {
      visual: filterForContext(VISUAL_DIAGNOSTICS_MODES),
      clinical: filterForContext(CLINICAL_SIMULATION_MODES),
      questions: filterForContext(QUESTION_PRACTICE_MODES),
      specialty: filterForContext(SPECIALTY_DRILL_MODES),
    };
  }, [searchQuery, showPANREContent, timeFilter]);

  const recentModes = useMemo(
    () =>
      getRecentModeIds()
        .map((id) => MODE_REGISTRY.find((mode) => mode.id === id))
        .filter((mode): mode is TrainingModeConfig => !!mode && !mode.isComingSoon)
        .slice(0, 4),
    []
  );

  const recommendedModeIds = ['core_adaptive', 'grand_rounds', 'diagnostic_puzzle'] as const;

  const recommendedModes = useMemo(
    () =>
      recommendedModeIds
        .map((id) => MODE_REGISTRY.find((mode) => mode.id === id))
        .filter((mode): mode is TrainingModeConfig => !!mode && !mode.isComingSoon)
        .filter((mode) => !mode.panreOnly || showPANREContent),
    [showPANREContent]
  );

  const totalVisibleModes =
    filteredModes.visual.length +
    filteredModes.clinical.length +
    filteredModes.questions.length +
    filteredModes.specialty.length;

  const weakestSet = useMemo(
    () => new Set(rolling360Stats?.weakestSystems ?? []),
    [rolling360Stats?.weakestSystems]
  );
  const weakestSystem = rolling360Stats?.weakestSystems?.[0] ?? null;
  const hasResidencyData = (rolling360Stats?.totalInWindow ?? 0) >= 5;
  const systemsWithData = Object.entries(rolling360Stats?.systemStats ?? {}).filter(
    ([, stats]) => stats.total >= 2
  );

  const handleModeSelect = (mode: TrainingModeConfig) => {
    recordRecentMode(mode.id);
    onNavigateToDrillMode(mode.id);
  };

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Mode Library',
            badgeTone: 'gold',
            title: 'Practice that adapts to your cognitive load.',
            subtitle:
              'Move cleanly between adaptive question sets, clinical simulations, and specialty drills without losing the thread of what needs work next.',
            status:
              weakestSystem && hasResidencyData
                ? `Weakest live signal: ${weakestSystem}`
                : 'Adaptive library ready',
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
            primaryAction: weakestSystem && onNavigateToDrillWithSystem
              ? {
                  label: `Target ${weakestSystem}`,
                  onClick: () => onNavigateToDrillWithSystem('system_drill', weakestSystem),
                }
              : {
                  label: 'Start adaptive session',
                  onClick: () => onNavigateToDrillMode('core_adaptive'),
                },
            secondaryActions: [
              {
                label: 'Grand Rounds',
                onClick: () => onNavigateToDrillMode('grand_rounds'),
              },
            ],
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Visible modes"
            value={totalVisibleModes}
            detail="Modes matching your current search and timing filters."
            icon={Layers}
          />
          <WorkspaceMetricCard
            label="Recent focus"
            value={recentModes.length}
            detail="Recently reopened drills, ready to resume."
            accent="#728ba6"
            icon={Clock}
          />
          <WorkspaceMetricCard
            label="Weakest system"
            value={weakestSystem ?? 'Calibrating'}
            detail={
              weakestSystem
                ? 'Pulled from Rolling 360 performance signals.'
                : 'Answer a few more questions to unlock targeting.'
            }
            accent="#9a7f9a"
            icon={TrendingUp}
          />
          <WorkspaceMetricCard
            label="Tracked systems"
            value={systemsWithData.length}
            detail="Systems with enough recent data to shape recommendations."
            accent="#7a8f6e"
            icon={BarChart3}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceFilterBar>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search for ECG, pharmacology, ventilator, stroke..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-white/8 bg-white/5 py-3.5 pl-11 pr-12 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--color-text-muted)] transition-colors hover:bg-white/6 hover:text-[var(--color-text-primary)]"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(TIME_FILTER_LABELS) as Array<keyof typeof TIME_FILTER_LABELS>).map(
                (filter) => (
                  <Button
                    key={filter}
                    type="button"
                    size="sm"
                    variant={timeFilter === filter ? 'primary' : 'secondary'}
                    onClick={() => setTimeFilter(filter)}
                    className="rounded-full"
                  >
                    {TIME_FILTER_LABELS[filter]}
                  </Button>
                )
              )}
            </div>
          </div>
        </WorkspaceFilterBar>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                  Practice flow
                </p>
                <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-4xl">
                  Start in the lane that matches your energy, then escalate with intent.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                  Question practice keeps recall sharp, simulations test clinical judgment, and
                  specialty drills let you pressure-test specific systems without leaving the same
                  adaptive workspace.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {recommendedModes.map((mode, index) => (
                  <WorkspaceSurface
                    key={mode.id}
                    accent={['#c4b78a', '#9a7f9a', '#728ba6'][index] ?? '#c4b78a'}
                    className="h-full"
                  >
                    <button
                      type="button"
                      onClick={() => handleModeSelect(mode)}
                      className="flex h-full w-full flex-col items-start gap-3 text-left"
                    >
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        Recommended
                      </p>
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {mode.label}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                          {mode.description}
                        </p>
                      </div>
                    </button>
                  </WorkspaceSurface>
                ))}
              </div>
            </div>

            <WorkspaceSurface accent="#728ba6" className="space-y-4">
              <div className="space-y-2">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Session signals
                </p>
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                  Choose the right difficulty window now.
                </h3>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">Quick wins</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Use 10-minute recall or image drills when you need momentum between classes or
                    on rotation.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Deep reasoning
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Switch into cases, OSCEs, and diagnostic puzzles when you have enough time to
                    think through ambiguity.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    System repair
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Residency Cockpit highlights weak systems once your Rolling 360 data is stable
                    enough to trust.
                  </p>
                </div>
              </div>
            </WorkspaceSurface>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      {recentModes.length > 0 ? (
        <WorkspaceReveal delay={0.16}>
          <WorkspaceSection
            title="Recently reopened"
            subtitle="Jump back into the modes you were using most recently."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {recentModes.map((mode) => (
                <ModeCard
                  key={mode.id}
                  mode={mode}
                  accent="#b39b6c"
                  onSelect={() => handleModeSelect(mode)}
                />
              ))}
            </div>
          </WorkspaceSection>
        </WorkspaceReveal>
      ) : null}

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSection
          title="Mode categories"
          subtitle="Browse the library by study intent instead of scanning one long undifferentiated list."
        >
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ['visual_diagnostics', filteredModes.visual],
                ['clinical_simulation', filteredModes.clinical],
                ['question_practice', filteredModes.questions],
                ['specialty_drills', filteredModes.specialty],
              ] as Array<[TrainingCategory, TrainingModeConfig[]]>
            ).map(([category, modes]) => {
              const info = CATEGORY_INFO[category];
              const Icon = ICON_MAP[info.iconName] || Target;
              const accent = CATEGORY_ACCENTS[category];

              return (
                <WorkspaceSurface key={category} accent={accent}>
                  <div className="space-y-4">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8"
                      style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: accent }} aria-hidden="true" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {info.label}
                      </h3>
                      <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                        {info.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">
                        {modes.length} matching mode{modes.length === 1 ? '' : 's'}
                      </span>
                      <span style={{ color: accent }} className="font-medium">
                        {info.label}
                      </span>
                    </div>
                  </div>
                </WorkspaceSurface>
              );
            })}
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.24}>
        <CategorySection
          category="question_practice"
          modes={filteredModes.questions}
          onSelectMode={handleModeSelect}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.28}>
        <CategorySection
          category="clinical_simulation"
          modes={filteredModes.clinical}
          onSelectMode={handleModeSelect}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.32}>
        <CategorySection
          category="visual_diagnostics"
          modes={filteredModes.visual}
          onSelectMode={handleModeSelect}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.36}>
        <CategorySection
          category="specialty_drills"
          modes={filteredModes.specialty}
          onSelectMode={handleModeSelect}
        />
      </WorkspaceReveal>

      {!isLoading && onNavigateToDrillWithSystem ? (
        <WorkspaceReveal delay={0.4}>
          <WorkspaceSection
            title="Residency Cockpit"
            subtitle="Rolling 360 signals identify which systems deserve immediate focused drilling."
          >
            <WorkspaceSurface accent="#7a8f6e">
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                {hasResidencyData && systemsWithData.length > 0 && rolling360Stats?.systemStats ? (
                  <div className="overflow-hidden rounded-[1.25rem] border border-white/8">
                    <BodyMapWidget
                      systemStats={rolling360Stats.systemStats}
                      weakestSystems={rolling360Stats.weakestSystems ?? []}
                      onSystemClick={(system) =>
                        onNavigateToDrillWithSystem('system_drill', system)
                      }
                    />
                  </div>
                ) : (
                  <WorkspaceEmptyState
                    icon={BarChart3}
                    title="Cockpit calibrating"
                    description="Complete a few more recent questions before system-level targeting becomes reliable."
                  />
                )}

                <div className="space-y-4">
                  <RoundsButton
                    weakestSystem={weakestSystem}
                    hasData={hasResidencyData}
                    onStartRounds={(system) =>
                      onNavigateToDrillWithSystem('system_drill', system ?? '')
                    }
                  />

                  {systemsWithData.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {systemsWithData.slice(0, 8).map(([system, stats]) => {
                        const isWeak = weakestSet.has(system);
                        return (
                          <button
                            key={system}
                            type="button"
                            onClick={() => onNavigateToDrillWithSystem('system_drill', system)}
                            className="text-left"
                          >
                            <WorkspaceSurface
                              accent={isWeak ? '#c4b78a' : '#728ba6'}
                              className="h-full transition-transform duration-300 hover:translate-y-[-2px]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-base font-semibold text-[var(--color-text-primary)]">
                                    {system}
                                  </p>
                                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    {Math.round(stats.accuracy)}% accuracy across {stats.total}{' '}
                                    question{stats.total === 1 ? '' : 's'}.
                                  </p>
                                </div>
                                {isWeak ? (
                                  <span className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
                                    Weak
                                  </span>
                                ) : null}
                              </div>
                            </WorkspaceSurface>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </WorkspaceSurface>
          </WorkspaceSection>
        </WorkspaceReveal>
      ) : null}

      {totalVisibleModes === 0 ? (
        <WorkspaceReveal delay={0.44}>
          <WorkspaceEmptyState
            icon={AlertCircle}
            title="No modes match this filter set"
            description="Reset the search and time window to bring the full practice library back into view."
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setTimeFilter('all');
                }}
              >
                Reset filters
              </Button>
            }
          />
        </WorkspaceReveal>
      ) : null}
    </WorkspacePage>
  );
};

export default PracticePage;
