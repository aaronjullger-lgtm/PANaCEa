/**
 * Performance Monitor Component
 *
 * Displays real-time performance metrics and optimization recommendations
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart,
  Download,
  Cpu,
} from 'lucide-react';
import { StandardButton, PrimaryButton, OutlineButton } from './StandardButton';
import { useInitialLoadOptimization, type LoadTimeMetrics } from '@/services/initialLoadOptimizer';

export interface PerformanceMonitorProps {
  /** Whether to show the monitor by default */
  defaultOpen?: boolean;
  /** Whether to show detailed metrics */
  showDetails?: boolean;
  /** Callback when performance score changes */
  onScoreChange?: (score: number) => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  defaultOpen = false,
  showDetails = true,
  onScoreChange,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { report, optimize } = useInitialLoadOptimization();

  // Notify parent of score changes
  useEffect(() => {
    if (onScoreChange && report.score > 0) {
      onScoreChange(report.score);
    }
  }, [report.score, onScoreChange]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-data-pass';
    if (score >= 70) return 'text-[var(--color-data-provisional)]';
    return 'text-data-fail';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Poor';
  };

  const formatMetric = (value: number | null | undefined, unit: string = 'ms') => {
    if (value === null || value === undefined) return '--';
    return `${value.toFixed(0)}${unit}`;
  };

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const renderMetricCard = (
    title: string,
    value: string,
    target: string,
    status: 'good' | 'warning' | 'poor',
    icon: React.ReactNode
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${
        status === 'good'
          ? 'border-[var(--color-data-pass)]/20 bg-[var(--color-data-pass)]/10'
          : status === 'warning'
            ? 'border-[var(--color-data-provisional)]/20 bg-[var(--color-data-provisional)]/10'
            : 'border-[var(--color-data-fail)]/20 bg-[var(--color-data-fail)]/10'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <span
          className={`text-sm font-semibold ${
            status === 'good'
              ? 'text-data-pass'
              : status === 'warning'
                ? 'text-[var(--color-data-provisional)]'
                : 'text-data-fail'
          }`}
        >
          {value}
        </span>
      </div>
      <div className="text-xs text-[var(--color-text-muted)]">Target: {target}</div>
    </motion.div>
  );

  const renderResourceCard = (resource: { name: string; size: number }) => (
    <div
      key={resource.name}
      className="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded-lg"
    >
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-[var(--color-text-muted)]" />
        <span className="text-sm font-medium truncate max-w-[200px]">{resource.name}</span>
      </div>
      <span className="text-sm text-[var(--color-text-muted)]">{formatSize(resource.size)}</span>
    </div>
  );

  return (
    <div className="relative">
      {/* Floating toggle button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full shadow-lg ${
          report.score >= 70
            ? 'bg-data-pass hover:bg-data-pass'
            : report.score >= 50
              ? 'bg-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]'
              : 'bg-data-fail hover:bg-data-fail'
        } text-white transition-colors`}
        aria-label="Performance Monitor"
      >
        <Activity className="w-6 h-6" />
        {report.score > 0 && (
          <span className="absolute -top-1 -right-1 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border)] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {report.score}
          </span>
        )}
      </motion.button>

      {/* Monitor Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--color-bg-secondary)] rounded-lg">
                    <Activity className="w-6 h-6 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Performance Monitor</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Real-time load optimization
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Overall Score */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm text-[var(--color-text-muted)] mb-1">
                    Performance Score
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(report.score)}`}>
                    {report.score}
                    <span className="text-lg">/100</span>
                  </div>
                  <div className="text-sm font-medium">{getScoreLabel(report.score)}</div>
                </div>
                <div className="flex gap-2">
                  <OutlineButton
                    size="sm"
                    onClick={() => optimize()}
                    icon={<Zap className="w-4 h-4" />}
                  >
                    Optimize
                  </OutlineButton>
                  <StandardButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? 'Simple' : 'Advanced'}
                  </StandardButton>
                </div>
              </div>

              {/* Score Bar */}
              <div className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${report.score}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full ${
                    report.score >= 70
                      ? 'bg-data-pass'
                      : report.score >= 50
                        ? 'bg-[var(--color-data-provisional)]'
                        : 'bg-data-fail'
                  }`}
                />
              </div>
              <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {showDetails && (
                <>
                  {/* Core Web Vitals */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart className="w-5 h-5 text-[var(--color-accent)]" />
                      <h4 className="font-semibold">Core Web Vitals</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {renderMetricCard(
                        'First Contentful Paint',
                        formatMetric(report.metrics?.firstContentfulPaint),
                        '< 1.8s',
                        (report.metrics?.firstContentfulPaint || 0) < 1800
                          ? 'good'
                          : (report.metrics?.firstContentfulPaint || 0) < 3000
                            ? 'warning'
                            : 'poor',
                        <Clock className="w-4 h-4" />
                      )}
                      {renderMetricCard(
                        'Largest Contentful Paint',
                        formatMetric(report.metrics?.largestContentfulPaint),
                        '< 2.5s',
                        (report.metrics?.largestContentfulPaint || 0) < 2500
                          ? 'good'
                          : (report.metrics?.largestContentfulPaint || 0) < 4000
                            ? 'warning'
                            : 'poor',
                        <Download className="w-4 h-4" />
                      )}
                      {renderMetricCard(
                        'First Input Delay',
                        formatMetric(report.metrics?.firstInputDelay),
                        '< 100ms',
                        (report.metrics?.firstInputDelay || 0) < 100
                          ? 'good'
                          : (report.metrics?.firstInputDelay || 0) < 300
                            ? 'warning'
                            : 'poor',
                        <Cpu className="w-4 h-4" />
                      )}
                      {renderMetricCard(
                        'Layout Shift',
                        formatMetric(report.metrics?.cumulativeLayoutShift, ''),
                        '< 0.1',
                        (report.metrics?.cumulativeLayoutShift || 0) < 0.1
                          ? 'good'
                          : (report.metrics?.cumulativeLayoutShift || 0) < 0.25
                            ? 'warning'
                            : 'poor',
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Bundle Analysis */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-[var(--color-accent)]" />
                        <h4 className="font-semibold">Bundle Analysis</h4>
                      </div>
                      <span className="text-sm text-[var(--color-text-muted)]">
                        Total: {formatSize(report.resourceAnalysis.totalSize)}
                      </span>
                    </div>

                    {report.resourceAnalysis.largestChunks.length > 0 ? (
                      <div className="space-y-2">
                        {report.resourceAnalysis.largestChunks.slice(0, 3).map(renderResourceCard)}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-[var(--color-text-muted)]">
                        No bundle data available
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-[var(--color-data-provisional)]" />
                    <h4 className="font-semibold">Recommendations</h4>
                  </div>
                  <div className="space-y-2">
                    {report.recommendations.slice(0, 3).map((rec, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3 p-3 bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/20 rounded-lg"
                      >
                        <AlertTriangle className="w-4 h-4 text-[var(--color-data-provisional)] mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{rec}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced Metrics */}
              {showAdvanced && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu className="w-5 h-5 text-[var(--color-accent)]" />
                    <h4 className="font-semibold">Advanced Metrics</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">
                        Total Blocking Time
                      </div>
                      <div className="font-semibold">
                        {formatMetric(report.metrics?.totalBlockingTime)}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">
                        Time to Interactive
                      </div>
                      <div className="font-semibold">
                        {formatMetric(report.metrics?.timeToInteractive)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <PrimaryButton
                  fullWidth
                  onClick={() => optimize()}
                  icon={<Zap className="w-4 h-4" />}
                >
                  Run Optimization Now
                </PrimaryButton>
                <div className="flex gap-2">
                  <OutlineButton
                    fullWidth
                    onClick={() => {
                      console.log('Performance Report:', report);
                      alert('Performance report logged to console');
                    }}
                  >
                    Export Report
                  </OutlineButton>
                  <StandardButton
                    variant="ghost"
                    fullWidth
                    onClick={() => {
                      location.reload();
                    }}
                  >
                    Refresh Page
                  </StandardButton>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      report.score >= 70
                        ? 'bg-data-pass'
                        : report.score >= 50
                          ? 'bg-[var(--color-data-provisional)]'
                          : 'bg-data-fail'
                    }`}
                  />
                  <span className="text-[var(--color-text-muted)]">
                    Last updated:{' '}
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  v1.0 • Auto-refresh: 30s
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PerformanceMonitor;
