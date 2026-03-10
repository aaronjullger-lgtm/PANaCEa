/**
 * Standardized API Response helper for PANaCEa
 *
 * Format: { success, data?, error?, message?, timestamp }
 *
 * Usage:
 *   return jsonSuccess(myData);
 *   return jsonError('Not found', 404);
 */

export interface APIResponseSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface APIResponseError {
  success: false;
  error: string;
  message: string;
  timestamp: string;
  code?: string;
  details?: unknown;
}

export type APIResponse<T = unknown> = APIResponseSuccess<T> | APIResponseError;

/**
 * Create a successful JSON Response with standardized shape
 */
export function jsonSuccess<T>(
  data: T,
  options?: {
    status?: number;
    message?: string;
    headers?: Record<string, string>;
  }
): Response {
  const body: APIResponseSuccess<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  if (options?.message) body.message = options.message;

  return new Response(JSON.stringify(body), {
    status: options?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

/**
 * Create an error JSON Response with standardized shape
 */
export function jsonError(
  message: string,
  status: number = 500,
  options?: {
    code?: string;
    details?: unknown;
    headers?: Record<string, string>;
  }
): Response {
  const body: APIResponseError = {
    success: false,
    error: options?.code ?? 'ERROR',
    message,
    timestamp: new Date().toISOString(),
  };
  if (options?.details !== undefined) body.details = options.details;

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}
