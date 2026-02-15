/**
 * Cloudflare CDN Service for PANaCEa
 *
 * Specialized service for Cloudflare CDN, R2, Images, and Stream integration.
 * Provides optimized asset delivery using Cloudflare's global network.
 */

import { CDNConfig, AssetOptimizationOptions, OptimizedAsset } from './cdnService';

export interface CloudflareCDNConfig extends CDNConfig {
  /** Cloudflare account ID */
  accountId?: string;
  /** Cloudflare Images account hash */
  imagesAccountHash?: string;
  /** Cloudflare Stream account ID */
  streamAccountId?: string;
  /** R2 bucket name */
  r2Bucket: string;
  /** Enable Cloudflare Images */
  enableImages: boolean;
  /** Enable Cloudflare Stream */
  enableStream: boolean;
  /** Enable Cloudflare Cache */
  enableCache: boolean;
  /** Enable Argo Smart Routing */
  enableArgo: boolean;
  /** Enable Web Analytics */
  enableAnalytics: boolean;
  /** Custom domain for CDN */
  customDomain?: string;
}

export interface CloudflareImageOptions {
  /** Image ID or URL */
  id: string;
  /** Variant name */
  variant?: string;
  /** Width */
  width?: number;
  /** Height */
  height?: number;
  /** Fit mode */
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  /** Background color for pad fit */
  background?: string;
  /** Animation settings */
  animated?: boolean;
}

export interface CloudflareStreamOptions {
  /** Video ID or URL */
  id: string;
  /** Player options */
  player?: {
    controls?: boolean;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    preload?: 'auto' | 'metadata' | 'none';
    poster?: string;
  };
  /** Quality options */
  quality?: '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
  /** Format options */
  format?: 'h264' | 'webm' | 'vp9';
}

/**
 * Default Cloudflare CDN configuration
 */
export const DEFAULT_CLOUDFLARE_CDN_CONFIG: CloudflareCDNConfig = {
  baseUrl: 'https://cdn.studypanacea.com',
  autoOptimizeImages: true,
  autoOptimizeVideos: true,
  autoOptimizeFonts: true,
  defaultImageQuality: 85,
  enableWebP: true,
  enableAVIF: true,
  enableResponsive: true,
  cacheDuration: 31536000,
  edgeCaching: true,
  brotliCompression: true,
  gzipCompression: true,
  provider: 'cloudflare',
  r2Bucket: 'panacea-assets',
  analytics: true,
  accountId: '',
  imagesAccountHash: '',
  streamAccountId: '',
  enableImages: true,
  enableStream: true,
  enableCache: true,
  enableArgo: true,
  enableAnalytics: true,
  customDomain: 'cdn.studypanacea.com',
};

/**
 * Cloudflare Images variants configuration
 */
export const CLOUDFLARE_IMAGE_VARIANTS = {
  thumbnail: { width: 150, height: 150, fit: 'cover' as const },
  small: { width: 320, height: 240, fit: 'contain' as const },
  medium: { width: 768, height: 576, fit: 'contain' as const },
  large: { width: 1024, height: 768, fit: 'contain' as const },
  xlarge: { width: 1920, height: 1080, fit: 'contain' as const },
  '4k': { width: 3840, height: 2160, fit: 'contain' as const },
  avatar: { width: 100, height: 100, fit: 'cover' as const, background: 'transparent' },
  cover: { width: 1200, height: 630, fit: 'cover' as const },
};

/**
 * Main Cloudflare CDN Service class
 */
export class CloudflareCDNService {
  private config: CloudflareCDNConfig;
  private isInitialized: boolean = false;

  constructor(config?: Partial<CloudflareCDNConfig>) {
    this.config = { ...DEFAULT_CLOUDFLARE_CDN_CONFIG, ...config };
  }

  /**
   * Initialize Cloudflare CDN service
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Check Cloudflare services availability
      const checks = await Promise.allSettled([
        this.checkImagesService(),
        this.checkStreamService(),
        this.checkR2Service(),
      ]);

      const allServicesAvailable = checks.every(
        (check) => check.status === 'fulfilled' && check.value === true
      );

      this.isInitialized = allServicesAvailable;
      return allServicesAvailable;
    } catch (error) {
      console.error('Failed to initialize Cloudflare CDN service:', error);
      return false;
    }
  }

  /**
   * Check Cloudflare Images service availability
   */
  private async checkImagesService(): Promise<boolean> {
    if (!this.config.enableImages || !this.config.imagesAccountHash) {
      return false;
    }

    try {
      // Simple check by trying to load a test image
      const testUrl = this.generateImageUrl({
        id: 'test',
        variant: 'thumbnail',
      });

      const response = await fetch(testUrl, { method: 'HEAD' });
      return response.ok || response.status === 404; // 404 is okay for test image
    } catch {
      return false;
    }
  }

  /**
   * Check Cloudflare Stream service availability
   */
  private async checkStreamService(): Promise<boolean> {
    if (!this.config.enableStream || !this.config.streamAccountId) {
      return false;
    }

    // Stream service check would require actual API call
    // For now, assume it's available if configured
    return !!this.config.streamAccountId;
  }

  /**
   * Check R2 service availability
   */
  private async checkR2Service(): Promise<boolean> {
    if (!this.config.r2Bucket) {
      return false;
    }

    // R2 service check would require actual API call
    // For now, assume it's available if configured
    return !!this.config.r2Bucket;
  }

  /**
   * Generate Cloudflare Images URL
   */
  public generateImageUrl(options: CloudflareImageOptions): string {
    const { id, variant = 'public', width, height, fit = 'cover', background, animated } = options;

    // If using Cloudflare Images with account hash
    if (this.config.enableImages && this.config.imagesAccountHash) {
      const baseUrl = `https://imagedelivery.net/${this.config.imagesAccountHash}/${id}/${variant}`;
      const params = new URLSearchParams();

      if (width) params.append('width', width.toString());
      if (height) params.append('height', height.toString());
      if (fit) params.append('fit', fit);
      if (background) params.append('background', background);
      if (animated !== undefined) params.append('animated', animated.toString());

      const queryString = params.toString();
      return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }

    // Fallback to regular CDN URL
    const baseUrl = this.config.baseUrl;
    const params = new URLSearchParams();

    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    if (fit) params.append('fit', fit);
    if (background) params.append('bg', background);

    return `${baseUrl}/images/${id}?${params.toString()}`;
  }

  /**
   * Generate Cloudflare Stream embed URL
   */
  public generateStreamUrl(options: CloudflareStreamOptions): string {
    const { id, player = {}, quality, format } = options;

    if (this.config.enableStream && this.config.streamAccountId) {
      // Cloudflare Stream embed URL
      const baseUrl = `https://iframe.videodelivery.net/${id}`;
      const params = new URLSearchParams();

      // Player options
      if (player.controls !== undefined) params.append('controls', player.controls.toString());
      if (player.autoplay !== undefined) params.append('autoplay', player.autoplay.toString());
      if (player.loop !== undefined) params.append('loop', player.loop.toString());
      if (player.muted !== undefined) params.append('muted', player.muted.toString());
      if (player.preload) params.append('preload', player.preload);
      if (player.poster) params.append('poster', player.poster);

      // Quality and format
      if (quality) params.append('quality', quality);
      if (format) params.append('format', format);

      const queryString = params.toString();
      return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }

    // Fallback to regular video URL
    return `${this.config.baseUrl}/videos/${id}`;
  }

  /**
   * Generate R2 object URL
   */
  public generateR2Url(
    key: string,
    options?: {
      download?: boolean;
      expiresIn?: number; // seconds
      contentType?: string;
    }
  ): string {
    const { download = false, expiresIn, contentType } = options || {};

    let url = `${this.config.baseUrl}/${key}`;

    if (download) {
      url += '?download=true';
    }

    if (contentType) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}response-content-type=${encodeURIComponent(contentType)}`;
    }

    // Note: Signed URLs with expiration would require backend API
    // This is a public URL generation

    return url;
  }

  /**
   * Optimize asset using Cloudflare services
   */
  public optimizeAsset(options: AssetOptimizationOptions): OptimizedAsset {
    const { type, originalUrl } = options;

    let optimizedUrl: string;
    let srcSet: string | undefined;

    switch (type) {
      case 'image':
        optimizedUrl = this.optimizeImage(options);
        srcSet = this.generateImageSrcSet(options);
        break;

      case 'video':
        optimizedUrl = this.optimizeVideo(options);
        break;

      case 'font':
        optimizedUrl = this.optimizeFont(options);
        break;

      default:
        optimizedUrl = originalUrl;
    }

    // Estimate file size (simplified)
    const estimatedSize = this.estimateOptimizedSize(type, options);

    return {
      url: optimizedUrl,
      srcSet,
      sizes: this.generateSizesAttribute(options),
      placeholder: this.generatePlaceholder(originalUrl),
      width: options.width,
      height: options.height,
      estimatedSize,
      format: options.format || 'auto',
      compressionRatio: 0.6, // Estimated 40% compression
      cacheStatus: 'hit',
    };
  }

  /**
   * Optimize image using Cloudflare Images
   */
  private optimizeImage(options: AssetOptimizationOptions): string {
    const { originalUrl, width, height, quality, format } = options;

    // Extract image ID from URL
    const imageId = this.extractImageId(originalUrl);

    // Determine variant based on dimensions
    const variant = this.getImageVariant(width, height);

    // Generate Cloudflare Images URL
    return this.generateImageUrl({
      id: imageId,
      variant,
      width,
      height,
      fit: 'cover',
      background: 'transparent',
    });
  }

  /**
   * Optimize video using Cloudflare Stream
   */
  private optimizeVideo(options: AssetOptimizationOptions): string {
    const { originalUrl } = options;

    // Extract video ID from URL
    const videoId = this.extractVideoId(originalUrl);

    // Generate Cloudflare Stream URL
    return this.generateStreamUrl({
      id: videoId,
      player: {
        controls: true,
        autoplay: false,
        loop: false,
        muted: true,
        preload: 'metadata',
      },
      quality: '720p',
      format: 'h264',
    });
  }

  /**
   * Optimize font using Cloudflare CDN
   */
  private optimizeFont(options: AssetOptimizationOptions): string {
    const { originalUrl } = options;

    // Font optimization: subsetting and format conversion
    const url = new URL(originalUrl, this.config.baseUrl);

    // Add font optimization parameters
    url.searchParams.append('subset', 'true');
    url.searchParams.append('display', 'swap');
    url.searchParams.append(
      'text',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    );

    return url.toString();
  }

  /**
   * Generate image srcSet for responsive images
   */
  private generateImageSrcSet(options: AssetOptimizationOptions): string {
    const { originalUrl, width } = options;

    if (!width || !this.config.enableResponsive) {
      return '';
    }

    const imageId = this.extractImageId(originalUrl);
    const breakpoints = [320, 480, 768, 1024, 1280, 1536, 1920];

    return breakpoints
      .map((bp) => {
        const variant = this.getImageVariant(bp);
        const url = this.generateImageUrl({
          id: imageId,
          variant,
          width: bp,
        });
        return `${url} ${bp}w`;
      })
      .join(', ');
  }

  /**
   * Generate sizes attribute
   */
  private generateSizesAttribute(options: AssetOptimizationOptions): string {
    const { width } = options;

    if (!width) {
      return '100vw';
    }

    return `(max-width: ${width}px) 100vw, ${width}px`;
  }

  /**
   * Generate placeholder
   */
  private generatePlaceholder(url: string): string {
    // Generate a low-quality placeholder using Cloudflare Images
    const imageId = this.extractImageId(url);

    return this.generateImageUrl({
      id: imageId,
      variant: 'thumbnail',
      width: 20,
      height: 20,
      fit: 'cover',
    });
  }

  /**
   * Extract image ID from URL
   */
  private extractImageId(url: string): string {
    // Extract the last part of the URL as image ID
    const parts = url.split('/');
    return parts[parts.length - 1] || 'default';
  }

  /**
   * Extract video ID from URL
   */
  private extractVideoId(url: string): string {
    // Extract the last part of the URL as video ID
    const parts = url.split('/');
    return parts[parts.length - 1] || 'default';
  }

  /**
   * Get appropriate image variant based on dimensions
   */
  private getImageVariant(width?: number, height?: number): string {
    if (!width && !height) {
      return 'public';
    }

    const maxDimension = Math.max(width || 0, height || 0);

    if (maxDimension <= 150) return 'thumbnail';
    if (maxDimension <= 320) return 'small';
    if (maxDimension <= 768) return 'medium';
    if (maxDimension <= 1024) return 'large';
    if (maxDimension <= 1920) return 'xlarge';
    return '4k';
  }

  /**
   * Estimate optimized file size
   */
  private estimateOptimizedSize(type: string, options: AssetOptimizationOptions): number {
    const { width, height, quality = 85 } = options;

    // Base size estimates
    const baseSizes: Record<string, number> = {
      image: 100000,
      video: 1000000,
      font: 50000,
      script: 20000,
      stylesheet: 10000,
      document: 5000,
    };

    let estimatedSize = baseSizes[type] || 10000;

    // Adjust for dimensions
    if ((type === 'image' || type === 'video') && width && height) {
      const pixels = width * height;
      const bytesPerPixel = type === 'image' ? 0.5 : 0.1;
      estimatedSize = pixels * bytesPerPixel;
    }

    // Adjust for quality
    const qualityFactor = quality / 100;
    estimatedSize *= qualityFactor;

    // Apply Cloudflare optimization savings
    const cloudflareSavings = 0.4; // 40% savings with Cloudflare optimization
    estimatedSize *= 1 - cloudflareSavings;

    return Math.round(estimatedSize);
  }

  /**
   * Purge CDN cache for specific URLs
   */
  public async purgeCache(urls: string | string[]): Promise<boolean> {
    if (!this.config.enableCache) {
      return false;
    }

    const urlList = Array.isArray(urls) ? urls : [urls];

    try {
      // In production, this would call Cloudflare API
      // For now, simulate successful purge
      console.log('Purging CDN cache for URLs:', urlList);
      return true;
    } catch (error) {
      console.error('Failed to purge CDN cache:', error);
      return false;
    }
  }

  /**
   * Get CDN analytics data
   */
  public async getAnalytics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<any> {
    if (!this.config.enableAnalytics) {
      return null;
    }

    try {
      // In production, this would fetch from Cloudflare Analytics API
      // For now, return mock data
      return {
        timeRange,
        requests: 1000,
        bandwidth: 50000000, // 50MB
        cacheHitRate: 0.85, // 85%
        topCountries: ['US', 'CA', 'GB', 'AU', 'DE'],
        topAssets: ['/images/condition-card.jpg', '/videos/procedure.mp4', '/fonts/inter.woff2'],
      };
    } catch (error) {
      console.error('Failed to fetch CDN analytics:', error);
      return null;
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<CloudflareCDNConfig>): void {
    this.config = { ...this.config, ...config };
    this.isInitialized = false; // Reset initialization state
  }

  /**
   * Get current configuration
   */
  public getConfig(): CloudflareCDNConfig {
    return { ...this.config };
  }

  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

/**
 * React hook for Cloudflare CDN service
 */
export function useCloudflareCDNService(config?: Partial<CloudflareCDNConfig>) {
  const [service] = useState(() => new CloudflareCDNService(config));
  const [isInitialized, setIsInitialized] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  // Initialize service
  useEffect(() => {
    service.initialize().then((initialized) => {
      setIsInitialized(initialized);
    });
  }, [service]);

  // Fetch analytics periodically
  useEffect(() => {
    if (!isInitialized || !service.getConfig().enableAnalytics) {
      return;
    }

    const fetchAnalytics = async () => {
      const data = await service.getAnalytics('24h');
      setAnalytics(data);
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 300000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [service, isInitialized]);

  return {
    service,
    isInitialized,
    analytics,
    optimizeAsset: service.optimizeAsset.bind(service),
    generateImageUrl: service.generateImageUrl.bind(service),
    generateStreamUrl: service.generateStreamUrl.bind(service),
    generateR2Url: service.generateR2Url.bind(service),
    purgeCache: service.purgeCache.bind(service),
    updateConfig: service.updateConfig.bind(service),
    getConfig: service.getConfig.bind(service),
  };
}

// TypeScript helper for useState
import { useState, useEffect } from 'react';
