/**
 * useRatingAudit — Fetches the implicit rating distribution audit.
 *
 * Returns Again/Good ratio, per-system breakdown, weekly trends,
 * and anomaly flags from the Rating Distribution Audit service.
 *
 * @see functions/api/analytics/rating-audit.ts
 * @see lib/services/ratingDistributionAuditService.ts
 * @see components/dashboard/RatingHealthCard.tsx
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

export type AnomalyLevel = 'healthy' | 'warning' | 'critical';

export interface RatingBucket {
  total: number;
  againCount: number;
  goodCount: number;
  againPct: number;
  goodPct: number;
}

export interface WeeklyTrend extends RatingBucket {
  weekStart: string;
}

export interface RatingAnomaly {
  level: AnomalyLevel;
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface RatingAuditData {
  userId: string;
  windowDays: number;
  overall: RatingBucket;
  bySystem: Array<RatingBucket & { system: string }>;
  bySessionType: Array<RatingBucket & { sessionType: string }>;
  weeklyTrend: WeeklyTrend[];
  anomalies: RatingAnomaly[];
  generatedAt: string;
}

export function useRatingAudit(windowDays: number = 90) {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<RatingAuditData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const endpoint = getApiEndpoint(`/api/analytics/rating-audit?windowDays=${windowDays}`);
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Rating audit fetch failed: ${response.status}`);
      }

      const json = await response.json();
      if (json?.data) {
        setData(json.data);
      }
    } catch (err) {
      console.warn('[useRatingAudit] Failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, windowDays]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchAudit();
  }, [isSignedIn, fetchAudit]);

  return { data, isLoading, error, refresh: fetchAudit };
}
