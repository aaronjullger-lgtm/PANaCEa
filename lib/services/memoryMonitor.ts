/**
 * Memory Monitoring Service
 * 
 * Provides comprehensive memory monitoring for both frontend and backend environments.
 * Tracks memory usage patterns, identifies potential leaks, and provides optimization recommendations.
 * 
 * Features:
 * - Real-time memory usage tracking
 * - Leak detection through trend analysis
 * - Performance optimization recommendations
 * - Automatic cleanup suggestions
 * - Integration with existing monitoring systems
 */

export interface MemoryMetrics {
  /** Timestamp of measurement */
  timestamp: number;
  /** Heap used in bytes */
  heapUsed: number;
  /** Heap total in bytes */
  heapTotal: number;
  /** Heap limit in bytes (if available) */
  heapLimit?: number;
  /** External memory in bytes (if available) */
  external?: number;
  /** Array buffer memory in bytes (if available) */
  arrayBuffers?: number;
  /** Memory pressure state */
  pressure: 'low' | 'medium' | 'high';
  /** Trend over last measurements */
  trend: 'stable' | 'increasing' | 'decreasing';
}

export interface MemoryLeakDetection {
  /** Whether a potential leak is detected */
  detected: boolean;
  /** Confidence level (0-1) */
  confidence: number;
  /** Type of potential leak */
  type?: 'event_listener' | 'timer' | 'cache' | 'data_structure' | 'unknown';
  /** Suggested remediation */
  remediation?: string;
  /** Affected components or areas */
  affectedAreas?: string[];
}

export interface MemoryOptimization {
  /** Current memory usage in MB */
  currentUsageMB: number;
  /** Target memory usage in MB */
  targetUsageMB: number;
  /** Optimization recommendations */
  recommendations: string[];
  /** Priority of optimizations (high, medium, low) */
  priority: 'high' | 'medium' | 'low';
}

class MemoryMonitor {
  private metricsHistory: MemoryMetrics[] = [];
  private readonly maxHistorySize = 100;
  private readonly checkInterval = 30000; // 30 seconds
  private intervalId: NodeJS.Timeout | null = null;
  private readonly leakThreshold = 0.1; // 10% increase over 5 measurements

  /**
   * Get current memory metrics
   */
  public getCurrentMetrics(): MemoryMetrics {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      // Browser environment
      const memory = (performance as any).memory;
      return this.createMetrics({
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        heapLimit: memory.jsHeapSizeLimit,
      });
    } else if (typeof process !== 'undefined' && process.memoryUsage) {
      // Node.js/backend environment
      const memory = process.memoryUsage();
      return this.createMetrics({
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers,
      });
    } else {
      // Fallback for environments without memory API
      return this.createMetrics({
        heapUsed: 0,
        heapTotal: 0,
      });
    }
  }

  /**
   * Create metrics object with calculated pressure and trend
   */
  private createMetrics(raw: {
    heapUsed: number;
    heapTotal: number;
    heapLimit?: number;
    external?: number;
    arrayBuffers?: number;
  }): MemoryMetrics {
    const timestamp = Date.now();
    const ratio = raw.heapTotal > 0 ? raw.heapUsed / raw.heapTotal : 0;
    
    let pressure: 'low' | 'medium' | 'high' = 'medium';
    if (ratio > 0.85) pressure = 'high';
    else if (ratio > 0.6) pressure = 'medium';
    else pressure = 'low';

    const metrics: MemoryMetrics = {
      timestamp,
      heapUsed: raw.heapUsed,
      heapTotal: raw.heapTotal,
      heapLimit: raw.heapLimit,
      external: raw.external,
      arrayBuffers: raw.arrayBuffers,
      pressure,
      trend: this.calculateTrend(),
    };

    this.addToHistory(metrics);
    return metrics;
  }

  /**
   * Add metrics to history and maintain size limit
   */
  private addToHistory(metrics: MemoryMetrics): void {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Calculate memory trend based on history
   */
  private calculateTrend(): 'stable' | 'increasing' | 'decreasing' {
    if (this.metricsHistory.length < 3) return 'stable';

    const recent = this.metricsHistory.slice(-5);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;
    const change = (last - first) / first;

    if (Math.abs(change) < 0.02) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Detect potential memory leaks
   */
  public detectLeaks(): MemoryLeakDetection {
    if (this.metricsHistory.length < 10) {
      return {
        detected: false,
        confidence: 0,
      };
    }

    // Check for consistent increase over last 10 measurements
    const recent = this.metricsHistory.slice(-10);
    const increases = recent.slice(1).filter((m, i) => 
      m.heapUsed > recent[i].heapUsed * (1 + this.leakThreshold / 2)
    );

    if (increases.length >= 7) {
      return {
        detected: true,
        confidence: 0.8,
        type: 'unknown',
        remediation: 'Investigate memory allocation patterns. Check for unclosed event listeners, timers, or large data structures.',
        affectedAreas: ['Global'],
      };
    }

    return {
      detected: false,
      confidence: 0,
    };
  }

  /**
   * Get optimization recommendations
   */
  public getOptimizations(): MemoryOptimization {
    const current = this.getCurrentMetrics();
    const currentUsageMB = current.heapUsed / (1024 * 1024);
    
    const recommendations: string[] = [];
    let priority: 'high' | 'medium' | 'low' = 'low';

    // High priority recommendations for high memory pressure
    if (current.pressure === 'high') {
      priority = 'high';
      recommendations.push(
        'Reduce large data structures in memory',
        'Implement pagination for large datasets',
        'Clear unused caches and temporary data',
        'Consider lazy loading for non-critical components'
      );
    } else if (current.pressure === 'medium') {
      priority = 'medium';
      recommendations.push(
        'Monitor memory usage trends',
        'Optimize image loading with lazy loading',
        'Implement virtual scrolling for long lists',
        'Use memory-efficient data structures'
      );
    } else {
      priority = 'low';
      recommendations.push(
        'Continue current optimization practices',
        'Regularly audit memory usage patterns',
        'Consider implementing memory usage alerts'
      );
    }

    // Add specific recommendations based on environment
    if (typeof window !== 'undefined') {
      // Browser-specific recommendations
      recommendations.push(
        'Use Chrome DevTools Memory Profiler to identify leaks',
        'Check for detached DOM elements',
        'Monitor event listener counts'
      );
    } else {
      // Node.js/backend recommendations
      recommendations.push(
        'Monitor garbage collection frequency',
        'Check for memory fragmentation',
        'Consider increasing heap size if consistently high'
      );
    }

    return {
      currentUsageMB: Math.round(currentUsageMB * 100) / 100,
      targetUsageMB: Math.round(current.heapTotal / (1024 * 1024) * 0.7), // Target 70% usage
      recommendations,
      priority,
    };
  }

  /**
   * Start continuous monitoring
   */
  public startMonitoring(): void {
    if (this.intervalId) {
      this.stopMonitoring();
    }

    this.intervalId = setInterval(() => {
      const metrics = this.getCurrentMetrics();
      const leaks = this.detectLeaks();
      
      if (leaks.detected) {
        console.warn('[MemoryMonitor] Potential memory leak detected:', leaks);
      }
      
      if (metrics.pressure === 'high') {
        console.warn('[MemoryMonitor] High memory pressure detected:', metrics);
      }
    }, this.checkInterval);

    console.log('[MemoryMonitor] Started memory monitoring');
  }

  /**
   * Stop continuous monitoring
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MemoryMonitor] Stopped memory monitoring');
    }
  }

  /**
   * Get memory usage statistics
   */
  public getStats() {
    const current = this.getCurrentMetrics();
    const leaks = this.detectLeaks();
    const optimizations = this.getOptimizations();

    return {
      current: {
        heapUsedMB: Math.round(current.heapUsed / (1024 * 1024) * 100) / 100,
        heapTotalMB: Math.round(current.heapTotal / (1024 * 1024) * 100) / 100,
        usagePercentage: Math.round((current.heapUsed / current.heapTotal) * 1000) / 10,
        pressure: current.pressure,
        trend: current.trend,
      },
      leaks,
      optimizations,
      historySize: this.metricsHistory.length,
    };
  }

  /**
   * Clear metrics history
   */
  public clearHistory(): void {
    this.metricsHistory = [];
  }
}

// Singleton instance
export const memoryMonitor = new MemoryMonitor();

// Export for easy use
export default memoryMonitor;