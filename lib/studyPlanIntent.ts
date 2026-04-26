import type { SessionSettings } from '@/types';

const ACTIVE_PLAN_TASK_KEY = 'panacea.study-plan.active-task.v1';
const PENDING_SESSION_INTENT_KEY = 'panacea.study-plan.pending-session.v1';

export interface ActiveStudyPlanTaskContext {
  planDate: string;
  taskId: string;
  taskTitle: string;
}

export interface PendingStudyPlanSessionIntent {
  context: ActiveStudyPlanTaskContext;
  settings: SessionSettings;
}

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

function readJson<T>(key: string): T | null {
  if (!canUseSessionStorage()) return null;

  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T | null): void {
  if (!canUseSessionStorage()) return;

  try {
    if (value == null) {
      sessionStorage.removeItem(key);
      return;
    }

    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal.
  }
}

export function loadActiveStudyPlanTask(): ActiveStudyPlanTaskContext | null {
  return readJson<ActiveStudyPlanTaskContext>(ACTIVE_PLAN_TASK_KEY);
}

export function saveActiveStudyPlanTask(
  context: ActiveStudyPlanTaskContext | null
): void {
  writeJson(ACTIVE_PLAN_TASK_KEY, context);
}

export function clearActiveStudyPlanTask(): void {
  writeJson(ACTIVE_PLAN_TASK_KEY, null);
}

export function loadPendingStudyPlanSessionIntent(): PendingStudyPlanSessionIntent | null {
  return readJson<PendingStudyPlanSessionIntent>(PENDING_SESSION_INTENT_KEY);
}

export function savePendingStudyPlanSessionIntent(
  intent: PendingStudyPlanSessionIntent | null
): void {
  writeJson(PENDING_SESSION_INTENT_KEY, intent);
}

export function clearPendingStudyPlanSessionIntent(): void {
  writeJson(PENDING_SESSION_INTENT_KEY, null);
}
