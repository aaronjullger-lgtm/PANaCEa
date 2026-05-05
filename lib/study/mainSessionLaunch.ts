import type { CoreAdaptiveSessionScope } from '@/components/session/CoreAdaptiveSession';
import type { SessionSettings } from '@/types';
import {
  loadPendingStudyPlanSessionIntent,
  type PendingStudyPlanSessionIntent,
} from '@/lib/studyPlanIntent';
import { ROUTES } from '@/config/routes';

export interface MainSessionLaunch {
  scope: CoreAdaptiveSessionScope;
  taskId: string | null;
  source: string | null;
  planDate: string | null;
  settings: SessionSettings | null;
}

export interface MainSessionLaunchPathOptions {
  source?: string;
  taskId?: string | null;
  planDate?: string | null;
}

function splitLaunchList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSize(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(5, Math.round(parsed))) : 20;
}

function matchesPendingIntent(
  pendingIntent: PendingStudyPlanSessionIntent | null,
  taskId: string | null,
  planDate: string | null,
  source: string | null
): pendingIntent is PendingStudyPlanSessionIntent {
  if (source !== 'study-plan' || !pendingIntent || !taskId) return false;
  if (pendingIntent.context.taskId !== taskId) return false;
  return !planDate || pendingIntent.context.planDate === planDate;
}

function toRouteMode(
  requestedMode: string | null,
  conditionId: string | undefined,
  systems: string[],
  settings: SessionSettings | null
): CoreAdaptiveSessionScope['mode'] {
  if (conditionId || settings?.conditionId) return 'condition';
  if (requestedMode === 'system' || systems.length === 1) return 'system';
  if (requestedMode === 'subcategory' || settings?.subcategoryName) return 'subcategory';
  return 'adaptive';
}

function buildSessionSettings({
  requestedMode,
  routeMode,
  size,
  systems,
  conditionId,
  conditionName,
  subcategory,
  pendingSettings,
}: {
  requestedMode: string | null;
  routeMode: CoreAdaptiveSessionScope['mode'];
  size: number;
  systems: string[];
  conditionId?: string;
  conditionName?: string;
  subcategory?: string;
  pendingSettings: SessionSettings | null;
}): SessionSettings {
  const defaultMode =
    requestedMode === 'review'
      ? 'review'
      : routeMode === 'adaptive'
        ? 'standard'
        : 'targeted';
  const defaultFocus =
    requestedMode === 'review' ? 'review' : routeMode === 'adaptive' ? 'all' : 'topic';
  const count = pendingSettings?.count ?? pendingSettings?.questionCount ?? size;

  return {
    ...pendingSettings,
    mode: pendingSettings?.mode ?? defaultMode,
    focus: pendingSettings?.focus ?? defaultFocus,
    topic:
      pendingSettings?.topic ??
      conditionName ??
      subcategory ??
      conditionId ??
      (systems.length === 1 ? systems[0] : undefined),
    count,
    questionCount: pendingSettings?.questionCount ?? count,
    systems: pendingSettings?.systems?.length ? pendingSettings.systems : systems,
    conditionId: pendingSettings?.conditionId ?? conditionId,
    conditionName: pendingSettings?.conditionName ?? conditionName,
    subcategoryName: pendingSettings?.subcategoryName ?? subcategory,
  };
}

export function parseMainSessionLaunch(
  search: string,
  pendingIntent: PendingStudyPlanSessionIntent | null = loadPendingStudyPlanSessionIntent()
): MainSessionLaunch {
  const params = new URLSearchParams(search);
  const taskId = params.get('taskId');
  const source = params.get('source');
  const planDate = params.get('planDate');
  const trustedPendingIntent = matchesPendingIntent(pendingIntent, taskId, planDate, source)
    ? pendingIntent
    : null;
  const pendingSettings = trustedPendingIntent?.settings ?? null;

  const routeSystems = splitLaunchList(params.get('systems'));
  const settingsSystems = pendingSettings?.systems ?? [];
  const systems = routeSystems.length > 0 ? routeSystems : settingsSystems;
  const routeConditions = splitLaunchList(params.get('conditions'));
  const conditionId = params.get('conditionId') ?? routeConditions[0] ?? pendingSettings?.conditionId;
  const conditionName = params.get('conditionName') ?? pendingSettings?.conditionName;
  const subcategory =
    params.get('topic') ??
    params.get('subcategory') ??
    pendingSettings?.subcategoryName ??
    (pendingSettings?.focus === 'topic' ? pendingSettings.topic : undefined);
  const requestedMode = params.get('mode') ?? null;
  const size = normalizeSize(
    params.get('size') ?? params.get('count') ?? pendingSettings?.questionCount ?? pendingSettings?.count
  );
  const mode = toRouteMode(requestedMode, conditionId, systems, pendingSettings);

  return {
    scope: {
      mode,
      size,
      system: systems[0],
      systems: systems.length > 0 ? systems : undefined,
      subcategory,
      conditionId,
      conditionName,
    },
    taskId,
    source,
    planDate,
    settings: buildSessionSettings({
      requestedMode,
      routeMode: mode,
      size,
      systems,
      conditionId,
      conditionName,
      subcategory,
      pendingSettings,
    }),
  };
}

export function buildMainSessionLaunchPath(
  settings: SessionSettings,
  options: MainSessionLaunchPathOptions = {}
): string {
  const params = new URLSearchParams();
  const systems = settings.systems?.filter(Boolean) ?? [];
  const count = normalizeSize(settings.questionCount ?? settings.count);
  const isReview = settings.mode === 'review' || settings.focus === 'review';
  const mode =
    isReview
      ? 'review'
      : settings.conditionId
        ? 'condition'
        : settings.subcategoryName
          ? 'subcategory'
          : systems.length === 1
            ? 'system'
            : 'adaptive';

  params.set('source', options.source ?? 'manual');
  params.set('mode', mode);
  params.set('count', String(count));

  if (options.taskId) params.set('taskId', options.taskId);
  if (options.planDate) params.set('planDate', options.planDate);
  if (systems.length > 0) params.set('systems', systems.join(','));
  if (settings.conditionId) {
    params.set('conditionId', settings.conditionId);
    params.set('conditions', settings.conditionId);
  }
  if (settings.conditionName) params.set('conditionName', settings.conditionName);
  if (settings.subcategoryName) params.set('subcategory', settings.subcategoryName);
  if (settings.topic && !settings.conditionId && !settings.subcategoryName) {
    params.set('topic', settings.topic);
  }

  return `${ROUTES.STUDY_MAIN_SESSION}?${params.toString()}`;
}
