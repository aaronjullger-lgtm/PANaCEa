/**
 * useMemoryMonitor Hook
 * 
 * React hook for memory monitoring and optimization.
 * Integrates with the MemoryMonitor service to provide real-time memory insights.
 * 
 * Features:
 * - Real-time memory usage tracking
 * - Leak detection alerts
 * - Optimization recommendations
 * - Automatic monitoring control
 */

import { useEffect, useState, useCallback } from 'react';
import { memoryMonitor, type MemoryMetrics, type MemoryLeakDetection, type MemoryOptimization } from '@/lib/services/memoryMonitor';

export interface UseMemoryMonitorOptions {
  /** Enable automatic monitoring on mount */
  autoMonitor?: boolean;
  /** Monitoring interval in milliseconds (default: 30000) */
  interval?: number;
  /** Enable leak detection alerts */
  leakAlerts?: boolean;
  /** Enable optimization recommendations */
  optimizations?: boolean;
  /** Debug mode for logging */
  debug?: boolean;
}

export interface UseMemoryMonitorResult {
  /** Current memory metrics */
  metrics: MemoryMetrics | null;
  /** Memory leak detection results */
  leakDetection: MemoryLeakDetection | null;
  /** Optimization recommendations */
  optimizations: MemoryOptimization | null;
  /** Whether monitoring is active */
  isMonitoring: boolean;
  /** Start memory monitoring */
  startMonitoring: () => void;
  /** Stop memory monitoring */
  stopMonitoring: () => void;
  /** Get current memory stats */
  getStats: () => ReturnType<typeof memoryMonitor.getStats>;
  /** Clear metrics history */
  clearHistory: () => void;
}

export function useMemoryMonitor(options: UseMemoryMonitorOptions = {}): UseMemoryMonitorResult {
  const {
    autoMonitor = true,
    interval = 30000,
    leakAlerts = true,
    optimizations = true,
    debug = false,
  } = options;

  const [metrics, setMetrics] = useState<MemoryMetrics | null>(null);
  const [leakDetection, setLeakDetection] = useState<MemoryLeakDetection | null>(null);
  const [optimizationData, setOptimizationData] = useState<MemoryOptimization | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Update metrics function
  const updateMetrics = useCallback(() => {
    try {
      const currentMetrics = memoryMonitor.getCurrentMetrics();
      setMetrics(currentMetrics);

      if (leakAlerts) {
        const leaks = memoryMonitor.detectLeaks();
        setLeakDetection(leaks);

        if (leaks.detected && debug) {
          console.warn('[useMemoryMonitor] Potential memory leak detected:', leaks);
        }
      }

      if (optimizations) {
        const optims = memoryMonitor.getOptimizations();
        setOptimizationData(optims);
      }
    } catch (error) {
      if (debug) {
        console.error('[useMemoryMonitor] Error updating metrics:', error);
      }
    }
  }, [leakAlerts, optimizations, debug]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    memoryMonitor.startMonitoring();
    setIsMonitoring(true);
    updateMetrics(); // Initial update
    
    if (debug) {
      console.log('[useMemoryMonitor] Memory monitoring started');
    }
  }, [updateMetrics, debug]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    memoryMonitor.stopMonitoring();
    setIsMonitoring(false);
    
    if (debug) {
      console.log('[useMemoryMonitor] Memory monitoring stopped');
    }
  }, [debug]);

  // Get stats
  const getStats = useCallback(() => {
    return memoryMonitor.getStats();
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    memoryMonitor.clearHistory();
    setMetrics(null);
    setLeakDetection(null);
    setOptimizationData(null);
    
    if (debug) {
      console.log('[useMemoryMonitor] History cleared');
    }
  }, [debug]);

  // Effect for auto-monitoring
  useEffect(() => {
    if (autoMonitor) {
      startMonitoring();
    }

    return () => {
      if (autoMonitor) {
        stopMonitoring();
      }
    };
  }, [autoMonitor, startMonitoring, stopMonitoring]);

  // Effect for interval updates
  useEffect(() => {
    if (!isMonitoring) return;

    const intervalId = setInterval(updateMetrics, interval);
    return () => clearInterval(intervalId);
  }, [isMonitoring, interval, updateMetrics]);

  // Effect for high memory pressure alerts
  useEffect(() => {
    if (!metrics || !leakAlerts) return;

    if (metrics.pressure === 'high') {
      console.warn('[useMemoryMonitor] High memory pressure detected:', {
        heapUsedMB: Math.round(metrics.heapUsed / (1024 * 1024) * 100) / 100,
        heapTotalMB: Math.round(metrics.heapTotal / (1024 * 1024) * 100) / 100,
        usagePercentage: Math.round((metrics.heapUsed / metrics.heapTotal) * 1000) / 10,
      });
    }
  }, [metrics, leakAlerts]);

  return {
    metrics,
    leakDetection,
    optimizations: optimizationData,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    getStats,
    clearHistory,
  };
}

// Export a simplified version for common use
export function useMemoryHealth() {
  const { metrics, leakDetection, optimizations, isMonitoring } = useMemoryMonitor({
    autoMonitor: true,
    leakAlerts: true,
    optimizations: true,
    debug: false,
  });

  const health = {
    status: 'healthy' as 'healthy' | 'warning' | 'critical',
    message: '',
    details: {} as Record<string, any>,
  };

  if (!metrics) {
    health.status = 'healthy';
    health.message = 'Memory monitoring not available';
    return health;
  }

  // Calculate health status
  const usagePercentage = metrics.heapTotal > 0 ? metrics.heapUsed / metrics.heapTotal : 0;
  
  if (usagePercentage > 0.85 || (leakDetection?.detected && leakDetection.confidence > 0.7)) {
    health.status = 'critical';
    health.message = 'Critical memory issues detected';
  } else if (usagePercentage > 0.7 || (leakDetection?.detected && leakDetection.confidence > 0.4)) {
    health.status = 'warning';
    health.message = 'Memory usage is high or potential leak detected';
  } else {
    health.status = 'healthy';
    health.message = 'Memory usage is normal';
  }

  // Add details
  health.details = {
    usagePercentage: Math.round(usagePercentage * 1000) / 10,
    heapUsedMB: Math.round(metrics.heapUsed / (1024 * 1024) * 100) / 100,
    heapTotalMB: Math.round(metrics.heapTotal / (1024 * 1024) * 100) / 100,
    pressure: metrics.pressure,
    trend: metrics.trend,
    leakDetected: leakDetection?.detected || false,
    leakConfidence: leakDetection?.confidence || 0,
    monitoringActive: isMonitoring,
    recommendations: optimizations?.recommendations?.slice(0, 3) || [],
  };

  return health;
}

export default useMemoryMonitor;