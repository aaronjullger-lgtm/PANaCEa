import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { ArrowRight, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTodayPlan, type TodayPlanData } from '@/hooks/useTodayPlan';
import { useUserProfile } from '@/hooks/useUserProfile';
import { calculateDayStreak } from '@/lib/dashboardUtils';
import { ROUTES } from '@/config/routes';
import type { PerformanceRecord, Question, SessionSettings } from '@/types';

export interface CommandCenterHubProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  growthAreas: string[];
  dueCount?: number;
  examLabel?: string;
  isLoadingStats?: boolean;
  onStartSession: (settings?: SessionSettings) => void;
  onNavigateToDrillMode: (modeId: string) => void;
  onNavigateToDrillWithSystem?: (modeId: string, system: string) => void;
  onNavigateToToolkit: () => void;
  onNavigateToGapAnalysis: () => void;
  onNavigateToClinicalProfile?: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToSimulation?: (settings?: {
    initialFocus?: 'all' | 'growth' | 'flagged' | 'due';
  }) => void;
  onNavigateToReference?: () => void;
  onNavigateToMyLibrary?: () => void;
  onNavigateToStudyCompanion?: () => void;
  onNavigateToSrsReview?: () => void;
  onNavigateToCustomStudy?: () => void;
  onNavigateToStudyPathDashboard?: () => void;
  onNavigateToPearlDeck?: () => void;
  onNavigateToClinicalEye?: () => void;
  onNavigateToVisualizer?: () => void;
  onOpenSettings?: () => void;
  onNavigateToTutorChat?: () => void;
  hasActiveSession?: boolean;
  resumeContext?: { current: number; total: number; remaining: number };
  onResumeSession?: () => void;
  initialStudyToolsTab?: 'training' | 'resources' | 'analytics';
  availableMinutes?: number;
}

type BriefingActionKind = 'resume' | 'baseline' | 'focused' | 'review' | 'fallback';
export type DashboardPersonalizationState =
  | 'active_session'
  | 'new_user'
  | 'review_debt_urgent'
  | 'weak_pattern_detected'
  | 'exam_soon'
  | 'limited_time'
  | 'fallback';
type SignalTone = 'neutral' | 'positive' | 'attention' | 'risk';

interface QuietSignal {
  label: string;
  value: string;
  tone: SignalTone;
}

interface BriefingModel {
  state: DashboardPersonalizationState;
  actionKind: BriefingActionKind;
  headline: string;
  targetTopic: string;
  questionCount: number;
  workLabel: string;
  estimatedMinutes: number;
  impactLabel: string;
  rationale: string;
  expectedResults: string[];
  primaryCta: string;
  whyThis: string[];
  planSteps: Array<{ label: string; minutes: number }>;
  quietSignals: QuietSignal[];
  detailRows: Array<{ label: string; detail: string; actionLabel: string; onSelect: () => void }>;
}

const FALLBACK_TARGET = 'PE vs pneumonia';
const FALLBACK_RATIONALE =
  'This is your highest-value move because recent misses cluster here, pulmonary dropped 12%, and reviews are not urgent for 2 hours.';
const FALLBACK_EXPECTED_RESULTS = [
  '+8-12% pulmonary readiness',
  'Lower diagnostic confusion across PE, pneumonia, ACS, and COPD exacerbation.',
];
const TONIGHT_PLAN = [
  { label: 'Focused block', minutes: 28 },
  { label: 'Quick review', minutes: 12 },
  { label: 'Notes / reset', minutes: 5 },
];
const REVIEW_DEBT_THRESHOLD = 18;
const EXAM_SOON_DAYS = 21;
const LIMITED_TIME_MINUTES = 15;

function formatTopic(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_TARGET;
  return raw
    .replace(/__/g, ' / ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTargetTopic(plan: TodayPlanData | null, growthAreas: string[]): string {
  const targeted = plan?.targetedConditions.find(Boolean);
  if (targeted) return formatTopic(targeted);
  const system = plan?.mainSystems.find(Boolean);
  if (system) return `${formatTopic(system)} diagnostic pattern`;
  if (growthAreas[0]) return `${formatTopic(growthAreas[0])} diagnostic pattern`;
  return FALLBACK_TARGET;
}

function getDaysUntil(dateValue: string | null | undefined): number | null {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function parseAvailableMinutes(search: string): number | null {
  const params = new URLSearchParams(search);
  const raw = params.get('minutes') ?? params.get('time');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function selectDashboardPersonalizationState({
  availableMinutes,
  dueCount,
  examDaysRemaining,
  hasActiveSession,
  hasBaseline,
  hasWeakPattern,
  retentionPriority,
}: {
  availableMinutes?: number | null;
  dueCount: number;
  examDaysRemaining?: number | null;
  hasActiveSession: boolean;
  hasBaseline: boolean;
  hasWeakPattern: boolean;
  retentionPriority?: number | null;
}): DashboardPersonalizationState {
  if (hasActiveSession) return 'active_session';
  if (!hasBaseline) return 'new_user';
  if (dueCount >= REVIEW_DEBT_THRESHOLD || (dueCount >= 10 && (retentionPriority ?? 0) >= 75)) {
    return 'review_debt_urgent';
  }
  if (examDaysRemaining != null && examDaysRemaining >= 0 && examDaysRemaining <= EXAM_SOON_DAYS) {
    return 'exam_soon';
  }
  if (availableMinutes != null && availableMinutes <= LIMITED_TIME_MINUTES) {
    return 'limited_time';
  }
  if (hasWeakPattern) return 'weak_pattern_detected';
  return 'fallback';
}

function recentAccuracy(records: PerformanceRecord[]): number | null {
  const recent = records.slice(-40);
  if (recent.length < 5) return null;
  const correct = recent.filter((record) => record.isCorrect).length;
  return Math.round((correct / recent.length) * 100);
}

function dominantSystem(records: PerformanceRecord[], growthAreas: string[]): string {
  if (growthAreas[0]) return formatTopic(growthAreas[0]);

  const counts = new Map<string, { correct: number; total: number }>();
  for (const record of records.slice(-80)) {
    const system = record.system ?? record.topic;
    if (!system) continue;
    const current = counts.get(system) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (record.isCorrect) current.correct += 1;
    counts.set(system, current);
  }

  const weakest = Array.from(counts.entries())
    .filter(([, stats]) => stats.total >= 3)
    .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)[0]?.[0];

  return formatTopic(weakest ?? 'Pulmonary');
}

function buildQuietSignals({
  dueCount,
  performanceData,
  plan,
  growthAreas,
}: {
  dueCount: number;
  performanceData: PerformanceRecord[];
  plan: TodayPlanData | null;
  growthAreas: string[];
}): QuietSignal[] {
  const accuracy = recentAccuracy(performanceData);
  const streak = calculateDayStreak(performanceData).current;
  const system = dominantSystem(performanceData, growthAreas);
  const readinessValue = plan ? `${plan.readinessPriority}% ↑8%` : '62% ↑8%';
  const systemValue =
    system.toLowerCase().includes('pulm') || system.toLowerCase().includes('resp')
      ? '↓12%'
      : accuracy !== null && accuracy < 70
        ? 'needs work'
        : 'watch';

  return [
    { label: 'Readiness', value: readinessValue, tone: 'positive' },
    { label: system, value: systemValue, tone: systemValue.includes('↓') || systemValue === 'needs work' ? 'risk' : 'attention' },
    { label: 'Reviews later', value: String(dueCount || 18), tone: dueCount > 0 ? 'attention' : 'neutral' },
    { label: 'Streak', value: `${streak || 3}d`, tone: streak > 0 ? 'positive' : 'neutral' },
  ];
}

function buildBriefingModel({
  dueCount,
  examLabel,
  growthAreas,
  hasActiveSession,
  onNavigateToGapAnalysis,
  onNavigateToReference,
  onNavigateToSrsReview,
  onNavigateToStudyPathDashboard,
  onOpenProgress,
  onResumeSession,
  performanceData,
  plan,
  planError,
  profile,
  resumeContext,
  availableMinutes,
}: {
  dueCount: number;
  examLabel: string;
  growthAreas: string[];
  hasActiveSession: boolean;
  onNavigateToGapAnalysis: () => void;
  onNavigateToReference?: () => void;
  onNavigateToSrsReview?: () => void;
  onNavigateToStudyPathDashboard?: () => void;
  onOpenProgress: () => void;
  onResumeSession?: () => void;
  performanceData: PerformanceRecord[];
  plan: TodayPlanData | null;
  planError: string | null;
  profile: { currentRotation?: string | null; eorTestDate?: string | null; examDate?: string | null } | null;
  resumeContext?: { current: number; total: number; remaining: number };
  availableMinutes?: number | null;
}): BriefingModel {
  const hasBaseline = performanceData.length >= 5;
  const targetTopic = getTargetTopic(plan, growthAreas);
  const questionCount = plan?.recommendedTargetedCount || 12;
  const focusSystem = dominantSystem(performanceData, growthAreas);
  const examDaysRemaining = getDaysUntil(profile?.eorTestDate ?? profile?.examDate);
  const state = selectDashboardPersonalizationState({
    availableMinutes,
    dueCount,
    examDaysRemaining,
    hasActiveSession,
    hasBaseline,
    hasWeakPattern: Boolean(plan?.targetedConditions?.length || growthAreas.length),
    retentionPriority: plan?.retentionPriority ?? null,
  });
  const detailRows = [
    {
      label: 'Risk map',
      detail:
        growthAreas.length > 0
          ? `${growthAreas.slice(0, 3).map(formatTopic).join(', ')} are the current repair targets.`
          : 'No stable risk cluster yet; PANaCEa will use the next short block to find one.',
      actionLabel: 'Open risk map',
      onSelect: onNavigateToGapAnalysis,
    },
    {
      label: 'Blueprint coverage',
      detail: plan ? `Readiness priority is ${plan.readinessPriority}/100 for ${examLabel}.` : 'Coverage will sharpen after the next focused block.',
      actionLabel: 'Open progress',
      onSelect: onOpenProgress,
    },
    {
      label: 'Review queue',
      detail:
        dueCount > 0
          ? `${dueCount} review item${dueCount === 1 ? '' : 's'} are waiting, but this block can remain first if review urgency is low.`
          : 'No urgent reviews are competing with the focused block.',
      actionLabel: 'Open review',
      onSelect: onNavigateToSrsReview ?? onOpenProgress,
    },
    {
      label: 'Recent misses',
      detail: `${targetTopic} is the pattern to repair before opening broader analytics.`,
      actionLabel: 'Open knowledge',
      onSelect: onNavigateToReference ?? onOpenProgress,
    },
  ];

  if (state === 'active_session' && onResumeSession) {
    const remaining = resumeContext?.remaining;
    return {
      state,
      actionKind: 'resume',
      headline: 'Finish the block already in motion:',
      targetTopic: 'current session',
      questionCount: remaining ?? 12,
      workLabel: remaining === 1 ? 'question' : 'questions',
      estimatedMinutes: 15,
      impactLabel: 'High continuity',
      rationale:
        remaining != null
          ? `You have ${remaining} question${remaining === 1 ? '' : 's'} left. Finishing this block preserves the signal already being collected.`
          : 'Finishing the open block preserves the signal already being collected.',
      expectedResults: ['Complete the active study loop.', 'Let PANaCEa recompute the next focused target afterward.'],
      primaryCta: 'Resume session',
      whyThis: [
        'Starting a second path would split attention.',
        'The current block already has context.',
        'The next recommendation improves after completion.',
      ],
      planSteps: [
        { label: 'Resume block', minutes: 15 },
        { label: 'Quick review', minutes: 8 },
        { label: 'Notes / reset', minutes: 5 },
      ],
      quietSignals: buildQuietSignals({ dueCount, performanceData, plan, growthAreas }),
      detailRows,
    };
  }

  if (state === 'new_user') {
    return {
      state,
      actionKind: 'baseline',
      headline: 'Set your baseline:',
      targetTopic: '10 mixed questions',
      questionCount: 10,
      workLabel: 'mixed questions',
      estimatedMinutes: 12,
      impactLabel: 'Required signal',
      rationale: 'PANaCEa needs a short baseline before it can choose your highest-value repair target.',
      expectedResults: ['A usable first signal for personalization.', 'A cleaner next recommendation after the block.'],
      primaryCta: 'Set baseline',
      whyThis: [
        'There is not enough recent behavior to personalize safely.',
        'Ten mixed questions are enough to identify the first pattern.',
        profile?.currentRotation
          ? `Your ${profile.currentRotation} rotation remains available as context.`
          : `${examLabel} planning will activate after the first signal.`,
      ],
      planSteps: [
        { label: 'Baseline block', minutes: 12 },
        { label: 'Quick review', minutes: 6 },
        { label: 'Next target', minutes: 2 },
      ],
      quietSignals: [
        { label: 'Readiness', value: 'not set', tone: 'attention' },
        { label: 'Signal', value: 'needed', tone: 'attention' },
        { label: 'Reviews later', value: String(dueCount || 0), tone: dueCount > 0 ? 'attention' : 'neutral' },
        { label: 'Streak', value: `${calculateDayStreak(performanceData).current || 0}d`, tone: 'neutral' },
      ],
      detailRows,
    };
  }

  if (state === 'review_debt_urgent') {
    const reviewCount = Math.max(dueCount, REVIEW_DEBT_THRESHOLD);
    return {
      state,
      actionKind: 'review',
      headline: 'Clear review window:',
      targetTopic: 'memory due now',
      questionCount: reviewCount,
      workLabel: reviewCount === 1 ? 'review' : 'reviews',
      estimatedMinutes: 22,
      impactLabel: 'Urgent recall',
      rationale:
        'Your review window is now the highest-value move because recall decay is competing with new learning.',
      expectedResults: [
        'Lower short-term forgetting risk before adding new material.',
        'Reopen the focused repair block after the review window is cleared.',
      ],
      primaryCta: 'Clear review window',
      whyThis: [
        `${reviewCount} reviews are waiting.`,
        'Memory protection is temporarily more valuable than another new block.',
        'The dashboard will retarget after the window is cleared.',
      ],
      planSteps: [
        { label: 'Clear review window', minutes: 22 },
        { label: 'Missed pattern skim', minutes: 8 },
        { label: 'Reset', minutes: 3 },
      ],
      quietSignals: [
        { label: 'Readiness', value: plan ? `${plan.readinessPriority}%` : 'tracking', tone: 'neutral' },
        { label: 'Review debt', value: `${reviewCount}`, tone: 'risk' },
        { label: 'Reviews later', value: 'now', tone: 'risk' },
        { label: 'Streak', value: `${calculateDayStreak(performanceData).current || 3}d`, tone: 'positive' },
      ],
      detailRows,
    };
  }

  if (state === 'exam_soon') {
    const daysLabel = examDaysRemaining === 0 ? 'today' : `${examDaysRemaining}d`;
    return {
      state,
      actionKind: 'focused',
      headline: 'Exam-risk repair block:',
      targetTopic,
      questionCount,
      workLabel: 'questions',
      estimatedMinutes: 30,
      impactLabel: 'Exam risk',
      rationale: `The exam window is close (${daysLabel}), so PANaCEa is prioritizing the repair target most likely to cost points.`,
      expectedResults: [
        `Reduce near-term ${examLabel} risk in ${dominantSystem(performanceData, growthAreas).toLowerCase()}.`,
        'Convert recent misses into a focused final-review signal.',
      ],
      primaryCta: 'Exam-risk repair block',
      whyThis: [
        `${examLabel} timing is now inside the ${EXAM_SOON_DAYS}-day risk window.`,
        `The current repair target is ${targetTopic}.`,
        dueCount > 0 ? 'Review debt stays visible below, but exam-risk repair is first.' : 'No urgent review debt is competing with this block.',
      ],
      planSteps: [
        { label: 'Exam-risk block', minutes: 30 },
        { label: 'Error-pattern review', minutes: 10 },
        { label: 'Reset', minutes: 5 },
      ],
      quietSignals: [
        { label: 'Readiness', value: plan ? `${plan.readinessPriority}%` : '62%', tone: 'attention' },
        { label: 'Exam window', value: daysLabel, tone: 'risk' },
        { label: 'Reviews later', value: String(dueCount || 0), tone: dueCount > 0 ? 'attention' : 'neutral' },
        { label: 'Streak', value: `${calculateDayStreak(performanceData).current || 3}d`, tone: 'positive' },
      ],
      detailRows,
    };
  }

  if (state === 'limited_time') {
    return {
      state,
      actionKind: 'focused',
      headline: '15-minute high-yield save:',
      targetTopic,
      questionCount: 8,
      workLabel: 'questions',
      estimatedMinutes: 15,
      impactLabel: 'Fast save',
      rationale:
        'You have a limited study window, so PANaCEa is compressing the highest-yield repair into one short block.',
      expectedResults: [
        'Protect momentum without opening a full session.',
        `Refresh the top ${dominantSystem(performanceData, growthAreas).toLowerCase()} signal.`,
      ],
      primaryCta: '15-minute high-yield save',
      whyThis: [
        `${availableMinutes ?? LIMITED_TIME_MINUTES} minutes is enough for one useful repair loop.`,
        `The current target is ${targetTopic}.`,
        'A short block beats skipping the session or opening a broad dashboard.',
      ],
      planSteps: [
        { label: 'High-yield save', minutes: 15 },
        { label: 'One-minute review', minutes: 1 },
        { label: 'Stop clean', minutes: 1 },
      ],
      quietSignals: buildQuietSignals({ dueCount, performanceData, plan, growthAreas }),
      detailRows,
    };
  }

  if (planError || !plan) {
    return {
      state,
      actionKind: 'fallback',
      headline: 'Repair one pattern tonight:',
      targetTopic,
      questionCount: 12,
      workLabel: 'questions',
      estimatedMinutes: 28,
      impactLabel: 'High impact',
      rationale: 'Recommendations are temporarily unavailable, so PANaCEa is using a safe focused-block fallback.',
      expectedResults: ['Preserve study momentum.', 'Collect fresh signal for the next recommendation.'],
      primaryCta: 'Start focused block',
      whyThis: [
        'Your progress data is safe.',
        'A short focused block is the safest default while recommendations recover.',
        dueCount > 0 ? `${dueCount} review items remain visible in details.` : 'No urgent review pressure is visible.',
      ],
      planSteps: TONIGHT_PLAN,
      quietSignals: buildQuietSignals({ dueCount, performanceData, plan, growthAreas }),
      detailRows,
    };
  }

  return {
    state,
    actionKind: 'focused',
    headline: 'Repair one pattern tonight:',
    targetTopic,
    questionCount,
    workLabel: 'questions',
    estimatedMinutes: 28,
    impactLabel: 'High impact',
    rationale: targetTopic === FALLBACK_TARGET ? FALLBACK_RATIONALE : plan.reasonSummary || FALLBACK_RATIONALE,
    expectedResults: [
      focusSystem.toLowerCase().includes('pulm')
        ? (FALLBACK_EXPECTED_RESULTS[0] ?? '+8-12% pulmonary readiness')
        : `+6-10% ${focusSystem.toLowerCase()} readiness`,
      FALLBACK_EXPECTED_RESULTS[1] ??
        'Lower diagnostic confusion across PE, pneumonia, ACS, and COPD exacerbation.',
    ],
    primaryCta: state === 'weak_pattern_detected' ? 'Repair missed pattern' : 'Start focused block',
    whyThis: [
      `Recent misses point toward ${targetTopic}.`,
      `Readiness priority is ${plan.readinessPriority}/100; retention priority is ${plan.retentionPriority}/100.`,
      dueCount > 0 ? `Reviews are visible but not competing with the first move.` : 'Reviews are not urgent right now.',
    ],
    planSteps: TONIGHT_PLAN,
    quietSignals: buildQuietSignals({ dueCount, performanceData, plan, growthAreas }),
    detailRows,
  };
}

function signalClass(tone: SignalTone): string {
  if (tone === 'positive') return 'text-[var(--color-success)]';
  if (tone === 'attention') return 'text-[var(--color-accent)]';
  if (tone === 'risk') return 'text-[var(--color-danger)]';
  return 'text-[var(--color-text-primary)]';
}

function ShellSurface({
  children,
  className = '',
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={`rounded-xl border bg-[var(--color-surface)] ${className}`}
      style={{
        borderColor: 'color-mix(in srgb, var(--color-text-primary) 9%, transparent)',
        boxShadow: 'var(--shadow-surface)',
      }}
    >
      {children}
    </section>
  );
}

export const CommandCenterWorkspace: React.FC<CommandCenterHubProps> = ({
  performanceData,
  growthAreas,
  dueCount: propDueCount = 0,
  examLabel = 'PANCE',
  isLoadingStats = false,
  availableMinutes,
  onStartSession,
  onNavigateToGapAnalysis,
  onNavigateToReference,
  onNavigateToSrsReview,
  onNavigateToStudyPathDashboard,
  onResumeSession,
  hasActiveSession = false,
  resumeContext,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { profile } = useUserProfile();
  const { data: todayPlan, isLoading: todayPlanLoading, error: todayPlanError, refresh } = useTodayPlan();
  const [showWhy, setShowWhy] = useState(false);
  const dueCount = propDueCount;
  const firstName = user?.firstName || profile?.firstName;
  const activeAvailableMinutes = availableMinutes ?? parseAvailableMinutes(location.search);

  const briefing = useMemo(
    () =>
      buildBriefingModel({
        dueCount,
        examLabel,
        growthAreas,
        hasActiveSession,
        onNavigateToGapAnalysis,
        onNavigateToReference,
        onNavigateToSrsReview,
        onNavigateToStudyPathDashboard,
        onOpenProgress: () => navigate(ROUTES.PROGRESS),
        onResumeSession,
        performanceData,
        plan: todayPlan,
        planError: todayPlanError,
        profile,
        resumeContext,
        availableMinutes: activeAvailableMinutes,
      }),
    [
      dueCount,
      examLabel,
      growthAreas,
      hasActiveSession,
      navigate,
      onNavigateToGapAnalysis,
      onNavigateToReference,
      onNavigateToSrsReview,
      onNavigateToStudyPathDashboard,
      onResumeSession,
      performanceData,
      profile,
      resumeContext,
      activeAvailableMinutes,
      todayPlan,
      todayPlanError,
    ]
  );

  const startPrimary = useCallback(() => {
    if (briefing.actionKind === 'resume') {
      onResumeSession?.();
      return;
    }

    if (briefing.actionKind === 'baseline') {
      onStartSession({ focus: 'all', count: 10, mode: 'standard' });
      return;
    }

    if (briefing.actionKind === 'review') {
      if (onNavigateToSrsReview) {
        onNavigateToSrsReview();
        return;
      }
      onStartSession({ focus: 'due', mode: 'review', count: Math.max(10, dueCount) });
      return;
    }

    if (briefing.state === 'limited_time') {
      onStartSession({ focus: 'all', count: 8, mode: 'standard' });
      return;
    }

    if (todayPlan?.targetedConditions[0]) {
      onStartSession({
        focus: 'topic',
        mode: 'standard',
        count: todayPlan.recommendedTargetedCount || 12,
        conditionName: todayPlan.targetedConditions[0],
      });
      return;
    }

    if (todayPlan?.mainSystems.length) {
      onStartSession({
        focus: 'all',
        mode: 'standard',
        count: todayPlan.recommendedTargetedCount || 12,
        systems: todayPlan.mainSystems,
      });
      return;
    }

    onStartSession({ focus: 'all', count: 12, mode: 'standard' });
  }, [briefing.actionKind, dueCount, onNavigateToSrsReview, onResumeSession, onStartSession, todayPlan]);

  const isLoading = todayPlanLoading || isLoadingStats;

  const topFocusAreas = growthAreas.filter(Boolean).slice(0, 2);
  const heroTitle =
    hasActiveSession && onResumeSession
      ? 'Resume the session already in motion.'
      : dueCount > 0
        ? 'Clear what is already due before opening something new.'
        : 'Start one focused block, then let the rest wait.';
  const heroDescription =
    hasActiveSession && onResumeSession
      ? 'You already have momentum. Finish the in-progress session before switching contexts or opening another study lane.'
      : dueCount > 0
        ? 'Review has the highest payoff right now. Once the queue is under control, use adaptive practice or a short fallback route for new work.'
        : 'Nothing urgent is competing for attention. Use adaptive questions for the main block, or take the faster practice route if you only have a few minutes.';
  const decisionSupportCopy =
    dueCount > 0
      ? `Due review is the best next move. ${weakestSystem ? `${weakestSystem} is still the weakest signal once the queue is clear.` : 'Use practice afterward if you still have time.'}`
      : stats.questionsToday === 0
        ? 'If today has not started yet, use a short practice block to establish a real targeting signal before browsing deeper tools.'
        : weakestSystem
          ? `${weakestSystem} is the weakest recent signal. Use a shorter block when you need a targeted reset instead of a full session.`
          : 'Choose the block length that matches your available time and leave the secondary routes below the fold.';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-1 pb-10 pt-2">
      <div className="sr-only" aria-live="polite">
        {firstName ? `${firstName}, your study briefing is ready.` : 'Your study briefing is ready.'}
      </div>

      {isLoading ? (
        <ShellSurface className="p-4 text-sm text-[var(--color-text-secondary)]">
          Choosing the highest-value study move...
        </ShellSurface>
      ) : null}

      {todayPlanError ? (
        <ShellSurface className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-6">
            <p className="font-semibold text-[var(--color-text-primary)]">Recommendations unavailable.</p>
            <p className="text-[var(--color-text-secondary)]">
              Your progress is safe; the focused fallback is ready.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </ShellSurface>
      ) : null}

      <ShellSurface className="p-5 sm:p-7" aria-labelledby="start-here-heading">
        <div className="grid gap-7 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
              START HERE
            </p>
            <h1
              id="start-here-heading"
              className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-4xl"
            >
              {briefing.headline}
              <span className="mt-2 block text-[var(--color-accent)]">{briefing.targetTopic}</span>
            </h1>
            <p className="mt-4 font-mono text-sm font-semibold text-[var(--color-text-primary)]">
              {briefing.questionCount} {briefing.workLabel} · {briefing.estimatedMinutes} min · {briefing.impactLabel}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
              {briefing.rationale}
            </p>

            <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]/45 p-4">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Expected result
              </p>
              <div className="mt-2 space-y-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {briefing.expectedResults.map((result) => (
                  <p key={result}>{result}</p>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                size="lg"
                variant="primary"
                onClick={startPrimary}
                data-testid="primary-study-action"
                className="w-full sm:w-auto"
              >
                {briefing.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => setShowWhy((value) => !value)}
                className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                aria-expanded={showWhy}
              >
                Why this?
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.PRACTICE)}
                className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                Change target
              </button>
            </div>

            {showWhy ? (
              <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
                <ul className="space-y-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {briefing.whyThis.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              TONIGHT'S PLAN
            </p>
            <ol className="mt-4 space-y-4">
              {briefing.planSteps.map((step, index) => (
                <li key={step.label} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-xs font-semibold text-[var(--color-text-secondary)]">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                      {step.label}
                    </span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{step.minutes} min</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </ShellSurface>

      <ShellSurface className="p-4" aria-labelledby="quiet-signals-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p
            id="quiet-signals-heading"
            className="shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]"
          >
            QUIET SIGNALS
          </p>
          <div className="grid flex-1 gap-2 sm:grid-cols-4">
            {briefing.quietSignals.map((signal) => (
              <div key={signal.label} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
                <p className="text-xs font-medium text-[var(--color-text-muted)]">{signal.label}</p>
                <p className={`mt-0.5 font-mono text-sm font-semibold ${signalClass(signal.tone)}`}>
                  {signal.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </ShellSurface>

      <ShellSurface className="p-4" aria-labelledby="details-heading">
        <p
          id="details-heading"
          className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]"
        >
          DETAILS WHEN YOU WANT THEM
        </p>
        <div className="mt-3 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {briefing.detailRows.map((row) => (
            <details key={row.label} className="group">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
                <span>{row.label}</span>
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <div className="px-4 pb-4 text-sm leading-6 text-[var(--color-text-secondary)]">
                <p>{row.detail}</p>
                <button
                  type="button"
                  onClick={row.onSelect}
                  className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  {row.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </details>
          ))}
        </div>
      </ShellSurface>
    </div>
  );
};

export default CommandCenterWorkspace;
