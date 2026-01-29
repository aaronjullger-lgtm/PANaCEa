/**
 * Image Optimization Utilities for StudyPANaCEa
 *
 * Comprehensive image optimization for better performance and user experience
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Image optimization configuration
 */
export interface ImageOptimizationConfig {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  lazyLoad?: boolean;
  placeholder?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Default optimization configuration
 */
export const DEFAULT_IMAGE_CONFIG: ImageOptimizationConfig = {
  quality: 85,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'webp',
  lazyLoad: true,
  loading: 'lazy',
};

/**
 * Optimized Image Component
 */
export function OptimizedImage({
  src,
  alt,
  config = {},
  className = '',
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  config?: Partial<ImageOptimizationConfig>;
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const mergedConfig = { ...DEFAULT_IMAGE_CONFIG, ...config };

  // Create optimized image URL
  const getOptimizedUrl = useCallback(() => {
    if (!src) return '';

    // If already optimized (has parameters), return as-is
    if (src.includes('?') || src.includes('format=')) {
      return src;
    }

    // Build optimization parameters
    const params = new URLSearchParams();

    if (mergedConfig.quality) {
      params.append('q', mergedConfig.quality.toString());
    }

    if (mergedConfig.maxWidth) {
      params.append('w', mergedConfig.maxWidth.toString());
    }

    if (mergedConfig.maxHeight) {
      params.append('h', mergedConfig.maxHeight.toString());
    }

    if (mergedConfig.format) {
      params.append('format', mergedConfig.format);
    }

    // Add cache busting parameter
    params.append('v', Date.now().toString());

    return `${src}?${params.toString()}`;
  }, [src, mergedConfig]);

  const optimizedSrc = getOptimizedUrl();

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!mergedConfig.lazyLoad || isLoaded || hasError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    // Create a temporary element to observe
    const tempElement = document.createElement('div');
    document.body.appendChild(tempElement);
    observer.observe(tempElement);

    return () => {
      observer.disconnect();
      if (tempElement.parentNode) {
        document.body.removeChild(tempElement);
      }
    };
  }, [mergedConfig.lazyLoad, isLoaded, hasError]);

  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };

  const handleError = (error: any) => {
    setHasError(true);
    console.error('Image load error:', error);
    if (onError) onError(error);
  };

  // Show placeholder while loading
  if ((mergedConfig.lazyLoad && !isVisible) || !isLoaded) {
    return (
      <div
        className={`bg-[var(--color-bg-tertiary)] animate-pulse ${className}`}
        style={{
          aspectRatio:
            mergedConfig.maxWidth && mergedConfig.maxHeight
              ? `${mergedConfig.maxWidth}/${mergedConfig.maxHeight}`
              : '16/9',
          minHeight: '200px',
        }}
      >
        {mergedConfig.placeholder && (
          <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
            {mergedConfig.placeholder}
          </div>
        )}
      </div>
    );
  }

  // Show error fallback if image failed to load
  if (hasError) {
    return (
      <div
        className={`bg-[var(--color-bg-secondary)] flex items-center justify-center ${className}`}
        style={{
          aspectRatio:
            mergedConfig.maxWidth && mergedConfig.maxHeight
              ? `${mergedConfig.maxWidth}/${mergedConfig.maxHeight}`
              : '16/9',
          minHeight: '200px',
        }}
      >
        <div className="text-[var(--color-text-muted)] text-center p-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm">Image failed to load</p>
          <button
            onClick={() => {
              setHasError(false);
              setIsLoaded(false);
            }}
            className="mt-2 text-xs text-[var(--color-accent)] hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      className={className}
      loading={mergedConfig.loading}
      onLoad={handleLoad}
      onError={handleError}
      decoding="async"
      style={{
        maxWidth: '100%',
        height: 'auto',
      }}
    />
  );
}

/**
 * Image preloader for critical images
 */
export function useImagePreloader(imageUrls: string[], config: ImageOptimizationConfig = {}) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (imageUrls.length === 0) return;

    let isMounted = true;

    const preloadImages = async () => {
      const results = await Promise.allSettled(
        imageUrls.map((url) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.onload = () => {
              if (isMounted) {
                resolve(url);
              }
            };
            img.onerror = () => {
              if (isMounted) {
                reject(url);
              }
            };
          });
        })
      );

      if (!isMounted) return;

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason) as string[];

      setLoadedCount(successful);
      setErrors(failed);
    };

    // Start preloading after a short delay
    const timer = setTimeout(preloadImages, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [imageUrls]);

  return {
    loadedCount,
    totalCount: imageUrls.length,
    isComplete: loadedCount === imageUrls.length,
    errors,
  };
}

/**
 * Responsive image with srcset support
 */
export function ResponsiveImage({
  src,
  alt,
  sizes,
  srcSet,
  className = '',
}: {
  src: string;
  alt: string;
  sizes?: string;
  srcSet?: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      sizes={sizes}
      srcSet={srcSet}
      loading="lazy"
      decoding="async"
      style={{
        maxWidth: '100%',
        height: 'auto',
      }}
    />
  );
}

/**
 * Image optimization hook for dynamic images
 */
export function useOptimizedImage(src: string, config: ImageOptimizationConfig = {}) {
  const [optimizedSrc, setOptimizedSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!src) {
      setOptimizedSrc('');
      return;
    }

    const optimizeImage = async () => {
      try {
        setIsLoading(true);

        // Simulate optimization process
        await new Promise((resolve) => setTimeout(resolve, 100));

        // In a real implementation, this would call an image optimization API
        // For now, we'll just add optimization parameters
        const params = new URLSearchParams();

        if (config.quality) params.append('q', config.quality.toString());
        if (config.maxWidth) params.append('w', config.maxWidth.toString());
        if (config.maxHeight) params.append('h', config.maxHeight.toString());
        if (config.format) params.append('format', config.format);

        const optimizedUrl = `${src}?${params.toString()}`;
        setOptimizedSrc(optimizedUrl);
      } catch (err) {
        setError(err as Error);
        setOptimizedSrc(src); // Fallback to original
      } finally {
        setIsLoading(false);
      }
    };

    optimizeImage();
  }, [src, config]);

  return {
    src: optimizedSrc,
    isLoading,
    error,
  };
}

/**
 * Image CDN configuration
 */
export interface ImageCDNConfig {
  baseUrl: string;
  apiKey?: string;
  optimization?: {
    quality: number;
    format: string;
    maxWidth: number;
    maxHeight: number;
  };
}

/**
 * Configure image CDN
 */
export function configureImageCDN(config: ImageCDNConfig) {
  // In a real implementation, this would set up the CDN client
  console.log('Image CDN configured:', config);
  return config;
}

/**
 * Get optimized image URL from CDN
 */
export function getCDNOptimizedUrl(
  src: string,
  cdnConfig: ImageCDNConfig,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  } = {}
) {
  // Extract filename from URL
  const filename = src.split('/').pop() || 'image';

  // Build CDN URL with optimizations
  const params = new URLSearchParams();

  if (options.width) params.append('width', options.width.toString());
  if (options.height) params.append('height', options.height.toString());
  if (options.quality) params.append('quality', options.quality.toString());
  if (options.format) params.append('format', options.format);

  // Add API key if available
  if (cdnConfig.apiKey) {
    params.append('api_key', cdnConfig.apiKey);
  }

  return `${cdnConfig.baseUrl}/${filename}?${params.toString()}`;
}

/**
 * Image performance monitoring
 */
export function monitorImagePerformance(
  src: string,
  onLoad: (performance: { loadTime: number; size: number }) => void
) {
  const startTime = performance.now();

  const img = new Image();
  img.src = src;

  img.onload = () => {
    const loadTime = performance.now() - startTime;
    const size = img.naturalWidth * img.naturalHeight;

    onLoad({
      loadTime,
      size,
    });
  };

  img.onerror = () => {
    console.error('Image failed to load:', src);
  };

  return img;
}
