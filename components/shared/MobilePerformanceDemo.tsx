/**
 * MobilePerformanceDemo Component
 *
 * Demonstrates and tests mobile performance optimizations.
 * Shows network conditions, performance metrics, and optimization recommendations.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  Battery,
  Cpu,
  Zap,
  AlertCircle,
  CheckCircle,
  BarChart,
  Smartphone,
  WifiOff,
  BatteryCharging,
} from 'lucide-react';
import { StandardButton, PrimaryButton, SecondaryButton } from './StandardButton';
import {
  useMobilePerformance,
  useMobileImageOptimization,
  useInteractionBasedLoading,
} from '@/hooks/useMobilePerformance';

export interface MobilePerformanceDemoProps {
  /** Whether the demo is initially open */
  defaultOpen?: boolean;
  /** Callback when demo is closed */
  onClose?: () => void;
}

export const MobilePerformanceDemo: React.FC<MobilePerformanceDemoProps> = ({
  defaultOpen = false,
  onClose,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'optimizations' | 'testing'>(
    'dashboard'
  );
  const [testImages, setTestImages] = useState<
    Array<{ src: string; loaded: boolean; loadTime: number }>
  >([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Use performance hooks
  const {
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
  } = useMobilePerformance({
    networkAware: true,
    batteryAware: true,
    memoryMonitoring: true,
    performanceReporting: true,
    prefetching: true,
    debug: true,
  });

  const { getOptimizedImageConfig, isSlowConnection: isImageSlowConnection } =
    useMobileImageOptimization();
  const { hasUserInteracted, shouldLoadResource } = useInteractionBasedLoading();

  const runPerformanceTests = async () => {
    setIsRunningTests(true);

    // Test 1: Image loading performance
    const testImageUrls = [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop',
    ];

    const imageResults = await Promise.all(
      testImageUrls.map(async (url) => {
        const startTime = performance.now();
        return new Promise<{ src: string; loaded: boolean; loadTime: number }>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const loadTime = performance.now() - startTime;
            resolve({ src: url, loaded: true, loadTime: Math.round(loadTime) });
          };
          img.onerror = () => {
            const loadTime = performance.now() - startTime;
            resolve({ src: url, loaded: false, loadTime: Math.round(loadTime) });
          };
          img.src = url;
        });
      })
    );

    setTestImages(imageResults);

    // Report metrics
    const avgLoadTime =
      imageResults.reduce((sum, img) => sum + img.loadTime, 0) / imageResults.length;
    reportMetric('image_load_time', avgLoadTime);

    // Test 2: DOM performance
    const domStartTime = performance.now();
    const divCount = 100;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < divCount; i++) {
      const div = document.createElement('div');
      div.textContent = `Test ${i}`;
      div.style.display = 'none';
      fragment.appendChild(div);
    }

    const testContainer = document.getElementById('performance-test-container');
    if (testContainer) {
      testContainer.appendChild(fragment);
      const domTime = performance.now() - domStartTime;
      reportMetric('dom_operation_time', domTime);

      // Clean up
      setTimeout(() => {
        testContainer.innerHTML = '';
      }, 1000);
    }

    setIsRunningTests(false);
  };

  const applyOptimizations = () => {
    // Apply optimizations to all images on the page
    document.querySelectorAll('img').forEach((img) => {
      if (img instanceof HTMLElement) {
        applyNetworkOptimizations(img);
      }
    });

    // Prefetch some resources if connection is good
    if (!isSlowConnection && !isSaveData) {
      prefetchResource('/api/health-check', 'low');
      prefetchResource('/images/placeholder.jpg', 'low');
    }

    alert('Applied mobile performance optimizations to current page');
  };

  const getNetworkIcon = () => {
    switch (network.effectiveType) {
      case 'slow-2g':
      case '2g':
        return <WifiOff className="w-5 h-5" />;
      case '3g':
        return <Wifi className="w-5 h-5" />;
      case '4g':
      case '5g':
        return <Wifi className="w-5 h-5" />;
      case 'wifi':
        return <Wifi className="w-5 h-5" />;
      default:
        return <Wifi className="w-5 h-5" />;
    }
  };

  const getNetworkColor = () => {
    if (isSlowConnection) return 'text-[var(--color-error)]';
    if (
      network.effectiveType === 'wifi' ||
      network.effectiveType === '4g' ||
      network.effectiveType === '5g'
    ) {
      return 'text-[var(--color-success)]';
    }
    return 'text-[var(--color-warning)]';
  };

  const getBatteryColor = () => {
    if (batteryLevel === null) return 'text-[var(--color-text-muted)]';
    if (batteryLevel < 0.2) return 'text-[var(--color-error)]';
    if (batteryLevel < 0.5) return 'text-[var(--color-warning)]';
    return 'text-[var(--color-success)]';
  };

  const getMemoryColor = () => {
    switch (hasLowMemory) {
      case true:
        return 'text-[var(--color-error)]';
      default:
        return 'text-[var(--color-success)]';
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-24 right-6 z-50">
        <PrimaryButton
          leftIcon={<Zap className="w-4 h-4" />}
          onClick={() => setIsOpen(true)}
          size="lg"
          className="shadow-lg"
        >
          Test Mobile Performance
        </PrimaryButton>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => {
        setIsOpen(false);
        onClose?.();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
              <Zap className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Mobile Performance Dashboard
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Real-time performance monitoring and optimization
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              onClose?.();
            }}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {['dashboard', 'optimizations', 'testing'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Network Card */}
                  <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`p-2 rounded-lg ${getNetworkColor().replace('text-', 'bg-')}/10`}
                      >
                        {getNetworkIcon()}
                      </div>
                      {isSlowConnection && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)]">
                          Slow
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-[var(--color-text-primary)] mb-1">Network</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {network.effectiveType.toUpperCase()} • {network.downlink.toFixed(1)} Mbps
                    </p>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      RTT: {network.rtt}ms • Save Data: {network.saveData ? 'On' : 'Off'}
                    </div>
                  </div>

                  {/* Battery Card */}
                  <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`p-2 rounded-lg ${getBatteryColor().replace('text-', 'bg-')}/10`}
                      >
                        {batteryLevel !== null && batteryLevel < 0.3 ? (
                          <BatteryCharging className="w-5 h-5" />
                        ) : (
                          <Battery className="w-5 h-5" />
                        )}
                      </div>
                      {batteryLevel !== null && batteryLevel < 0.3 && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)]">
                          Low
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-[var(--color-text-primary)] mb-1">Battery</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {batteryLevel !== null
                        ? `${Math.round(batteryLevel * 100)}%`
                        : 'Not available'}
                    </p>
                    <div className="w-full h-2 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBatteryColor().replace('text-', 'bg-')}`}
                        style={{ width: batteryLevel !== null ? `${batteryLevel * 100}%` : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Memory Card */}
                  <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`p-2 rounded-lg ${getMemoryColor().replace('text-', 'bg-')}/10`}
                      >
                        <Cpu className="w-5 h-5" />
                      </div>
                      {hasLowMemory && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)]">
                          High
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-[var(--color-text-primary)] mb-1">Memory</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {hasLowMemory ? 'High pressure' : 'Normal'}
                    </p>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Monitor memory usage for optimizations
                    </div>
                  </div>

                  {/* Interaction Card */}
                  <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                        <Smartphone className="w-5 h-5 text-[var(--color-accent)]" />
                      </div>
                      {hasUserInteracted && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
                          Active
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-[var(--color-text-primary)] mb-1">
                      User Interaction
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {hasUserInteracted ? 'User has interacted' : 'Waiting for interaction'}
                    </p>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Non-critical resources: {shouldLoadResource('low') ? 'Loaded' : 'Pending'}
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                        Performance Metrics
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Core Web Vitals and custom metrics
                      </p>
                    </div>
                    <BarChart className="w-6 h-6 text-[var(--color-text-muted)]" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      { label: 'FCP', value: metrics.fcp, unit: 'ms', threshold: 3000 },
                      { label: 'LCP', value: metrics.lcp, unit: 'ms', threshold: 4000 },
                      { label: 'CLS', value: metrics.cls, unit: '', threshold: 0.1 },
                      { label: 'FID', value: metrics.fid, unit: 'ms', threshold: 100 },
                      { label: 'TTI', value: metrics.tti, unit: 'ms', threshold: 5000 },
                      { label: 'TBT', value: metrics.tbt, unit: 'ms', threshold: 300 },
                    ].map((metric) => {
                      const isGood = metric.value === null || metric.value <= metric.threshold;
                      const isWarning =
                        metric.value !== null && metric.value > metric.threshold * 0.8;
                      const isBad = metric.value !== null && metric.value > metric.threshold;

                      return (
                        <div key={metric.label} className="text-center">
                          <div
                            className={`text-2xl font-bold mb-1 ${
                              isBad
                                ? 'text-[var(--color-error)]'
                                : isWarning
                                  ? 'text-[var(--color-warning)]'
                                  : 'text-[var(--color-success)]'
                            }`}
                          >
                            {metric.value !== null ? metric.value : '—'}
                          </div>
                          <div className="text-sm text-[var(--color-text-secondary)]">
                            {metric.label}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {metric.unit}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optimization Recommendations */}
                <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                        Optimization Recommendations
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Based on current device and network conditions
                      </p>
                    </div>
                    <AlertCircle className="w-6 h-6 text-[var(--color-warning)]" />
                  </div>

                  <div className="space-y-3">
                    {getOptimizationRecommendations()
                      .slice(0, 5)
                      .map((recommendation, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]"
                        >
                          <div className="mt-0.5">
                            <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                          </div>
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {recommendation}
                          </span>
                        </div>
                      ))}

                    {getOptimizationRecommendations().length === 0 && (
                      <div className="text-center py-4">
                        <CheckCircle className="w-12 h-12 text-[var(--color-success)] mx-auto mb-3" />
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          No optimization recommendations needed. Performance looks good!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'optimizations' && (
              <motion.div
                key="optimizations"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                    Mobile Performance Optimizations
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-6">
                    These optimizations are automatically applied based on device conditions
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      title: 'Network-Aware Loading',
                      description: 'Adjusts resource quality based on connection speed',
                      status: isSlowConnection
                        ? 'Active (Slow connection)'
                        : 'Active (Good connection)',
                      config: getOptimizedImageConfig(),
                      icon: <Wifi className="w-5 h-5" />,
                    },
                    {
                      title: 'Battery-Aware Optimizations',
                      description: 'Reduces animations and background tasks on low battery',
                      status:
                        batteryLevel !== null && batteryLevel < 0.3
                          ? 'Active (Low battery)'
                          : 'Active',
                      config: { reduceAnimations: batteryLevel !== null && batteryLevel < 0.3 },
                      icon: <Battery className="w-5 h-5" />,
                    },
                    {
                      title: 'Memory Monitoring',
                      description: 'Detects high memory pressure and applies optimizations',
                      status: hasLowMemory ? 'Active (High memory)' : 'Active',
                      config: { virtualScrolling: hasLowMemory, cleanupInterval: '30s' },
                      icon: <Cpu className="w-5 h-5" />,
                    },
                    {
                      title: 'Interaction-Based Loading',
                      description: 'Loads non-critical resources only after user interaction',
                      status: hasUserInteracted
                        ? 'Active (User interacted)'
                        : 'Waiting for interaction',
                      config: { hasInteracted: hasUserInteracted },
                      icon: <Smartphone className="w-5 h-5" />,
                    },
                    {
                      title: 'Connection-Aware Prefetching',
                      description: 'Prefetches resources only on good connections',
                      status: isSlowConnection ? 'Paused (Slow connection)' : 'Active',
                      config: { enabled: !isSlowConnection },
                      icon: <Zap className="w-5 h-5" />,
                    },
                  ].map((optimization, index) => (
                    <div
                      key={index}
                      className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                            {optimization.icon}
                          </div>
                          <div>
                            <h4 className="font-medium text-[var(--color-text-primary)]">
                              {optimization.title}
                            </h4>
                            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                              {optimization.description}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full ${
                            optimization.status.includes('Active')
                              ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                              : optimization.status.includes('Paused')
                                ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                                : 'bg-[var(--color-info)]/10 text-[var(--color-info)]'
                          }`}
                        >
                          {optimization.status}
                        </span>
                      </div>

                      <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                        <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                          Current Configuration:
                        </div>
                        <pre className="text-xs text-[var(--color-text-muted)] overflow-x-auto">
                          {JSON.stringify(optimization.config, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-accent)]/5">
                  <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-3">
                    Apply Optimizations Now
                  </h4>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    Manually apply mobile performance optimizations to the current page:
                  </p>
                  <div className="flex items-center gap-3">
                    <PrimaryButton
                      leftIcon={<Zap className="w-4 h-4" />}
                      onClick={applyOptimizations}
                    >
                      Apply All Optimizations
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={() => {
                        // Apply only image optimizations
                        document.querySelectorAll('img').forEach((img) => {
                          if (img instanceof HTMLElement) {
                            applyNetworkOptimizations(img);
                          }
                        });
                        alert('Applied image optimizations only');
                      }}
                    >
                      Optimize Images Only
                    </SecondaryButton>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'testing' && (
              <motion.div
                key="testing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                      Performance Testing
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Run tests to measure mobile performance
                    </p>
                  </div>
                  <PrimaryButton
                    leftIcon={<Zap className="w-4 h-4" />}
                    onClick={runPerformanceTests}
                    loading={isRunningTests}
                  >
                    Run Performance Tests
                  </PrimaryButton>
                </div>

                {/* Test Results */}
                {testImages.length > 0 && (
                  <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                      Image Loading Test Results
                    </h4>
                    <div className="space-y-4">
                      {testImages.map((image, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border ${image.loaded ? 'border-[var(--color-success)]/20 bg-[var(--color-success)]/5' : 'border-[var(--color-error)]/20 bg-[var(--color-error)]/5'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {image.loaded ? (
                                <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-[var(--color-error)]" />
                              )}
                              <div>
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  Image {index + 1}
                                </span>
                                <div className="text-xs text-[var(--color-text-muted)] truncate max-w-xs">
                                  {image.src}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`text-lg font-semibold ${image.loaded ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}
                              >
                                {image.loadTime}ms
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)]">
                                Load time
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="mt-4 p-4 rounded-lg bg-[var(--color-bg-primary)]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            Average Load Time
                          </span>
                          <span className="text-lg font-semibold text-[var(--color-accent)]">
                            {Math.round(
                              testImages.reduce((sum, img) => sum + img.loadTime, 0) /
                                testImages.length
                            )}
                            ms
                          </span>
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-2">
                          Network: {network.effectiveType} • Connection:{' '}
                          {isSlowConnection ? 'Slow' : 'Good'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test Container (hidden) */}
                <div id="performance-test-container" className="hidden" />

                {/* Performance Tips */}
                <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                    Mobile Performance Tips
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      'Use WebP/AVIF format for images',
                      'Implement lazy loading for below-the-fold content',
                      'Minimize JavaScript bundle size',
                      'Use code splitting for routes',
                      'Optimize CSS delivery',
                      'Reduce third-party scripts',
                      'Implement service workers for caching',
                      'Use CDN for static assets',
                    ].map((tip, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]"
                      >
                        <div className="mt-0.5">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                        </div>
                        <span className="text-sm text-[var(--color-text-secondary)]">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-text-muted)]">
              Network: {network.effectiveType} • Battery:{' '}
              {batteryLevel !== null ? `${Math.round(batteryLevel * 100)}%` : 'N/A'} • Memory:{' '}
              {hasLowMemory ? 'High' : 'Normal'}
            </div>
            <div className="flex items-center gap-3">
              <SecondaryButton size="sm" onClick={() => setIsOpen(false)}>
                Close
              </SecondaryButton>
              <PrimaryButton size="sm" onClick={applyOptimizations}>
                Apply Optimizations
              </PrimaryButton>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
