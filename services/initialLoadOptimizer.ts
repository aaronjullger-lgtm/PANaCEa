/**
 * Initial Load Time Optimizer for StudyPANaCEa
 *
 * Comprehensive system for improving initial page load performance
 * Implements critical path optimization, resource prioritization, and monitoring
 */

import { useEffect, useRef, useState } from 'react';

export interface LoadTimeMetrics {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

export interface ResourceTiming {
  name: string;
  duration: number;
  transferSize: number;
  startTime: number;
  initiatorType: string;
}

export interface PerformanceBudget {
  maxBundleSize: number; // in KB
  maxImageSize: number; // in KB
  maxThirdPartyScripts: number;
  maxFontSize: number; // in KB
  maxRenderTime: number; // in ms
}

export class InitialLoadOptimizer {
  private static instance: InitialLoadOptimizer;
  private metrics: LoadTimeMetrics | null = null;
  private resourceTimings: ResourceTiming[] = [];
  private performanceBudget: PerformanceBudget = {
    maxBundleSize: 500, // 500KB max initial bundle
    maxImageSize: 100, // 100KB max per image
    maxThirdPartyScripts: 5,
    maxFontSize: 50, // 50KB max font bundle
    maxRenderTime: 3000, // 3 seconds max render time
  };

  private constructor() {
    this.setupPerformanceObserver();
    this.setupResourceTiming();
  }

  static getInstance(): InitialLoadOptimizer {
    if (!InitialLoadOptimizer.instance) {
      InitialLoadOptimizer.instance = new InitialLoadOptimizer();
    }
    return InitialLoadOptimizer.instance;
  }

  /**
   * Setup Performance Observer for Core Web Vitals
   */
  private setupPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        if (lastEntry) {
          this.metrics = {
            ...(this.metrics ?? {}),
            firstContentfulPaint: lastEntry.startTime,
          };
          this.logMetric('First Contentful Paint', lastEntry.startTime);
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        if (lastEntry) {
          this.metrics = {
            ...(this.metrics ?? {}),
            largestContentfulPaint: (lastEntry as any).startTime,
          };
          this.logMetric('Largest Contentful Paint', (lastEntry as any).startTime);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        let cls = 0;
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            cls += (entry as any).value;
          }
        });
        this.metrics = {
          ...(this.metrics ?? {}),
          cumulativeLayoutShift: cls,
        };
        this.logMetric('Cumulative Layout Shift', cls);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // First Input Delay
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        if (lastEntry) {
          const delay = (lastEntry as any).processingStart - lastEntry.startTime;
          this.metrics = {
            ...(this.metrics ?? {}),
            firstInputDelay: delay,
          };
          this.logMetric('First Input Delay', delay);
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (error) {
      console.warn('Performance Observer setup failed:', error);
    }
  }

  /**
   * Collect resource timing data
   */
  private setupResourceTiming(): void {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }

    // Collect existing resource timings
    const resources = performance.getEntriesByType('resource');
    resources.forEach((resource: any) => {
      this.resourceTimings.push({
        name: resource.name,
        duration: resource.duration,
        transferSize: resource.transferSize || 0,
        startTime: resource.startTime,
        initiatorType: resource.initiatorType,
      });
    });

    // Observe new resources
    const resourceObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((resource: any) => {
        this.resourceTimings.push({
          name: resource.name,
          duration: resource.duration,
          transferSize: resource.transferSize || 0,
          startTime: resource.startTime,
          initiatorType: resource.initiatorType,
        });
      });
    });
    resourceObserver.observe({ entryTypes: ['resource'] });
  }

  /**
   * Log performance metric with severity classification
   */
  private logMetric(name: string, value: number): void {
    let severity = 'good';
    let budget = 0;

    switch (name) {
      case 'First Contentful Paint':
        budget = 1800; // 1.8 seconds
        break;
      case 'Largest Contentful Paint':
        budget = 2500; // 2.5 seconds
        break;
      case 'First Input Delay':
        budget = 100; // 100ms
        break;
      case 'Cumulative Layout Shift':
        budget = 0.1; // 0.1
        break;
    }

    if (value > budget * 1.5) {
      severity = 'poor';
    } else if (value > budget) {
      severity = 'needs-improvement';
    }

    console.log(`[Performance] ${name}: ${value.toFixed(2)}ms (${severity})`);
  }

  /**
   * Analyze bundle size and identify optimization opportunities
   */
  analyzeBundleSize(): {
    totalSize: number;
    largestChunks: Array<{ name: string; size: number }>;
    recommendations: string[];
  } {
    const chunks: Array<{ name: string; size: number }> = [];
    let totalSize = 0;

    // Analyze resource timings to estimate bundle sizes
    this.resourceTimings.forEach((resource) => {
      if (resource.initiatorType === 'script' && resource.name.includes('.js')) {
        const name = resource.name.split('/').pop() || resource.name;
        chunks.push({ name, size: resource.transferSize / 1024 }); // Convert to KB
        totalSize += resource.transferSize / 1024;
      }
    });

    // Sort by size descending
    chunks.sort((a, b) => b.size - a.size);

    const recommendations: string[] = [];

    // Check against performance budget
    if (totalSize > this.performanceBudget.maxBundleSize) {
      recommendations.push(
        `Total bundle size ${totalSize.toFixed(2)}KB exceeds budget of ${this.performanceBudget.maxBundleSize}KB`
      );
    }

    // Identify large chunks
    const largeChunks = chunks.filter((chunk) => chunk.size > 100); // Chunks larger than 100KB
    if (largeChunks.length > 0) {
      recommendations.push(
        `Large chunks detected: ${largeChunks.map((c) => `${c.name} (${c.size.toFixed(2)}KB)`).join(', ')}`
      );
    }

    // Check third-party scripts
    const thirdPartyScripts = this.resourceTimings.filter(
      (r) =>
        r.initiatorType === 'script' &&
        !r.name.includes(window.location.origin) &&
        !r.name.includes('localhost')
    );
    if (thirdPartyScripts.length > this.performanceBudget.maxThirdPartyScripts) {
      recommendations.push(
        `Too many third-party scripts: ${thirdPartyScripts.length} (max: ${this.performanceBudget.maxThirdPartyScripts})`
      );
    }

    return {
      totalSize,
      largestChunks: chunks.slice(0, 5),
      recommendations,
    };
  }

  /**
   * Optimize critical rendering path
   */
  optimizeCriticalPath(): void {
    if (typeof document === 'undefined') return;

    // Defer non-critical CSS
    const nonCriticalLinks = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"]:not([media="print"])'
    );
    nonCriticalLinks.forEach((link) => {
      if (!link.media || link.media === 'all') {
        link.media = 'print';
        link.onload = () => {
          link.media = 'all';
        };
      }
    });

    // Lazy load images below the fold
    const images = document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]');
    images.forEach((img) => {
      if (!img.loading) {
        img.loading = 'lazy';
      }
    });

    // Preconnect to critical origins
    const criticalOrigins = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://clerk.com',
    ];

    criticalOrigins.forEach((origin) => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    // Preload critical resources
    const criticalResources = [
      { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
    ];

    criticalResources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      if (resource.type) link.type = resource.type;
      if (resource.crossOrigin) link.crossOrigin = resource.crossOrigin;
      document.head.appendChild(link);
    });
  }

  /**
   * Implement resource hints for faster navigation
   */
  addResourceHints(): void {
    if (typeof document === 'undefined') return;

    // DNS prefetch for external domains
    const externalDomains = ['clerk.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

    externalDomains.forEach((domain) => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = `//${domain}`;
      document.head.appendChild(link);
    });

    // Do not prefetch API endpoints: /api/dashboard/stats and /api/user/profile require
    // authentication (cookies). Prefetch does not send credentials, so it would trigger
    // 503/401 and wasted requests. Let the app fetch them when the user is signed in.

    // Preconnect to critical origins
    const preconnectOrigins = [
      'https://api.clerk.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];

    preconnectOrigins.forEach((origin) => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  /**
   * Monitor and report performance metrics
   */
  getPerformanceReport(): {
    metrics: LoadTimeMetrics | null;
    resourceAnalysis: ReturnType<typeof this.analyzeBundleSize>;
    recommendations: string[];
    score: number;
  } {
    const resourceAnalysis = this.analyzeBundleSize();
    const recommendations = [...resourceAnalysis.recommendations];
    let score = 100;

    // Calculate performance score based on metrics
    if (this.metrics) {
      if (this.metrics.firstContentfulPaint > 1800) score -= 20;
      if (this.metrics.largestContentfulPaint > 2500) score -= 30;
      if (this.metrics.firstInputDelay > 100) score -= 20;
      if (this.metrics.cumulativeLayoutShift > 0.1) score -= 10;
    }

    // Deduct points for bundle size issues
    if (resourceAnalysis.totalSize > this.performanceBudget.maxBundleSize) {
      score -= 15;
    }

    return {
      metrics: this.metrics,
      resourceAnalysis,
      recommendations,
      score: Math.max(0, score),
    };
  }

  /**
   * Initialize optimizer - should be called early in app lifecycle
   */
  initialize(): void {
    console.log('[Performance] Initial Load Optimizer initialized');

    // Optimize critical path
    this.optimizeCriticalPath();

    // Add resource hints
    this.addResourceHints();

    // Start monitoring
    this.setupPerformanceObserver();

    // Report initial performance
    setTimeout(() => {
      const report = this.getPerformanceReport();
      console.log('[Performance] Initial Report:', report);
    }, 3000);
  }
}

const DEFAULT_REPORT: ReturnType<InitialLoadOptimizer['getPerformanceReport']> = {
  metrics: null,
  resourceAnalysis: { totalSize: 0, largestChunks: [], recommendations: [] },
  recommendations: [],
  score: 0,
};

/**
 * React hook for performance optimization.
 * Report updates after init so consumers (e.g. 5s timeout in App) see real metrics.
 */
export function useInitialLoadOptimization(): {
  report: ReturnType<InitialLoadOptimizer['getPerformanceReport']>;
  optimize: () => void;
} {
  const optimizerRef = useRef<InitialLoadOptimizer | null>(null);
  const [report, setReport] = useState(DEFAULT_REPORT);

  useEffect(() => {
    if (!optimizerRef.current) {
      optimizerRef.current = InitialLoadOptimizer.getInstance();
      optimizerRef.current.initialize();
    }
    const opt = optimizerRef.current;
    // Update report after observers have had time to emit (so App's 5s callback sees real score)
    const t = setTimeout(() => {
      setReport(opt.getPerformanceReport());
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  const optimize = () => {
    if (optimizerRef.current) {
      optimizerRef.current.optimizeCriticalPath();
      optimizerRef.current.addResourceHints();
    }
  };

  return { report, optimize };
}

/**
 * Utility to measure function execution time
 */
export function measureExecutionTime<T>(fn: () => T, label: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
  return result;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export default InitialLoadOptimizer.getInstance();
