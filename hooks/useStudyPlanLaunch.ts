import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useCallback, useState } from 'react';
import { API_ENDPOINTS, getApiEndpoint } from '@/lib/utils/apiConfig';
import type { StudyPlanTask } from '@/lib/api/types/studyPlan';
import {
  saveActiveStudyPlanTask,
  savePendingStudyPlanSessionIntent,
} from '@/lib/studyPlanIntent';
import { ROUTES } from '@/config/routes';

interface UseStudyPlanLaunchResult {
  isLaunching: boolean;
  error: string | null;
  launchTask: (planDate: string, task: StudyPlanTask) => Promise<void>;
}

export function useStudyPlanLaunch(): UseStudyPlanLaunchResult {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launchTask = useCallback(
    async (planDate: string, task: StudyPlanTask) => {
      setIsLaunching(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Not authenticated');
        }

        await fetch(getApiEndpoint(API_ENDPOINTS.STUDY_PLAN_PROGRESS), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planDate,
            taskId: task.id,
            action: 'start',
          }),
        });

        saveActiveStudyPlanTask({
          planDate,
          taskId: task.id,
          taskTitle: task.title,
        });
        savePendingStudyPlanSessionIntent({
          context: {
            planDate,
            taskId: task.id,
            taskTitle: task.title,
          },
          settings: task.launchSettings,
        });

        navigate(ROUTES.STUDY);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to launch study task');
      } finally {
        setIsLaunching(false);
      }
    },
    [getToken, navigate]
  );

  return { isLaunching, error, launchTask };
}

export default useStudyPlanLaunch;
