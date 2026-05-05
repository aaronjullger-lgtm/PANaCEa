import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { API_ENDPOINTS, getApiEndpoint } from '@/lib/utils/apiConfig';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';
import type {
  StudyPlanCurrentData,
  StudyPlanDay,
  StudyPlanProgressInput,
  StudyPlanSettings,
} from '@/lib/api/types/studyPlan';

interface UseStudyPlanOptions {
  days?: number;
}

interface UseStudyPlanResult {
  data: StudyPlanCurrentData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSettings: (settings: Partial<StudyPlanSettings>) => Promise<StudyPlanCurrentData | null>;
  markTaskProgress: (
    input: StudyPlanProgressInput
  ) => Promise<StudyPlanDay | null>;
}

async function authedJsonFetch<T>(
  getToken: () => Promise<string | null>,
  url: string,
  init?: RequestInit
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(getApiEnvelopeError(body, `Request failed (${response.status})`));
  }

  return unwrapApiEnvelope<T>(await response.json());
}

export function useStudyPlan(
  options: UseStudyPlanOptions = {}
): UseStudyPlanResult {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<StudyPlanCurrentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = options.days ?? 7;

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await authedJsonFetch<StudyPlanCurrentData>(
        getToken,
        `${getApiEndpoint(API_ENDPOINTS.STUDY_PLAN_CURRENT)}?days=${days}`,
        { method: 'GET', headers: {} }
      );
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load study plan');
    } finally {
      setIsLoading(false);
    }
  }, [days, getToken, isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateSettings = useCallback(
    async (settings: Partial<StudyPlanSettings>) => {
      setIsSaving(true);
      setError(null);
      try {
        const response = await authedJsonFetch<StudyPlanCurrentData>(
          getToken,
          getApiEndpoint(API_ENDPOINTS.STUDY_PLAN_CURRENT),
          {
            method: 'PUT',
            body: JSON.stringify({
              days,
              forceRegenerate: true,
              settings,
            }),
          }
        );
        setData(response);
        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save study plan settings');
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [days, getToken]
  );

  const markTaskProgress = useCallback(
    async (input: StudyPlanProgressInput) => {
      try {
        const response = await authedJsonFetch<StudyPlanDay>(
          getToken,
          getApiEndpoint(API_ENDPOINTS.STUDY_PLAN_PROGRESS),
          {
            method: 'POST',
            body: JSON.stringify(input),
          }
        );

        setData((current) => {
          if (!current) return current;
          const nextDays = current.days.map((day) =>
            day.planDate === response.planDate ? response : day
          );
          return {
            ...current,
            days: nextDays,
            today:
              current.today?.planDate === response.planDate
                ? response
                : current.today,
          };
        });

        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update task progress');
        return null;
      }
    },
    [getToken]
  );

  return {
    data,
    isLoading,
    isSaving,
    error,
    refresh,
    updateSettings,
    markTaskProgress,
  };
}

export default useStudyPlan;
