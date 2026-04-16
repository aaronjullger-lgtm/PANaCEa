import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth, useUser } from '@clerk/clerk-react';
import useSWR from 'swr';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  RefreshCw,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  WorkspaceEmptyState,
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
import type { RecommendationResponse, StudyPlan } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { ROUTES } from '@/config/routes';
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
    if (!response.ok) {
      const safeMessages: Record<number, string> = {
        401: 'Your session has expired. Please sign in again.',
        403: 'You do not have permission to access this study plan.',
        404: 'No study plan found. Try regenerating one.',
        429: 'Too many requests. Please wait a moment and try again.',
      };
      throw new Error(
        safeMessages[response.status] ?? 'Unable to load your study plan. Please try again.'
      );
    }
    return (await response.json()) as RecommendationResponse;
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
        body: JSON.stringify({ planId: plan.id }),
      });

      if (!response.ok) {
        throw new Error(`Failed to accept plan: ${response.status}`);
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

      if (!response.ok) {
        throw new Error('Unable to regenerate study plan. Please try again.');
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
            <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-b-transparent" />
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

    return (
      <WorkspacePage density="wide" mode="error">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Study Path',
              badgeTone: 'amber',
              title: 'Your study route is unavailable right now.',
              subtitle:
                'The optimizer could not return a safe recommendation, so the plan is falling back instead of guessing.',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
              primaryAction: {
                label: 'Try again',
                onClick: () => mutate(),
              },
              secondaryActions: [
                {
                  label: 'Open Practice instead',
                  onClick: () => navigate(ROUTES.PRACTICE),
                },
              ],
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceSurface accent="#a67f7f" role="alert">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-data-fail)]/25 bg-[var(--color-data-fail)]/10">
                <AlertTriangle className="h-5 w-5 text-[var(--color-data-fail)]" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                  Study plan unavailable
                </h2>
                <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                  {safeMessage}
                </p>
                <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                  This usually means the optimizer lacked a safe enough signal or the request failed mid-flight. Retry above, or jump into Practice while the plan recalculates.
                </p>
              </div>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  if (!plan) {
    return (
      <WorkspacePage density="wide" mode="error">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Study Path',
              badgeTone: 'amber',
              title: 'No study path has been generated yet.',
              subtitle:
                'The optimizer needs another pass before it can turn your current signals into a plan.',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
              primaryAction: {
                label: 'Generate plan',
                onClick: () => mutate(),
              },
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceEmptyState
            icon={Target}
            title="No study plan generated"
            description="We couldn't generate a study plan from the current data. Try again in a moment."
            action={
              <Button type="button" size="sm" onClick={() => mutate()}>
                Generate plan
              </Button>
            }
          />
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage density="wide" mode="analytics">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Study Path',
            badgeTone: 'amber',
            title: 'A study route that shows its tradeoffs.',
            subtitle:
              'Review the recommended path, see how hard it pushes, and compare alternatives before you commit your next week of study time.',
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
                Plan summary
              </p>
              <h2 className="heading-fluid-lg max-w-3xl font-semibold text-[var(--color-text-primary)]">
                This route balances coverage, retention, and fatigue instead of optimizing for only one.
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.24) }}
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
