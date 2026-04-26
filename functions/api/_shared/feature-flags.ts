import { fail } from './api-response';
import { ErrorCode } from './error-catalog';

type FeatureEnv = Record<string, unknown> | undefined | null;

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isFeatureEnabled(env: FeatureEnv, key: string): boolean {
  const raw = env?.[key];
  if (typeof raw === 'boolean') return raw;
  if (raw == null) return false;
  return ENABLED_VALUES.has(String(raw).trim().toLowerCase());
}

export function featureDisabledResponse(
  request: Request | undefined,
  message: string,
  status = 404
): Response {
  return fail(ErrorCode.FEATURE_DISABLED, {
    message,
    request,
    status,
  });
}
