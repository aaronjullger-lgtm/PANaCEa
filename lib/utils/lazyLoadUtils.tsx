/**
 * Enhanced Lazy Loading Utilities for StudyPANaCEa
 *
 * Optimized lazy loading with preloading, error handling, and performance monitoring
 */

import React, { lazy, Suspense, ComponentType } from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import Loader from '@/components/loading/Loader';

/**
 * Enhanced lazy loading with preload capability
 */
export function lazyWithPreload<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    preload?: boolean;
    fallback?: React.ReactElement;
    errorFallback?: React.ReactElement;
  } = {}
): {
  component: React.LazyExoticComponent<ComponentType<P>>;
  preload: () => Promise<void>;
} {
  // Create the lazy component
  const LazyComponent = lazy(() => {
    // Track load start time for performance monitoring
    const startTime = performance.now();

    return importFn().catch((error) => {
      console.error('Lazy load failed:', error);
      // Return a fallback component if import fails
      return {
        default: () =>
          options.errorFallback || (
            <ErrorBoundary>
              <div>Error loading component</div>
            </ErrorBoundary>
          ),
      };
    });
  });

  // Create preload function
  const preload = async () => {
    try {
      const startTime = performance.now();
      await importFn();
      const loadTime = performance.now() - startTime;
      console.log(`Preloaded component in ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('Preload failed:', error);
    }
  };

  // Auto-preload if requested
  if (options.preload) {
    // Schedule preload after a short delay to not block initial render
    setTimeout(preload, 1000);
  }

  return {
    component: LazyComponent,
    preload,
  };
}

/**
 * Lazy load with suspense wrapper for consistent UX
 */
export function lazyWithSuspense<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    fallback?: React.ReactElement;
    errorFallback?: React.ReactElement;
    preload?: boolean;
  } = {}
) {
  const { component: LazyComponent, preload } = lazyWithPreload(importFn, options);

  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <Suspense fallback={options.fallback || <Loader />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };

  return {
    component: WrappedComponent,
    preload,
  };
}

/**
 * Performance-optimized lazy loading with chunk naming
 */
export function lazyWithChunkName<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  chunkName: string,
  options: {
    preload?: boolean;
    fallback?: React.ReactElement;
  } = {}
) {
  // Add webpack chunk name comment for better debugging
  const importWithChunkName = () => {
    // @ts-ignore - webpack magic comment
    const importWithName = importFn as () => Promise<{ default: ComponentType<P> }>;
    return importFn();
  };

  return lazyWithPreload(importFn, options);
}

/**
 * Preload strategy for critical components
 */
export function createPreloadStrategy() {
  const preloadQueue: (() => Promise<void>)[] = [];
  let isPreloading = false;

  const addToQueue = (preloadFn: () => Promise<void>) => {
    preloadQueue.push(preloadFn);
  };

  const processQueue = async () => {
    if (isPreloading) return;

    isPreloading = true;

    try {
      // Process queue sequentially with delays between loads
      for (let i = 0; i < preloadQueue.length; i++) {
        const startTime = performance.now();
        const fn = preloadQueue[i];
        if (fn) await fn();
        const loadTime = performance.now() - startTime;

        // Add delay between preloads to avoid blocking
        if (i < preloadQueue.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        console.log(
          `Preloaded component ${i + 1}/${preloadQueue.length} in ${loadTime.toFixed(2)}ms`
        );
      }
    } catch (error) {
      console.error('Preload queue error:', error);
    } finally {
      isPreloading = false;
    }
  };

  // Start processing queue after initial render
  const startPreloading = () => {
    // Delay preloading until after initial paint
    requestIdleCallback(() => {
      processQueue();
    });
  };

  return {
    add: addToQueue,
    start: startPreloading,
  };
}

/**
 * Performance monitoring for lazy loaded components
 */
export function monitorLazyLoadPerformance(componentName: string, importFn: () => Promise<any>) {
  const startTime = performance.now();

  return importFn()
    .then((module) => {
      const loadTime = performance.now() - startTime;
      console.log(`[PERF] ${componentName} loaded in ${loadTime.toFixed(2)}ms`);

      // Report to analytics if available
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'lazy_load', {
          component: componentName,
          load_time: loadTime,
        });
      }

      return module;
    })
    .catch((error) => {
      console.error(`[PERF] ${componentName} failed to load:`, error);
      throw error;
    });
}

/**
 * Create optimized lazy components with all enhancements
 */
export function createOptimizedLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    componentName: string;
    preload?: boolean;
    fallback?: React.ReactElement;
    errorFallback?: React.ReactElement;
  }
) {
  const monitoredImport = () => monitorLazyLoadPerformance(options.componentName, importFn);

  return lazyWithSuspense(monitoredImport, {
    preload: options.preload,
    fallback: options.fallback,
    errorFallback: options.errorFallback,
  });
}

/**
 * Global preload strategy for the application
 */
export const globalPreloadStrategy = createPreloadStrategy();

/**
 * Preload all critical components
 */
export function preloadCriticalComponents() {
  // This would be called after initial app render
  // Example usage in App.tsx:
  // useEffect(() => {
  //   preloadCriticalComponents();
  // }, []);
}

/**
 * Lazy load with retry capability
 */
export function lazyWithRetry<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    fallback?: React.ReactElement;
  } = {}
) {
  const { maxRetries = 2, retryDelay = 1000, fallback } = options;

  const importWithRetry = async (attempt = 1): Promise<{ default: ComponentType<P> }> => {
    try {
      return await importFn();
    } catch (error) {
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed, retrying in ${retryDelay}ms...`, error);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return importWithRetry(attempt + 1);
      }
      console.error(`All ${maxRetries} attempts failed:`, error);
      throw error;
    }
  };

  return lazyWithSuspense(importWithRetry, { fallback });
}
