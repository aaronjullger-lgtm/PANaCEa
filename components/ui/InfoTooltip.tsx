/**
 * InfoTooltip — Accessible hover/focus tooltip for AI-derived scores.
 *
 * Renders a small info icon (ⓘ) that reveals explanatory text on
 * hover or keyboard focus. Uses CSS-only positioning for zero JS overhead.
 *
 * @see lib/constants/copy.ts — tooltip text constants
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  /** Tooltip text content */
  text: string;
  /** Size of the info icon in pixels */
  size?: number;
  /** Optional className for the wrapper */
  className?: string;
}

export function InfoTooltip({ text, size = 14, className = '' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVisible(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isVisible]);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] p-0.5"
        aria-label="More information"
        aria-describedby={isVisible ? 'info-tooltip-content' : undefined}
      >
        <Info
          style={{ width: size, height: size, color: 'var(--color-text-muted)' }}
          aria-hidden="true"
        />
      </button>

      {isVisible && (
        <div
          ref={tooltipRef}
          id="info-tooltip-content"
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs leading-relaxed rounded-lg shadow-lg border max-w-[260px] w-max pointer-events-none"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {text}
          {/* Arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
              marginTop: '-4px',
            }}
          />
        </div>
      )}
    </span>
  );
}

export default InfoTooltip;
