/**
 * Image Optimization Utilities
 * 
 * Provides lazy loading, placeholder generation, and progressive image loading
 * for improved performance and user experience.
 */

/**
 * Generate a blur placeholder data URL for an image
 * This creates a tiny, blurred version of an image that can be shown while loading
 * 
 * @param width - Width of the placeholder
 * @param height - Height of the placeholder
 * @param color - Base color for the placeholder (default: gray)
 * @returns Data URL for the blur placeholder
 */
export function generateBlurPlaceholder(
  width: number = 10,
  height: number = 10,
  color: string = '#94a3b8'
): string {
  // Create a simple SVG blur placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="blur">
          <feGaussianBlur stdDeviation="2"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="${color}" filter="url(#blur)"/>
    </svg>
  `;
  
  // Encode to base64 data URL
  const encoded = btoa(svg);
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * Intersection Observer based lazy loading hook
 * This can be used with React refs to trigger image loading when visible
 * 
 * @param threshold - Visibility threshold (0-1) to trigger loading
 * @param rootMargin - Margin around viewport to preload images
 * @returns Function to observe an element
 */
export function createLazyLoader(
  threshold: number = 0.1,
  rootMargin: string = '50px'
): IntersectionObserver | null {
  // Check if IntersectionObserver is supported
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }
  
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
          }
          
          // Stop observing once loaded
          if (entry.target instanceof Element) {
            img.classList.add('loaded');
          }
        }
      });
    },
    {
      threshold,
      rootMargin,
    }
  );
}

/**
 * Preload an image in the background
 * Useful for preloading images that will be shown soon
 * 
 * @param src - Image source URL
 * @returns Promise that resolves when image is loaded
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images
 * 
 * @param sources - Array of image URLs to preload
 * @returns Promise that resolves when all images are loaded
 */
export function preloadImages(sources: string[]): Promise<void[]> {
  return Promise.all(sources.map(preloadImage));
}

/**
 * Check if an image URL is valid and accessible
 * 
 * @param url - Image URL to check
 * @returns Promise that resolves to true if image is valid
 */
export async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    await preloadImage(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate responsive image srcset for different screen sizes
 * Useful for optimizing image delivery based on device
 * 
 * @param baseUrl - Base image URL (should support width parameter)
 * @param widths - Array of widths to generate
 * @returns srcset string
 */
export function generateSrcSet(baseUrl: string, widths: number[] = [320, 640, 960, 1280, 1920]): string {
  return widths
    .map((width) => {
      // Assuming URL supports ?w=width parameter
      const url = baseUrl.includes('?') 
        ? `${baseUrl}&w=${width}` 
        : `${baseUrl}?w=${width}`;
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Calculate the aspect ratio of an image
 * Useful for maintaining aspect ratio during loading
 * 
 * @param width - Image width
 * @param height - Image height
 * @returns Aspect ratio as percentage (for padding-bottom trick)
 */
export function calculateAspectRatio(width: number, height: number): string {
  return `${(height / width) * 100}%`;
}

/**
 * Create a progressive image loading component props
 * This returns props that can be spread onto an img element
 * 
 * @param src - Image source
 * @param alt - Alt text
 * @param options - Additional options
 * @returns Props object for img element
 */
export function createProgressiveImageProps(
  src: string,
  alt: string,
  options: {
    placeholder?: string;
    className?: string;
    width?: number;
    height?: number;
    sizes?: string;
  } = {}
): {
  'data-src': string;
  src: string;
  alt: string;
  className: string;
  loading: 'lazy';
  decoding: 'async';
  width?: number;
  height?: number;
  sizes?: string;
} {
  const { placeholder, className = '', width, height, sizes } = options;
  
  return {
    'data-src': src,
    src: placeholder || generateBlurPlaceholder(),
    alt,
    className: `${className} progressive-image`,
    loading: 'lazy',
    decoding: 'async',
    ...(width && { width }),
    ...(height && { height }),
    ...(sizes && { sizes }),
  };
}

/**
 * Optimize image loading by implementing priority queues
 * Critical images load first, others load when idle
 */
export class ImageLoadingQueue {
  private criticalQueue: string[] = [];
  private normalQueue: string[] = [];
  private isProcessing: boolean = false;
  
  /**
   * Add image to critical queue (loads immediately)
   */
  addCritical(src: string): void {
    if (!this.criticalQueue.includes(src) && !this.normalQueue.includes(src)) {
      this.criticalQueue.push(src);
      this.processQueue();
    }
  }
  
  /**
   * Add image to normal queue (loads when idle)
   */
  addNormal(src: string): void {
    if (!this.criticalQueue.includes(src) && !this.normalQueue.includes(src)) {
      this.normalQueue.push(src);
      this.processQueue();
    }
  }
  
  /**
   * Process the loading queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    // Load critical images first
    while (this.criticalQueue.length > 0) {
      const src = this.criticalQueue.shift();
      if (src) {
        try {
          await preloadImage(src);
        } catch (error) {
          console.warn(`Failed to load critical image: ${src}`, error);
        }
      }
    }
    
    // Load normal images when idle
    if ('requestIdleCallback' in window) {
      this.processNormalQueue();
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => this.processNormalQueue(), 100);
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Process normal queue during idle time
   */
  private processNormalQueue(): void {
    const processNext = () => {
      if (this.normalQueue.length === 0) return;
      
      const src = this.normalQueue.shift();
      if (src) {
        preloadImage(src)
          .catch((error) => console.warn(`Failed to load image: ${src}`, error))
          .finally(() => {
            if (this.normalQueue.length > 0) {
              if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(processNext);
              } else {
                setTimeout(processNext, 50);
              }
            }
          });
      }
    };
    
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(processNext);
    } else {
      setTimeout(processNext, 50);
    }
  }
  
  /**
   * Clear all queues
   */
  clear(): void {
    this.criticalQueue = [];
    this.normalQueue = [];
  }
  
  /**
   * Get queue status
   */
  getStatus(): { critical: number; normal: number; processing: boolean } {
    return {
      critical: this.criticalQueue.length,
      normal: this.normalQueue.length,
      processing: this.isProcessing,
    };
  }
}

// Export a singleton instance for global use
export const globalImageQueue = new ImageLoadingQueue();
