import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth, useUser } from '@clerk/clerk-react';
import useSWR from 'swr';
import { Calendar, Clock, Target, TrendingUp, Zap, AlertTriangle, ChevronRight, Check, RefreshCw } from 'lucide-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import type { RecommendationResponse, StudyPlan } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { CARD_RING_SHADOW } from '@/components/ui/card';
import ProgressProjectionChart from './ProgressProjectionChart';
import PlanAlternativesModal from './PlanAlternativesModal';
import FatigueAlertBanner from './FatigueAlertBanner';

// ============================================================================
// Authenticated Fetcher
// ============================================================================

function createStudyPathFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<RecommendationResponse> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const safeMessages: Record<number, string> = {
        401: 'Your session has expired. Please sign in again.',
        403: 'You do not have permission to access this study plan.',
        404: 'No study plan found. Try regenerating one.',
        429: 'Too many requests. Please wait a moment and try again.',
      };
      throw new Error(safeMessages[res.status] ?? 'Unable to load your study plan. Please try again.');
    }
    const data = await res.json();
    return data as RecommendationResponse;
  };
}

// ============================================================================
// Study Path Dashboard Component
// ============================================================================

const StudyPathDashboard = () => {
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

  const handleAcceptPlan = async () => {
    if (!data?.plan) return;
    setIsAccepting(true);
    try {
      const token = await getToken();
      const res = await fetch(getApiEndpoint(API_ENDPOINTS.STUDY_PATH_ACCEPT), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: data.plan.id,
          // feedback optional, can be added later via UI
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to accept plan: ${res.status}`);
      }
      showToast({
        type: 'success',
        message: 'Study plan accepted! You can now start following it.',
      });
      // Optionally refresh data
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
      const res = await fetch(getApiEndpoint(API_ENDPOINTS.STUDY_PATH_REGENERATE), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        mutate(); // refetch recommendation
        showToast({
          type: 'success',
          message: 'Study plan regenerated successfully!',
        });
      } else {
        throw new Error('Unable to regenerate study plan. Please try again.');
      }
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
          <p className="mt-4 text-[var(--color-text-secondary)]">Loading your personalized study plan...</p>
        </div>
      </div>
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
      <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-6 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-[var(--color-warning)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Study plan unavailable
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-4">
          {safeMessage}
        </p>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    );
  }

  const plan = data?.plan;
  const alternatives = data?.alternatives || [];
  const confidence = data?.confidence ?? 0;
  const rationale = data?.rationale || '';

  if (!plan) {
    return (
      <div className="rounded-xl bg-[var(--color-bg-secondary)] p-6 text-center">
        <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          No study plan generated
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-4">
          We couldn't generate a study plan. Please try again later.
        </p>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:opacity-90"
        >
          Generate Plan
        </button>
      </div>
    );
  }

  const totalSessions = plan.sessions.length;
  const totalMinutes = plan.totalEstimatedMinutes;
  const fatigueRisk = plan.metadata.fatigueRisk;
  const blueprintCoverage = plan.metadata.blueprintCoverage;
  const projectedRetentionIncrease = plan.metadata.projectedRetentionIncrease;

  // Calculate days until plan completion
  const sortedSessions = [...plan.sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const startDate = sortedSessions[0]?.date;
  const endDate = sortedSessions[sortedSessions.length - 1]?.date;
  const daysCount = startDate && endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-primary)] via-[var(--color-bg-primary)] to-[var(--color-bg-secondary)] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5 }}
          className="pt-2"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg bg-[var(--color-accent)]/15">
              <Target className="w-6 h-6 text-[var(--color-text-inverse)]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)] truncate max-w-full">
                Dynamic Study Path Optimizer
              </h1>
              <p className="text-sm md:text-base text-[var(--color-text-secondary)]">
                Your personalized plan to maximize retention and blueprint coverage.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Fatigue Alert Banner */}
        <FatigueAlertBanner riskLevel={fatigueRisk} />

        {/* Plan Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[var(--color-bg-card)] rounded-xl p-5" style={{ boxShadow: CARD_RING_SHADOW }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                <Clock className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Total Study Time</p>
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {Math.round(totalMinutes / 60)} hours
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {totalSessions} sessions over {daysCount} days
            </p>
          </div>

          <div className="bg-[var(--color-bg-card)] rounded-xl p-5" style={{ boxShadow: CARD_RING_SHADOW }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-[var(--color-success)]/10">
                <TrendingUp className="w-5 h-5 text-[var(--color-success)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Projected Retention Increase</p>
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  +{(projectedRetentionIncrease * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Based on FSRS v6 optimization
            </p>
          </div>

          <div className="bg-[var(--color-bg-card)] rounded-xl p-5" style={{ boxShadow: CARD_RING_SHADOW }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-[var(--color-warning)]/10">
                <Zap className="w-5 h-5 text-[var(--color-warning)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Confidence</p>
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {(confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {confidence > 0.7 ? 'High confidence' : confidence > 0.4 ? 'Moderate confidence' : 'Low confidence'}
            </p>
          </div>

          <div className="bg-[var(--color-bg-card)] rounded-xl p-5" style={{ boxShadow: CARD_RING_SHADOW }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-[var(--color-info)]/10">
                <Calendar className="w-5 h-5 text-[var(--color-info)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Blueprint Coverage</p>
                <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {(Object.values(blueprintCoverage) as number[]).reduce((sum, val) => sum + val, 0).toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Weighted across all organ systems
            </p>
          </div>
        </div>

        {/* Progress Projection Chart */}
        <div className="bg-[var(--color-bg-card)] rounded-xl p-6" style={{ boxShadow: CARD_RING_SHADOW }}>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
            Progress Projection
          </h2>
          <ProgressProjectionChart planId={plan.id} />
        </div>

        {/* Sessions List */}
        <div className="bg-[var(--color-bg-card)] rounded-xl p-6" style={{ boxShadow: CARD_RING_SHADOW }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Study Sessions</h2>
            <span className="text-sm text-[var(--color-text-secondary)]">
              {totalSessions} sessions • {Math.round(totalMinutes / 60)} total hours
            </span>
          </div>
          <div className="space-y-4">
            {sortedSessions.map((session, idx) => (
              <div
                key={session.id}
                className="p-4 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold">
                      <span className="text-xs">Day</span>
                      <span>{idx + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">
                        {session.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {session.topics.length} topics • {session.topics.reduce((sum, t) => sum + t.estimatedMinutes, 0)} min
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                </div>
                {session.notes && (
                  <p className="mt-3 text-sm text-[var(--color-text-secondary)] italic">{session.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleAcceptPlan}
            disabled={isAccepting}
            className="px-6 py-3 bg-[var(--color-success)] text-[var(--color-text-inverse)] rounded-xl font-semibold hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className={`w-5 h-5 ${isAccepting ? 'animate-spin' : ''}`} />
            {isAccepting ? 'Accepting...' : 'Accept Plan'}
          </button>
          <button
            onClick={() => setShowAlternativesModal(true)}
            className="px-6 py-3 bg-[var(--color-bg-card)] text-[var(--color-text-primary)] rounded-xl font-semibold hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center justify-center gap-2"
            disabled={alternatives.length === 0}
          >
            <Target className="w-5 h-5" />
            View Alternatives ({alternatives.length})
          </button>
          <button
            onClick={handleRegeneratePlan}
            disabled={isRegenerating}
            className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl font-semibold hover:opacity-90 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerating...' : 'Regenerate Plan'}
          </button>
        </div>

        {/* Rationale */}
        {rationale && (
          <div className="bg-[var(--color-bg-card)] rounded-xl p-6" style={{ boxShadow: CARD_RING_SHADOW }}>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
              Plan Rationale
            </h3>
            <p className="text-[var(--color-text-secondary)] whitespace-pre-line">{rationale}</p>
          </div>
        )}
      </div>

      {/* Alternatives Modal */}
      <PlanAlternativesModal
        isOpen={showAlternativesModal}
        onClose={() => setShowAlternativesModal(false)}
        alternatives={alternatives}
        currentPlan={plan}
      />
    </div>
  );
};

export default StudyPathDashboard;