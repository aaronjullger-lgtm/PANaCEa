import type { DashboardWidgetDefinition, SelectedWidget } from '../model/widgetTypes';

const STORAGE_KEY = 'panacea.dashboard.widgetCadence.v1';
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const SAME_VIEW_DEDUPE_MS = 60_000;

type ExposureStore = Record<string, number[]>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStore(): ExposureStore {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, number[]] => Array.isArray(entry[1]))
        .map(([id, values]) => [id, values.filter((value) => Number.isFinite(value))]),
    );
  } catch {
    return {};
  }
}

function writeStore(store: ExposureStore): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage is optional; cadence must not break the dashboard.
  }
}

export function shouldSuppressForCadence(widget: DashboardWidgetDefinition, now = Date.now()): boolean {
  if (!widget.cadence) return false;
  const history = (readStore()[widget.id] ?? []).filter((timestamp) => now - timestamp <= WEEK_MS);
  const lastShown = history.at(-1);

  if (widget.cadence.cooldownDays && lastShown && now - lastShown < widget.cadence.cooldownDays * DAY_MS) {
    return true;
  }

  if (widget.cadence.maxShowsPerWeek && history.length >= widget.cadence.maxShowsPerWeek) {
    return true;
  }

  return false;
}

export function recordWidgetExposures(widgets: SelectedWidget[], now = Date.now()): void {
  const widgetsWithCadence = widgets.filter((widget) => widget.cadence);
  if (widgetsWithCadence.length === 0) return;

  const store = readStore();
  let changed = false;

  for (const widget of widgetsWithCadence) {
    const history = (store[widget.id] ?? []).filter((timestamp) => now - timestamp <= WEEK_MS);
    const lastShown = history.at(-1);
    if (lastShown && now - lastShown < SAME_VIEW_DEDUPE_MS) {
      store[widget.id] = history;
      continue;
    }
    store[widget.id] = [...history, now];
    changed = true;
  }

  if (changed) writeStore(store);
}
