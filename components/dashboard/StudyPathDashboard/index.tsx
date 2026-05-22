import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAuth, useUser } from '@clerk/clerk-react';
import useSWR from 'swr';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  RefreshCw,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/loading';
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
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';
import type { RecommendationResponse, StudyPlan } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { ROUTES } from '@/config/routes';
import { clinicalConsoleDemoData } from '@/components/clinical-console/studyDemoData';
import { workspaceAccent } from '@/lib/tokens';
import ProgressProjectionChart from './ProgressProjectionChart';
import PlanAlternativesModal from './PlanAlternativesModal';
import FatigueAlertBanner from './FatigueAlertBanner';

function createStudyPathFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<RecommendationResponse> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const safeMessages: Record<number, string> = {
        401: 'Your session has expired. Please sign in again.',
        403: 'You do not have permission to access this study plan.',
        404: 'No study plan found. Try regenerating one.',
        429: 'Too many requests. Please wait a moment and try again.',
      };
      throw new Error(
        getApiEnvelopeError(json, safeMessages[response.status] ?? 'Unable to load your study plan. Please try again.')
      );
    }
    return unwrapApiEnvelope<RecommendationResponse>(json);
  };
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function normalizePlan(plan: StudyPlan): StudyPlan {
  return {
    ...plan,
    generatedAt: toDate(plan.generatedAt) ?? new Date(),
    validUntil: toDate(plan.validUntil) ?? new Date(),
    sessions: (plan.sessions ?? []).map((session) => ({
      ...session,
      date: toDate(session.date) ?? new Date(),
      topics: session.topics ?? [],
    })),
  };
}

function formatFatigueLabel(level: StudyPlan['metadata']['fatigueRisk']) {
  switch (level) {
    case 'HIGH':
      return 'High fatigue risk';
    case 'MEDIUM':
      return 'Moderate fatigue risk';
    default:
      return 'Low fatigue risk';
  }
}

const StudyPathDashboard = () => {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const fetcher = useCallback(createStudyPathFetcher(getToken), [getToken]);
  const { data, error, isLoading, mutate } = useSWR<RecommendationResponse>(
    user ? getApiEndpoint(API_ENDPOINTS.STUDY_PATH_RECOMMENDATION) : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const [showAlternativesModal, setShowAlternativesModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const plan = useMemo(() => (data?.plan ? normalizePlan(data.plan) : null), [data?.plan]);
  const alternatives = useMemo(
    () => (data?.alternatives ?? []).map((candidate) => normalizePlan(candidate)),
    [data?.alternatives]
  );
  const rationale = data?.rationale || '';
  const confidence = data?.confidence ?? 0;

  const sortedSessions = useMemo(() => {
    if (!plan) return [];
    return [...plan.sessions].sort((left, right) => left.date.getTime() - right.date.getTime());
  }, [plan]);

  const totalMinutes = plan?.totalEstimatedMinutes ?? 0;
  const totalSessions = sortedSessions.length;
  const blueprintCoverage = plan?.metadata.blueprintCoverage ?? {};
  const fatigueRisk = plan?.metadata.fatigueRisk ?? 'LOW';
  const projectedRetentionIncrease = plan?.metadata.projectedRetentionIncrease ?? 0;
  const coverageTotal = useMemo(
    () => (Object.values(blueprintCoverage) as number[]).reduce((sum, value) => sum + value, 0),
    [blueprintCoverage]
  );

  const startDate = sortedSessions[0]?.date ?? null;
  const endDate = sortedSessions[sortedSessions.length - 1]?.date ?? null;
  const daysCount =
    startDate && endDate
      ? Math.max(
          1,
          Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        )
      : 0;

  const topicCount = useMemo(
    () => sortedSessions.reduce((sum, session) => sum + session.topics.length, 0),
    [sortedSessions]
  );

  const handleAcceptPlan = async () => {
    if (!plan) return;
    setIsAccepting(true);
    try {
      const token = await getToken();
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.STUDY_PATH_ACCEPT), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId: plan.id, plan }),
      });
      const responseJson = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getApiEnvelopeError(responseJson, `Failed to accept plan: ${response.status}`)
        );
      }

      showToast({
        type: 'success',
        message: 'Study plan accepted! You can now start following it.',
      });
      mutate();
    } catch (err) {
      console.error('Accept plan error:', err);
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to accept plan',
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRegeneratePlan = async () => {
    setIsRegenerating(true);
    try {
      const token = await getToken();
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.STUDY_PATH_REGENERATE), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const responseJson = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getApiEnvelopeError(responseJson, 'Unable to regenerate study plan. Please try again.')
        );
      }

      await mutate();
      showToast({
        type: 'success',
        message: 'Study plan regenerated successfully!',
      });
    } catch (err) {
      console.error('Regeneration error:', err);
      showToast({
        type: 'error',
        message: 'Unable to regenerate study plan. Please try again.',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const renderFallbackStudyPath = ({
    title,
    subtitle,
    reason,
    tone,
  }: {
    title: string;
    subtitle: string;
    reason: string;
    tone: 'warning' | 'empty';
  }) => {
    const preview = clinicalConsoleDemoData.studyPathPreview;
    const reasonTone = tone === 'warning' ? workspaceAccent.rose : workspaceAccent.amber;

    return (
      <WorkspacePage density="wide" mode="analytics">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Study Architect',
              badgeTone: 'amber',
              title,
              subtitle,
              status: 'Guest-safe preview',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
              primaryAction: {
                label: 'Retry optimizer',
                onClick: () => mutate(),
                icon: RefreshCw,
              },
              secondaryActions: [
                {
                  label: 'Open Practice',
                  onClick: () => navigate(ROUTES.PRACTICE),
                },
              ],
            }}
          />
        </WorkspaceReveal>

        <WorkspaceReveal delay={0.04}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WorkspaceMetricCard
              label="Preview workload"
              value={preview.totalStudyTime}
              detail={`${preview.cadence} with review work sequenced before new content.`}
              icon={Clock}
              accent={workspaceAccent.amber}
            />
            <WorkspaceMetricCard
              label="Retention target"
              value={preview.retentionLift}
              detail="Expected lift pattern once a live optimizer can use authenticated performance data."
              icon={TrendingUp}
              accent={workspaceAccent.sage}
            />
            <WorkspaceMetricCard
              label="Fatigue load"
              value={preview.fatigueRisk}
              detail="Keeps timed blocks away from the densest repair sessions."
              icon={Zap}
              accent={workspaceAccent.rose}
            />
            <WorkspaceMetricCard
              label="Blueprint lane"
              value={preview.coverage}
              detail="High-yield systems represented in the current console preview."
              icon={Calendar}
              accent={workspaceAccent.steel}
            />
          </div>
        </WorkspaceReveal>

        <WorkspaceReveal delay={0.08}>
          <WorkspaceHeroStrip accent={workspaceAccent.amber}>
            <WorkspaceSplit className="items-start">
              <div className="space-y-4">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                  Route architecture preview
                </p>
                <h2 className="heading-fluid-lg max-w-3xl font-semibold text-[var(--color-text-primary)]">
                  Repair first, then transfer under timing pressure.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                  {preview.rationale}
                </p>
              </div>

              <WorkspaceSurface accent={reasonTone} role={tone === 'warning' ? 'alert' : 'reference'}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="workspace-icon-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[var(--color-text-primary)]">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Live plan status
                    </p>
                    <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                      {reason}
                    </p>
                    <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                      This preview is not accepted or written to your account. Retry when the
                      authenticated optimizer is available, or start Practice from the same signal set.
                    </p>
                  </div>
                </div>
              </WorkspaceSurface>
            </WorkspaceSplit>
          </WorkspaceHeroStrip>
        </WorkspaceReveal>

        <WorkspaceReveal delay={0.12}>
          <WorkspaceSection
            title="Route map"
            subtitle="A representative weekly structure for the current medical console direction."
            action={
              <Button type="button" size="sm" onClick={() => navigate(ROUTES.PRACTICE)}>
                Start practice
              </Button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {preview.sessions.map((session) => (
                <WorkspaceSurface key={`${session.day}-${session.label}`} accent={workspaceAccent.steel}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="workspace-chip rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                          {session.day}
                        </span>
                        <span className="text-xs font-medium text-[var(--color-accent-secondary)]">
                          {session.duration}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                        {session.label}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">{session.action}</p>
                    </div>
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-[var(--color-text-muted)] sm:block" />
                  </div>
                  <div className="mt-4 grid gap-2">
                    {session.topics.map((topic) => (
                      <div
                        key={topic}
                        className="workspace-subsurface-soft rounded-lg px-3.5 py-2.5 text-sm text-[var(--color-text-secondary)]"
                      >
                        {topic}
                      </div>
                    ))}
                  </div>
                </WorkspaceSurface>
              ))}
            </div>
          </WorkspaceSection>
        </WorkspaceReveal>

        <WorkspaceReveal delay={0.16}>
          <WorkspaceSurface accent={workspaceAccent.plum} role="reference">
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Safety guardrails
                </p>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                  The plan should change behavior, not just fill a calendar.
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {preview.guardrails.map((guardrail) => (
                  <div
                    key={guardrail}
                    className="workspace-subsurface-soft rounded-lg p-4 text-sm leading-6 text-[var(--color-text-secondary)]"
                  >
                    {guardrail}
                  </div>
                ))}
              </div>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      </WorkspacePage>
    );
  };

  if (isLoading) {
    return (
      <WorkspacePage density="wide" mode="error">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Study Path',
              badgeTone: 'amber',
              title: 'Building your next study route.',
              subtitle:
                'The optimizer is assembling a plan around retention, blueprint coverage, and fatigue load.',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceSurface accent="#b39b6c">
            <div
              className="flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center"
              role="status"
              aria-live="polite"
            >
              <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Loading your personalized study path...
              </p>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  if (error) {
    const safeMessage =
      error.message &&
      !error.message.includes('prisma') &&
      !error.message.includes('Argument') &&
      !error.message.includes('Invalid') &&
      error.message.length < 200
        ? error.message
        : 'Unable to load your study plan. Please try again.';

    return renderFallbackStudyPath({
      title: 'Study path console is running in fallback mode.',
      subtitle:
        'The authenticated optimizer could not return a live plan, so this route shows the same planning model without pretending it has been saved.',
      reason: safeMessage,
      tone: 'warning',
    });
  }

  const isEffectivelyEmpty =
    !plan ||
    (totalSessions === 0 && totalMinutes === 0 && topicCount === 0);

  if (isEffectivelyEmpty) {
    return renderFallbackStudyPath({
      title: 'Build a route from the next useful study signal.',
      subtitle:
        'No persisted study path is available in this session yet. Start a practice block to generate performance data, then the optimizer can build a personalized weekly route.',
      reason:
        !plan
          ? 'No live plan was returned for the current session. Generate a plan after authenticated performance data is available, or start Practice to create fresh signals.'
          : 'Your plan was returned but contains no scheduled sessions yet. Complete a baseline calibration block or a few practice questions to seed enough data for a route.',
      tone: 'empty',
    });
  }

  return (
    <WorkspacePage density="wide" mode="analytics">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Study Architect',
            badgeTone: 'amber',
            title: 'A study plan that shows the tradeoffs.',
            subtitle:
              'Convert weak areas, due reviews, question blocks, and clinical case work into a realistic weekly route.',
            status: formatFatigueLabel(fatigueRisk),
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
            primaryAction: {
              label: isAccepting ? 'Accepting...' : 'Accept plan',
              onClick: handleAcceptPlan,
              disabled: isAccepting,
            },
            secondaryActions: [
              {
                label: `Alternatives (${alternatives.length})`,
                onClick: () => setShowAlternativesModal(true),
                disabled: alternatives.length === 0,
              },
              {
                label: isRegenerating ? 'Regenerating...' : 'Regenerate',
                onClick: handleRegeneratePlan,
                disabled: isRegenerating,
              },
            ],
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Total study time"
            value={`${Math.round(totalMinutes / 60)}h`}
            detail={`${totalSessions} sessions across ${daysCount} day${daysCount === 1 ? '' : 's'}.`}
            icon={Clock}
          />
          <WorkspaceMetricCard
            label="Projected retention"
            value={`+${(projectedRetentionIncrease * 100).toFixed(1)}%`}
            detail="Expected lift from this optimized plan."
            accent="#7a8f6e"
            icon={TrendingUp}
          />
          <WorkspaceMetricCard
            label="Confidence"
            value={`${(confidence * 100).toFixed(0)}%`}
            detail={
              confidence > 0.7
                ? 'High confidence recommendation.'
                : confidence > 0.4
                  ? 'Moderate confidence recommendation.'
                  : 'Lower confidence because the data is thinner.'
            }
            accent="#b39b6c"
            icon={Zap}
          />
          <WorkspaceMetricCard
            label="Blueprint coverage"
            value={`${coverageTotal.toFixed(1)}%`}
            detail={`${topicCount} scheduled topic block${topicCount === 1 ? '' : 's'} across the plan.`}
            accent="#728ba6"
            icon={Calendar}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Study prescription architecture
              </p>
              <h2 className="heading-fluid-lg max-w-3xl font-semibold text-[var(--color-text-primary)]">
                This route balances coverage, retention, and fatigue instead of optimizing for only one metric.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                {rationale ||
                  'Your current recommendation weighs how much needs review, how much blueprint ground is left to cover, and how aggressive the schedule can be before it stops being sustainable.'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="workspace-subsurface rounded-[1.25rem] p-4">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Plan window
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {startDate
                    ? `${startDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })} to ${endDate?.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}`
                    : 'Dates unavailable'}
                </p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  Generated {plan.generatedAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <FatigueAlertBanner riskLevel={fatigueRisk} compact />
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSurface accent="#a67f7f">
          <FatigueAlertBanner riskLevel={fatigueRisk} />
        </WorkspaceSurface>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title="Progress projection"
          subtitle="Use the projection chart to see what this plan expects to change if you actually follow it."
        >
          <WorkspaceSurface accent="#728ba6">
            <ProgressProjectionChart planId={plan.id} />
          </WorkspaceSurface>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSection
          title="Session map"
          subtitle="A day-by-day view of the work this plan is actually asking you to do."
          action={
            <span className="workspace-chip rounded-full px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
              {totalSessions} sessions
            </span>
          }
        >
          <div className="space-y-4">
            {sortedSessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, delay: Math.min(index * 0.03, 0.24) }}
              >
                <WorkspaceSurface accent={index % 2 === 0 ? '#c4b78a' : '#728ba6'}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="workspace-icon-tile flex h-12 w-12 flex-col items-center justify-center rounded-2xl text-[var(--color-text-primary)]">
                        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                          Day
                        </span>
                        <span className="text-sm font-semibold">{index + 1}</span>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
                          {session.date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {session.topics.length} topic block{session.topics.length === 1 ? '' : 's'} •{' '}
                          {session.topics.reduce((sum, topic) => sum + topic.estimatedMinutes, 0)} minutes
                        </p>
                        {session.notes ? (
                          <p className="text-sm italic text-[var(--color-text-muted)]">
                            {session.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <ChevronRight className="hidden h-5 w-5 text-[var(--color-text-muted)] lg:block" />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {session.topics.map((topic, topicIndex) => (
                      <div
                        key={`${session.id}-${topic.taxonomyCode}-${topicIndex}`}
                        className="workspace-subsurface-soft rounded-[1.05rem] p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {topic.taxonomyCode}
                          </p>
                          <span className="workspace-chip rounded-full px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                            {topic.recommendedAction}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                          {topic.subcategory || 'General focus area'}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                          <span>{topic.estimatedMinutes} min</span>
                          <span>Urgency {topic.urgencyScore.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </WorkspaceSurface>
              </motion.div>
            ))}
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      {rationale ? (
        <WorkspaceReveal delay={0.24}>
          <WorkspaceSection
            title="Why this plan was chosen"
            subtitle="A plain-language explanation of the optimizer’s current recommendation."
          >
            <WorkspaceSurface accent="#9a7f9a">
              <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text-secondary)]">
                {rationale}
              </p>
            </WorkspaceSurface>
          </WorkspaceSection>
        </WorkspaceReveal>
      ) : null}

      <WorkspaceReveal delay={0.28}>
        <WorkspaceSurface accent="#728ba6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Decision check
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Accept when the workload feels sustainable. If it feels too heavy or oddly focused,
                compare alternatives before committing the week.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={alternatives.length === 0}
                onClick={() => setShowAlternativesModal(true)}
              >
                View alternatives
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAcceptPlan}
                disabled={isAccepting}
                icon={<Check className="h-4 w-4" aria-hidden="true" />}
              >
                {isAccepting ? 'Accepting...' : 'Accept plan'}
              </Button>
            </div>
          </div>
        </WorkspaceSurface>
      </WorkspaceReveal>

      <PlanAlternativesModal
        isOpen={showAlternativesModal}
        onClose={() => setShowAlternativesModal(false)}
        alternatives={alternatives}
        currentPlan={plan}
      />
    </WorkspacePage>
  );
};

export default StudyPathDashboard;
