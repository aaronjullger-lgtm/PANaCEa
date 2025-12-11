/**
 * Data Loader Utility
 * 
 * Provides lazy loading and caching for large data files to improve
 * initial bundle size and application performance.
 */

// Cache to store loaded data
const dataCache = new Map<string, any>();

/**
 * Lazily load drug data when needed.
 * Uses dynamic import to keep it out of the main bundle.
 * 
 * @returns Promise resolving to the drug data
 */
export async function loadDrugData(): Promise<any> {
  const cacheKey = 'drugData';
  
  // Return from cache if already loaded
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }
  
  try {
    const module = await import('../../pharm/drugData.json');
    const data = module.default;
    dataCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Failed to load drug data:', error);
    throw new Error('Unable to load drug data. Please try again.');
  }
}

/**
 * Lazily load condition content when needed.
 * Now uses database API endpoint instead of static JSON file.
 * 
 * @returns Promise resolving to the condition content
 */
export async function loadConditionContent(): Promise<any> {
  const cacheKey = 'conditionContent';
  
  // Return from cache if already loaded
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }
  
  try {
    // Use the database API endpoint (same approach as lib/loadConditions.ts)
    const apiUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || 
                    (typeof process !== 'undefined' && process.env?.VITE_API_URL) || 
                    'http://localhost:3001';
    
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/content/all`);
    
    if (response.ok) {
      const data = await response.json();
      dataCache.set(cacheKey, data);
      return data;
    }
    
    console.warn('Database API not available, condition content will be loaded on-demand');
    // Return empty object - content will be loaded on-demand via database queries
    return {};
  } catch (error) {
    console.warn('Failed to load condition content from API, will use on-demand loading:', error);
    // Return empty object - content will be loaded on-demand via database queries
    return {};
  }
}

/**
 * Lazily load lab cases data when needed.
 * Uses dynamic import to keep it out of the main bundle.
 * 
 * @returns Promise resolving to the lab cases data
 */
export async function loadLabCases(): Promise<any> {
  const cacheKey = 'labCases';
  
  // Return from cache if already loaded
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }
  
  try {
    const module = await import('../../src/data/labCases.json');
    const data = module.default;
    dataCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Failed to load lab cases:', error);
    throw new Error('Unable to load lab cases data. Please try again.');
  }
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
