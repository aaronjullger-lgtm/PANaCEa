import React, { useCallback, useRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { feedback } from '@/services/core/feedbackService';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent'
  | 'inverse';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Alias for loading (compatibility with SemanticButton) */
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  /** Alias for leftIcon (compatibility with StandardButton) */
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Alias for rightIcon (compatibility with PrimaryButton) */
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
  /** Trigger selection haptic on press (for important CTAs) */
  hapticOnPress?: boolean;
  /** Track latency for telemetry (FSRS v6 integration) */
  trackLatency?: boolean;
  /** Optional identifier for latency tracking */
  buttonId?: string;
}

// =============================================================================
// LATENCY TRACKING HOOK
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

      // Log to telemetry pipeline
      if (typeof window !== 'undefined' && (window as any).__PANACEA_TELEMETRY__) {
        (window as any).__PANACEA_TELEMETRY__.track('button_latency', {
          buttonId,
          latencyMs: metricsRef.current.latencyMs,
          timestamp: new Date().toISOString(),
        });
      }

      // Store in sessionStorage for FSRS analysis
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
// STYLE DEFINITIONS (CSS Variables – Stormy Slate Design System)
// =============================================================================

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs min-h-[32px]',
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2 text-sm min-h-[44px]',
  lg: 'px-6 py-3 text-base min-h-[48px]',
  xl: 'px-8 py-4 text-lg min-h-[52px]',
};

const variantClasses: Record<ButtonVariant, { base: string; hover: string; disabled: string }> = {
  primary: {
    base: 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-2 border-[var(--color-accent-border,var(--color-accent-hover))]',
    hover:
      'hover:bg-[var(--color-accent)]/90 hover:border-[var(--color-accent-border,var(--color-accent-hover))]/90 active:bg-[var(--color-accent)]/80',
    disabled:
      'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  secondary: {
    base: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)]',
    hover:
      'hover:bg-[var(--color-bg-tertiary)]/80 hover:border-[var(--color-border-strong)] active:bg-[var(--color-bg-tertiary)]/70',
    disabled:
      'disabled:bg-[var(--color-bg-tertiary)]/50 disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  outline: {
    base: 'bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border)]',
    hover:
      'hover:bg-[var(--color-bg-tertiary)]/50 hover:border-[var(--color-accent)] active:bg-[var(--color-bg-tertiary)]/40',
    disabled:
      'disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  ghost: {
    base: 'bg-transparent text-[var(--color-text-primary)] border border-transparent',
    hover: 'hover:bg-[var(--color-bg-tertiary)]/50 active:bg-[var(--color-bg-tertiary)]/40',
    disabled: 'disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed',
  },
  success: {
    base: 'bg-[var(--color-data-pass)] text-[var(--color-text-inverse)] border border-[var(--color-data-pass)]',
    hover:
      'hover:bg-[var(--color-data-pass)]/90 hover:border-[var(--color-data-pass)]/90 active:bg-[var(--color-data-pass)]/80',
    disabled:
      'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  warning: {
    base: 'bg-[var(--color-data-provisional)] text-[var(--color-text-inverse)] border border-[var(--color-data-provisional)]',
    hover:
      'hover:bg-[var(--color-data-provisional)]/90 hover:border-[var(--color-data-provisional)]/90 active:bg-[var(--color-data-provisional)]/80',
    disabled:
      'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  danger: {
    base: 'bg-[var(--color-data-fail)] text-[var(--color-text-inverse)] border border-[var(--color-data-fail)]',
    hover:
      'hover:bg-[var(--color-data-fail)]/90 hover:border-[var(--color-data-fail)]/90 active:bg-[var(--color-data-fail)]/80',
    disabled:
      'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  accent: {
    base: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30',
    hover:
      'hover:bg-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/50 active:bg-[var(--color-accent)]/30',
    disabled:
      'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  inverse: {
    base: 'bg-[var(--color-text-inverse)] text-[var(--color-bg-primary)] border border-[var(--color-text-inverse)]',
    hover:
      'hover:bg-[var(--color-text-inverse)]/90 hover:border-[var(--color-text-inverse)]/90 active:bg-[var(--color-text-inverse)]/80',
    disabled:
      'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
};

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  isLoading,
  leftIcon,
  icon,
  rightIcon,
  iconRight,
  children,
  hapticOnPress = false,
  trackLatency = false,
  buttonId,
  className = '',
  disabled,
  onClick,
  ...props
}) => {
  const id = buttonId || `btn-${variant}-${size}`;
  const { trackClick } = useButtonLatency(id);

  const resolvedLeftIcon = leftIcon ?? icon;
  const resolvedRightIcon = rightIcon ?? iconRight;
  const resolvedLoading = isLoading ?? loading;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (trackLatency) {
        trackClick();
      }
      if (hapticOnPress && !disabled && !resolvedLoading) {
        feedback.selection();
      }
      onClick?.(e);
    },
    [trackLatency, trackClick, hapticOnPress, disabled, resolvedLoading, onClick]
  );

  const variantConfig = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  const isDisabled = disabled || resolvedLoading;

  const baseClasses = [
    'inline-flex items-center justify-center gap-2',
    'font-medium rounded-lg',
    'transition-all duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2',
    'cursor-pointer select-none',
    fullWidth ? 'w-full' : '',
    sizeClass,
    variantConfig.base,
    variantConfig.hover,
    variantConfig.disabled,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Determine icon size based on button size
  const getIconSize = (): string => {
    if (size === 'xs' || size === 'sm') return 'w-4 h-4';
    if (size === 'lg' || size === 'xl') return 'w-6 h-6';
    return 'w-5 h-5';
  };

  return (
    <motion.button
      className={baseClasses}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      onClick={handleClick}
      aria-busy={resolvedLoading}
      {...props}
    >
      {resolvedLoading ? (
        <Loader2 className={`${getIconSize()} animate-spin`} aria-hidden="true" />
      ) : (
        <>
          {resolvedLeftIcon && <span className="flex-shrink-0">{resolvedLeftIcon}</span>}
          {children != null && <span className="truncate">{children}</span>}
          {resolvedRightIcon && <span className="flex-shrink-0">{resolvedRightIcon}</span>}
        </>
      )}
    </motion.button>
  );
};

// =============================================================================
// CONVENIENCE COMPONENTS (re‑exports for backward compatibility)
// =============================================================================

export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
);

export const OutlineButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="outline" {...props} />
);

export const SuccessButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="success" {...props} />
);

export const WarningButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="warning" {...props} />
);

export const DangerButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="danger" {...props} />
);

export const GhostButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="ghost" {...props} />
);

export const AccentButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="accent" {...props} />
);

export const InverseButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="inverse" {...props} />
);

// SemanticButton alias (for compatibility with existing imports)
export const SemanticButton: React.FC<Omit<ButtonProps, 'variant'> & { isLoading?: boolean }> = ({
  isLoading,
  loading,
  ...props
}) => <Button loading={isLoading ?? loading} variant="secondary" {...props} />;

// StartSessionButton (hero CTA)
export const StartSessionButton: React.FC<Omit<ButtonProps, 'variant' | 'size'>> = (props) => (
  <Button variant="primary" size="xl" fullWidth buttonId="start-main-session" {...props} />
);

// ActionButton (secondary actions)
export const ActionButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
);

export default Button;