/**
 * Recent training modes — shared between Command Palette and Practice page.
 * Single source for localStorage key and read/write helpers.
 */

const RECENT_MODES_KEY = 'panceai_recent_modes';
export const MAX_RECENT_MODES = 8;

export function getRecentModeIds(): string[] {
  if (typeof globalThis.window === 'undefined') return [];
  try {
    const raw = globalThis.localStorage.getItem(RECENT_MODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function recordRecentMode(modeId: string): void {
  if (typeof globalThis.window === 'undefined') return;
  try {
    const recent = getRecentModeIds();
    const updated = [modeId, ...recent.filter((id) => id !== modeId)].slice(
      0,
      MAX_RECENT_MODES
    );
    globalThis.localStorage.setItem(RECENT_MODES_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}
