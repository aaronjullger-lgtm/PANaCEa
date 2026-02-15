/**
 * Comprehensive CDN Service for PANaCEa
 *
 * Provides centralized CDN configuration, asset optimization, and performance monitoring.
 * Integrates with Cloudflare CDN, R2 storage, and edge caching strategies.
 */

export interface CDNConfig {
  /** CDN base URL (e.g., https://cdn.studypanacea.com) */
  baseUrl: string;
  /** Enable automatic image optimization */
  autoOptimizeImages: boolean;
  /** Enable automatic video optimization */
  autoOptimizeVideos: boolean;
  /** Enable automatic font optimization */
  autoOptimizeFonts: boolean;
  /** Default image quality (0-100) */
  defaultImageQuality: number;
  /** Enable WebP conversion */
  enableWebP: boolean;
  /** Enable AVIF conversion */
  enableAVIF: boolean;
  /** Enable responsive images */
  enableResponsive: boolean;
  /** Cache duration in seconds */
  cacheDuration: number;
  /** Enable edge caching */
  edgeCaching: boolean;
  /** Enable brotli compression */
  brotliCompression: boolean;
  /** Enable gzip compression */
  gzipCompression: boolean;
  /** CDN provider */
  provider: 'cloudflare' | 'custom';
  /** R2 bucket for asset storage */
  r2Bucket?: string;
  /** Enable analytics */
  analytics: boolean;
}

export interface AssetOptimizationOptions {
  /** Asset type */
  type: 'image' | 'video' | 'font' | 'script' | 'stylesheet' | 'document';
  /** Original URL */
  originalUrl: string;
  /** Target width (for images/videos) */
  width?: number;
  /** Target height (for images/videos) */
  height?: number;
  /** Quality (0-100) */
  quality?: number;
  /** Format (auto, webp, avif, jpeg, png, mp4, webm) */
  format?: string;
  /** Enable lazy loading */
  lazy?: boolean;
  /** Generate placeholder */
  placeholder?: boolean;
  /** Network-aware optimization */
  networkAware?: boolean;
  /** Device pixel ratio */
  devicePixelRatio?: number;
}

export interface OptimizedAsset {
  /** Optimized URL */
  url: string;
  /** Source set for responsive images */
  srcSet?: string;
  /** Sizes attribute */
  sizes?: string;
  /** Placeholder data */
  placeholder?: string;
  /** Dimensions */
  width?: number;
  height?: number;
  /** File size estimate (bytes) */
  estimatedSize: number;
  /** Format used */
  format: string;
  /** Compression ratio */
  compressionRatio: number;
  /** CDN cache status */
  cacheStatus: 'hit' | 'miss' | 'stale' | 'revalidated';
}

export interface CDNPerformanceMetrics {
  /** Total requests */
  totalRequests: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Average response time (ms) */
  avgResponseTime: number;
  /** Total bandwidth saved (bytes) */
  bandwidthSaved: number;
  /** Optimization savings percentage */
  optimizationSavings: number;
  /** Edge locations served */
  edgeLocations: number;
}

/**
 * Default CDN configuration for PANaCEa
 */
export const DEFAULT_CDN_CONFIG: CDNConfig = {
  baseUrl: 'https://cdn.studypanacea.com',
  autoOptimizeImages: true,
  autoOptimizeVideos: true,
  autoOptimizeFonts: true,
  defaultImageQuality: 85,
  enableWebP: true,
  enableAVIF: true,
  enableResponsive: true,
  cacheDuration: 31536000, // 1 year
  edgeCaching: true,
  brotliCompression: true,
  gzipCompression: true,
  provider: 'cloudflare',
  r2Bucket: 'panacea-assets',
  analytics: true,
};

/**
 * Network presets for adaptive optimization
 */
const NETWORK_PRESETS = {
  'slow-2g': { quality: 30, format: 'jpeg', lazy: true },
  '2g': { quality: 50, format: 'jpeg', lazy: true },
  '3g': { quality: 70, format: 'webp', lazy: true },
  '4g': { quality: 85, format: 'avif', lazy: false },
  '5g': { quality: 95, format: 'avif', lazy: false },
};

/**
 * Device presets for responsive optimization
 */
const DEVICE_PRESETS = {
  mobile: { width: 768, breakpoints: [320, 480, 768] },
  tablet: { width: 1024, breakpoints: [768, 1024, 1280] },
  desktop: { width: 1920, breakpoints: [1024, 1280, 1536, 1920] },
  '4k': { width: 3840, breakpoints: [1920, 2560, 3840] },
};

/**
 * Main CDN Service class
 */
export class CDNService {
  private config: CDNConfig;
  private performanceMetrics: CDNPerformanceMetrics;
  private networkInfo: any;

  constructor(config?: Partial<CDNConfig>) {
    this.config = { ...DEFAULT_CDN_CONFIG, ...config };
    this.performanceMetrics = this.initializeMetrics();
    this.networkInfo = this.detectNetworkInfo();
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): CDNPerformanceMetrics {
    return {
      totalRequests: 0,
      cacheHitRate: 0,
      avgResponseTime: 0,
      bandwidthSaved: 0,
      optimizationSavings: 0,
      edgeLocations: 0,
    };
  }

  /**
   * Detect network information from browser APIs
   */
  private detectNetworkInfo() {
    if (typeof window === 'undefined') {
      return { effectiveType: '4g', saveData: false };
    }

    const connection = (navigator as any).connection;
    return {
      effectiveType: connection?.effectiveType || '4g',
      saveData: connection?.saveData || false,
      devicePixelRatio: window.devicePixelRatio || 1,
      viewportWidth: window.innerWidth,
    };
  }

  /**
   * Get device type based on viewport width
   */
  private getDeviceType(width: number): keyof typeof DEVICE_PRESETS {
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    if (width <= 1920) return 'desktop';
    return '4k';
  }

  /**
   * Generate optimized asset URL
   */
  public optimizeAsset(options: AssetOptimizationOptions): OptimizedAsset {
    const { type, originalUrl, width, height, quality, format, lazy, placeholder, networkAware } =
      options;

    // Update metrics
    this.performanceMetrics.totalRequests++;

    // Apply network-aware optimization if enabled
    const optimizedOptions = networkAware ? this.applyNetworkAwareOptimization(options) : options;

    // Generate CDN URL
    const cdnUrl = this.generateCDNUrl(optimizedOptions);

    // Generate responsive srcSet if enabled and applicable
    const srcSet =
      this.config.enableResponsive && (type === 'image' || type === 'video')
        ? this.generateSrcSet(optimizedOptions)
        : undefined;

    // Generate placeholder if requested
    const placeholderData =
      placeholder && (type === 'image' || type === 'video')
        ? this.generatePlaceholder(originalUrl)
        : undefined;

    // Estimate file size
    const estimatedSize = this.estimateFileSize(optimizedOptions);

    return {
      url: cdnUrl,
      srcSet,
      sizes: this.generateSizesAttribute(optimizedOptions),
      placeholder: placeholderData,
      width: optimizedOptions.width,
      height: optimizedOptions.height,
      estimatedSize,
      format: optimizedOptions.format || 'auto',
      compressionRatio: this.calculateCompressionRatio(originalUrl, estimatedSize),
      cacheStatus: 'hit', // This would be determined by actual CDN response
    };
  }

  /**
   * Apply network-aware optimization
   */
  private applyNetworkAwareOptimization(
    options: AssetOptimizationOptions
  ): AssetOptimizationOptions {
    const { effectiveType, saveData } = this.networkInfo;
    const preset =
      NETWORK_PRESETS[effectiveType as keyof typeof NETWORK_PRESETS] || NETWORK_PRESETS['4g'];

    const optimized = { ...options };

    // Adjust quality based on network
    if (options.quality === undefined) {
      optimized.quality = preset.quality;
    }

    // Further reduce quality if save data is enabled
    if (saveData && optimized.quality) {
      optimized.quality = Math.max(30, optimized.quality - 20);
    }

    // Adjust format based on network and browser support
    if (options.format === 'auto' || options.format === undefined) {
      optimized.format = this.getBestFormat(preset.format);
    }

    // Enable lazy loading for slower networks
    if (options.lazy === undefined) {
      optimized.lazy = preset.lazy;
    }

    return optimized;
  }

  /**
   * Get best format based on browser support
   */
  private getBestFormat(preferredFormat: string): string {
    if (typeof window === 'undefined') return 'webp';

    // Check AVIF support
    if (preferredFormat === 'avif' && this.config.enableAVIF) {
      const avifSupported = this.checkAVIFSupport();
      if (avifSupported) return 'avif';
    }

    // Check WebP support
    if ((preferredFormat === 'webp' || preferredFormat === 'avif') && this.config.enableWebP) {
      const webpSupported = this.checkWebPSupport();
      if (webpSupported) return 'webp';
    }

    // Fallback to JPEG
    return 'jpeg';
  }

  /**
   * Check AVIF support
   */
  private checkAVIFSupport(): boolean {
    if (typeof window === 'undefined') return false;

    const canvas = document.createElement('canvas');
    if (!canvas.getContext) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Create test image
    const avifData =
      'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = avifData;
    })
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Check WebP support
   */
  private checkWebPSupport(): boolean {
    if (typeof window === 'undefined') return false;

    const canvas = document.createElement('canvas');
    if (!canvas.toDataURL) return false;

    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * Generate CDN URL with optimization parameters
   */
  private generateCDNUrl(options: AssetOptimizationOptions): string {
    const { type, originalUrl, width, height, quality, format } = options;

    // If URL already contains CDN parameters, return as-is
    if (
      originalUrl.includes('?') &&
      (originalUrl.includes('format=') || originalUrl.includes('quality='))
    ) {
      return originalUrl;
    }

    // Build CDN parameters
    const params = new URLSearchParams();

    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    if (quality) params.append('quality', quality.toString());
    if (format && format !== 'auto') params.append('format', format);

    // Add optimization parameters based on asset type
    switch (type) {
      case 'image':
        params.append('fit', 'cover');
        params.append('optimize', 'high');
        if (this.config.enableResponsive) {
          params.append('responsive', 'true');
        }
        break;
      case 'video':
        params.append('codec', 'h264');
        params.append('bitrate', '2000k');
        break;
      case 'font':
        params.append('subset', 'true');
        params.append('woff2', 'true');
        break;
    }

    // Add cache busting for development
    if (process.env.NODE_ENV === 'development') {
      params.append('v', Date.now().toString().slice(-8));
    }

    // Construct full CDN URL
    const cdnBase = this.config.baseUrl;
    const assetPath = originalUrl.startsWith('http') ? new URL(originalUrl).pathname : originalUrl;

    return `${cdnBase}${assetPath}?${params.toString()}`;
  }

  /**
   * Generate srcSet for responsive images
   */
  private generateSrcSet(options: AssetOptimizationOptions): string {
    const { type, originalUrl, width, quality, format } = options;

    if (type !== 'image') return '';

    const deviceType = this.getDeviceType(this.networkInfo.viewportWidth);
    const breakpoints = DEVICE_PRESETS[deviceType].breakpoints;

    return breakpoints
      .map((bp) => {
        const url = this.generateCDNUrl({
          ...options,
          width: bp,
          height: undefined, // Maintain aspect ratio
        });
        return `${url} ${bp}w`;
      })
      .join(', ');
  }

  /**
   * Generate sizes attribute for responsive images
   */
  private generateSizesAttribute(options: AssetOptimizationOptions): string {
    const deviceType = this.getDeviceType(this.networkInfo.viewportWidth);

    switch (deviceType) {
      case 'mobile':
        return '(max-width: 768px) 100vw, 768px';
      case 'tablet':
        return '(max-width: 1024px) 100vw, 1024px';
      case 'desktop':
        return '(max-width: 1920px) 100vw, 1920px';
      case '4k':
        return '100vw';
      default:
        return '100vw';
    }
  }

  /**
   * Generate placeholder (simplified - would use blurhash in production)
   */
  private generatePlaceholder(url: string): string {
    // In production, this would generate a blurhash or dominant color
    // For now, return a simple data URL
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==';
  }

  /**
   * Estimate file size based on optimization options
   */
  private estimateFileSize(options: AssetOptimizationOptions): number {
    const { type, width, height, quality } = options;

    // Base size estimates (in bytes)
    const baseSizes = {
      image: 100000, // 100KB base
      video: 1000000, // 1MB base
      font: 50000, // 50KB base
      script: 20000, // 20KB base
      stylesheet: 10000, // 10KB base
      document: 5000, // 5KB base
    };

    let estimatedSize = baseSizes[type] || 10000;

    // Adjust based on dimensions for images/videos
    if ((type === 'image' || type === 'video') && width && height) {
      const pixels = width * height;
      const bytesPerPixel = type === 'image' ? 0.5 : 0.1; // Rough estimates
      estimatedSize = pixels * bytesPerPixel;
    }

    // Adjust based on quality
    if (quality) {
      const qualityFactor = quality / 100;
      estimatedSize *= qualityFactor;
    }

    // Apply compression based on format
    const compressionRatios = {
      avif: 0.3,
      webp: 0.5,
      jpeg: 0.7,
      png: 1.0,
      mp4: 0.2,
      webm: 0.3,
      woff2: 0.4,
      woff: 0.7,
      ttf: 1.0,
    };

    const format = options.format || 'auto';
    const compressionRatio = compressionRatios[format as keyof typeof compressionRatios] || 1.0;
    estimatedSize *= compressionRatio;

    return Math.round(estimatedSize);
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(originalUrl: string, optimizedSize: number): number {
    // In production, this would compare with original file size
    // For now, return a reasonable estimate
    return 0.6; // 40% compression
  }

  /**
   * Update CDN configuration
   */
  public updateConfig(config: Partial<CDNConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): CDNConfig {
    return { ...this.config };
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): CDNPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.performanceMetrics = this.initializeMetrics();
  }

  /**
   * Prefetch assets for better performance
   */
  public prefetchAssets(urls: string[]): void {
    if (typeof window === 'undefined') return;

    urls.forEach((url) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = this.getAssetType(url);
      document.head.appendChild(link);
    });
  }

  /**
   * Determine asset type from URL
   */
  private getAssetType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'avif':
        return 'image';
      case 'mp4':
      case 'webm':
      case 'ogg':
        return 'video';
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'otf':
        return 'font';
      case 'js':
        return 'script';
      case 'css':
        return 'style';
      default:
        return 'fetch';
    }
  }

  /**
   * Generate cache key for asset
   */
  public generateCacheKey(url: string, options?: Partial<AssetOptimizationOptions>): string {
    const keyParts = [url];

    if (options) {
      if (options.width) keyParts.push(`w${options.width}`);
      if (options.height) keyParts.push(`h${options.height}`);
      if (options.quality) keyParts.push(`q${options.quality}`);
      if (options.format) keyParts.push(`f${options.format}`);
    }

    return keyParts.join('_');
  }
}

/**
 * React hook for CDN service
 */
export function useCDNService(config?: Partial<CDNConfig>) {
  const [service] = useState(() => new CDNService(config));
  const [metrics, setMetrics] = useState<CDNPerformanceMetrics>(service.getMetrics());

  // Update metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(service.getMetrics());
    }, 5000);

    return () => clearInterval(interval);
  }, [service]);

  return {
    service,
    metrics,
    optimizeAsset: service.optimizeAsset.bind(service),
    prefetchAssets: service.prefetchAssets.bind(service),
    updateConfig: service.updateConfig.bind(service),
    getConfig: service.getConfig.bind(service),
    resetMetrics: service.resetMetrics.bind(service),
  };
}

// TypeScript helper for useState
import { useState, useEffect } from 'react';
