/**
 * Service Worker Registration Utility
 * 
 * Handles service worker registration, updates, and lifecycle management.
 */

/**
 * Configuration for service worker
 */
interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Register the service worker
 */
export async function register(config?: ServiceWorkerConfig): Promise<void> {
  if (!isServiceWorkerSupported()) {
    console.log('Service workers are not supported in this browser');
    return;
  }
  
  // Only register in production or when explicitly enabled
  if ((import.meta as any).env.MODE === 'development' && !(import.meta as any).env.VITE_ENABLE_SW) {
    console.log('Service worker disabled in development mode');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    
    console.log('Service Worker registered successfully:', registration);
    
    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Check every hour
    
    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.log('New service worker available');
            config?.onUpdate?.(registration);
          } else if (newWorker.state === 'activated') {
            // Service worker activated
            console.log('Service worker activated');
            config?.onSuccess?.(registration);
          }
        });
      }
    });
    
    // Listen for controller change (new SW took over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service worker controller changed');
      // Optionally reload the page to get new content
      if (config?.onUpdate) {
        window.location.reload();
      }
    });
    
    // Setup online/offline listeners
    window.addEventListener('online', () => {
      console.log('Application is online');
      config?.onOnline?.();
    });
    
    window.addEventListener('offline', () => {
      console.log('Application is offline');
      config?.onOffline?.();
    });
    
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}

/**
 * Unregister the service worker
 */
export async function unregister(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.unregister();
    console.log('Service Worker unregistered successfully');
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
  }
}

/**
 * Skip waiting and activate new service worker immediately
 */
export async function skipWaiting(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }
  
  const registration = await navigator.serviceWorker.ready;
  
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Clear all caches
 */
export async function clearCaches(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'CLEAR_CACHE' });
    
    // Also clear cache storage directly
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('All caches cleared');
    }
  } catch (error) {
    console.error('Failed to clear caches:', error);
  }
}

/**
 * Check if the app is currently offline
 */
export function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Get cache size information
 */
export async function getCacheInfo(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;
    
    return {
      usage,
      quota,
      percentage: Math.round(percentage * 100) / 100,
    };
  }
  
  return { usage: 0, quota: 0, percentage: 0 };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Request persistent storage permission
 * Prevents cache eviction by the browser
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`Storage persistence: ${isPersisted ? 'granted' : 'denied'}`);
      return isPersisted;
    } catch (error) {
      console.error('Failed to request persistent storage:', error);
      return false;
    }
  }
  
  return false;
}

/**
 * Check if storage is persisted
 */
export async function isStoragePersisted(): Promise<boolean> {
  if ('storage' in navigator && 'persisted' in navigator.storage) {
    return await navigator.storage.persisted();
  }
  
  return false;
}

/**
 * Show update notification to user
 * Returns a promise that resolves when user accepts the update
 */
export function showUpdateNotification(): Promise<boolean> {
  return new Promise((resolve) => {
    // You can implement a custom notification UI here
    const shouldUpdate = confirm(
      'A new version of PANaCEa is available. Would you like to update now?'
    );
    
    if (shouldUpdate) {
      skipWaiting().then(() => {
        resolve(true);
      });
    } else {
      resolve(false);
    }
  });
}
