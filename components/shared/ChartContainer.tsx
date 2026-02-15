/**
 * ChartContainer – prevents Recharts "width(-1) and height(-1)" warning
 * by only rendering children when the container has positive dimensions.
 */

import React, { useRef, useState, useEffect } from 'react';

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
        : (fallback ?? <div style={{ height: minHeight, minHeight }} aria-hidden />)}
    </div>
  );
};

export default ChartContainer;
