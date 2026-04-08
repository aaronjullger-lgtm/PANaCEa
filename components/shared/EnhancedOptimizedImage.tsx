/**
 * Enhanced Optimized Image Component
 *
 * Uses the ImageOptimizationService for comprehensive image optimization
 * with network-aware quality adjustment, responsive images, and lazy loading.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  imageOptimizationService,
  useImageOptimization,
  ImageOptimizationOptions,
} from '@/services/imageOptimizationService';

interface EnhancedOptimizedImageProps extends Omit<ImageOptimizationOptions, 'src'> {
  /** Source image URL */
  src: string;
  /** Alternative text for accessibility */
  alt: string;
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Loading state callback */
  onLoad?: () => void;
  /** Error state callback */
  onError?: (error: Error) => void;
  /** Click handler */
  onClick?: () => void;
  /** Enable zoom on click */
  enableZoom?: boolean;
  /** Show loading skeleton */
  showSkeleton?: boolean;
  /** Skeleton color */
  skeletonColor?: string;
  /** Animation duration */
  animationDuration?: number;
  /** Custom intersection observer options */
  intersectionOptions?: IntersectionObserverInit;
}

/**
 * Enhanced Optimized Image Component
 */
export const EnhancedOptimizedImage: React.FC<EnhancedOptimizedImageProps> = ({
  src,
  alt,
  className = '',
  style = {},
  onLoad,
  onError,
  onClick,
  enableZoom = false,
  showSkeleton = true,
  skeletonColor = 'var(--color-bg-secondary)',
  animationDuration = 300,
  intersectionOptions = { rootMargin: '100px' },
  ...optimizationOptions
}) => {
  const { optimize } = useImageOptimization();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [optimizedData, setOptimizedData] = useState<ReturnType<typeof optimize> | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Optimize image on source change
  useEffect(() => {
    if (!src) return;

    try {
      const result = optimize({
        src,
        alt,
        ...optimizationOptions,
      });
      setOptimizedData(result);
    } catch (error) {
      console.error('Failed to optimize image:', error);
      setOptimizedData(null);
    }
  }, [src, alt, optimize, optimizationOptions]);

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!optimizationOptions.lazy || !imgRef.current || isLoaded || hasError) return;

    const observer = imageOptimizationService.createLazyLoader((entry) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        if (observerRef.current && imgRef.current) {
          observerRef.current.unobserve(imgRef.current);
        }
      }
    }, intersectionOptions);

    observerRef.current = observer;
    observer.observe(imgRef.current);

    return () => {
      if (observerRef.current && imgRef.current) {
        observerRef.current.unobserve(imgRef.current);
      }
    };
  }, [optimizationOptions.lazy, isLoaded, hasError, intersectionOptions]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback(() => {
    setIsLoaded(false);
    setHasError(true);
    onError?.(new Error(`Failed to load image: ${src}`));
  }, [src, onError]);

  // Handle click
  const handleClick = useCallback(() => {
    if (enableZoom) {
      setIsZoomed(!isZoomed);
    }
    onClick?.();
  }, [enableZoom, isZoomed, onClick]);

  // Handle escape key to exit zoom
  useEffect(() => {
    if (!enableZoom || !isZoomed) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomed(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [enableZoom, isZoomed]);

  // Handle click outside to exit zoom
  useEffect(() => {
    if (!enableZoom || !isZoomed || !containerRef.current) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsZoomed(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [enableZoom, isZoomed]);

  // If no optimized data, show fallback
  if (!optimizedData) {
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{
          backgroundColor: skeletonColor,
          ...style,
        }}
        aria-label={alt}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[var(--color-text-muted)] text-sm">Loading image...</span>
        </div>
      </div>
    );
  }

  const { url, srcSet, sizes, placeholder, width, height, estimatedSize, format } = optimizedData;

  // Determine if we should load the image
  const shouldLoadImage = !optimizationOptions.lazy || isVisible;

  const containerProps: React.HTMLAttributes<HTMLDivElement> = {
    ref: containerRef,
    className: `relative overflow-hidden ${className} ${enableZoom ? 'cursor-zoom-in' : ''}`,
    style: {
      backgroundColor: placeholder || skeletonColor,
      aspectRatio: width && height ? `${width} / ${height}` : '16 / 9',
      ...style,
    },
    'aria-label': alt,
  };

  if (onClick) {
    containerProps.onClick = handleClick;
    containerProps.role = 'button';
    containerProps.tabIndex = 0;
  }

  return (
    <>
      <div {...containerProps}>
        {/* Loading skeleton */}
        <AnimatePresence>
          {showSkeleton && !isLoaded && !hasError && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: animationDuration / 1000 }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, ${skeletonColor} 25%, color-mix(in srgb, ${skeletonColor} 80%, transparent) 50%, ${skeletonColor} 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error state */}
        <AnimatePresence>
          {hasError && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center p-4"
             
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-[var(--color-text-muted)] text-center">
                <svg
                  className="w-12 h-12 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <p className="text-sm">Failed to load image</p>
                <button
                  type="button"
                  className="mt-2 px-3 py-1 text-xs bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] rounded hover:bg-[var(--color-action-primary)]/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHasError(false);
                    setIsLoaded(false);
                  }}
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Optimized image */}
        <AnimatePresence>
          {!hasError && shouldLoadImage && (
            <motion.img
              ref={imgRef}
              src={url}
              alt={alt}
              srcSet={srcSet}
              sizes={sizes}
              width={width}
              height={height}
              loading={optimizationOptions.lazy ? 'lazy' : 'eager'}
              decoding="async"
              className={`w-full h-full object-cover transition-opacity duration-${animationDuration} ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handleLoad}
              onError={handleError}
             
              animate={{ opacity: isLoaded ? 1 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: animationDuration / 1000 }}
            />
          )}
        </AnimatePresence>

        {/* Image info badge (debug mode) */}
        {process.env.NODE_ENV === 'development' && isLoaded && (
          <div className="absolute bottom-2 right-2 bg-[var(--color-bg-primary)]/90 text-[var(--color-text-primary)] text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity">
            {format?.toUpperCase()} •{' '}
            {estimatedSize ? `${Math.round(estimatedSize / 1024)}KB` : 'N/A'}
          </div>
        )}
      </div>

      {/* Zoom overlay */}
      <AnimatePresence>
        {enableZoom && isZoomed && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-xl p-4"
           
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsZoomed(false)}
          >
            <div className="relative max-w-full max-h-full">
              <img
                src={url}
                alt={`Zoomed: ${alt}`}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />

              <button
                type="button"
                className="absolute top-4 right-4 p-2 bg-[var(--color-bg-primary)]/90 text-[var(--color-text-primary)] rounded-full border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                onClick={() => setIsZoomed(false)}
                aria-label="Close zoom"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <div className="absolute bottom-4 left-4 right-4 text-[var(--color-text-inverse)] text-sm text-center opacity-75">
                <p>Click anywhere or press ESC to close</p>
                {format && estimatedSize && (
                  <p className="text-xs mt-1">
                    {format.toUpperCase()} • {Math.round(estimatedSize / 1024)}KB • {width}×{height}
                    px
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </>
  );
};

/**
 * Convenience component for medical images with attribution
 */
export const MedicalImage: React.FC<EnhancedOptimizedImageProps & { attribution?: string }> = ({
  attribution,
  ...props
}) => {
  return (
    <figure className="space-y-2">
      <EnhancedOptimizedImage {...props} />
      {attribution && (
        <figcaption className="text-xs text-[var(--color-text-muted)] text-center">
          {attribution}
        </figcaption>
      )}
    </figure>
  );
};

/**
 * Image gallery component
 */
export const ImageGallery: React.FC<{
  images: Array<{ src: string; alt: string; attribution?: string }>;
  columns?: number;
  gap?: number;
}> = ({ images, columns = 3, gap = 4 }) => {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap * 0.25}rem`,
      }}
    >
      {images.map((image, index) => (
        <MedicalImage
          key={index}
          src={image.src}
          alt={image.alt}
          attribution={image.attribution}
          maxWidth={800}
          lazy={true}
          responsive={true}
          enableZoom={true}
        />
      ))}
    </div>
  );
};

export default EnhancedOptimizedImage;
