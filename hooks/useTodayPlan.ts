import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { API_ENDPOINTS, getApiEndpoint } from '@/lib/utils/apiConfig';
import type { StudyPlanDay } from '@/lib/api/types/studyPlan';

export function useTodayPlan() {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<StudyPlanDay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!isSignedIn) {
      setData(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = getApiEndpoint(API_ENDPOINTS.STUDY_PLAN_TODAY);
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Study plan fetch failed: ${response.status}`);
      }

      const json = (await response.json()) as { data?: StudyPlanDay | null };
      setData(json?.data ?? null);
    } catch (err) {
      console.warn('[useTodayPlan] Failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan]);

  return { data, isLoading, error, refresh: fetchPlan };
}

export default useTodayPlan;
