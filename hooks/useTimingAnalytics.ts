/**
 * Timing Analytics Hook
 *
 * Tracks timing metrics and conversation paths during OSCE sessions.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createTimingAnalyticsService } from '@/services/analytics/timingAnalyticsService';
import type { TimingMetric, SessionTimingAnalytics } from '@/types/smart-scribe-system';

interface UseTimingAnalyticsOptions {
  sessionId: string | null;
  caseId: string | null;
  enabled?: boolean;
}

export function useTimingAnalytics({
  sessionId,
  caseId,
  enabled = true,
}: UseTimingAnalyticsOptions) {
  const [currentMetrics, setCurrentMetrics] = useState<TimingMetric[]>([]);
  const [analytics, setAnalytics] = useState<SessionTimingAnalytics | null>(null);

  // Create service instance once
  const service = useMemo(() => createTimingAnalyticsService(), []);

  // Start session tracking
  useEffect(() => {
    if (!sessionId || !caseId || !enabled) return;

    service.startSession(sessionId, caseId);
  }, [sessionId, caseId, enabled, service]);

  /**
   * Start a timing metric.
   */
  const startMetric = useCallback(
    (
      name: string,
      type: TimingMetric['type'],
      significance?: TimingMetric['significance'],
      targetDuration?: number
    ) => {
      if (!sessionId) return null;
      return service.startMetric(sessionId, name, type, significance, targetDuration);
    },
    [sessionId, service]
  );

  /**
   * End a timing metric.
   */
  const endMetric = useCallback(
    (metricId: string) => {
      if (!sessionId) return;
      service.endMetric(sessionId, metricId);

      // Update current metrics
      const snapshot = service.getSnapshot(sessionId);
      if (snapshot) {
        setCurrentMetrics(snapshot.metrics);
      }
    },
    [sessionId, service]
  );

  /**
   * Record a conversation node.
   */
  const recordNode = useCallback(
    (
      type: 'question' | 'action' | 'finding' | 'decision',
      content: string,
      parentId?: string,
      relevanceScore?: number
    ) => {
      if (!sessionId) return null;
      return service.recordConversationNode(sessionId, type, content, parentId, relevanceScore);
    },
    [sessionId, service]
  );

  /**
   * Record a milestone.
   */
  const recordMilestone = useCallback(
    (name: string, target?: number, achieved?: boolean) => {
      if (!sessionId) return;
      service.recordMilestone(sessionId, name, target, achieved);
    },
    [sessionId, service]
  );

  /**
   * End session and get final analytics.
   */
  const endSession = useCallback(async () => {
    if (!sessionId) return null;
    const finalAnalytics = await service.endSession(sessionId);
    setAnalytics(finalAnalytics);
    return finalAnalytics;
  }, [sessionId, service]);

  /**
   * Get real-time snapshot.
   */
  const getSnapshot = useCallback(() => {
    if (!sessionId) return null;
    return service.getSnapshot(sessionId);
  }, [sessionId, service]);

  return {
    currentMetrics,
    analytics,
    startMetric,
    endMetric,
    recordNode,
    recordMilestone,
    endSession,
    getSnapshot,
  };
}
