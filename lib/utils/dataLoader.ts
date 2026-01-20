import { getApiEndpoint, API_ENDPOINTS } from './apiConfig';

// Cache to store loaded data
const dataCache = new Map<string, any>();

/**
 * Lazily load drug data when needed.
 * Database-First: PostgreSQL is the ONLY source of truth.
 * No static fallbacks - errors propagate to UI for proper handling.
 *
 * @returns Promise resolving to the drug data
 * @throws Error if database is unavailable
 */
export async function loadDrugData(): Promise<any> {
  const cacheKey = 'drugData';

  // Return from cache if already loaded
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  const apiUrl = getApiEndpoint(API_ENDPOINTS.DRUGS_ALL);
  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to load drugs from database: ${response.status}`);
  }

  const data = await response.json();
  dataCache.set(cacheKey, data);
  return data;
}

/**
 * Lazily load condition content when needed.
 * Uses database API endpoint exclusively - no static fallback.
 *
 * @returns Promise resolving to the condition content, or empty object if database is unavailable
 * @note Returns empty object on error to prevent app crashes. Logs errors to console.
 */
export async function loadConditionContent(): Promise<any> {
  const cacheKey = 'conditionContent';

  // Return from cache if already loaded
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  // Use the database API endpoint (same approach as lib/loadConditions.ts)
  const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);

  try {
    const response = await fetch(apiUrl);

    // Check if response is OK and is JSON before parsing
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      dataCache.set(cacheKey, data);
      console.log(
        `✓ Loaded condition content from database (${Object.keys(data).length} conditions)`
      );
      return data;
    }

    // Database API returned non-OK response
    const contentType = response.headers.get('content-type');

    if (!contentType?.includes('application/json')) {
      console.warn(`⚠ Database API returned ${contentType || 'unknown'} instead of JSON`);
      console.warn('This usually means the backend server is not running.');
      console.warn('Start with: npm run dev:all (or npm run dev:server + npm run dev)');
    } else if (response.status === 503) {
      const errorData = await response.json();
      console.error(`⚠ Database unavailable: ${errorData.message || 'Cannot connect to database'}`);
      console.error('Ensure DATABASE_URL is configured in .env');
    } else {
      console.error(`Database API returned status ${response.status} for ${apiUrl}`);
    }
  } catch (error) {
    console.error(`✗ Failed to load condition content from database API (${apiUrl}):`, error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - backend server may not be running');
      console.error('Start with: npm run dev:all (or npm run dev:server + npm run dev)');
    }
  }

  // Return empty object to prevent app crashes - no static fallback
  // Application requires database to be properly configured for full functionality
  console.warn('⚠ Returning empty dataset - condition content will not be available');
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
      const data = await response.json();
      dataCache.set(cacheKey, data);
      console.log(`✓ Loaded ${Array.isArray(data) ? data.length : 0} lab cases from database`);
      return data;
    }

    // Log warning for non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.warn('Lab cases endpoint returned non-JSON response (backend not running)');
    }
  } catch (error) {
    console.warn('Failed to load lab cases from API - this is optional content:', error);
  }

  // Return empty array as graceful fallback
  // Lab cases are optional and generated content, not critical for core functionality
  console.info('ℹ Lab cases not available (backend may not be running)');
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