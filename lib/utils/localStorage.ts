/**
 * Optimized localStorage utilities with caching and batching
 * 
 * Provides performance-optimized wrappers around localStorage operations
 * with in-memory caching to reduce expensive JSON parse/stringify operations.
 */

// Cache for frequently accessed localStorage items
const storageCache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Get an item from localStorage with caching
 * @param key - The localStorage key
 * @param defaultValue - Default value if key doesn't exist
 * @param ttl - Cache time-to-live in milliseconds (default: 5000ms)
 * @returns The parsed value or default
 */
export function getCachedItem<T>(key: string, defaultValue: T, ttl: number = CACHE_TTL): T {
  if (typeof window === 'undefined') return defaultValue;

  // Check cache first
  const cached = storageCache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < ttl) {
    return cached.value as T;
  }

  // Read from localStorage
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      storageCache.set(key, { value: defaultValue, timestamp: now });
      return defaultValue;
    }
    
    const parsed = JSON.parse(raw) as T;
    storageCache.set(key, { value: parsed, timestamp: now });
    return parsed;
  } catch (error) {
    console.error(`Failed to parse localStorage item "${key}":`, error);
    storageCache.set(key, { value: defaultValue, timestamp: now });
    return defaultValue;
  }
}

/**
 * Set an item in localStorage and update cache
 * @param key - The localStorage key
 * @param value - The value to store
 */
export function setCachedItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    storageCache.set(key, { value, timestamp: Date.now() });
  } catch (error) {
    console.error(`Failed to save localStorage item "${key}":`, error);
  }
}

/**
 * Remove an item from localStorage and cache
 * @param key - The localStorage key
 */
export function removeCachedItem(key: string): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(key);
  storageCache.delete(key);
}

/**
 * Clear a specific cache entry (useful when you know the value changed externally)
 * @param key - The localStorage key
 */
export function invalidateCache(key: string): void {
  storageCache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  storageCache.clear();
}

/**
 * Batch set multiple localStorage items at once
 * This is more efficient than multiple individual sets
 * @param items - Array of {key, value} pairs to set
 */
export function batchSetItems<T = any>(items: Array<{ key: string; value: T }>): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  
  items.forEach(({ key, value }) => {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      storageCache.set(key, { value, timestamp: now });
    } catch (error) {
      console.error(`Failed to save localStorage item "${key}":`, error);
    }
  });
}

/**
 * Get the current cache size (for debugging)
 */
export function getCacheSize(): number {
  return storageCache.size;
}

/**
 * Get all cached keys (for debugging)
 */
export function getCachedKeys(): string[] {
  return Array.from(storageCache.keys());
}
