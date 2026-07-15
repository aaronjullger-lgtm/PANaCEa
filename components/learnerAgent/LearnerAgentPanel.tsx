/**
 * LearnerAgentPanel — compact next-action coach (not a full chat dashboard).
 */

import React, { useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Compass, Clock, Play, Pause, Settings2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/loading';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useLearnerAgent, isLearnerAgentEnabled } from '@/hooks/useLearnerAgent';
import { useNavigate } from 'react-router-dom';

export interface LearnerAgentPanelProps {
  availableMinutes?: number;
  onStartSession?: (launchParams: Record<string, string>) => void;
}

export const LearnerAgentPanel: React.FC<LearnerAgentPanelProps> = ({
  availableMinutes,
  onStartSession,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const {
    loading,
    error,
    recommendation,
    correlationId,
    connected,
    fetchRecommendation,
    connectWebSocket,
    sendRecommendationResponse,
    startSession,
  } = useLearnerAgent();

  useEffect(() => {
    if (!isLearnerAgentEnabled()) return;
    void fetchRecommendation(availableMinutes);
    void connectWebSocket();
  }, [availableMinutes, connectWebSocket, fetchRecommendation]);

  const handleAccept = useCallback(async () => {
    if (!recommendation) return;
    sendRecommendationResponse('accept');
    await startSession(recommendation.title);
    if (onStartSession) {
      onStartSession(recommendation.launchParams);
    } else {
      const params = new URLSearchParams(recommendation.launchParams);
      navigate(`${recommendation.launchRoute}?${params}`);
    }
  }, [navigate, onStartSession, recommendation, sendRecommendationResponse, startSession]);

  const handleDefer = useCallback(() => {
    sendRecommendationResponse('defer');
    void fetchRecommendation(availableMinutes);
  }, [availableMinutes, fetchRecommendation, sendRecommendationResponse]);

  if (!isLearnerAgentEnabled()) return null;

  const sectionEnter = prefersReducedMotion ? false : { y: 12 };
  const sectionAnimate = prefersReducedMotion ? false : { y: 0 };

  return (
    <motion.section
      aria-label="Learner Agent recommendation"
      initial={sectionEnter}
      animate={sectionAnimate}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      <GlassCard variant="neutral" className="p-5 border border-[var(--color-border)]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-[var(--color-accent-button)]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Next best action</h2>
          </div>
          <span
            className="text-xs text-[var(--color-text-muted)] tabular-nums"
            title={correlationId ?? undefined}
          >
            {connected ? 'Live' : 'API'}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] min-h-[44px]">
            <InlineSpinner size="sm" />
            Calculating recommendation…
          </div>
        ) : error ? (
          <p className="text-sm text-[var(--color-text-secondary)]" role="alert">
            {error}
          </p>
        ) : recommendation ? (
          <div className="space-y-4">
            <div>
              <p className="font-bold text-[var(--color-text-primary)]">{recommendation.title}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ~{recommendation.estimatedMinutes} min
              </p>
            </div>

            <div className="rounded-lg bg-[var(--color-bg-tertiary)] p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                Why this now?
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">{recommendation.whyNow}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                className="min-h-[44px]"
                onClick={() => void handleAccept()}
                aria-label="Accept recommendation and start"
              >
                <Play className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Start
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="min-h-[44px]"
                onClick={handleDefer}
                aria-label="Defer recommendation"
              >
                <Pause className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Defer
              </Button>
              <Button
                variant="ghost"
                size="md"
                className="min-h-[44px]"
                onClick={() => sendRecommendationResponse('adjust', 'learner requested adjustment')}
                aria-label="Adjust study plan"
              >
                <Settings2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Adjust
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">No recommendation available.</p>
        )}
      </GlassCard>
    </motion.section>
  );
};

export default LearnerAgentPanel;
