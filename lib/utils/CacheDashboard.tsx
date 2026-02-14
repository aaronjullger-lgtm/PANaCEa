/**
 * Cache Dashboard UI component - displays cache stats and controls.
 * Separated from cachingStrategies.ts so the main module can stay .ts (no JSX).
 */

import React, { useState, useEffect } from 'react';
import { cacheManager } from './cachingStrategies';
import type { CacheStats } from './cachingStrategies';

export const CacheDashboard: React.FC = () => {
  const [stats, setStats] = useState<Record<string, CacheStats>>({});
  const [selectedCache, setSelectedCache] = useState<string>('default');

  useEffect(() => {
    const updateStats = () => {
      setStats(cacheManager.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const handleClearCache = (name: string) => {
    cacheManager.clearCache(name);
    setStats(cacheManager.getStats());
  };

  const handleClearAll = () => {
    cacheManager.clearAll();
    setStats({});
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Cache Dashboard
        </h3>
        <button
          onClick={handleClearAll}
          className="px-3 py-1 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
        >
          Clear All Caches
        </button>
      </div>

      {/* Cache Selection */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(stats).map((name) => (
          <button
            key={name}
            onClick={() => setSelectedCache(name)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              selectedCache === name
                ? 'bg-[var(--color-action-primary)] text-white'
                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-action-muted)]'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Cache Stats */}
      {stats[selectedCache] && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
              <div className="text-sm text-[var(--color-text-muted)]">Hit Rate</div>
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {formatPercentage(stats[selectedCache].hitRate)}
              </div>
            </div>
            <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
              <div className="text-sm text-[var(--color-text-muted)]">Total Requests</div>
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {stats[selectedCache].hits + stats[selectedCache].misses}
              </div>
            </div>
            <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
              <div className="text-sm text-[var(--color-text-muted)]">Memory Size</div>
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {formatBytes(stats[selectedCache].memorySize)}
              </div>
            </div>
            <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
              <div className="text-sm text-[var(--color-text-muted)]">Avg Response Time</div>
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {stats[selectedCache].avgResponseTime.toFixed(1)}ms
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-[var(--color-text-muted)]">Cache Distribution</div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {stats[selectedCache].memoryEntries} memory / {stats[selectedCache].persistentEntries} persistent
              </div>
            </div>
            <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
              <div
                className="bg-[var(--color-action-primary)] h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(stats[selectedCache].memoryEntries / (stats[selectedCache].memoryEntries + stats[selectedCache].persistentEntries || 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleClearCache(selectedCache)}
              className="px-3 py-1 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Clear {selectedCache} Cache
            </button>
          </div>
        </div>
      )}

      {/* Cache Tips */}
      <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-lg p-3">
        <h4 className="font-medium text-[var(--color-text-primary)] mb-1">
          Cache Optimization Tips
        </h4>
        <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
          <li>• Aim for hit rate above 80% for optimal performance</li>
          <li>• Use appropriate TTL based on data volatility</li>
          <li>• Consider stale-while-revalidate for frequently changing data</li>
          <li>• Monitor memory usage to prevent excessive growth</li>
        </ul>
      </div>
    </div>
  );
};
