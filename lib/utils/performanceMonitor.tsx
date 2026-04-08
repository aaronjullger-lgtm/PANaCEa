/**
 * Performance Monitoring Utilities
 * Track bundle size, load times, and runtime performance
 */

import { useEffect, useRef, useState } from 'react';

// ============================================================================
// BUNDLE ANALYSIS
// ============================================================================

export interface BundleMetrics {
  /** Total bundle size in bytes */
  totalSize: number;
  /** JavaScript bundle size */
  jsSize: number;
  /** CSS bundle size */
  cssSize: number;
  /** Number of chunks */
  chunkCount: number;
  /** Largest chunk size */
  largestChunk: number;
  /** Average chunk size */
  averageChunk: number;
  /** Compression ratio (gzip) */
  compressionRatio: number;
}

export interface PerformanceMetrics {
  /** First Contentful Paint (FCP) in ms */
  fcp: number;
  /** Largest Contentful Paint (LCP) in ms */
  lcp: number;
  /** First Input Delay (FID) in ms */
  fid: number;
  /** Cumulative Layout Shift (CLS) */
  cls: number;
  /** Time to Interactive (TTI) in ms */
  tti: number;
  /** Total Blocking Time (TBT) in ms */
  tbt: number;
  /** Speed Index */
  speedIndex: number;
}

/**
 * Estimate bundle size from performance entries
 */
export function estimateBundleMetrics(): BundleMetrics {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) {
    return {
      totalSize: 0,
      jsSize: 0,
      cssSize: 0,
      chunkCount: 0,
      largestChunk: 0,
      averageChunk: 0,
      compressionRatio: 0.7, // Default estimate
    };
  }

  const resources = performance.getEntriesByType('resource');
  let totalSize = 0;
  let jsSize = 0;
  let cssSize = 0;
  const chunks: number[] = [];

  resources.forEach((resource: any) => {
    const url = resource.name;
    const size = resource.transferSize || resource.encodedBodySize || 0;

    if (url.includes('.js') && !url.includes('hot-update')) {
      jsSize += size;
      chunks.push(size);
    } else if (url.includes('.css')) {
      cssSize += size;
    }

    totalSize += size;
  });

  const chunkCount = chunks.length;
  const largestChunk = Math.max(...chunks, 0);
  const averageChunk = chunkCount > 0 ? chunks.reduce((a, b) => a + b, 0) / chunkCount : 0;

  return {
    totalSize,
    jsSize,
    cssSize,
    chunkCount,
    largestChunk,
    averageChunk,
    compressionRatio: totalSize > 0 ? (totalSize - jsSize - cssSize) / totalSize : 0.7,
  };
}

/**
 * Hook to track bundle metrics
 */
export function useBundleMetrics(): BundleMetrics {
  const [metrics, setMetrics] = useState<BundleMetrics>(() => estimateBundleMetrics());

  useEffect(() => {
    // Update metrics after all resources are loaded
    const updateMetrics = () => {
      setTimeout(() => {
        setMetrics(estimateBundleMetrics());
      }, 1000);
    };

    if (document.readyState === 'complete') {
      updateMetrics();
    } else {
      window.addEventListener('load', updateMetrics);
      return () => window.removeEventListener('load', updateMetrics);
    }
  }, []);

  return metrics;
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Track Core Web Vitals
 */
export function trackCoreWebVitals(): PerformanceMetrics | null {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return null;
  }

  const metrics: Partial<PerformanceMetrics> = {};

  try {
    // FCP (First Contentful Paint)
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcpEntry) {
      metrics.fcp = Math.round(fcpEntry.startTime);
    }

    // LCP (Largest Contentful Paint)
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      metrics.lcp = Math.round(lastEntry.startTime);
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      metrics.cls = clsValue;
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    // FID (First Input Delay)
    const fidObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        metrics.fid = Math.round(entry.processingStart - entry.startTime);
        break;
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });

    // Calculate TTI (Time to Interactive) - approximation
    const longTasks = performance.getEntriesByType('long-task');
    if (longTasks.length > 0) {
      const lastLongTask = longTasks[longTasks.length - 1];
      metrics.tti = Math.round(lastLongTask.startTime + lastLongTask.duration);
    }

    // Calculate TBT (Total Blocking Time)
    let tbt = 0;
    longTasks.forEach((task: any) => {
      const blockingTime = task.duration - 50; // Tasks > 50ms are blocking
      if (blockingTime > 0) {
        tbt += blockingTime;
      }
    });
    metrics.tbt = Math.round(tbt);

    // Speed Index approximation
    const paintEntries = performance.getEntriesByType('paint');
    if (paintEntries.length > 0) {
      const lastPaint = paintEntries[paintEntries.length - 1];
      metrics.speedIndex = Math.round(lastPaint.startTime);
    }

    return metrics as PerformanceMetrics;
  } catch (error) {
    console.warn('Performance monitoring failed:', error);
    return null;
  }
}

/**
 * Hook to track performance metrics
 */
export function usePerformanceMetrics(): PerformanceMetrics | null {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    const measuredMetrics = trackCoreWebVitals();
    if (measuredMetrics) {
      setMetrics(measuredMetrics);
    }

    // Also track runtime performance
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'measure') {
          console.debug(`Performance measure: ${entry.name} = ${Math.round(entry.duration)}ms`);
        }
      });
    });
    observer.observe({ entryTypes: ['measure'] });

    return () => observer.disconnect();
  }, []);

  return metrics;
}

// ============================================================================
// CODE SPLITTING OPTIMIZATION
// ============================================================================

export interface ChunkAnalysis {
  /** Chunk name or ID */
  name: string;
  /** Size in bytes */
  size: number;
  /** Whether this chunk is loaded */
  loaded: boolean;
  /** Load time in ms */
  loadTime?: number;
  /** Dependencies */
  dependencies: string[];
}

/**
 * Analyze webpack chunks (if available)
 */
export function analyzeChunks(): ChunkAnalysis[] {
  if (!(window as any).__webpack_chunk_load__) {
    return [];
  }

  const chunks: ChunkAnalysis[] = [];
  const webpackJsonp = (window as any).webpackJsonp;

  if (webpackJsonp && Array.isArray(webpackJsonp)) {
    webpackJsonp.forEach((chunk: any) => {
      if (chunk && chunk[0] && chunk[1]) {
        const chunkId = chunk[0];
        const modules = chunk[1];

        // Estimate size from module count
        const size = Object.keys(modules).length * 1024; // Rough estimate

        chunks.push({
          name: `chunk-${chunkId}`,
          size,
          loaded: true,
          dependencies: [],
        });
      }
    });
  }

  return chunks;
}

/**
 * Preload critical chunks
 */
export function preloadCriticalChunks(chunkNames: string[]): Promise<void[]> {
  const promises = chunkNames.map((chunkName) => {
    return new Promise<void>((resolve) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = `/assets/${chunkName}.js`;
      link.onload = () => resolve();
      link.onerror = () => resolve(); // Don't fail on error
      document.head.appendChild(link);
    });
  });

  return Promise.all(promises);
}

/**
 * Lazy load component with retry and timeout
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  timeout = 10000
): React.LazyExoticComponent<T> {
  return React.lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const load = (attempt = 1) => {
        const timer = setTimeout(() => {
          if (attempt < retries) {
            console.warn(`Lazy load timeout, retrying (${attempt}/${retries})`);
            load(attempt + 1);
          } else {
            reject(new Error(`Lazy load failed after ${retries} attempts`));
          }
        }, timeout);

        importFn()
          .then((module) => {
            clearTimeout(timer);
            resolve(module);
          })
          .catch((error) => {
            clearTimeout(timer);
            if (attempt < retries) {
              console.warn(`Lazy load failed, retrying (${attempt}/${retries})`, error);
              load(attempt + 1);
            } else {
              reject(error);
            }
          });
      };

      load();
    });
  });
}

// ============================================================================
// MEMORY MONITORING
// ============================================================================

export interface MemoryMetrics {
  /** Total JS heap size */
  totalJSHeapSize: number;
  /** Used JS heap size */
  usedJSHeapSize: number;
  /** JS heap size limit */
  jsHeapSizeLimit: number;
  /** Memory usage percentage */
  usagePercentage: number;
}

/**
 * Get memory usage (if supported)
 */
export function getMemoryMetrics(): MemoryMetrics | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }
  return null;
}

/**
 * Hook to monitor memory usage
 */
export function useMemoryMonitor(interval = 5000): MemoryMetrics | null {
  const [metrics, setMetrics] = useState<MemoryMetrics | null>(() => getMemoryMetrics());

  useEffect(() => {
    const updateMetrics = () => {
      const newMetrics = getMemoryMetrics();
      if (newMetrics) {
        setMetrics(newMetrics);
      }
    };

    const timer = setInterval(updateMetrics, interval);
    return () => clearInterval(timer);
  }, [interval]);

  return metrics;
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Measure execution time of a function
 */
export function measureExecution<T>(fn: () => T, label: string): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;

  performance.measure(label, { start, end });
  console.debug(`⏱️ ${label}: ${duration.toFixed(2)}ms`);

  return { result, duration };
}

/**
 * Debounce function with performance tracking
 */
export function debounceWithMetrics<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  label: string
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  let callCount = 0;
  let totalDelay = 0;

  return (...args: Parameters<T>) => {
    callCount++;
    totalDelay += delay;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      const start = performance.now();
      fn(...args);
      const end = performance.now();
      const executionTime = end - start;

      console.debug(
        `⏱️ ${label}: ${executionTime.toFixed(2)}ms execution, ${callCount} calls debounced`
      );
      callCount = 0;
      totalDelay = 0;
    }, delay);
  };
}

/**
 * Throttle function with performance tracking
 */
export function throttleWithMetrics<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
  label: string
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let callCount = 0;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      callCount++;
      const start = performance.now();
      fn(...args);
      const end = performance.now();
      const executionTime = end - start;

      console.debug(
        `⏱️ ${label}: ${executionTime.toFixed(2)}ms execution, ${callCount} calls throttled`
      );

      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        callCount = 0;
      }, limit);
    }
  };
}

/**
 * Create performance mark
 */
export function mark(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
}

/**
 * Measure between two marks
 */
export function measure(name: string, startMark: string, endMark: string): number | null {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name);
      if (entries.length > 0) {
        return entries[0].duration;
      }
    } catch (error) {
      // Marks might not exist
    }
  }
  return null;
}

// ============================================================================
// BUNDLE SIZE OPTIMIZATION RECOMMENDATIONS
// ============================================================================

export interface BundleOptimization {
  /** Issue description */
  issue: string;
  /** Severity: low, medium, high, critical */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Recommendation */
  recommendation: string;
  /** Estimated savings */
  estimatedSavings: string;
}

/**
 * Analyze bundle for optimization opportunities
 */
export function analyzeBundleOptimizations(metrics: BundleMetrics): BundleOptimization[] {
  const optimizations: BundleOptimization[] = [];

  // Check total bundle size
  if (metrics.totalSize > 2 * 1024 * 1024) {
    // > 2MB
    optimizations.push({
      issue: 'Bundle size exceeds 2MB',
      severity: 'high',
      recommendation: 'Implement more aggressive code splitting and tree shaking',
      estimatedSavings: '500KB-1MB',
    });
  }

  // Check largest chunk size
  if (metrics.largestChunk > 500 * 1024) {
    // > 500KB
    optimizations.push({
      issue: `Largest chunk is ${(metrics.largestChunk / 1024).toFixed(0)}KB`,
      severity: 'medium',
      recommendation: 'Split large chunks into smaller, focused chunks',
      estimatedSavings: `${Math.round((metrics.largestChunk * 0.3) / 1024)}KB`,
    });
  }

  // Check chunk count
  if (metrics.chunkCount < 5) {
    optimizations.push({
      issue: 'Too few chunks - may be loading unnecessary code',
      severity: 'medium',
      recommendation: 'Implement route-based code splitting',
      estimatedSavings: 'Varies by route',
    });
  } else if (metrics.chunkCount > 20) {
    optimizations.push({
      issue: 'Too many chunks - may cause HTTP overhead',
      severity: 'low',
      recommendation: 'Merge small chunks or implement chunk grouping',
      estimatedSavings: 'Reduced HTTP requests',
    });
  }

  // Check compression
  if (metrics.compressionRatio < 0.6) {
    optimizations.push({
      issue: 'Low compression ratio',
      severity: 'medium',
      recommendation: 'Ensure gzip/brotli compression is enabled on server',
      estimatedSavings: `${Math.round((metrics.totalSize * 0.3) / 1024)}KB`,
    });
  }

  return optimizations;
}

// ============================================================================
// PERFORMANCE DASHBOARD COMPONENT
// ============================================================================

import React from 'react';

export const PerformanceDashboard: React.FC = () => {
  const bundleMetrics = useBundleMetrics();
  const performanceMetrics = usePerformanceMetrics();
  const memoryMetrics = useMemoryMonitor();
  const optimizations = analyzeBundleOptimizations(bundleMetrics);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 space-y-6">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
        Performance Dashboard
      </h3>

      {/* Bundle Metrics */}
      <div className="space-y-3">
        <h4 className="font-medium text-[var(--color-text-primary)]">Bundle Metrics</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
            <div className="text-sm text-[var(--color-text-muted)]">Total Size</div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {formatBytes(bundleMetrics.totalSize)}
            </div>
          </div>
          <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
            <div className="text-sm text-[var(--color-text-muted)]">JS Size</div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {formatBytes(bundleMetrics.jsSize)}
            </div>
          </div>
          <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
            <div className="text-sm text-[var(--color-text-muted)]">Chunks</div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {bundleMetrics.chunkCount}
            </div>
          </div>
          <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
            <div className="text-sm text-[var(--color-text-muted)]">Largest Chunk</div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {formatBytes(bundleMetrics.largestChunk)}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      {performanceMetrics && (
        <div className="space-y-3">
          <h4 className="font-medium text-[var(--color-text-primary)]">Core Web Vitals</h4>
          <div className="grid grid-cols-2 gap-3">
            {performanceMetrics.fcp && (
              <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
                <div className="text-sm text-[var(--color-text-muted)]">FCP</div>
                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {formatTime(performanceMetrics.fcp)}
                </div>
              </div>
            )}
            {performanceMetrics.lcp && (
              <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
                <div className="text-sm text-[var(--color-text-muted)]">LCP</div>
                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {formatTime(performanceMetrics.lcp)}
                </div>
              </div>
            )}
            {performanceMetrics.fid && (
              <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
                <div className="text-sm text-[var(--color-text-muted)]">FID</div>
                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {formatTime(performanceMetrics.fid)}
                </div>
              </div>
            )}
            {performanceMetrics.cls && (
              <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
                <div className="text-sm text-[var(--color-text-muted)]">CLS</div>
                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {performanceMetrics.cls.toFixed(3)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Memory Metrics */}
      {memoryMetrics && (
        <div className="space-y-3">
          <h4 className="font-medium text-[var(--color-text-primary)]">Memory Usage</h4>
          <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-[var(--color-text-muted)]">Heap Usage</div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {memoryMetrics.usagePercentage.toFixed(1)}%
              </div>
            </div>
            <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
              <div
                className="bg-[var(--color-action-primary)] h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(memoryMetrics.usagePercentage, 100)}%` }}
              />
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-2">
              {formatBytes(memoryMetrics.usedJSHeapSize)} /{' '}
              {formatBytes(memoryMetrics.jsHeapSizeLimit)}
            </div>
          </div>
        </div>
      )}

      {/* Optimization Recommendations */}
      {optimizations.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-[var(--color-text-primary)]">
            Optimization Recommendations
          </h4>
          <div className="space-y-2">
            {optimizations.map((opt, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  opt.severity === 'critical'
                    ? 'border-[var(--color-data-fail)]/20 bg-[var(--color-data-fail)]/5'
                    : opt.severity === 'high'
                      ? 'border-[var(--color-data-provisional)]/20 bg-[var(--color-data-provisional)]/5'
                      : opt.severity === 'medium'
                        ? 'border-[var(--color-data-provisional)]/20 bg-[var(--color-data-provisional)]/5'
                        : 'border-[var(--color-data-pass)]/20 bg-[var(--color-data-pass)]/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-[var(--color-text-primary)]">{opt.issue}</div>
                    <div className="text-sm text-[var(--color-text-muted)] mt-1">
                      {opt.recommendation}
                    </div>
                  </div>
                  <div className="text-xs font-medium px-2 py-1 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                    {opt.severity.toUpperCase()}
                  </div>
                </div>
                {opt.estimatedSavings && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-2">
                    Estimated savings: {opt.estimatedSavings}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
