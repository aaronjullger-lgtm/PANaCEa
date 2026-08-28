export interface ApiEnvelope<T = unknown> {
  ok?: boolean;
  success?: boolean;
  data?: T;
  error?: string | { message?: string; details?: unknown };
  message?: string;
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('data' in value || 'ok' in value || 'success' in value || 'error' in value)
  );
}

export function getApiEnvelopeError(json: unknown, fallback = 'Request failed'): string {
  if (!isApiEnvelope(json)) return fallback;
  if (typeof json.error === 'string') return json.error;
  return json.error?.message ?? json.message ?? fallback;
}

export function unwrapApiEnvelope<T>(json: unknown): T {
  if (isApiEnvelope<T>(json)) {
    if (json.ok === false || json.success === false) {
      throw new Error(getApiEnvelopeError(json));
    }
    if ('data' in json) return json.data as T;
  }
  return json as T;
}

export function unwrapApiEnvelopeArrayField<T>(json: unknown, field: string): T[] {
  const payload = unwrapApiEnvelope<unknown>(json);

  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (typeof payload !== 'object' || payload === null) {
    return [];
  }

  const value = (payload as Record<string, unknown>)[field];
  return Array.isArray(value) ? (value as T[]) : [];
}
