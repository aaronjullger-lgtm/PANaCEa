/**
 * Daily Challenges Hub
 *
 * Premium workspace wrapper for daily engagement surfaces:
 * Grand Rounds, Diagnostic Puzzle, and Medical Wordle.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock3,
  Puzzle,
  Sparkles,
  SpellCheck,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { API_ENDPOINTS, buildApiUrl } from '@/lib/utils/apiConfig';
import { useDiagnosticPuzzle } from '@/hooks/useDiagnosticPuzzle';
import { useWordleGame } from '@/hooks/useWordleGame';
import { ROUTES } from '@/config/routes';

interface ChallengeCardConfig {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  completed: boolean;
  streak?: number;
  loading: boolean;
  error?: string | null;
  buttonText: string;
  onAction: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseGrandRoundsStatus(payload: unknown): { completed: boolean; streak?: number } {
  if (!isRecord(payload)) return { completed: false };

  const root = isRecord(payload.data) ? payload.data : payload;
  return {
    completed: root.completed === true,
    streak: typeof root.streak === 'number' ? root.streak : undefined,
  };
}

function formatTimeUntilReset(now: Date) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const diffMs = Math.max(next.getTime() - now.getTime(), 0);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function ChallengeCard({
  challenge,
  resetTime,
}: {
  challenge: ChallengeCardConfig;
  resetTime: string;
}) {
  const Icon = challenge.icon;

  return (
    <WorkspaceSurface
      accent={challenge.error ? '#a67f7f' : challenge.accent}
      role={challenge.error ? 'alert' : 'action'}
      className="h-full"
    >
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl border"
              style={{
                background: `color-mix(in srgb, ${challenge.accent} 16%, var(--color-bg-secondary))`,
                borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
              }}
            >
              <Icon className="h-5 w-5" style={{ color: challenge.accent }} aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
                {challenge.title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">{challenge.subtitle}</p>
            </div>
          </div>

          <span
            className="rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]"
            style={{
              borderColor: challenge.completed
                ? 'rgba(56, 161, 105, 0.28)'
                : 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
              background: challenge.completed
                ? 'rgba(56, 161, 105, 0.12)'
                : 'color-mix(in srgb, var(--color-bg-tertiary) 78%, var(--color-bg-primary) 22%)',
              color: challenge.completed ? 'var(--color-data-pass)' : 'var(--color-text-muted)',
            }}
          >
            {challenge.completed ? 'Completed' : 'Open'}
          </span>
        </div>

        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
          {challenge.description}
        </p>

        <div className="workspace-subsurface-soft space-y-2 rounded-[1.1rem] p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--color-text-secondary)]">Daily reset</span>
            <span className="font-medium text-[var(--color-text-primary)]">{resetTime}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--color-text-secondary)]">Streak</span>
            <span className="font-medium text-[var(--color-text-primary)]">
              {challenge.streak !== undefined ? `${challenge.streak} days` : 'Track starts here'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--color-text-secondary)]">Status</span>
            <span
              className={
                challenge.error
                  ? 'text-[var(--color-data-fail)]'
                  : challenge.loading
                    ? 'text-[var(--color-text-muted)]'
                    : 'text-[var(--color-text-primary)]'
              }
            >
              {challenge.error
                ? 'Needs refresh'
                : challenge.loading
                  ? 'Loading...'
                  : challenge.completed
                    ? 'Completed today'
                    : 'Ready to start'}
            </span>
          </div>
        </div>

        {challenge.error ? (
          <p className="text-xs text-[var(--color-data-fail)]">
            Unable to load current state right now. You can still open the challenge.
          </p>
        ) : null}

        <div className="mt-auto">
          <Button
            type="button"
            className="w-full"
            size="md"
            onClick={challenge.onAction}
            disabled={challenge.loading}
          >
            {challenge.buttonText}
          </Button>
        </div>
      </div>
    </WorkspaceSurface>
  );
}

export function DailyChallengesHub() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [grandRoundsCompleted, setGrandRoundsCompleted] = useState(false);
  const [grandRoundsLoading, setGrandRoundsLoading] = useState(true);
  const [grandRoundsError, setGrandRoundsError] = useState<string | null>(null);
  const [grandRoundsStreak, setGrandRoundsStreak] = useState<number | undefined>();
  const [resetTime, setResetTime] = useState(() => formatTimeUntilReset(new Date()));

  const {
    userState: diagnosticUserState,
    isLoading: diagnosticLoading,
    error: diagnosticError,
    fetchDailyPuzzle,
  } = useDiagnosticPuzzle();

  const {
    status: wordleStatus,
    loading: wordleLoading,
    error: wordleError,
  } = useWordleGame();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setResetTime(formatTimeUntilReset(new Date()));
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchGrandRoundsCompletion = async () => {
      setGrandRoundsLoading(true);
      setGrandRoundsError(null);
      try {
        const token = await getToken();
        const response = await fetch(buildApiUrl(API_ENDPOINTS.GRAND_ROUNDS_COMPLETED), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = parseGrandRoundsStatus(await response.json());
        setGrandRoundsCompleted(data.completed);
        setGrandRoundsStreak(data.streak);
      } catch (error) {
        setGrandRoundsError(error instanceof Error ? error.message : 'Failed to load');
      } finally {
        setGrandRoundsLoading(false);
      }
    };

    fetchGrandRoundsCompletion();
  }, [getToken]);

  useEffect(() => {
    fetchDailyPuzzle();
  }, [fetchDailyPuzzle]);

  const diagnosticCompleted =
    diagnosticUserState?.status === 'won' || diagnosticUserState?.status === 'lost';
  const wordleCompleted = wordleStatus === 'won' || wordleStatus === 'lost';

  const challenges = useMemo<ChallengeCardConfig[]>(
    () => [
      {
        key: 'grand-rounds',
        title: 'Grand Rounds',
        subtitle: 'Daily competitive challenge',
        description:
          'Five speed-weighted questions designed to feel like a focused warmup, not another full study block.',
        icon: Trophy,
        accent: '#c4b78a',
        completed: grandRoundsCompleted,
        streak: grandRoundsStreak,
        loading: grandRoundsLoading,
        error: grandRoundsError,
        buttonText: grandRoundsCompleted ? 'Review challenge' : 'Start challenge',
        onAction: () => navigate(ROUTES.STUDY),
      },
      {
        key: 'diagnostic-puzzle',
        title: 'Diagnostic Puzzle',
        subtitle: 'Daily mystery case',
        description:
          'Work through progressive clues and lock in the diagnosis before the case reveals itself.',
        icon: Puzzle,
        accent: '#728ba6',
        completed: diagnosticCompleted,
        loading: diagnosticLoading,
        error: diagnosticError,
        buttonText: diagnosticCompleted ? 'Review puzzle' : 'Start puzzle',
        onAction: () => navigate(ROUTES.STUDY),
      },
      {
        key: 'medical-wordle',
        title: 'Medical Wordle',
        subtitle: 'Daily term recall',
        description:
          'A short vocabulary sprint to keep medical language, terminology, and pattern recall sharp.',
        icon: SpellCheck,
        accent: '#9a7f9a',
        completed: wordleCompleted,
        loading: wordleLoading,
        error: wordleError,
        buttonText: wordleCompleted ? 'Review wordle' : 'Start wordle',
        onAction: () => navigate(ROUTES.PRACTICE),
      },
    ],
    [
      diagnosticCompleted,
      diagnosticError,
      diagnosticLoading,
      grandRoundsCompleted,
      grandRoundsError,
      grandRoundsLoading,
      grandRoundsStreak,
      navigate,
      wordleCompleted,
      wordleError,
      wordleLoading,
    ]
  );

  const completedCount = challenges.filter((challenge) => challenge.completed).length;
  const loadingCount = challenges.filter((challenge) => challenge.loading).length;
  const errorCount = challenges.filter((challenge) => Boolean(challenge.error)).length;
  const overallProgress = (completedCount / challenges.length) * 100;

  return (
    <WorkspacePage density="wide" mode="challenge">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Daily Momentum',
            badgeTone: 'amber',
            title: 'Small daily wins that keep the study rhythm alive.',
            subtitle:
              'Open one fast challenge, keep the daily loop visible, and see interruptions immediately when a lane needs attention.',
            status:
              completedCount === challenges.length
                ? 'All daily challenges completed'
                : `${completedCount} of ${challenges.length} complete today`,
            actionPosition: 'under-title',
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
            primaryAction: {
              label: completedCount === challenges.length ? 'Open Practice' : 'Resume challenges',
              onClick: () => navigate(completedCount === challenges.length ? ROUTES.PRACTICE : ROUTES.STUDY),
            },
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkspaceMetricCard
            label="Completed today"
            value={`${completedCount}/${challenges.length}`}
            detail="A simple consistency score for the current daily cycle."
            icon={Target}
            variant="progress"
          />
          <WorkspaceMetricCard
            label="Needs attention"
            value={errorCount}
            detail={
              errorCount > 0
                ? 'One or more challenge states had trouble loading. Open the affected lane directly instead of waiting for a neutral refresh.'
                : `Next reset in ${resetTime}. All challenge states are readable right now.`
            }
            accent="#a67f7f"
            icon={Calendar}
            variant={errorCount > 0 ? 'alert' : 'reference'}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip tone="challenge">
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">
                Daily loop
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Start one challenge fast, then stop cleanly when the daily loop is done.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                These lanes should behave like a quick warmup or consistency check, not another
                sprawling dashboard. Open one, finish it, and move on.
              </p>
            </div>

            <div className="workspace-subsurface space-y-4 rounded-[1.4rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Daily completion
                </p>
                <span className="text-sm font-medium text-[var(--color-accent)]">
                  {Math.round(overallProgress)}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full"
                style={{
                  background:
                    'color-mix(in srgb, var(--color-bg-tertiary) 72%, var(--color-bg-primary) 28%)',
                }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-category-knowledge), var(--color-category-practice))' }}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.key}
                    className="workspace-subsurface-soft rounded-[1rem] px-3 py-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      {challenge.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                      {challenge.completed ? 'Done today' : 'Still open'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Challenge lanes"
          subtitle="Three different kinds of daily engagement, each designed to feel like a small high-signal win."
        >
          <div className="grid gap-4 xl:grid-cols-3">
            {challenges.map((challenge) => (
              <ChallengeCard key={challenge.key} challenge={challenge} resetTime={resetTime} />
            ))}
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSurface accent="#728ba6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Habit guidance
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                If you only have ten minutes, do one challenge. If you have more, use them as the
                first rep before moving into practice or your command center recommendations.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => navigate(ROUTES.PRACTICE)}>
              Open Practice
            </Button>
          </div>
        </WorkspaceSurface>
      </WorkspaceReveal>
    </WorkspacePage>
  );
}
