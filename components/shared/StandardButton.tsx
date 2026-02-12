import React from 'react';
import { motion } from 'framer-motion';

export type ButtonVariant = 
  | 'primary'      // Main action buttons (accent color)
  | 'secondary'    // Secondary actions (bg-tertiary)
  | 'outline'      // Border-only buttons
  | 'ghost'        // Minimal buttons (text only)
  | 'success'      // Positive actions (data-pass)
  | 'warning'      // Cautionary actions (data-provisional)
  | 'danger'       // Destructive actions (data-fail)
  | 'accent'       // Alternative accent (color-accent)
  | 'inverse';     // For dark backgrounds

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface StandardButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

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
    hover: 'hover:bg-[var(--color-accent)]/90 hover:border-[var(--color-accent-border,var(--color-accent-hover))]/90 active:bg-[var(--color-accent)]/80',
    disabled: 'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  secondary: {
    base: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)]',
    hover: 'hover:bg-[var(--color-bg-tertiary)]/80 hover:border-[var(--color-border-strong)] active:bg-[var(--color-bg-tertiary)]/70',
    disabled: 'disabled:bg-[var(--color-bg-tertiary)]/50 disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  outline: {
    base: 'bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border)]',
    hover: 'hover:bg-[var(--color-bg-tertiary)]/50 hover:border-[var(--color-accent)] active:bg-[var(--color-bg-tertiary)]/40',
    disabled: 'disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  ghost: {
    base: 'bg-transparent text-[var(--color-text-primary)] border border-transparent',
    hover: 'hover:bg-[var(--color-bg-tertiary)]/50 active:bg-[var(--color-bg-tertiary)]/40',
    disabled: 'disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed',
  },
  success: {
    base: 'bg-[var(--color-data-pass)] text-[var(--color-text-inverse)] border border-[var(--color-data-pass)]',
    hover: 'hover:bg-[var(--color-data-pass)]/90 hover:border-[var(--color-data-pass)]/90 active:bg-[var(--color-data-pass)]/80',
    disabled: 'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  warning: {
    base: 'bg-[var(--color-data-provisional)] text-[var(--color-text-inverse)] border border-[var(--color-data-provisional)]',
    hover: 'hover:bg-[var(--color-data-provisional)]/90 hover:border-[var(--color-data-provisional)]/90 active:bg-[var(--color-data-provisional)]/80',
    disabled: 'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  danger: {
    base: 'bg-[var(--color-data-fail)] text-[var(--color-text-inverse)] border border-[var(--color-data-fail)]',
    hover: 'hover:bg-[var(--color-data-fail)]/90 hover:border-[var(--color-data-fail)]/90 active:bg-[var(--color-data-fail)]/80',
    disabled: 'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  accent: {
    base: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30',
    hover: 'hover:bg-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/50 active:bg-[var(--color-accent)]/30',
    disabled: 'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
  inverse: {
    base: 'bg-[var(--color-text-inverse)] text-[var(--color-bg-primary)] border border-[var(--color-text-inverse)]',
    hover: 'hover:bg-[var(--color-text-inverse)]/90 hover:border-[var(--color-text-inverse)]/90 active:bg-[var(--color-text-inverse)]/80',
    disabled: 'disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-muted)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed',
  },
};

export const StandardButton: React.FC<StandardButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantConfig = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  
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
  ].filter(Boolean).join(' ');

  const isDisabled = disabled || loading;

  return (
    <motion.button
      className={baseClasses}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      {...props}
    >
      {loading && (
        <svg
          className="w-4 h-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      <span className="truncate">{children}</span>
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </motion.button>
  );
};

// Convenience components for common button types
export const PrimaryButton: React.FC<Omit<StandardButtonProps, 'variant'>> = (props) => (
  <StandardButton variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<StandardButtonProps, 'variant'>> = (props) => (
  <StandardButton variant="secondary" {...props} />
);

export const OutlineButton: React.FC<Omit<StandardButtonProps, 'variant'>> = (props) => (
  <StandardButton variant="outline" {...props} />
);

export const SuccessButton: React.FC<Omit<StandardButtonProps, 'variant'>> = (props) => (
  <StandardButton variant="success" {...props} />
);

export const DangerButton: React.FC<Omit<StandardButtonProps, 'variant'>> = (props) => (
  <StandardButton variant="danger" {...props} />
);

export const WarningButton: React.FC<Omit<StandardButtonProps, 'variant'>> = (props) => (
  <StandardButton variant="warning" {...props} />
);