/**
 * Memory Optimizer Utility
 * 
 * Provides utilities for identifying and fixing common memory issues.
 * Includes tools for memory profiling, leak detection, and optimization.
 */

export interface MemoryProfile {
  /** Total heap size in bytes */
  totalHeapSize: number;
  /** Used heap size in bytes */
  usedHeapSize: number;
  /** Number of DOM nodes */
  domNodeCount: number;
  /** Number of event listeners */
  eventListenerCount: number;
  /** Number of timers (setInterval/setTimeout) */
  timerCount: number;
  /** Number of active promises */
  promiseCount: number;
  /** Cache sizes */
  cacheSizes: Record<string, number>;
}

export interface MemoryIssue {
  /** Issue type */
  type: 'dom_nodes' | 'event_listeners' | 'timers' | 'promises' | 'cache' | 'data_structures';
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  /** Description of the issue */
  description: string;
  /** Suggested fix */
  fix: string;
  /** Estimated memory impact in bytes */
  estimatedImpact: number;
}

export interface OptimizationResult {
  /** Issues found */
  issues: MemoryIssue[];
  /** Total estimated memory that can be freed */
  totalSavingsBytes: number;
  /** Optimization recommendations */
  recommendations: string[];
  /** Whether optimization should be performed */
  shouldOptimize: boolean;
}

class MemoryOptimizer {
  /**
   * Get current memory profile
   */
  public async getProfile(): Promise<MemoryProfile> {
    const profile: MemoryProfile = {
      totalHeapSize: 0,
      usedHeapSize: 0,
      domNodeCount: 0,
      eventListenerCount: 0,
      timerCount: 0,
      promiseCount: 0,
      cacheSizes: {},
    };

    try {
      // Get heap information if available
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const memory = (performance as any).memory;
        profile.totalHeapSize = memory.totalJSHeapSize;
        profile.usedHeapSize = memory.usedJSHeapSize;
      }

      // Get DOM node count
      if (typeof document !== 'undefined') {
        profile.domNodeCount = this.countDOMNodes();
      }

      // Get event listener count (approximate)
      profile.eventListenerCount = this.estimateEventListenerCount();

      // Get timer count (approximate)
      profile.timerCount = this.estimateTimerCount();

      // Get cache sizes from known caches
      profile.cacheSizes = await this.getCacheSizes();

    } catch (error) {
      console.warn('[MemoryOptimizer] Error getting memory profile:', error);
    }

    return profile;
  }

  /**
   * Count DOM nodes recursively
   */
  private countDOMNodes(element?: Element): number {
    if (typeof document === 'undefined') return 0;

    const root = element || document.documentElement;
    let count = 1; // Count the current element

    // Count child nodes
    for (let i = 0; i < root.children.length; i++) {
      count += this.countDOMNodes(root.children[i]);
    }

    return count;
  }

  /**
   * Estimate event listener count
   */
  private estimateEventListenerCount(): number {
    if (typeof document === 'undefined') return 0;

    let count = 0;
    const elements = document.querySelectorAll('*');
    
    // This is an approximation - we can't directly access all event listeners
    elements.forEach(element => {
      // Check for common event listener patterns
      const attributes = element.attributes;
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i].name;
        if (attr.startsWith('on') && attr.length > 2) {
          count++;
        }
      }
    });

    return count;
  }

  /**
   * Estimate timer count
   */
  private estimateTimerCount(): number {
    // This is an approximation - we can't directly access all timers
    // In a real implementation, you might want to monkey-patch setTimeout/setInterval
    return 0; // Placeholder
  }

  /**
   * Get cache sizes from known caching systems
   */
  private async getCacheSizes(): Promise<Record<string, number>> {
    const cacheSizes: Record<string, number> = {};

    try {
      // Check localStorage
      if (typeof localStorage !== 'undefined') {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            total += (key.length + (value?.length || 0)) * 2; // UTF-16
          }
        }
        cacheSizes.localStorage = total;
      }

      // Check sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        let total = 0;
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            const value = sessionStorage.getItem(key);
            total += (key.length + (value?.length || 0)) * 2;
          }
        }
        cacheSizes.sessionStorage = total;
      }

      // Check IndexedDB (simplified)
      if (typeof indexedDB !== 'undefined') {
        // This would require more complex implementation
        cacheSizes.indexedDB = 0;
      }

    } catch (error) {
      console.warn('[MemoryOptimizer] Error getting cache sizes:', error);
    }

    return cacheSizes;
  }

  /**
   * Analyze memory profile for issues
   */
  public analyzeProfile(profile: MemoryProfile): MemoryIssue[] {
    const issues: MemoryIssue[] = [];

    // Check DOM node count
    if (profile.domNodeCount > 5000) {
      issues.push({
        type: 'dom_nodes',
        severity: profile.domNodeCount > 10000 ? 'high' : 'medium',
        description: `High DOM node count: ${profile.domNodeCount} nodes`,
        fix: 'Implement virtual scrolling, lazy loading, or reduce DOM complexity',
        estimatedImpact: profile.domNodeCount * 1000, // Approximate bytes per node
      });
    }

    // Check event listener count
    if (profile.eventListenerCount > 1000) {
      issues.push({
        type: 'event_listeners',
        severity: profile.eventListenerCount > 5000 ? 'high' : 'medium',
        description: `High event listener count: ${profile.eventListenerCount} listeners`,
        fix: 'Ensure proper cleanup of event listeners in useEffect cleanup functions',
        estimatedImpact: profile.eventListenerCount * 100, // Approximate bytes per listener
      });
    }

    // Check cache sizes
    Object.entries(profile.cacheSizes).forEach(([cacheName, size]) => {
      if (size > 10 * 1024 * 1024) { // 10MB
        issues.push({
          type: 'cache',
          severity: size > 50 * 1024 * 1024 ? 'high' : 'medium',
          description: `Large cache size: ${cacheName} uses ${Math.round(size / (1024 * 1024) * 100) / 100}MB`,
          fix: 'Implement cache expiration, size limits, or compression',
          estimatedImpact: size,
        });
      }
    });

    // Check heap usage
    if (profile.totalHeapSize > 0) {
      const usagePercentage = profile.usedHeapSize / profile.totalHeapSize;
      if (usagePercentage > 0.8) {
        issues.push({
          type: 'data_structures',
          severity: 'high',
          description: `High heap usage: ${Math.round(usagePercentage * 100)}% of ${Math.round(profile.totalHeapSize / (1024 * 1024))}MB`,
          fix: 'Reduce memory footprint by optimizing data structures and implementing pagination',
          estimatedImpact: profile.usedHeapSize * 0.2, // Estimate 20% savings
        });
      }
    }

    return issues;
  }

  /**
   * Get optimization recommendations
   */
  public getOptimizations(profile: MemoryProfile, issues: MemoryIssue[]): OptimizationResult {
    const totalSavingsBytes = issues.reduce((sum, issue) => sum + issue.estimatedImpact, 0);
    const recommendations: string[] = [];

    // General recommendations
    if (profile.domNodeCount > 3000) {
      recommendations.push('Consider implementing virtual scrolling for long lists');
      recommendations.push('Use React.memo() for expensive component re-renders');
      recommendations.push('Implement lazy loading for off-screen components');
    }

    if (profile.eventListenerCount > 500) {
      recommendations.push('Audit useEffect cleanup functions for event listeners');
      recommendations.push('Consider using event delegation for similar elements');
      recommendations.push('Use AbortController for fetch request cleanup');
    }

    if (Object.values(profile.cacheSizes).some(size => size > 5 * 1024 * 1024)) {
      recommendations.push('Implement cache expiration policies');
      recommendations.push('Consider compressing cache data');
      recommendations.push('Set maximum size limits for caches');
    }

    // Specific recommendations based on issues
    issues.forEach(issue => {
      if (issue.severity === 'high') {
        recommendations.push(`HIGH PRIORITY: ${issue.fix}`);
      }
    });

    return {
      issues,
      totalSavingsBytes,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      shouldOptimize: issues.some(issue => issue.severity === 'high') || totalSavingsBytes > 10 * 1024 * 1024,
    };
  }

  /**
   * Perform memory optimization
   */
  public async optimize(): Promise<{
    success: boolean;
    freedBytes: number;
    actionsTaken: string[];
    errors: string[];
  }> {
    const actionsTaken: string[] = [];
    const errors: string[] = [];
    let freedBytes = 0;

    try {
      // Clear unused caches
      const cacheResult = await this.clearUnusedCaches();
      if (cacheResult.freedBytes > 0) {
        actionsTaken.push(`Cleared ${Math.round(cacheResult.freedBytes / 1024)}KB from caches`);
        freedBytes += cacheResult.freedBytes;
      }

      // Force garbage collection (if available)
      if (typeof (globalThis as any).gc === 'function') {
        (globalThis as any).gc();
        actionsTaken.push('Forced garbage collection');
      }

      // Clear temporary data
      const tempResult = this.clearTemporaryData();
      if (tempResult.freedBytes > 0) {
        actionsTaken.push(`Cleared ${Math.round(tempResult.freedBytes / 1024)}KB of temporary data`);
        freedBytes += tempResult.freedBytes;
      }

    } catch (error) {
      errors.push(`Optimization error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      freedBytes,
      actionsTaken,
      errors,
    };
  }

  /**
   * Clear unused caches
   */
  private async clearUnusedCaches(): Promise<{ freedBytes: number }> {
    let freedBytes = 0;

    try {
      // Clear expired items from localStorage
      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = [];
        const now = Date.now();

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('cache_')) {
            try {
              const item = localStorage.getItem(key);
              if (item) {
                const data = JSON.parse(item);
                if (data.expires && data.expires < now) {
                  keysToRemove.push(key);
                  freedBytes += (key.length + item.length) * 2;
                }
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      // Clear large temporary sessionStorage items
      if (typeof sessionStorage !== 'undefined') {
        const tempKeys = ['temp_', 'upload_', 'draft_'];
        const keysToRemove: string[] = [];

        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && tempKeys.some(prefix => key.startsWith(prefix))) {
            const value = sessionStorage.getItem(key);
            keysToRemove.push(key);
            if (value) {
              freedBytes += (key.length + value.length) * 2;
            }
          }
        }

        keysToRemove.forEach(key => sessionStorage.removeItem(key));
      }

    } catch (error) {
      console.warn('[MemoryOptimizer] Error clearing caches:', error);
    }

    return { freedBytes };
  }

  /**
   * Clear temporary data
   */
  private clearTemporaryData(): { freedBytes: number } {
    let freedBytes = 0;

    try {
      // Clear data attributes from DOM elements
      if (typeof document !== 'undefined') {
        const elements = document.querySelectorAll('[data-temp], [data-cache]');
        elements.forEach(element => {
          element.removeAttribute('data-temp');
          element.removeAttribute('data-cache');
        });
        freedBytes += elements.length * 50; // Approximate
      }

    } catch (error) {
      console.warn('[MemoryOptimizer] Error clearing temporary data:', error);
    }

    return { freedBytes };
  }

  /**
   * Create a memory usage report
   */
  public async createReport(): Promise<{
    profile: MemoryProfile;
    issues: MemoryIssue[];
    optimizations: OptimizationResult;
    optimizationResult?: Awaited<ReturnType<typeof this.optimize>>;
  }> {
    const profile = await this.getProfile();
    const issues = this.analyzeProfile(profile);
    const optimizations = this.getOptimizations(profile, issues);

    let optimizationResult;
    if (optimizations.shouldOptimize) {
      optimizationResult = await this.optimize();
    }

    return {
      profile,
      issues,
      optimizations,
      optimizationResult,
    };
  }
}

// Singleton instance
export const memoryOptimizer = new MemoryOptimizer();

// Export for easy use
export default memoryOptimizer;