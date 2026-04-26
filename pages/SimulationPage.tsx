/**
 * SimulationPage - Core PANCE / PANRE simulation workspace.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Award, Brain, Clock, Flag, Target, TrendingUp } from 'lucide-react';
import type { PerformanceRecord, Question, SessionSettings, SystemCode } from '../types';
import { useUserContext } from '../hooks/useUserContext';
import { Button } from '@/components/ui/button';
import {
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSurface,
} from '@/components/workspace';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/config/topic-map';

interface SimulationPageProps {
  onStartSession: (settings: SessionSettings) => void | Promise<void>;
  onBack: () => void;
  performanceData: PerformanceRecord[];
  flaggedQuestions: Question[];
  growthAreas: string[];
  examLabel?: string;
  initialFocus?: FocusOption;
}

type FocusOption = 'all' | 'growth' | 'flagged' | 'due';

const FOCUS_STYLES: Record<
  FocusOption,
  {
    accent: string;
    label: string;
    subtitle: string;
    icon: React.ElementType;
  }
> = {
  all: {
    accent: '#728ba6',
    label: 'All Topics',
    subtitle: 'Strict blueprint-weighted mix',
    icon: Brain,
  },
  growth: {
    accent: '#b39b6c',
    label: 'Growth Areas',
    subtitle: 'Target weaker systems',
    icon: TrendingUp,
  },
  flagged: {
    accent: '#a67f7f',
    label: 'Flagged',
    subtitle: 'Return to marked questions',
    icon: Flag,
  },
  due: {
    accent: '#7a8f6e',
    label: 'Due for Review',
    subtitle: 'Spaced repetition maintenance',
    icon: Clock,
  },
};

export const SimulationPage: React.FC<SimulationPageProps> = ({
  onStartSession,
  onBack,
  performanceData,
  flaggedQuestions,
  growthAreas,
  examLabel = 'PANCE',
  initialFocus = 'all',
}) => {
  const [selectedFocus, setSelectedFocus] = useState<FocusOption>(initialFocus);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const { careerStage } = useUserContext();
  const [enabledSystems, setEnabledSystems] = useState<Set<SystemCode>>(() => {
    if (typeof window === 'undefined') {
      return new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
    }
    try {
      const saved = localStorage.getItem('panceai_enabled_systems');
      if (saved) return new Set(JSON.parse(saved) as SystemCode[]);
    } catch {
      /* ignore */
    }
    return new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
  });

  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('panceai_enabled_systems');
        if (saved) setEnabledSystems(new Set(JSON.parse(saved) as SystemCode[]));
      } catch {
        /* ignore */
      }
    };

    globalThis.addEventListener('panceai_enabled_systems_changed', handler);
    return () => globalThis.removeEventListener('panceai_enabled_systems_changed', handler);
  }, []);

  const stats = useMemo(() => {
    const recent = performanceData.slice(-100);
    const correct = recent.filter((record) => record.isCorrect).length;
    const accuracy = recent.length > 0 ? Math.round((correct / recent.length) * 100) : 0;
    const today = new Date().toDateString();
    const todayQuestions = performanceData.filter(
      (record) => new Date(record.timestamp).toDateString() === today
    ).length;

    return {
      accuracy,
      todayQuestions,
      totalQuestions: performanceData.length,
      flaggedCount: flaggedQuestions.length,
      growthAreasCount: growthAreas.length,
    };
  }, [flaggedQuestions, growthAreas, performanceData]);

  const focusOptions = useMemo<
    Array<{
      id: FocusOption;
      label: string;
      subtitle: string;
      icon: React.ElementType;
      accent: string;
      stat?: number;
    }>
  >(
    () => [
      {
        id: 'all',
        label: 'All Topics',
        subtitle: 'Strict NCCPA blueprint weighting',
        icon: Brain,
        accent: '#728ba6',
        stat: stats.totalQuestions,
      },
      {
        id: 'growth',
        label: 'Growth Areas',
        subtitle: 'Target your weakest systems',
        icon: TrendingUp,
        accent: '#b39b6c',
        stat: stats.growthAreasCount,
      },
      {
        id: 'flagged',
        label: 'Flagged',
        subtitle: 'Questions you marked for later',
        icon: Flag,
        accent: '#a67f7f',
        stat: stats.flaggedCount,
      },
      {
        id: 'due',
        label: examLabel === 'PANRE' ? 'Maintenance Due' : 'Due for Review',
        subtitle: 'Spaced repetition reviews',
        icon: Clock,
        accent: '#7a8f6e',
      },
    ],
    [examLabel, stats.flaggedCount, stats.growthAreasCount, stats.totalQuestions]
  );

  const getFocusDescription = () => {
    switch (selectedFocus) {
      case 'all':
        return 'Strict NCCPA blueprint weighting. No weak-area bias, just exam-representative distribution.';
      case 'growth':
        return `Target your ${stats.growthAreasCount} weakest areas when you want the biggest return on a shorter session.`;
      case 'flagged':
        return `Return to ${stats.flaggedCount} questions you intentionally marked for a second pass.`;
      case 'due':
        return 'Use spaced-repetition due items when you want maintenance without losing retention momentum.';
      default:
        return '';
    }
  };

  const handleStart = async () => {
    if (isStarting) return;
    setStartError(null);

    let focus: SessionSettings['focus'];
    switch (selectedFocus) {
      case 'growth':
        focus = 'growth';
        break;
      case 'flagged':
        focus = 'reviewFlagged';
        break;
      case 'due':
        focus = 'due';
        break;
      default:
        focus = 'all';
    }

    const allSystems = Object.keys(ABBREVIATION_TO_TOPIC_MAP).length;
    const isDidacticWithCurriculum =
      careerStage === 'student' && enabledSystems.size > 0 && enabledSystems.size < allSystems;

    const settings: SessionSettings = { focus };
    if (selectedFocus === 'all') {
      settings.simulationStrict = true;
    }
    if (isDidacticWithCurriculum) {
      settings.systems = Array.from(enabledSystems);
    }

    try {
      setIsStarting(true);
      await onStartSession(settings);
    } catch (error) {
      setStartError(
        error instanceof Error ? error.message : 'Unable to start the simulation session.'
      );
    } finally {
      setIsStarting(false);
    }
  };

  const selectedFocusMeta = FOCUS_STYLES[selectedFocus];

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: examLabel === 'PANRE' ? 'Maintenance Mode' : 'Exam Simulation',
            badgeTone: examLabel === 'PANRE' ? 'sage' : 'steel',
            title:
              examLabel === 'PANRE'
                ? 'Run focused maintenance sessions with exam-day discipline.'
                : `Run a high-fidelity ${examLabel} simulation.`,
            subtitle:
              examLabel === 'PANRE'
                ? 'PANRE-LA check-ins, due-item maintenance, and blueprint-respecting refresh work.'
                : 'Choose how strict or targeted the session should be, then launch a blueprint-weighted flow.',
            backLabel: 'Back to Study',
            onBack,
            primaryAction: {
              label: examLabel === 'PANRE' ? 'Start Maintenance' : `Start ${examLabel} Session`,
              onClick: () => {
                void handleStart();
              },
              icon: Award,
              disabled: isStarting,
            },
            status: `Current focus: ${selectedFocusMeta.label}`,
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Recent Accuracy"
            value={`${stats.accuracy}%`}
            detail="Based on the latest 100 question outcomes."
            icon={Target}
          />
          <WorkspaceMetricCard
            label="Questions Today"
            value={stats.todayQuestions}
            detail="Tracks how much exam-style work you have already done today."
            accent="#728ba6"
            icon={Brain}
          />
          <WorkspaceMetricCard
            label="Growth Areas"
            value={stats.growthAreasCount}
            detail="Weak systems or categories worth targeting when time is limited."
            accent="#b39b6c"
            icon={TrendingUp}
          />
          <WorkspaceMetricCard
            label="Flagged Questions"
            value={stats.flaggedCount}
            detail="Marked items ready for a deliberate second pass."
            accent="#a67f7f"
            icon={Flag}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Simulation focus
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Start from the right kind of pressure: strict exam realism when you want signal,
                targeted focus when you need recovery.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                {getFocusDescription()}
              </p>
            </div>

            <div className="workspace-subsurface rounded-[1.25rem] p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                When to use each focus
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>Choose `All Topics` for the most exam-representative signal.</li>
                <li>Choose `Growth Areas` when you need targeted recovery before testing again.</li>
                <li>Choose `Flagged` or `Due` for deliberate review without rebuilding a custom mode.</li>
              </ul>
            </div>
          </div>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Choose your simulation focus"
          subtitle="Each mode changes how the session is assembled, so pick the one that matches the learning job you need done."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {focusOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedFocus === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedFocus(option.id)}
                  aria-pressed={isSelected}
                  className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <WorkspaceSurface
                    accent={option.accent}
                    className="h-full transition-transform duration-300 hover:translate-y-[-2px]"
                  >
                    <div
                      className="flex h-full items-start gap-4 rounded-[1.1rem] border p-5 transition-all"
                      style={{
                        borderColor: isSelected
                          ? `color-mix(in srgb, ${option.accent} 72%, white 6%)`
                          : 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                        background: isSelected
                          ? `color-mix(in srgb, ${option.accent} 14%, var(--color-bg-secondary))`
                          : 'color-mix(in srgb, var(--color-bg-secondary) 74%, var(--color-bg-primary) 26%)',
                      }}
                    >
                      <div
                        className="workspace-icon-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                          background: isSelected
                            ? `color-mix(in srgb, ${option.accent} 85%, white 5%)`
                            : 'color-mix(in srgb, var(--color-bg-tertiary) 82%, var(--color-bg-primary) 18%)',
                          color: isSelected ? '#0b1020' : 'var(--color-text-secondary)',
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-[var(--color-text-primary)]">
                            {option.label}
                          </span>
                          {option.stat !== undefined ? (
                            <span
                              className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                              style={{
                                borderColor: `color-mix(in srgb, ${option.accent} 42%, transparent)`,
                                color: option.accent,
                                background: `color-mix(in srgb, ${option.accent} 14%, transparent)`,
                              }}
                            >
                              {option.stat}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                          {option.subtitle}
                        </p>
                      </div>

                      {isSelected ? (
                        <span
                          className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[#0b1020]"
                          style={{ background: option.accent }}
                        >
                          ✓
                        </span>
                      ) : null}
                    </div>
                  </WorkspaceSurface>
                </button>
              );
            })}
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSurface accent={selectedFocusMeta.accent} className="space-y-5">
          <div className="space-y-2">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Ready state
            </p>
            <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
              {selectedFocusMeta.label}
            </h3>
            <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {getFocusDescription()}
            </p>
          </div>

          {startError ? (
            <div className="rounded-[1rem] border border-[var(--color-data-fail)]/30 bg-[var(--color-data-fail)]/10 px-4 py-3 text-sm text-[var(--color-data-fail)]">
              {startError}
            </div>
          ) : null}

          <Button
            type="button"
            size="lg"
            onClick={() => {
              void handleStart();
            }}
            icon={Award}
            loading={isStarting}
            disabled={isStarting}
            className="w-full shadow-[0_24px_60px_-28px_rgba(196,183,138,0.55)] sm:w-auto"
          >
            {isStarting
              ? 'Starting session…'
              : examLabel === 'PANRE'
                ? 'Start Maintenance'
                : `Start ${examLabel} Session`}
          </Button>
        </WorkspaceSurface>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default SimulationPage;
