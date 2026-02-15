import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCDNOptimization } from '@/services/cdnService';
import { useCloudflareCDN } from '@/services/cloudflareCDNService';
import StandardButton from './StandardButton';
import {
  Info,
  CheckCircle,
  AlertCircle,
  Download,
  RefreshCw,
  Globe,
  Wifi,
  WifiOff,
  Zap,
  Image as ImageIcon,
} from 'lucide-react';

interface CDNOptimizationDemoProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const CDNOptimizationDemo: React.FC<CDNOptimizationDemoProps> = ({
  isOpen = true,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'network' | 'format' | 'responsive' | 'cloudflare'>(
    'network'
  );
  const [selectedImage, setSelectedImage] = useState<string>(
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&h=800&fit=crop'
  );
  const [optimizationOptions, setOptimizationOptions] = useState({
    width: 800,
    height: 600,
    quality: 85,
    format: 'auto' as 'auto' | 'webp' | 'avif' | 'jpeg',
    networkType: '4g' as 'slow-2g' | '2g' | '3g' | '4g' | '5g',
  });

  const { optimizeImage, networkInfo, performanceMetrics, preloadImages } = useCDNOptimization({
    cdnBaseUrl: 'https://cdn.panacea.app',
    defaultQuality: 85,
    enableWebP: true,
    enableAVIF: true,
  });

  const cloudflareCDN = useCloudflareCDN({
    accountId: 'demo-account',
    apiToken: 'demo-token',
  });

  const [optimizedResult, setOptimizedResult] = useState<any>(null);
  const [cloudflareResult, setCloudflareResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preloaded, setPreloaded] = useState(false);

  const sampleImages = [
    {
      url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&h=800&fit=crop',
      name: 'Medical Illustration',
      size: '2.4 MB',
      type: 'JPEG',
    },
    {
      url: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=1600&h=900&fit=crop',
      name: 'Anatomy Diagram',
      size: '3.1 MB',
      type: 'PNG',
    },
    {
      url: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=1400&h=933&fit=crop',
      name: 'ECG Waveform',
      size: '1.8 MB',
      type: 'JPEG',
    },
    {
      url: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=2048&h=1152&fit=crop',
      name: 'High-Res Medical',
      size: '5.2 MB',
      type: 'JPEG',
    },
  ];

  const networkTypes = [
    { id: 'slow-2g', label: 'Slow 2G', speed: '50-100 Kbps', icon: WifiOff, color: 'text-red-500' },
    { id: '2g', label: '2G', speed: '100-300 Kbps', icon: Wifi, color: 'text-orange-500' },
    { id: '3g', label: '3G', speed: '700 Kbps - 1.5 Mbps', icon: Wifi, color: 'text-yellow-500' },
    { id: '4g', label: '4G', speed: '5-50 Mbps', icon: Wifi, color: 'text-green-500' },
    { id: '5g', label: '5G', speed: '100+ Mbps', icon: Zap, color: 'text-blue-500' },
  ];

  const formats = [
    { id: 'auto', label: 'Auto (Best)', compression: 'Optimal', browserSupport: 'Modern browsers' },
    {
      id: 'avif',
      label: 'AVIF',
      compression: 'Excellent (50-80%)',
      browserSupport: 'Chrome, Firefox, Edge',
    },
    {
      id: 'webp',
      label: 'WebP',
      compression: 'Very Good (25-35%)',
      browserSupport: 'Most browsers',
    },
    { id: 'jpeg', label: 'JPEG', compression: 'Good (10-20%)', browserSupport: 'All browsers' },
  ];

  useEffect(() => {
    if (isOpen) {
      runOptimization();
    }
  }, [selectedImage, optimizationOptions, isOpen]);

  const runOptimization = async () => {
    setIsLoading(true);
    try {
      const result = optimizeImage({
        src: selectedImage,
        width: optimizationOptions.width,
        height: optimizationOptions.height,
        quality: optimizationOptions.quality,
        format: optimizationOptions.format,
        networkType: optimizationOptions.networkType,
        generateSrcSet: true,
        generatePlaceholder: true,
        lazyLoad: true,
      });

      setOptimizedResult(result);

      // Simulate Cloudflare CDN optimization
      if (cloudflareCDN.isConfigured) {
        const cfResult = await cloudflareCDN.optimizeImage({
          src: selectedImage,
          width: optimizationOptions.width,
          height: optimizationOptions.height,
          variant: 'medium',
        });
        setCloudflareResult(cfResult);
      }
    } catch (error) {
      console.error('Optimization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreload = async () => {
    if (optimizedResult?.src) {
      await preloadImages([optimizedResult.src]);
      setPreloaded(true);
      setTimeout(() => setPreloaded(false), 3000);
    }
  };

  const calculateSavings = () => {
    if (!optimizedResult) return { size: 0, percentage: 0 };

    const originalSize = sampleImages.find((img) => img.url === selectedImage)?.size || '2.4 MB';
    const originalBytes = parseFloat(originalSize) * 1024 * 1024;
    const optimizedBytes = optimizedResult.estimatedSize || originalBytes * 0.3;

    return {
      size: (originalBytes - optimizedBytes) / (1024 * 1024),
      percentage: ((originalBytes - optimizedBytes) / originalBytes) * 100,
    };
  };

  const savings = calculateSavings();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl bg-[var(--color-bg-primary)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
                  <Globe className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                    CDN & Asset Optimization Demo
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Network-aware image optimization with automatic format selection
                  </p>
                </div>
              </div>
              <StandardButton
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Close
              </StandardButton>
            </div>

            {/* Main Content */}
            <div className="flex flex-col lg:flex-row h-[calc(90vh-80px)]">
              {/* Left Panel - Controls */}
              <div className="lg:w-1/3 p-6 border-r border-[var(--color-border)] overflow-y-auto">
                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                  {(
                    [
                      { id: 'network', label: 'Network', icon: Wifi },
                      { id: 'format', label: 'Format', icon: ImageIcon },
                      { id: 'responsive', label: 'Responsive', icon: RefreshCw },
                      { id: 'cloudflare', label: 'Cloudflare', icon: Globe },
                    ] as const
                  ).map((tab) => (
                    <StandardButton
                      key={tab.id}
                      variant={activeTab === tab.id ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab(tab.id)}
                      className="flex-1"
                    >
                      <tab.icon className="w-4 h-4 mr-2" />
                      {tab.label}
                    </StandardButton>
                  ))}
                </div>

                {/* Image Selection */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Select Image
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {sampleImages.map((img) => (
                      <button
                        key={img.url}
                        onClick={() => setSelectedImage(img.url)}
                        className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                          selectedImage === img.url
                            ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
                            : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                        }`}
                      >
                        <div className="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-[var(--color-text-tertiary)]" />
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                            {img.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {img.size} • {img.type}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Network Type Selection */}
                {activeTab === 'network' && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                      Network Connection
                    </h3>
                    <div className="space-y-2">
                      {networkTypes.map((net) => {
                        const Icon = net.icon;
                        return (
                          <button
                            key={net.id}
                            onClick={() =>
                              setOptimizationOptions((prev) => ({
                                ...prev,
                                networkType: net.id as any,
                              }))
                            }
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                              optimizationOptions.networkType === net.id
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                                : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`w-5 h-5 ${net.color}`} />
                              <div className="text-left">
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                  {net.label}
                                </p>
                                <p className="text-xs text-[var(--color-text-secondary)]">
                                  {net.speed}
                                </p>
                              </div>
                            </div>
                            {optimizationOptions.networkType === net.id && (
                              <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        <strong>Detected:</strong> {networkInfo.effectiveType || '4g'} • RTT:{' '}
                        {networkInfo.rtt || '50'}ms • Downlink: {networkInfo.downlink || '10'} Mbps
                      </p>
                    </div>
                  </div>
                )}

                {/* Format Selection */}
                {activeTab === 'format' && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                      Image Format
                    </h3>
                    <div className="space-y-2">
                      {formats.map((fmt) => (
                        <button
                          key={fmt.id}
                          onClick={() =>
                            setOptimizationOptions((prev) => ({
                              ...prev,
                              format: fmt.id as any,
                            }))
                          }
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            optimizationOptions.format === fmt.id
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                              : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">
                              {fmt.label}
                            </span>
                            {optimizationOptions.format === fmt.id && (
                              <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                            )}
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
                            <p>Compression: {fmt.compression}</p>
                            <p>Browser Support: {fmt.browserSupport}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        <strong>Best format detected:</strong>{' '}
                        {optimizedResult?.recommendedFormat || 'WebP'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quality Slider */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="quality-slider"
                      className="text-sm font-medium text-[var(--color-text-secondary)]"
                    >
                      Quality: {optimizationOptions.quality}%
                    </label>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {optimizationOptions.quality >= 90
                        ? 'High'
                        : optimizationOptions.quality >= 70
                          ? 'Balanced'
                          : 'Compressed'}
                    </span>
                  </div>
                  <input
                    id="quality-slider"
                    type="range"
                    min="30"
                    max="100"
                    value={optimizationOptions.quality}
                    onChange={(e) =>
                      setOptimizationOptions((prev) => ({
                        ...prev,
                        quality: parseInt(e.target.value),
                      }))
                    }
                    aria-label={`Image quality slider: ${optimizationOptions.quality} percent`}
                    className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent)]"
                  />
                  <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-1">
                    <span>Smaller</span>
                    <span>Larger</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <StandardButton
                    variant="primary"
                    size="lg"
                    onClick={runOptimization}
                    loading={isLoading}
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Re-optimize Image
                  </StandardButton>
                  <StandardButton
                    variant="outline"
                    size="lg"
                    onClick={handlePreload}
                    disabled={!optimizedResult?.src || preloaded}
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {preloaded ? 'Preloaded!' : 'Preload Image'}
                  </StandardButton>
                </div>
              </div>

              {/* Right Panel - Results */}
              <div className="lg:w-2/3 p-6 overflow-y-auto">
                {/* Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Size Reduction
                      </span>
                      <Zap className="w-4 h-4 text-[var(--color-success)]" />
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                      {savings.percentage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {savings.size.toFixed(2)} MB saved
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Load Time
                      </span>
                      <Zap className="w-4 h-4 text-[var(--color-warning)]" />
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                      {optimizedResult?.estimatedLoadTime || '1.2'}s
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      vs{' '}
                      {optimizedResult?.estimatedLoadTime
                        ? (optimizedResult.estimatedLoadTime * 3).toFixed(1)
                        : '3.6'}
                      s original
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Bandwidth Saved
                      </span>
                      <Globe className="w-4 h-4 text-[var(--color-accent)]" />
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                      {(savings.size * 1000).toFixed(0)} KB
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Per image load</p>
                  </div>
                </div>

                {/* Image Comparison */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Optimization Comparison
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                      <div className="p-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            Original
                          </span>
                          <span className="text-xs px-2 py-1 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                            {sampleImages.find((img) => img.url === selectedImage)?.size}
                          </span>
                        </div>
                      </div>
                      <div className="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center p-4">
                        <div className="text-center">
                          <ImageIcon className="w-12 h-12 mx-auto mb-2 text-[var(--color-text-tertiary)]" />
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            Large file - slow loading
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                      <div className="p-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            Optimized
                          </span>
                          <span className="text-xs px-2 py-1 rounded bg-[var(--color-success)]/10 text-[var(--color-success)]">
                            {(savings.size * 1024).toFixed(0)} KB saved
                          </span>
                        </div>
                      </div>
                      <div className="aspect-video bg-[var(--color-bg-tertiary)] flex items-center justify-center p-4">
                        <div className="text-center">
                          <Zap className="w-12 h-12 mx-auto mb-2 text-[var(--color-success)]" />
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            Optimized for {optimizationOptions.networkType}
                          </p>
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                            Format: {optimizedResult?.recommendedFormat || 'Auto'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Details */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Technical Details
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                      <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Optimized URL
                      </p>
                      <code className="text-xs text-[var(--color-text-primary)] break-all">
                        {optimizedResult?.src || 'Generating...'}
                      </code>
                    </div>
                    {optimizedResult?.srcSet && (
                      <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Responsive srcSet
                        </p>
                        <code className="text-xs text-[var(--color-text-primary)] break-all">
                          {optimizedResult.srcSet}
                        </code>
                      </div>
                    )}
                    {optimizedResult?.sizes && (
                      <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Sizes Attribute
                        </p>
                        <code className="text-xs text-[var(--color-text-primary)]">
                          {optimizedResult.sizes}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cloudflare CDN Details */}
                {activeTab === 'cloudflare' && cloudflareCDN.isConfigured && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <Globe className="w-5 h-5 text-blue-500" />
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                        Cloudflare CDN Integration
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Images Service</span>
                        <span className="text-[var(--color-success)] font-medium">Active</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">Stream Service</span>
                        <span className="text-[var(--color-success)] font-medium">Ready</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">R2 Storage</span>
                        <span className="text-[var(--color-success)] font-medium">Connected</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-blue-500/20">
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Cloudflare CDN provides global edge caching, automatic image optimization,
                          and video streaming with analytics.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Performance Tips */}
                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-[var(--color-accent)]" />
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
                      Performance Tips
                    </h4>
                  </div>
                  <ul className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-[var(--color-success)] mt-0.5 flex-shrink-0" />
                      Use WebP/AVIF formats for 50-80% smaller files
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-[var(--color-success)] mt-0.5 flex-shrink-0" />
                      Implement responsive images with srcSet
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-[var(--color-success)] mt-0.5 flex-shrink-0" />
                      Preload critical above-the-fold images
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-[var(--color-success)] mt-0.5 flex-shrink-0" />
                      Use lazy loading for below-the-fold content
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-success)]"></div>
                    <span className="text-[var(--color-text-secondary)]">
                      Performance Score: {performanceMetrics.score || 95}/100
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]"></div>
                    <span className="text-[var(--color-text-secondary)]">
                      Cache Hit Rate: {performanceMetrics.cacheHitRate || 92}%
                    </span>
                  </div>
                </div>
                <StandardButton
                  variant="accent"
                  size="sm"
                  onClick={() => {
                    // Export optimization settings
                    const settings = {
                      optimizationOptions,
                      optimizedResult,
                      performanceMetrics,
                    };
                    console.log('CDN Optimization Settings:', settings);
                    alert('Settings logged to console for development');
                  }}
                >
                  Export Settings
                </StandardButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
