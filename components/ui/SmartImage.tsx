/**
 * SmartImage Component
 * 
 * A performant, accessible image component with:
 * - Lazy loading (Intersection Observer)
 * - Blur-up skeleton loader
 * - Graceful error fallback
 * - Aspect ratio preservation
 * 
 * Use for medical images (X-rays, CTs, dermoscopy) throughout the app.
 */

import React, { useState, useRef, useEffect, ImgHTMLAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageOff, Loader2 } from 'lucide-react';

export interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Aspect ratio (e.g., '16/9', '4/3', '1/1') - defaults to auto */
  aspectRatio?: string;
  /** Enable blur-up loading effect */
  blurUp?: boolean;
  /** Custom fallback component or element */
  fallback?: React.ReactNode;
  /** Show loading spinner */
  showLoader?: boolean;
  /** Callback when image loads successfully */
  onLoadSuccess?: () => void;
  /** Callback when image fails to load */
  onLoadError?: (error: Error) => void;
  /** Container className */
  containerClassName?: string;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  aspectRatio,
  blurUp = true,
  fallback,
  showLoader = true,
  onLoadSuccess,
  onLoadError,
  containerClassName = '',
  className = '',
  ...imgProps
}) => {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.01,
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Start loading when in view
  useEffect(() => {
    if (!isInView || !src) return;

    setLoadState('loading');

    // Preload image
    const img = new Image();
    img.src = src;

    img.onload = () => {
      setLoadState('loaded');
      onLoadSuccess?.();
    };

    img.onerror = () => {
      setLoadState('error');
      onLoadError?.(new Error(`Failed to load image: ${src}`));
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, src, onLoadSuccess, onLoadError]);

  const aspectRatioStyle = aspectRatio
    ? { aspectRatio }
    : {};

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800 ${containerClassName}`}
      style={aspectRatioStyle}
    >
      <AnimatePresence mode="wait">
        {/* Loading State */}
        {(loadState === 'idle' || loadState === 'loading') && (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Skeleton / Blur-up effect */}
            {blurUp && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800" />
            )}
            
            {/* Loading spinner */}
            {showLoader && loadState === 'loading' && (
              <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin z-10" />
            )}
          </motion.div>
        )}

        {/* Loaded Image */}
        {loadState === 'loaded' && (
          <motion.img
            key="image"
            ref={imgRef}
            src={src}
            alt={alt}
            initial={{ opacity: 0, scale: blurUp ? 1.05 : 1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`w-full h-full object-cover ${className}`}
            loading="lazy"
            {...imgProps}
          />
        )}

        {/* Error State */}
        {loadState === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500"
          >
            {fallback || (
              <>
                <ImageOff className="w-10 h-10" />
                <span className="text-xs text-center px-2">Image unavailable</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * SmartImage with zoom capability for medical imaging
 */
export const ZoomableImage: React.FC<SmartImageProps & { enableZoom?: boolean }> = ({
  enableZoom = true,
  ...props
}) => {
  const [isZoomed, setIsZoomed] = useState(false);

  if (!enableZoom) {
    return <SmartImage {...props} />;
  }

  return (
    <>
      <button
        onClick={() => setIsZoomed(true)}
        className="w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg overflow-hidden"
        aria-label={`View ${props.alt} in full screen`}
      >
        <SmartImage {...props} />
      </button>

      {/* Full-screen zoom modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsZoomed(false)}
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-zoom-out p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Zoomed view of ${props.alt}`}
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              src={props.src}
              alt={props.alt}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              aria-label="Close zoomed view"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SmartImage;
