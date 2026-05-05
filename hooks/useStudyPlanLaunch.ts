import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useCallback, useState } from 'react';
import { API_ENDPOINTS, getApiEndpoint } from '@/lib/utils/apiConfig';
import type { SessionSettings } from '@/types';
import {
  saveActiveStudyPlanTask,
  savePendingStudyPlanSessionIntent,
} from '@/lib/studyPlanIntent';
import { ROUTES } from '@/config/routes';
import { getApiEnvelopeError } from '@/lib/utils/apiEnvelope';

export interface StudyPlanLaunchTask {
  id: string;
  title: string;
  kind?: string;
  mode?: string;
  route?: string | null;
  launchSettings?: SessionSettings | null;
  count?: number | null;
  targetQuestions?: number | null;
  systemFilter?: string[] | null;
  systems?: string[] | null;
  conditionIds?: string[] | null;
  launchParams?: Record<string, string> | null;
}

interface UseStudyPlanLaunchResult {
  isLaunching: boolean;
  error: string | null;
  launchTask: (planDate: string, task: StudyPlanLaunchTask) => Promise<void>;
}

async function parseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return getApiEnvelopeError(body, `Request failed (${response.status})`);
}

function coerceCount(task: StudyPlanLaunchTask): number {
  const raw =
    task.launchSettings?.questionCount ??
    task.launchSettings?.count ??
    task.targetQuestions ??
    task.count ??
    Number(task.launchParams?.count);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 20;
}

function coerceSystems(task: StudyPlanLaunchTask): string[] {
  const settingsSystems = Array.isArray(task.launchSettings?.systems)
    ? task.launchSettings.systems
    : [];
  const systems = Array.isArray(task.systems) ? task.systems : [];
  const systemFilter = Array.isArray(task.systemFilter) ? task.systemFilter : [];
  const paramsSystems = task.launchParams?.systems
    ? task.launchParams.systems.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  return Array.from(new Set([...settingsSystems, ...systems, ...systemFilter, ...paramsSystems]));
}

function coerceConditions(task: StudyPlanLaunchTask): string[] {
  const settingsConditionId = task.launchSettings?.conditionId ? [task.launchSettings.conditionId] : [];
  const conditionIds = Array.isArray(task.conditionIds) ? task.conditionIds : [];
  const paramsConditions = task.launchParams?.conditions
    ? task.launchParams.conditions.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const paramConditionId = task.launchParams?.conditionId ? [task.launchParams.conditionId] : [];

  return Array.from(new Set([...settingsConditionId, ...conditionIds, ...paramsConditions, ...paramConditionId]));
}

function coerceConditionName(task: StudyPlanLaunchTask): string | undefined {
  return task.launchSettings?.conditionName ?? task.launchParams?.conditionName;
}

function isConditionTargetedTask(_task: StudyPlanLaunchTask, conditions = coerceConditions(_task)): boolean {
  return conditions.length > 0;
}

function buildLaunchSettings(task: StudyPlanLaunchTask): SessionSettings {
  const conditions = coerceConditions(task);
  const systems = coerceSystems(task);
  const count = coerceCount(task);
  const conditionName = coerceConditionName(task);

  if (task.launchSettings) {
    const conditionTargeted = isConditionTargetedTask(task, conditions);
    return {
      ...task.launchSettings,
      mode: conditionTargeted
        ? 'targeted'
        : task.kind === 'review'
          ? 'review'
          : task.kind === 'targeted'
            ? 'core_adaptive'
            : (task.launchSettings.mode ?? 'core_adaptive'),
      focus: conditionTargeted
        ? 'topic'
        : task.kind === 'review'
          ? 'review'
          : 'all',
      count: task.launchSettings.count ?? count,
      questionCount: task.launchSettings.questionCount ?? count,
      systems: task.launchSettings.systems ?? systems,
      conditionId: task.launchSettings.conditionId ?? conditions[0],
      conditionName,
    };
  }

  const conditionTargeted = isConditionTargetedTask(task, conditions);
  return {
    mode: conditionTargeted ? 'targeted' : task.kind === 'review' ? 'review' : 'core_adaptive',
    focus: conditionTargeted ? 'topic' : task.kind === 'review' ? 'review' : 'all',
    count,
    questionCount: count,
    systems,
    conditionId: conditions[0],
    conditionName,
  };
}

function buildCanonicalStudySessionRoute(planDate: string, task: StudyPlanLaunchTask): string {
  const route = new URL(ROUTES.STUDY_MAIN_SESSION, window.location.origin);
  const count = coerceCount(task);
  const systems = coerceSystems(task);
  const conditions = coerceConditions(task);
  const conditionName = coerceConditionName(task);
  const requestedMode = task.launchParams?.mode ?? task.mode;
  const conditionTargeted = isConditionTargetedTask(task, conditions);

  route.searchParams.set('source', 'study-plan');
  route.searchParams.set('taskId', task.id);
  route.searchParams.set('planDate', planDate);
  route.searchParams.set('count', String(count));
  route.searchParams.set(
    'mode',
    conditionTargeted
      ? 'condition'
      : task.kind === 'review'
        ? 'review'
      : requestedMode === 'system' || systems.length === 1
        ? 'system'
        : 'adaptive'
  );

  if (systems.length > 0) {
    route.searchParams.set('systems', systems.join(','));
  }
  if (conditions.length > 0) {
    route.searchParams.set('conditions', conditions.join(','));
    route.searchParams.set('conditionId', conditions[0] ?? '');
  }
  if (conditionName) {
    route.searchParams.set('conditionName', conditionName);
  }

  return `${route.pathname}?${route.searchParams.toString()}`;
}

export function useStudyPlanLaunch(): UseStudyPlanLaunchResult {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launchTask = useCallback(
    async (planDate: string, task: StudyPlanLaunchTask) => {
      setIsLaunching(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(getApiEndpoint(API_ENDPOINTS.STUDY_PLAN_PROGRESS), {
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

        if (!response.ok) {
          throw new Error(await parseError(response));
        }

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
          settings: buildLaunchSettings(task),
        });

        navigate(buildCanonicalStudySessionRoute(planDate, task));
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
