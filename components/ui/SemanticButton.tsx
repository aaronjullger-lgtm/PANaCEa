/**
 * SemanticButton.tsx
 *
 * Clinical Precision Design System - Semantic Button Component
 *
 * Design Philosophy:
 * - Medical students need "Aesthetic Monotony" - low-contrast, predictable UI
 * - Color is reserved ONLY for data (red=forgot, green=good) and alerts
 * - Buttons are defined by FUNCTION, not marketing appeal
 *
 * Variants:
 * - primary: High-contrast white on slate - THE hero CTA (Start Session)
 * - secondary: Glassmorphism slate - All other actions
 * - success: Teal - Only for confirmed positive states
 * - danger: Red - Only for destructive actions
 * - ghost: Transparent - Navigation/subtle actions
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// =============================================================================
// TELEMETRY HOOK - Captures time_to_first_click for FSRS v6 integration
// =============================================================================

interface LatencyMetrics {
  componentRenderTime: number;
  firstInteractionTime: number | null;
  latencyMs: number | null;
}

function useButtonLatency(buttonId: string) {
  const renderTimeRef = useRef<number>(performance.now());
  const metricsRef = useRef<LatencyMetrics>({
    componentRenderTime: renderTimeRef.current,
    firstInteractionTime: null,
    latencyMs: null,
  });

  const trackClick = useCallback(() => {
    if (metricsRef.current.firstInteractionTime === null) {
      const now = performance.now();
      metricsRef.current.firstInteractionTime = now;
      metricsRef.current.latencyMs = now - metricsRef.current.componentRenderTime;

      // Log to telemetry pipeline (integrate with existing useTelemetry hook)
      if (typeof window !== 'undefined' && (window as any).__PANACEA_TELEMETRY__) {
        (window as any).__PANACEA_TELEMETRY__.track('button_latency', {
          buttonId,
          latencyMs: metricsRef.current.latencyMs,
          timestamp: new Date().toISOString(),
        });
      }

      // Also store in sessionStorage for FSRS analysis
      try {
        const existing = sessionStorage.getItem('panacea_button_latencies');
        const latencies = existing ? JSON.parse(existing) : [];
        latencies.push({
          buttonId,
          latencyMs: metricsRef.current.latencyMs,
          timestamp: Date.now(),
        });
        // Keep only last 100 entries
        if (latencies.length > 100) latencies.shift();
        sessionStorage.setItem('panacea_button_latencies', JSON.stringify(latencies));
      } catch (e) {
        // Ignore storage errors
      }
    }
    return metricsRef.current.latencyMs;
  }, [buttonId]);

  return { trackClick, metrics: metricsRef.current };
}

// =============================================================================
// BUTTON VARIANTS - Stormy Slate Design System
// =============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const variantStyles: Record<ButtonVariant, string> = {
  // Primary: High-contrast white on deep navy - THE hero CTA
  primary: `
    bg-slate-100 text-slate-900
    hover:bg-white hover:shadow-lg hover:shadow-slate-100/20
    active:bg-slate-200
    border border-slate-200
    font-semibold
  `,

  // Secondary: Glassmorphism slate - All other actions
  secondary: `
    bg-slate-800/60 backdrop-blur-sm text-slate-100
    hover:bg-slate-700/70 hover:text-white
    active:bg-slate-700
    border border-slate-600/50
    font-medium
  `,

  // Success: Teal - Only for confirmed positive states
  success: `
    bg-teal-600/90 text-white
    hover:bg-teal-500
    active:bg-teal-600
    border border-teal-500/50
    font-semibold
  `,

  // Danger: Red - Only for destructive actions
  danger: `
    bg-red-600/90 text-white
    hover:bg-red-500
    active:bg-red-600
    border border-red-500/50
    font-semibold
  `,

  // Ghost: Transparent - Navigation/subtle actions
  ghost: `
    bg-transparent text-slate-300
    hover:bg-slate-800/50 hover:text-slate-100
    active:bg-slate-700/50
    border border-transparent
    font-medium
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] min-w-[44px] px-3 py-2.5 text-sm rounded-lg gap-1.5',
  md: 'min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'min-h-[44px] px-6 py-3.5 text-base rounded-xl gap-2.5',
  xl: 'min-h-[44px] px-8 py-4 text-lg rounded-2xl gap-3',
};

// =============================================================================
// SEMANTIC BUTTON COMPONENT
// =============================================================================

interface SemanticButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  trackLatency?: boolean;
  buttonId?: string;
}

export function SemanticButton({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  trackLatency = true,
  buttonId,
  children,
  className = '',
  onClick,
  disabled,
  ...props
}: SemanticButtonProps) {
  const id = buttonId || `btn-${variant}-${size}`;
  const { trackClick } = useButtonLatency(id);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (trackLatency) {
        trackClick();
      }
      onClick?.(e);
    },
    [onClick, trackClick, trackLatency]
  );

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center cursor-pointer
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size={size} />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </motion.button>
  );
}

// =============================================================================
// LOADING SPINNER
// =============================================================================

function LoadingSpinner({ size }: { size: ButtonSize }) {
  const spinnerSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
  }[size];

  return (
    <div
      className={`${spinnerSize} border-2 border-current/30 border-t-current rounded-full animate-spin`}
    />
  );
}

// =============================================================================
// CONVENIENCE COMPONENTS
// =============================================================================

/**
 * StartSessionButton - The hero CTA for Main Session
 * Uses primary variant with high contrast
 */
export function StartSessionButton({
  children = 'Start Main Session',
  ...props
}: Omit<SemanticButtonProps, 'variant'>) {
  return (
    <SemanticButton variant="primary" size="xl" fullWidth buttonId="start-main-session" {...props}>
      {children}
    </SemanticButton>
  );
}

/**
 * ActionButton - For secondary actions (drills, tools, etc.)
 */
export function ActionButton(props: Omit<SemanticButtonProps, 'variant'>) {
  return <SemanticButton variant="secondary" {...props} />;
}

/**
 * GhostButton - For navigation and subtle actions
 */
export function GhostButton(props: Omit<SemanticButtonProps, 'variant'>) {
  return <SemanticButton variant="ghost" {...props} />;
}

export default SemanticButton;
