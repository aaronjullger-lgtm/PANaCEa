import { getApiEndpoint, API_ENDPOINTS } from './apiConfig';
import { parseJsonOrThrow } from './safeJsonResponse';
import { logger } from "@/lib/simple-logger";

// Cache to store loaded data
const dataCache = new Map<string, any>();
const dataLoaderLogger = logger.scope('dataLoader');

/** Log "backend not running" once per session to avoid console spam when API is down. */
let backendDownWarned = false;
function warnBackendDownOnce(): void {
  if (backendDownWarned) return;
  backendDownWarned = true;
  console.warn(
    '⚠ API backend not available. For full data, run: npm run dev:all (or npm run dev:server + npm run dev)'
  );
}

/**
 * Lazily load drug data when needed.
 * Database-First: PostgreSQL is the ONLY source of truth.
 * No static fallbacks - errors propagate to UI for proper handling.
 *
 * @param getToken - Optional function to get auth token (from Clerk's useAuth hook)
 * @returns Promise resolving to the drug data
 * @throws Error if database is unavailable
 */
export async function loadDrugData(getToken?: () => Promise<string | null>): Promise<any> {
  const cacheKey = 'drugData';

  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (getToken) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // Try /api/drugs/all first, fallback to /api/drugs when only root exists
  const urls = [getApiEndpoint(API_ENDPOINTS.DRUGS_ALL), getApiEndpoint(API_ENDPOINTS.DRUGS)];

  for (const apiUrl of urls) {
    try {
      const response = await fetch(apiUrl, { headers });
      if (!response.ok) continue;

      const raw = (await parseJsonOrThrow(response)) as unknown;
      const data = Array.isArray(raw)
        ? raw
        : ((raw as { data?: { drugs?: unknown[] }; drugs?: unknown[] })?.data?.drugs ??
          (raw as { drugs?: unknown[] })?.drugs ??
          []);
      dataCache.set(cacheKey, data);
      return data;
    } catch {
      continue;
    }
  }

  if (typeof window !== 'undefined') {
    warnBackendDownOnce();
  }
  const empty: never[] = [];
  dataCache.set(cacheKey, empty);
  return empty;
}

/**
 * Lazily load condition content when needed.
 * Uses database API endpoint exclusively - no static fallback.
 *
 * @param getToken - Optional function to get auth token (from Clerk's useAuth hook)
 * @returns Promise resolving to the condition content, or empty object if database is unavailable
 * @note Returns empty object on error to prevent app crashes. Logs errors to console.
 */
export async function loadConditionContent(getToken?: () => Promise<string | null>): Promise<any> {
  const cacheKey = 'conditionContent';

  // Return from cache if already loaded
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  // Use the database API endpoint (same approach as lib/loadConditions.ts)
  const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);

  // Build headers with auth token if available
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (getToken) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(apiUrl, { headers });

    // Check if response is OK and is JSON before parsing
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = (await parseJsonOrThrow(response)) as Record<string, unknown>;
      dataCache.set(cacheKey, data);
      dataLoaderLogger.debug('Loaded condition content', {
        conditions: Object.keys(data).length,
      });
      return data;
    }

    // Database API returned non-OK response
    const contentType = response.headers.get('content-type');

    if (response.status === 429) {
      dataLoaderLogger.warn('Rate limited (429) for /api/content/all – retry later');
      warnBackendDownOnce();
    } else if (!contentType?.includes('application/json')) {
      warnBackendDownOnce();
    } else if (response.status === 503) {
      try {
        const errorData = (await parseJsonOrThrow(response).catch(() => ({}))) as {
          message?: string;
        };
        dataLoaderLogger.warn('Database unavailable', {
          message: errorData?.message || 'Cannot connect to database',
        });
      } catch {
        dataLoaderLogger.warn('Database unavailable (503)');
      }
    } else {
      dataLoaderLogger.warn('Content API returned non-OK status', {
        status: response.status,
        apiUrl,
      });
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      warnBackendDownOnce();
    } else {
      dataLoaderLogger.error('Failed to load condition content', { error, apiUrl });
    }
  }

  // Return empty object to prevent app crashes - no static fallback
  warnBackendDownOnce();
  return {};
}

/**
 * Lazily load lab cases data when needed.
 * Uses database API endpoint with graceful fallback.
 *
 * @param getToken - Optional function to get auth token (from Clerk's useAuth hook)
 * @returns Promise resolving to the lab cases data
 */
export async function loadLabCases(getToken?: () => Promise<string | null>): Promise<any> {
  const cacheKey = 'labCases';

  // Return from cache if already loaded
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  try {
    const apiUrl = getApiEndpoint(API_ENDPOINTS.LABS_CASES);

    // Build headers with auth token if available
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (getToken) {
      const token = await getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(apiUrl, { headers });

    // Check if response is OK and is JSON before parsing
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const responseData = (await parseJsonOrThrow(response)) as { data?: unknown } | unknown[];
      // Handle wrapped response format { success: true, data: [...] }
      const data = Array.isArray(responseData)
        ? responseData
        : ((responseData as { data?: unknown }).data ?? responseData);
      const cases = Array.isArray(data) ? data : [];
      dataCache.set(cacheKey, cases);
      dataLoaderLogger.debug('Loaded lab cases from database', { count: cases.length });
      return cases;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      warnBackendDownOnce();
    }
  } catch {
    warnBackendDownOnce();
  }

  // Return empty array as graceful fallback
  const emptyData: any[] = [];
  dataCache.set(cacheKey, emptyData);
  return emptyData;
}

/**
 * Preload data in the background to improve perceived performance.
 * Call this after the initial app load to warm up the cache.
 * Uses requestIdleCallback for better performance if available.
 */
export function preloadData(): void {
  const preloadTask = () => {
    // Load data in order of likely usage (most common first)
    loadConditionContent().catch(() => {
      // Silently fail - will retry when actually needed
    });

    // Delay drug data slightly to prioritize condition content
    setTimeout(() => {
      loadDrugData().catch(() => {
        // Silently fail - will retry when actually needed
      });
    }, 500);

    // Lab cases are least commonly used, load last
    setTimeout(() => {
      loadLabCases().catch(() => {
        // Silently fail - will retry when actually needed
      });
    }, 1000);
  };

  // Use requestIdleCallback if available for better performance
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(preloadTask, { timeout: 3000 });
  } else {
    // Fallback to setTimeout with slightly longer delay for older browsers
    setTimeout(preloadTask, 2000);
  }
}

/**
 * Clear the data cache. Useful for testing or forcing a reload.
 */
export function clearDataCache(): void {
  dataCache.clear();
}

/**
 * Get the current cache size (number of loaded datasets).
 */
export function getCacheSize(): number {
  return dataCache.size;
}
