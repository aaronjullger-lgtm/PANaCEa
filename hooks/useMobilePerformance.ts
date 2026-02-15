/**
 * useMobilePerformance Hook
 *
 * Provides mobile-specific performance optimizations:
 * - Network condition detection (2G, 3G, 4G, 5G, WiFi)
 * - Adaptive resource loading based on network
 * - Performance monitoring and reporting
 * - Battery and memory optimization
 * - Connection-aware prefetching
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface NetworkInfo {
  /** Effective connection type: 'slow-2g', '2g', '3g', '4g', '5g', 'wifi' */
  effectiveType: string;
  /** Downlink speed in Mbps */
  downlink: number;
  /** Round trip time in ms */
  rtt: number;
  /** Whether save-data mode is enabled */
  saveData: boolean;
  /** Network type from navigator.connection.type */
  type: string;
}

export interface PerformanceMetrics {
  /** First Contentful Paint (estimated) */
  fcp: number | null;
  /** Largest Contentful Paint (estimated) */
  lcp: number | null;
  /** Cumulative Layout Shift */
  cls: number | null;
  /** First Input Delay (estimated) */
  fid: number | null;
  /** Time to Interactive (estimated) */
  tti: number | null;
  /** Total blocking time */
  tbt: number | null;
}

export interface MobilePerformanceOptions {
  /** Enable network-aware loading */
  networkAware?: boolean;
  /** Enable battery-aware optimizations */
  batteryAware?: boolean;
  /** Enable memory monitoring */
  memoryMonitoring?: boolean;
  /** Enable performance reporting */
  performanceReporting?: boolean;
  /** Enable connection-aware prefetching */
  prefetching?: boolean;
  /** Debug mode for logging */
  debug?: boolean;
}

export interface MobilePerformanceResult {
  /** Current network information */
  network: NetworkInfo;
  /** Current performance metrics */
  metrics: PerformanceMetrics;
  /** Whether device is on a slow connection */
  isSlowConnection: boolean;
  /** Whether save-data mode is enabled */
  isSaveData: boolean;
  /** Battery level (0-1) if available */
  batteryLevel: number | null;
  /** Whether device has low memory */
  hasLowMemory: boolean;
  /** Apply network-aware optimizations to an element */
  applyNetworkOptimizations: (element: HTMLElement) => void;
  /** Prefetch a resource if connection allows */
  prefetchResource: (url: string, priority?: 'high' | 'low') => void;
  /** Report a performance metric */
  reportMetric: (name: string, value: number) => void;
  /** Get optimization recommendations */
  getOptimizationRecommendations: () => string[];
}

/**
 * Get network information from navigator.connection
 */
function getNetworkInfo(): NetworkInfo {
  if (typeof navigator === 'undefined' || !navigator.connection) {
    return {
      effectiveType: 'unknown',
      downlink: 10, // Assume decent connection
      rtt: 50,
      saveData: false,
      type: 'unknown',
    };
  }

  const connection = navigator.connection as any;
  return {
    effectiveType: connection.effectiveType || 'unknown',
    downlink: connection.downlink || 10,
    rtt: connection.rtt || 50,
    saveData: connection.saveData || false,
    type: connection.type || 'unknown',
  };
}

/**
 * Check if connection is slow
 */
function isSlowConnection(network: NetworkInfo): boolean {
  return (
    network.effectiveType === 'slow-2g' ||
    network.effectiveType === '2g' ||
    network.downlink < 1 || // Less than 1 Mbps
    network.rtt > 300 || // More than 300ms RTT
    network.saveData
  );
}

/**
 * Get battery information if available
 */
async function getBatteryInfo(): Promise<{ level: number; charging: boolean } | null> {
  if (typeof navigator === 'undefined' || !('getBattery' in navigator)) {
    return null;
  }

  try {
    const battery = await (navigator as any).getBattery();
    return {
      level: battery.level,
      charging: battery.charging,
    };
  } catch (error) {
    console.warn('Failed to get battery info:', error);
    return null;
  }
}

/**
 * Estimate memory pressure
 */
function getMemoryPressure(): 'low' | 'medium' | 'high' {
  if (typeof performance === 'undefined' || !performance.memory) {
    return 'medium'; // Assume medium if we can't measure
  }

  const memory = (performance as any).memory;
  const usedMB = memory.usedJSHeapSize / (1024 * 1024);
  const totalMB = memory.totalJSHeapSize / (1024 * 1024);
  const ratio = usedMB / totalMB;

  if (ratio > 0.9) return 'high';
  if (ratio > 0.7) return 'medium';
  return 'low';
}

export function useMobilePerformance(
  options: MobilePerformanceOptions = {}
): MobilePerformanceResult {
  const {
    networkAware = true,
    batteryAware = true,
    memoryMonitoring = true,
    performanceReporting = true,
    prefetching = true,
    debug = false,
  } = options;

  const [network, setNetwork] = useState<NetworkInfo>(() => getNetworkInfo());
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    cls: null,
    fid: null,
    tti: null,
    tbt: null,
  });
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [memoryPressure, setMemoryPressure] = useState<'low' | 'medium' | 'high'>('medium');

  const isSlowConnection = isSlowConnection(network);
  const isSaveData = network.saveData;
  const hasLowMemory = memoryPressure === 'high';

  // Track network changes
  useEffect(() => {
    if (!networkAware || typeof navigator === 'undefined' || !navigator.connection) {
      return;
    }

    const handleNetworkChange = () => {
      const newNetwork = getNetworkInfo();
      setNetwork(newNetwork);

      if (debug) {
        console.log('[MobilePerformance] Network changed:', newNetwork);
      }
    };

    const connection = navigator.connection as any;
    connection.addEventListener('change', handleNetworkChange);

    // Initial check
    handleNetworkChange();

    return () => {
      connection.removeEventListener('change', handleNetworkChange);
    };
  }, [networkAware, debug]);

  // Track battery if available
  useEffect(() => {
    if (!batteryAware) return;

    let mounted = true;

    const updateBattery = async () => {
      const batteryInfo = await getBatteryInfo();
      if (mounted && batteryInfo) {
        setBatteryLevel(batteryInfo.level);

        if (debug && batteryInfo.level < 0.2) {
          console.log('[MobilePerformance] Low battery detected:', batteryInfo.level);
        }
      }
    };

    updateBattery();

    // Update battery level periodically
    const interval = setInterval(updateBattery, 60000); // Every minute

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [batteryAware, debug]);

  // Monitor memory pressure
  useEffect(() => {
    if (!memoryMonitoring) return;

    const checkMemory = () => {
      const pressure = getMemoryPressure();
      setMemoryPressure(pressure);

      if (debug && pressure === 'high') {
        console.log('[MobilePerformance] High memory pressure detected');
      }
    };

    // Check memory periodically
    const interval = setInterval(checkMemory, 30000); // Every 30 seconds
    checkMemory(); // Initial check

    return () => clearInterval(interval);
  }, [memoryMonitoring, debug]);

  // Collect performance metrics
  useEffect(() => {
    if (!performanceReporting || typeof window === 'undefined') return;

    const collectMetrics = () => {
      // In a real implementation, you would use the Performance API
      // For now, we'll simulate or use available metrics
      const newMetrics: PerformanceMetrics = { ...metrics };

      // Try to get real metrics if available
      if (window.performance && window.performance.getEntriesByType) {
        const paintEntries = window.performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          newMetrics.fcp = Math.round(fcpEntry.startTime);
        }

        // Monitor CLS (would need PerformanceObserver in real implementation)
        // This is a simplified version
        if (typeof (window as any).CLS !== 'undefined') {
          newMetrics.cls = (window as any).CLS;
        }
      }

      setMetrics(newMetrics);
    };

    // Collect metrics after page load
    const timeout = setTimeout(collectMetrics, 2000);

    // Also collect on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        collectMetrics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [performanceReporting]);

  const applyNetworkOptimizations = useCallback(
    (element: HTMLElement) => {
      if (!networkAware) return;

      const tagName = element.tagName.toLowerCase();

      // Apply optimizations based on network conditions
      if (isSlowConnection || isSaveData) {
        switch (tagName) {
          case 'img': {
            const img = element as HTMLImageElement;
            img.loading = 'lazy';
            if (!img.src.includes('?') && !img.src.includes('quality=')) {
              img.src = `${img.src}${img.src.includes('?') ? '&' : '?'}quality=50`;
            }
            break;
          }
          case 'video': {
            const video = element as HTMLVideoElement;
            video.preload = 'metadata';
            break;
          }
          case 'iframe':
            // Defer iframe loading
            element.setAttribute('loading', 'lazy');
            break;
        }

        // Add data-saver attribute for CSS targeting
        element.setAttribute('data-saver', 'true');
      }

      if (debug) {
        console.log(
          '[MobilePerformance] Applied optimizations to:',
          tagName,
          element.id || element.className
        );
      }
    },
    [networkAware, isSlowConnection, isSaveData, debug]
  );

  const prefetchResource = useCallback(
    (url: string, priority: 'high' | 'low' = 'low') => {
      if (!prefetching) return;

      // Only prefetch on good connections
      if (isSlowConnection || isSaveData) {
        if (debug) {
          console.log('[MobilePerformance] Skipping prefetch on slow connection:', url);
        }
        return;
      }

      // Only prefetch high priority resources on medium battery
      if (batteryLevel !== null && batteryLevel < 0.3 && priority === 'low') {
        if (debug) {
          console.log('[MobilePerformance] Skipping low-priority prefetch on low battery:', url);
        }
        return;
      }

      // Create link element for prefetching
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = url.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)
        ? 'image'
        : url.match(/\.(js)$/i)
          ? 'script'
          : url.match(/\.(css)$/i)
            ? 'style'
            : 'fetch';

      document.head.appendChild(link);

      if (debug) {
        console.log('[MobilePerformance] Prefetching resource:', url, 'priority:', priority);
      }

      // Clean up after a while
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      }, 30000); // Remove after 30 seconds
    },
    [prefetching, isSlowConnection, isSaveData, batteryLevel, debug]
  );

  const reportMetric = useCallback(
    (name: string, value: number) => {
      if (!performanceReporting) return;

      // Update metrics state
      setMetrics((prev) => ({
        ...prev,
        [name]: value,
      }));

      // In a real implementation, you would send this to analytics
      if (debug) {
        console.log(`[MobilePerformance] Metric reported: ${name} = ${value}`);
      }

      // Check if metric indicates performance issue
      const thresholds: Record<string, number> = {
        fcp: 3000, // 3 seconds
        lcp: 4000, // 4 seconds
        cls: 0.1, // 0.1 CLS score
        fid: 100, // 100ms
        tti: 5000, // 5 seconds
        tbt: 300, // 300ms
      };

      if (thresholds[name] && value > thresholds[name]) {
        console.warn(
          `[MobilePerformance] Performance issue detected: ${name} = ${value}ms (threshold: ${thresholds[name]}ms)`
        );
      }
    },
    [performanceReporting, debug]
  );

  const getOptimizationRecommendations = useCallback((): string[] => {
    const recommendations: string[] = [];

    // Network-based recommendations
    if (isSlowConnection) {
      recommendations.push(
        'Reduce image quality for slow connections',
        'Implement more aggressive lazy loading',
        'Consider using skeleton screens for slower networks',
        'Reduce non-essential animations'
      );
    }

    if (isSaveData) {
      recommendations.push(
        'Enable data-saver mode optimizations',
        'Skip non-critical resources',
        'Use lower quality media'
      );
    }

    // Battery-based recommendations
    if (batteryLevel !== null && batteryLevel < 0.3) {
      recommendations.push(
        'Reduce animations and transitions',
        'Lower frame rate for non-essential UI',
        'Disable background polling'
      );
    }

    // Memory-based recommendations
    if (hasLowMemory) {
      recommendations.push(
        'Implement virtual scrolling for long lists',
        'Clean up unused event listeners',
        'Reduce DOM node count',
        'Implement memory-efficient caching'
      );
    }

    // Performance metric-based recommendations
    if (metrics.fcp && metrics.fcp > 3000) {
      recommendations.push('Optimize critical rendering path for faster FCP');
    }

    if (metrics.cls && metrics.cls > 0.1) {
      recommendations.push('Fix layout shifts by reserving space for dynamic content');
    }

    return recommendations;
  }, [isSlowConnection, isSaveData, batteryLevel, hasLowMemory, metrics]);

  // Apply global optimizations on mount
  useEffect(() => {
    if (!networkAware) return;

    // Apply optimizations to existing images and videos
    const applyGlobalOptimizations = () => {
      if (isSlowConnection || isSaveData) {
        // Optimize images
        document.querySelectorAll('img').forEach((img) => {
          applyNetworkOptimizations(img);
        });

        // Optimize videos
        document.querySelectorAll('video').forEach((video) => {
          applyNetworkOptimizations(video);
        });

        // Optimize iframes
        document.querySelectorAll('iframe').forEach((iframe) => {
          applyNetworkOptimizations(iframe);
        });

        if (debug) {
          console.log('[MobilePerformance] Applied global optimizations for slow connection');
        }
      }
    };

    // Run after DOM is ready
    const timeout = setTimeout(applyGlobalOptimizations, 100);
    return () => clearTimeout(timeout);
  }, [networkAware, isSlowConnection, isSaveData, applyNetworkOptimizations, debug]);

  return {
    network,
    metrics,
    isSlowConnection,
    isSaveData,
    batteryLevel,
    hasLowMemory,
    applyNetworkOptimizations,
    prefetchResource,
    reportMetric,
    getOptimizationRecommendations,
  };
}

/**
 * Hook to optimize images for mobile performance
 */
export function useMobileImageOptimization() {
  const { network, isSlowConnection, isSaveData } = useMobilePerformance({
    networkAware: true,
    batteryAware: false,
    memoryMonitoring: false,
    performanceReporting: false,
    prefetching: false,
    debug: false,
  });

  const getOptimizedImageConfig = useCallback(() => {
    const config: any = {
      loading: 'lazy',
      decoding: 'async',
    };

    if (isSlowConnection || isSaveData) {
      config.quality = 50;
      config.format = 'webp'; // WebP is generally smaller
    } else {
      config.quality = 85;
      config.format = 'avif'; // AVIF for good connections
    }

    // Adjust based on exact network type
    switch (network.effectiveType) {
      case 'slow-2g':
      case '2g':
        config.maxWidth = 800;
        config.maxHeight = 600;
        break;
      case '3g':
        config.maxWidth = 1200;
        config.maxHeight = 800;
        break;
      default:
        config.maxWidth = 1920;
        config.maxHeight = 1080;
    }

    return config;
  }, [network, isSlowConnection, isSaveData]);

  return {
    getOptimizedImageConfig,
    isSlowConnection,
    isSaveData,
  };
}

/**
 * Hook to manage resource loading based on user interaction
 */
export function useInteractionBasedLoading() {
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleInteraction = () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true);

        // Clear any existing timeout
        if (interactionTimeoutRef.current) {
          clearTimeout(interactionTimeoutRef.current);
        }
      }
    };

    // Listen for various user interactions
    const events = ['click', 'touchstart', 'keydown', 'scroll'];
    events.forEach((event) => {
      document.addEventListener(event, handleInteraction, { once: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleInteraction);
      });

      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [hasUserInteracted]);

  // Load non-critical resources after user interaction
  useEffect(() => {
    if (!hasUserInteracted) return;

    const loadNonCriticalResources = () => {
      // This would load non-critical JS, prefetch pages, etc.
      console.log(
        '[InteractionBasedLoading] Loading non-critical resources after user interaction'
      );
    };

    // Wait a bit after interaction to avoid competing with critical resources
    interactionTimeoutRef.current = setTimeout(loadNonCriticalResources, 1000);

    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [hasUserInteracted]);

  return {
    hasUserInteracted,
    // Function to check if we should load a resource based on interaction
    shouldLoadResource: (priority: 'critical' | 'high' | 'medium' | 'low') => {
      if (priority === 'critical') return true;
      if (priority === 'high') return true;
      if (priority === 'medium') return hasUserInteracted;
      return hasUserInteracted; // Low priority also needs interaction
    },
  };
}
