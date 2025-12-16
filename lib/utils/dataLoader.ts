import { getApiEndpoint, API_ENDPOINTS } from './apiConfig';

// Cache to store loaded data
const dataCache = new Map<string, any>();

/**
 * Lazily load drug data when needed.
 * Uses database API endpoint with fallback to static registry.
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
    const response = await fetch('/api/drugs');
    
    // Check if response is OK and is JSON before parsing
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      dataCache.set(cacheKey, data);
      return data;
    }
  } catch (error) {
    console.warn('Failed to load drug data from API, using static registry:', error);
  }
  
  // Fallback to static drug registry
  try {
    const { getAllDrugs } = await import('../../drugRegistry');
    const drugMetas = getAllDrugs();
    
    // Convert to expected format
    const drugs = drugMetas.map((meta) => ({
      id: `drug_${meta.genericName.toLowerCase().replace(/\s+/g, '_')}`,
      genericName: meta.genericName,
      brandName: meta.brandName || null,
      drugClass: meta.drugClass,
      mechanismOfAction: meta.mechanismOfAction || null,
      indications: meta.indications || [],
      contraindications: meta.contraindications || [],
      sideEffects: meta.commonSideEffects || [],
      isHighYield: meta.isHighYield
    }));
    
    dataCache.set(cacheKey, drugs);
    return drugs;
  } catch (fallbackError) {
    console.error('Failed to load static drug registry:', fallbackError);
    throw new Error('Unable to load drug data from any source.');
  }
}

/**
 * Lazily load condition content when needed.
 * Uses database API endpoint with fallback to static JSON file.
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
    const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);
    
    const response = await fetch(apiUrl);
    
    // Check if response is OK and is JSON before parsing
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      dataCache.set(cacheKey, data);
      return data;
    }
    
    console.warn('Database API not available, attempting to load static JSON');
  } catch (error) {
    console.warn('Failed to load condition content from API:', error);
  }
  
  // Fallback to static JSON file
  try {
    const response = await fetch('/data/conditionContent.clean.json');
    
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const dataArray = await response.json();
      
      // Convert array format to map format (conditionId -> content)
      const contentMap: Record<string, any> = {};
      if (Array.isArray(dataArray)) {
        dataArray.forEach((item: any) => {
          if (item.conditionId && item.content) {
            contentMap[item.conditionId] = item.content;
          }
        });
      }
      
      dataCache.set(cacheKey, contentMap);
      return contentMap;
    }
  } catch (fallbackError) {
    console.warn('Failed to load static condition content:', fallbackError);
  }
  
  // Return empty object - content will be loaded on-demand via database queries
  console.warn('Condition content not available from any source, returning empty dataset');
  return {};
}

/**
 * Lazily load lab cases data when needed.
 * Uses database API endpoint with graceful fallback.
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
    const response = await fetch('/api/labs/cases');
    
    // Check if response is OK and is JSON before parsing
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      dataCache.set(cacheKey, data);
      return data;
    }
  } catch (error) {
    console.warn('Failed to load lab cases from API:', error);
  }
  
  // Return empty array as graceful fallback
  // Lab cases are optional and generated content, not critical for core functionality
  console.warn('Lab cases not available, returning empty dataset');
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
