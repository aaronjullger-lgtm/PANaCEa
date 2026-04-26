import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

export type StudySplit = 'main_heavy' | 'balanced' | 'targeted_heavy';

export interface TodayPlanData {
  recommendedMainCount: number;
  recommendedTargetedCount: number;
  mainSystems: string[];
  targetedConditions: string[];
  readinessPriority: number;
  retentionPriority: number;
  recommendedSplit: StudySplit;
  reasonSummary: string;
  generatedAt: string;
  planId?: string;
  planDate?: string;
  status?: string;
  progress?: {
    questionsAnswered: number;
    questionsTarget: number;
    percentComplete: number;
  };
  tasks?: Array<{
    id: string;
    kind: string;
    mode: string;
    title: string;
    count: number;
    estimatedMinutes: number;
    reason: string;
    priority: string;
    status: string;
    systemFilter?: string[];
    conditionIds?: string[];
    route: string;
    launchParams: Record<string, string>;
  }>;
}

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

      const json: any = await response.json();
      const payload = json?.data?.data ?? json?.data ?? json;
      if (payload) setData(payload);
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
