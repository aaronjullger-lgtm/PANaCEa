/**
 * Enhanced Image Optimization Service for PANaCEa
 *
 * Comprehensive image optimization with:
 * - Automatic format selection (WebP/AVIF/JPEG)
 * - Responsive image generation
 * - Network-aware quality adjustment
 * - Lazy loading with intersection observer
 * - Placeholder generation
 * - CDN integration
 * - Image compression
 */

export interface ImageOptimizationOptions {
  /** Source image URL */
  src: string;
  /** Alternative text for accessibility */
  alt?: string;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Image quality (0-100) */
  quality?: number;
  /** Preferred output format */
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  /** Enable lazy loading */
  lazy?: boolean;
  /** Generate placeholder (blurhash or color) */
  placeholder?: boolean;
  /** Placeholder type */
  placeholderType?: 'blurhash' | 'color' | 'gradient';
  /** Enable responsive images (srcset) */
  responsive?: boolean;
  /** Breakpoints for responsive images */
  breakpoints?: number[];
  /** Enable CDN optimization */
  cdn?: boolean;
  /** CDN configuration */
  cdnConfig?: CDNConfig;
}

export interface CDNConfig {
  /** CDN base URL */
  baseUrl?: string;
  /** Enable automatic optimization */
  autoOptimize?: boolean;
  /** Default quality */
  defaultQuality?: number;
  /** Enable WebP conversion */
  webp?: boolean;
  /** Enable AVIF conversion */
  avif?: boolean;
  /** Enable responsive images */
  responsive?: boolean;
}

export interface OptimizedImageResult {
  /** Optimized image URL */
  url: string;
  /** Source set for responsive images */
  srcSet?: string;
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Placeholder data */
  placeholder?: string;
  /** Image dimensions */
  width?: number;
  height?: number;
  /** File size estimate */
  estimatedSize?: number;
  /** Format used */
  format?: string;
}

export interface NetworkAwareConfig {
  /** Network effective type */
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  /** Save data mode enabled */
  saveData?: boolean;
  /** Device pixel ratio */
  devicePixelRatio?: number;
  /** Viewport width */
  viewportWidth?: number;
}

/**
 * Default image optimization configuration
 */
export const DEFAULT_OPTIONS: Partial<ImageOptimizationOptions> = {
  quality: 85,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'auto',
  lazy: true,
  placeholder: true,
  placeholderType: 'color',
  responsive: true,
  cdn: true,
  breakpoints: [320, 480, 768, 1024, 1280, 1536, 1920],
};

/**
 * Network-aware optimization presets
 */
export const NETWORK_PRESETS: Record<string, Partial<ImageOptimizationOptions>> = {
  'slow-2g': {
    quality: 30,
    maxWidth: 640,
    maxHeight: 480,
    format: 'webp',
    placeholder: true,
    responsive: false,
  },
  '2g': {
    quality: 50,
    maxWidth: 800,
    maxHeight: 600,
    format: 'webp',
    placeholder: true,
    responsive: true,
  },
  '3g': {
    quality: 70,
    maxWidth: 1200,
    maxHeight: 800,
    format: 'webp',
    placeholder: true,
    responsive: true,
  },
  '4g': {
    quality: 85,
    maxWidth: 1920,
    maxHeight: 1080,
    format: 'avif',
    placeholder: true,
    responsive: true,
  },
};

/**
 * CDN configuration for image optimization
 */
export const DEFAULT_CDN_CONFIG: CDNConfig = {
  autoOptimize: true,
  defaultQuality: 85,
  webp: true,
  avif: true,
  responsive: true,
};

/**
 * Main image optimization service
 */
export class ImageOptimizationService {
  private cdnConfig: CDNConfig;
  private networkConfig: NetworkAwareConfig;

  constructor(cdnConfig?: Partial<CDNConfig>, networkConfig?: NetworkAwareConfig) {
    this.cdnConfig = { ...DEFAULT_CDN_CONFIG, ...cdnConfig };
    this.networkConfig = networkConfig || this.detectNetworkConfig();
  }

  /**
   * Detect network configuration from browser APIs
   */
  private detectNetworkConfig(): NetworkAwareConfig {
    const connection = (navigator as any).connection;

    return {
      effectiveType: connection?.effectiveType,
      saveData: connection?.saveData,
      devicePixelRatio: window.devicePixelRatio || 1,
      viewportWidth: window.innerWidth,
    };
  }

  /**
   * Get network-aware optimization options
   */
  private getNetworkAwareOptions(
    baseOptions: Partial<ImageOptimizationOptions>
  ): Partial<ImageOptimizationOptions> {
    const { effectiveType = '4g', saveData = false } = this.networkConfig;

    const networkPreset = NETWORK_PRESETS[effectiveType] || NETWORK_PRESETS['4g'];
    const options = { ...networkPreset, ...baseOptions };

    // Further reduce quality if save data is enabled
    if (saveData && options.quality) {
      options.quality = Math.max(30, options.quality - 20);
    }

    return options;
  }

  /**
   * Generate optimized image URL with CDN parameters
   */
  private generateOptimizedUrl(src: string, options: Partial<ImageOptimizationOptions>): string {
    if (!src) return '';

    // If already has CDN parameters, return as-is
    if (src.includes('?') && (src.includes('format=') || src.includes('quality='))) {
      return src;
    }

    // Determine best format
    const format = this.getBestFormat(options.format || 'auto');

    // Build CDN parameters
    const params = new URLSearchParams();

    if (options.maxWidth) {
      params.append('width', options.maxWidth.toString());
    }

    if (options.maxHeight) {
      params.append('height', options.maxHeight.toString());
    }

    if (options.quality) {
      params.append('quality', options.quality.toString());
    }

    if (format && format !== 'auto') {
      params.append('format', format);
    }

    // Add optimization parameters
    params.append('fit', 'cover');
    params.append('optimize', 'high');

    // Add cache busting for development
    if (process.env.NODE_ENV === 'development') {
      params.append('v', Date.now().toString().slice(-8));
    }

    return `${src}?${params.toString()}`;
  }

  /**
   * Generate responsive srcset
   */
  private generateSrcSet(
    src: string,
    breakpoints: number[],
    options: Partial<ImageOptimizationOptions>
  ): string {
    return breakpoints
      .map((breakpoint) => {
        const url = this.generateOptimizedUrl(src, {
          ...options,
          maxWidth: breakpoint,
          maxHeight: Math.round(
            (options.maxHeight || 1080) * (breakpoint / (options.maxWidth || 1920))
          ),
        });
        return `${url} ${breakpoint}w`;
      })
      .join(', ');
  }

  /**
   * Generate sizes attribute for responsive images
   */
  private generateSizes(breakpoints: number[]): string {
    const sizes = breakpoints.map((bp, index) => {
      if (index === breakpoints.length - 1) {
        return `${bp}px`;
      }
      const nextBp = breakpoints[index + 1];
      return `(max-width: ${nextBp}px) ${bp}px`;
    });

    return sizes.join(', ');
  }

  /**
   * Generate placeholder (simplified - in production would use blurhash or dominant color)
   */
  private generatePlaceholder(type: string = 'color'): string {
    switch (type) {
      case 'blurhash':
        // In production, this would generate or fetch a blurhash
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==';
      case 'gradient':
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      default:
        return '#f3f4f6';
    }
  }

  /**
   * Determine best image format based on browser support and network conditions
   */
  private getBestFormat(preferredFormat: string): string {
    // Check browser support
    const supportsAvif =
      typeof document !== 'undefined' &&
      document.createElement('canvas').toDataURL('image/avif').indexOf('data:image/avif') === 0;

    const supportsWebp =
      typeof document !== 'undefined' &&
      document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;

    const { effectiveType = '4g' } = this.networkConfig;

    if (preferredFormat !== 'auto') {
      return preferredFormat;
    }

    // Choose format based on network and browser support
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return 'webp'; // WebP is good balance of compression and compatibility
    }

    if (supportsAvif && effectiveType === '4g') {
      return 'avif'; // AVIF for best compression on fast networks
    }

    if (supportsWebp) {
      return 'webp'; // WebP for good compression and wide support
    }

    return 'jpeg'; // Fallback to JPEG
  }

  /**
   * Estimate file size based on dimensions and quality
   */
  private estimateFileSize(width: number, height: number, quality: number, format: string): number {
    // Rough estimation formula
    const pixels = width * height;
    let bytesPerPixel = 0.5; // Conservative estimate

    switch (format) {
      case 'avif':
        bytesPerPixel = quality > 80 ? 0.3 : 0.2;
        break;
      case 'webp':
        bytesPerPixel = quality > 80 ? 0.5 : 0.3;
        break;
      case 'jpeg':
        bytesPerPixel = quality > 80 ? 1.0 : 0.7;
        break;
      case 'png':
        bytesPerPixel = 4.0; // PNG is large
        break;
    }

    // Adjust for quality
    const qualityFactor = quality / 100;
    const estimatedBytes = pixels * bytesPerPixel * qualityFactor;

    return Math.round(estimatedBytes);
  }

  /**
   * Optimize a single image
   */
  optimizeImage(options: ImageOptimizationOptions): OptimizedImageResult {
    const mergedOptions = {
      ...DEFAULT_OPTIONS,
      ...this.getNetworkAwareOptions(options),
      ...options,
    };

    const {
      src,
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      format = 'auto',
      placeholder = true,
      placeholderType = 'color',
      responsive = true,
      breakpoints = DEFAULT_OPTIONS.breakpoints as number[],
    } = mergedOptions;

    const bestFormat = this.getBestFormat(format);
    const optimizedUrl = this.generateOptimizedUrl(src, {
      maxWidth,
      maxHeight,
      quality,
      format: bestFormat,
    });

    const result: OptimizedImageResult = {
      url: optimizedUrl,
      format: bestFormat,
      width: maxWidth,
      height: maxHeight,
      estimatedSize: this.estimateFileSize(maxWidth, maxHeight, quality, bestFormat),
    };

    // Generate responsive attributes if enabled
    if (responsive && breakpoints.length > 0) {
      result.srcSet = this.generateSrcSet(src, breakpoints, mergedOptions);
      result.sizes = this.generateSizes(breakpoints);
    }

    // Generate placeholder if enabled
    if (placeholder) {
      result.placeholder = this.generatePlaceholder(placeholderType);
    }

    return result;
  }

  /**
   * Preload images for better performance
   */
  preloadImages(urls: string[]): Promise<void[]> {
    return Promise.all(
      urls.map((url) => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
          img.src = url;
        });
      })
    );
  }

  /**
   * Lazy load images with intersection observer
   */
  createLazyLoader(
    callback: (entry: IntersectionObserverEntry) => void,
    options: IntersectionObserverInit = { rootMargin: '50px' }
  ): IntersectionObserver {
    return new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback(entry);
        }
      });
    }, options);
  }

  /**
   * Update network configuration
   */
  updateNetworkConfig(config: Partial<NetworkAwareConfig>): void {
    this.networkConfig = { ...this.networkConfig, ...config };
  }

  /**
   * Update CDN configuration
   */
  updateCDNConfig(config: Partial<CDNConfig>): void {
    this.cdnConfig = { ...this.cdnConfig, ...config };
  }
}

/**
 * React hook for image optimization
 */
export function useImageOptimization(cdnConfig?: Partial<CDNConfig>) {
  const [service] = useState(() => new ImageOptimizationService(cdnConfig));
  const [networkConfig, setNetworkConfig] = useState<NetworkAwareConfig>(service['networkConfig']);

  // Update network config on changes
  useEffect(() => {
    const updateNetworkInfo = () => {
      const newConfig = service['detectNetworkConfig']();
      setNetworkConfig(newConfig);
      service.updateNetworkConfig(newConfig);
    };

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    window.addEventListener('resize', updateNetworkInfo);

    return () => {
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
      window.removeEventListener('resize', updateNetworkInfo);
    };
  }, [service]);

  const optimize = useCallback(
    (options: ImageOptimizationOptions) => service.optimizeImage(options),
    [service]
  );

  const preload = useCallback((urls: string[]) => service.preloadImages(urls), [service]);

  return {
    optimize,
    preload,
    networkConfig,
    updateCDNConfig: service.updateCDNConfig.bind(service),
  };
}

/**
 * Default singleton instance
 */
export const imageOptimizationService = new ImageOptimizationService();

export default imageOptimizationService;
