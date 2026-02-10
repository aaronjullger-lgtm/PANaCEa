/**
 * Client-side logger for Console Ninja–friendly output.
 * - Dev: debug/info/warn/error all go to console with a consistent tag.
 * - Prod: only warn and error are emitted to reduce noise; debug/info are no-op.
 */

const TAG = '[PANaCEa]';
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

function formatPayload(payload: unknown): string {
  if (payload === undefined) return '';
  if (payload instanceof Error) {
    return ` ${payload.message}${payload.stack ? '\n' + payload.stack : ''}`;
  }
  if (typeof payload === 'object' && payload !== null) {
    try {
      return ' ' + JSON.stringify(payload);
    } catch {
      return ' [object not serializable]';
    }
  }
  return ' ' + String(payload);
}

function formatMessage(scope: string, message: string, payload?: unknown): string {
  const prefix = scope ? `${TAG} [${scope}]` : TAG;
  const suffix = formatPayload(payload);
  return `${prefix} ${message}${suffix}`;
}

export const logger = {
  debug(scope: string, message: string, payload?: unknown): void {
    if (isDev && typeof console.debug === 'function') {
      console.debug(formatMessage(scope, message, payload));
    }
  },

  info(scope: string, message: string, payload?: unknown): void {
    if (isDev && typeof console.info === 'function') {
      console.info(formatMessage(scope, message, payload));
    }
  },

  warn(scope: string, message: string, payload?: unknown): void {
    if (typeof console.warn === 'function') {
      console.warn(formatMessage(scope, message, payload));
    }
  },

  error(scope: string, message: string, payload?: unknown): void {
    if (typeof console.error === 'function') {
      console.error(formatMessage(scope, message, payload));
    }
  },
};
