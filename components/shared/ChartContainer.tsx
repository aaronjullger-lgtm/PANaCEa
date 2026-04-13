/**
 * ChartContainer – prevents Recharts "width(-1) and height(-1)" warning
 * by only rendering children when the container has positive dimensions.
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { springs, skeletonLineVariants } from '@/config/appViews';

export interface ChartContainerProps {
  /** Minimum height so the container gets layout before first paint */
  minHeight?: number;
  /** Minimum width (default 0 for flex children) */
  minWidth?: number;
  /** Optional class for the wrapper */
  className?: string;
  /** Chart content (e.g. ResponsiveContainer) */
  children: React.ReactNode;
  /** Optional loading state to show until dimensions are ready */
  fallback?: React.ReactNode;
  /** Optional aria-hidden for decorative charts */
  'aria-hidden'?: boolean;
}

/**
 * Wraps a Recharts ResponsiveContainer so it only mounts when the parent
 * has positive width/height, avoiding "The width(-1) and height(-1) of chart
 * should be greater than 0" warning.
 */
export const ChartContainer: React.FC<ChartContainerProps> = ({
  minHeight = 200,
  minWidth = 0,
  className = '',
  children,
  fallback,
  'aria-hidden': ariaHidden,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const { width, height } = el.getBoundingClientRect();
      setReady((prev) => {
        const nowReady = width > 0 && height > 0;
        return nowReady ? true : prev;
      });
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        minHeight: `${minHeight}px`,
        minWidth: minWidth > 0 ? `${minWidth}px` : undefined,
        width: '100%',
      }}
      {...(ariaHidden === true ? { 'aria-hidden': true } : {})}
    >
      {ready
        ? children
        : (fallback ?? (
          <div style={{ height: minHeight, minHeight }} aria-hidden className="relative overflow-hidden">
            {/* Cinematic chart skeleton — staggered bar placeholders with shimmer */}
            <div className="absolute inset-0 flex items-end justify-around gap-2 px-6 pb-6 pt-10">
              {[0.4, 0.65, 0.35, 0.8, 0.55, 0.7, 0.45, 0.6].map((h, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={skeletonLineVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex-1 rounded-t-md bg-[var(--color-bg-tertiary)] animate-pulse"
                  style={{ height: `${h * 100}%`, maxWidth: 32 }}
                />
              ))}
            </div>
            {/* Axis lines */}
            <div className="absolute bottom-5 left-5 right-5 h-px bg-[var(--color-border)]" />
            <div className="absolute top-8 bottom-5 left-5 w-px bg-[var(--color-border)]" />
            {/* Shimmer overlay */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(196, 183, 138, 0.04) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
              }}
              animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', repeatDelay: 0.6 }}
            />
          </div>
        ))}
    </div>
  );
};

export default ChartContainer;
